import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL??'http://127.0.0.1:5181/';
const out=new URL('../node_modules/.cache/prepared-shadows/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();let body=await response.text();
  body=body.replace('const preparedShadows = new WorldShadows(scene, coaster);',`window.originalShadows=[];scene.traverse(o=>window.originalShadows.push({o,cast:o.castShadow,visible:o.visible}));window.shadowSetupStart=performance.now();const preparedShadows = new WorldShadows(scene, coaster);`);
  body=body.replace('const worldMatrices = new StaticWorldMatrices(scene);','window.shadowSetupMs=performance.now()-window.shadowSetupStart;const worldMatrices = new StaticWorldMatrices(scene);');
  body+='\nwindow.shadowView={scene,camera,renderer,shadows,celestialLighting,preparedShadows,coaster,boats,treehouse,bread,updateTreeShadows,updateSky,get c(){return character}};';
  await route.fulfill({response,body});
 });
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Тени');await page.locator('#start-game').click();
 await page.waitForFunction(()=>window.shadowView?.c,null,{timeout:180000});await page.waitForTimeout(500);
 const inventory=await page.evaluate(async()=>{
  const t=window.shadowView;t.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.display='none');
  const {isCharacterShadow}=await import('/src/prepared-shadows.ts');let live=0,forbidden=[],grass=0,staticInstances=0;
  t.scene.traverse(o=>{if(o.isMesh&&o.castShadow){live++;if(!isCharacterShadow(o))forbidden.push(o.name);}if(o.name==='Prepared grass cell')grass+=o.count;if(o.name==='Prepared scenery cell')staticInstances+=o.count;});
  return {...t.preparedShadows.inventory,live,forbidden,grass,staticInstances,setupMs:window.shadowSetupMs,originalCaptured:window.originalShadows?.length??0};
 });
 assert.equal(inventory.forbidden.length,0,'Only character/NPC meshes may enter ordinary shadow maps');
 assert(inventory.grass>1000);assert(inventory.staticInstances>1000);assert(inventory.moving>80);assert(inventory.originalCaptured>0);
 const shrub=await page.evaluate(()=>window.shadowView.scene.getObjectByName('Biome meadow details').userData.sites.find(s=>s.kind==='bush'&&Math.hypot(s.x,s.z)<60));
 const rows=[];
 for(const [name,eye,look,phase] of [
  ['meadow',[8,9,22],[0,0,0],.25],['oak',[156,18,78],[135,6,39],.25],
  ['flowers',[22,8,-47],[10,1,-70],.25],['mill',[94,12,85],[75,3,56],.25],
  ['home',[154,10,159],[135,2,135],.25],['maze',[-70,48,146],[-94,0,94],.25],['rails',[228,18,65],[222,5,30],.25],
  ['night',[156,18,78],[135,6,39],.75],['shrub',[shrub.x+3,3,shrub.z+5],[shrub.x,0,shrub.z],.25],
 ]){
  const row=await page.evaluate(async({eye,look,phase})=>{
   const t=window.shadowView,{daylight}=await import('/src/day-cycle.ts'),light=daylight(phase);
   t.camera.position.fromArray(eye);t.camera.lookAt(...look);t.camera.updateMatrixWorld();
   t.celestialLighting.update(light);t.updateTreeShadows(light);t.updateSky(0,t.camera,light);t.shadows.update();t.preparedShadows.update(light,t.camera.position);t.renderer.toneMappingExposure=1+light.day*.2;
   const gl=t.renderer.getContext();
   const sample=async()=>{const times=[];let counts;for(let i=0;i<28;i++){await new Promise(requestAnimationFrame);t.renderer.info.reset();const at=performance.now();t.renderer.render(t.scene,t.camera);gl.finish();if(i>=8)times.push(performance.now()-at);counts={...t.renderer.info.render};}return {ms:times.sort((a,b)=>a-b)[Math.floor(times.length/2)],calls:counts.calls,triangles:counts.triangles};};
   const prepared=await sample();t.preparedShadows.grass.visible=false;const withoutGrass=await sample();t.preparedShadows.grass.visible=true;
   const preparedAfter=await sample(),states=window.originalShadows.map(({o})=>({o,cast:o.castShadow,visible:o.visible}));
   const {skipShadowOnlyColourPass}=await import('/src/scenery-shadows.ts');
   for(const {o,cast,visible} of window.originalShadows){o.castShadow=cast;o.visible=visible;if(o.isMesh)skipShadowOnlyColourPass(o);}
   t.preparedShadows.group.visible=false;const original=await sample();
   for(const {o,cast,visible} of states){o.castShadow=cast;o.visible=visible;}t.preparedShadows.group.visible=true;t.renderer.render(t.scene,t.camera);
   return {prepared,withoutGrass,preparedAfter,original,stable:Math.abs(prepared.ms-preparedAfter.ms)/Math.max(prepared.ms,preparedAfter.ms)<.15};
  },{eye,look,phase});rows.push({name,...row});await page.screenshot({path:new URL(name+'.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 }
 // Check the prepared layer alone: unrelated scenery LODs and character
 // shadow maps are deliberately excluded from this stability assertion.
 await page.evaluate(()=>{
  const t=window.shadowView;t.stabilityState=t.scene.children.map(o=>({o,visible:o.visible}));t.stabilityBackground=t.scene.background.clone();
  for(const o of t.scene.children)o.visible=o===t.preparedShadows.group;
  t.scene.background.set('#ffffff');for(let i=0;i<10;i++)t.renderer.render(t.scene,t.camera);
 });
 const first=await page.screenshot();await page.evaluate(()=>{const t=window.shadowView;for(let i=0;i<10;i++)t.renderer.render(t.scene,t.camera);});
 const repeated=await page.screenshot();await writeFile(new URL('stationary-first.png',out),first);await writeFile(new URL('stationary-repeated.png',out),repeated);
 const stationary=await page.evaluate(async images=>{
  const pixels=[];
  for(const data of images){const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);pixels.push(ctx.getImageData(0,0,img.width,img.height).data);}
  let changedChannels=0,maxChannelDelta=0;
  for(let i=0;i<pixels[0].length;i++){const delta=Math.abs(pixels[0][i]-pixels[1][i]);if(delta)changedChannels++;maxChannelDelta=Math.max(maxChannelDelta,delta);}
  return {changedChannels,maxChannelDelta,channels:pixels[0].length};
 },[first.toString('base64'),repeated.toString('base64')]);
 await page.evaluate(()=>{const t=window.shadowView;for(const {o,visible} of t.stabilityState)o.visible=visible;t.scene.background.copy(t.stabilityBackground);});
 const moving=await page.evaluate(async()=>{
  const t=window.shadowView,{daylight}=await import('/src/day-cycle.ts'),light=daylight(.25),mesh=t.preparedShadows.group.getObjectByName('Prepared moving object shadows');
  t.preparedShadows.update(light,t.camera.position);const before=[...mesh.instanceMatrix.array];
  t.boats.update(0,40);t.coaster.update(1,t.camera.position);t.treehouse.update(1);t.preparedShadows.update(light,t.camera.position);
  return {changed:before.some((x,i)=>x!==mesh.instanceMatrix.array[i]),casters:mesh.castShadow};
 });
 assert(moving.changed);assert.equal(moving.casters,false);assert.deepEqual(errors,[]);
 const result={inventory,rows,moving,stationary,errors};await writeFile(new URL('report.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 // GPU edge/blending rounding may differ by a single 8-bit step at a handful
 // of pixels. Larger changes or a moving pattern would be visible flicker.
 assert(stationary.maxChannelDelta<=1&&stationary.changedChannels/stationary.channels<.001,'Frozen prepared silhouettes must not flicker between frames');
}finally{await browser.close();}
