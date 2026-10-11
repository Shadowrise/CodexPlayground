// Frozen actual game; compare only this turn's rocks and water plants.
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
import assert from 'node:assert/strict';

const url=process.env.GAME_URL??'http://127.0.0.1:5174/',mobile=process.env.SCENERY_MOBILE==='1';
const out=new URL('../node_modules/.cache/',import.meta.url);await mkdir(out,{recursive:true});
const prefix=new URL('natural-scenery'+(mobile?'-mobile':''),out).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:mobile?{width:844,height:390}:{width:1280,height:800},hasTouch:mobile}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const [file,baseline] of [['landmarks','landmarks-before-plants'],['meadow-decor','meadow-before-water-plants']]){
  const source=await readFile(new URL(baseline+'.ts',out),'utf8'),current=await (await page.request.get(url+'src/'+file+'.ts')).text(),imports=[...current.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
  const old=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>{
   const key=spec.startsWith('./')?'/src/'+spec.slice(2)+'.ts':spec==='three'?'/three.js':spec.split('/').at(-1).replace('.js','__js');
   const path=imports.find(p=>p.includes(key));if(!path)throw Error('Unmapped import '+spec);return 'from '+JSON.stringify(path);
  });
  await page.route('**/src/'+file+'-before.ts',route=>route.fulfill({contentType:'application/javascript',body:old}));
 }
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch(),body=await response.text(),batchUrl=body.match(/import\s*\{\s*configureSceneryBatching\s*\}\s*from\s*['"]([^'"]+)['"]/)[1];
  await route.fulfill({response,body:body+'\nimport {scenerySources as checkScenerySources} from '+JSON.stringify(batchUrl)+';\nwindow.sceneryView={scene,camera,renderer,shadows,celestialLighting,updateTreeShadows,updateSky,setupShadowMaterials,fruits,getSources:checkScenerySources,get c(){return character}};'});
 });
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Кувшинки');await page.locator('#start-game').click();await page.waitForTimeout(200);
 const inventory=await page.evaluate(async()=>{
  const t=window.sceneryView;t.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.display='none');
  const {createLandmarks}=await import('/src/landmarks-before.ts'),{createMeadowDecor}=await import('/src/meadow-decor-before.ts'),{daylight}=await import('/src/day-cycle.ts');
  const forest=t.scene.getObjectByName('Four woodland biomes');t.landmarks=t.scene.getObjectByName('Ponds, flowers, mushrooms, rocks, picnics and ruins');t.meadow=t.scene.getObjectByName('Biome meadow details');
  t.oldLandmarks=createLandmarks(forest.userData.meadowLayout,forest.userData.treePositions);t.oldMeadow=createMeadowDecor(forest.userData.treePositions,forest.userData.meadowLayout);
  if(JSON.stringify(t.oldMeadow.userData.sites)!==JSON.stringify(t.meadow.userData.sites))throw Error('Meadow plant placement changed');
  t.oldLandmarks.visible=t.oldMeadow.visible=false;t.scene.add(t.oldLandmarks,t.oldMeadow);t.oldLandmarks.updateMatrixWorld(true);t.oldMeadow.updateMatrixWorld(true);
  t.meadow.userData.windTime.value=t.oldMeadow.userData.windTime.value=8;
  const m=t.camera.matrix.clone(),zero=t.camera.position.clone().set(0,0,0);
  t.oldMeadow.getObjectByName('Meadow grass').traverse(o=>{if(o.isInstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);if(t.fruits.fruits.some(f=>Math.hypot(m.elements[12]-f.object.position.x,m.elements[14]-f.object.position.z)<2.6)){m.scale(zero);o.setMatrixAt(i,m);}}o.instanceMatrix.needsUpdate=true;}});
  t.setupShadowMaterials();const day=daylight(.25);t.celestialLighting.update(day);t.updateTreeShadows(day);t.updateSky(0,t.camera,day);t.renderer.toneMappingExposure=1+day.day*.2;
  const bytes=root=>{const buffers=new Set();root.traverse(o=>{if(o.isMesh)for(const a of [...Object.values(o.geometry.attributes),o.geometry.index,o.instanceMatrix,o.instanceColor])if(a)buffers.add(a.array.buffer);});return [...buffers].reduce((n,b)=>n+b.byteLength,0);};
  return {placementUnchanged:true,reeds:t.meadow.userData.sites.filter(s=>s.kind==='reeds').length,beforeBytes:bytes(t.oldLandmarks)+bytes(t.oldMeadow),afterBytes:bytes(t.landmarks)+bytes(t.meadow)};
 });
 const rows=[];
 const sites=await page.evaluate(async()=>{const {LANDMARKS}=await import('/src/landmark-sites.ts');return {arch:LANDMARKS.find(p=>p.kind===5),pile:LANDMARKS.find(p=>p.kind===3),pond:LANDMARKS.find(p=>p.kind===0&&p.x>0)};});
 for(const [name,eye,look] of [
  ['arch',[sites.arch.x+11,4,sites.arch.z+14],[sites.arch.x,1.5,sites.arch.z+3]],
  ['pile',[sites.pile.x+11,4,sites.pile.z+12],[sites.pile.x,1,sites.pile.z]],
  ['pond',[sites.pond.x+21,5,sites.pond.z+17],[sites.pond.x,0,sites.pond.z]],
  ['diagonal',[-205,8,-205],[205,8,205]],
 ]){
  const row=await page.evaluate(async({name,eye,look})=>{
   const t=window.sceneryView;t.camera.position.fromArray(eye);t.camera.lookAt(...look);t.camera.updateMatrixWorld();t.c.actor.position.set(eye[0],0,eye[2]);t.shadows.update();
   const sample=async old=>{
    t.oldLandmarks.visible=t.oldMeadow.visible=old;t.landmarks.visible=t.meadow.visible=!old;
    const gl=t.renderer.getContext(),times=[];let counts;
    for(let i=0;i<36;i++){await new Promise(requestAnimationFrame);t.renderer.info.reset();const at=performance.now();t.renderer.render(t.scene,t.camera);gl.finish();if(i>=12)times.push(performance.now()-at);counts={...t.renderer.info.render};}
    return {ms:times.sort((a,b)=>a-b)[Math.floor(times.length/2)],calls:counts.calls,triangles:counts.triangles};
   };
   const before=await sample(true),after=await sample(false),control=await sample(true);t.oldLandmarks.visible=t.oldMeadow.visible=false;t.landmarks.visible=t.meadow.visible=true;t.renderer.render(t.scene,t.camera);return {name,before,after,control};
  },{name,eye,look});rows.push(row);await page.screenshot({path:prefix+'-'+name+'.png'});
 }
 // Close views of the actual instances (including multi-draw source records).
 await page.evaluate(async()=>{
  const t=window.sceneryView,records=[];
  const gather=(mesh,world)=>{if(mesh.geometry.userData.kind)for(let i=0;i<mesh.count;i++){const m=t.camera.matrix.clone();mesh.getMatrixAt(i,m);m.premultiply(world);records.push({kind:mesh.geometry.userData.kind,matrix:m.elements.slice()});}};
  t.landmarks.traverse(o=>{if(o.isInstancedMesh)gather(o,o.matrixWorld);if(o.isBatchedMesh)for(const s of t.getSources(o))gather(s.mesh,s.visibility.matrixWorld);});
  t.close=records;
 });
 for(const kind of ['naturalRock','reeds','waterLily']){
  const target=await page.evaluate(({kind,pond})=>{
   const t=window.sceneryView;const records=t.close.filter(p=>p.kind===kind);records.sort((a,b)=>Math.hypot(a.matrix[12]-pond.x,a.matrix[14]-pond.z)-Math.hypot(b.matrix[12]-pond.x,b.matrix[14]-pond.z));
   const e=records[0]?.matrix;if(!e)throw Error('No visible '+kind+' instance');const x=e[12],y=e[13],z=e[14],s=Math.hypot(e[0],e[2]);
   t.camera.position.set(x+(kind==='reeds'?-2:3)*s,y+(kind==='reeds'?1.3:1.9)*s,z+2.5*s);t.camera.lookAt(x,y+(kind==='reeds'?.7:.16),z);t.camera.updateMatrixWorld();t.shadows.update();t.renderer.render(t.scene,t.camera);return {kind,x,y,z};
  },{kind,pond:sites.pond});await page.screenshot({path:prefix+'-'+kind+'-close.png'});
 }
 await page.evaluate(async()=>{const t=window.sceneryView,{daylight}=await import('/src/day-cycle.ts'),day=daylight(.75);t.celestialLighting.update(day);t.updateTreeShadows(day);t.updateSky(0,t.camera,day);t.renderer.toneMappingExposure=1+day.day*.2;t.shadows.update();t.renderer.render(t.scene,t.camera);});
 await page.screenshot({path:prefix+'-lily-night.png'});
 assert.deepEqual(errors,[]);const report={viewport:mobile?'phone-sized desktop Chrome':'desktop',inventory,rows,errors};await writeFile(prefix+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
