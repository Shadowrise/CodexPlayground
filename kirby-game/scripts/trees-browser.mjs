// Frozen scene, old/new/old measurements. Does not touch the user's save.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import assert from 'node:assert/strict';
const url=process.env.GAME_URL??'http://127.0.0.1:5174/',mobile=process.env.TREE_MOBILE==='1';
const out=new URL('../node_modules/.cache/',import.meta.url);await mkdir(out,{recursive:true});
const prefix=new URL('trees'+(mobile?'-mobile':''),out).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:mobile?{width:844,height:390}:{width:1280,height:800},hasTouch:mobile}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 const current=await (await page.request.get(url+'src/forest.ts')).text(),three=[...current.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]).find(s=>s.includes('/three.js'));
 for(const file of ['forest','treehouse']){
  const source=execFileSync('git',['show',(process.env.TREE_BASELINE_REF??'83c76a5')+':kirby-game/src/'+file+'.ts'],{encoding:'utf8'});
  const old=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>'from '+JSON.stringify(spec==='three'?three:'/src/'+spec.slice(2)+'.ts'));
  await page.route('**/src/'+file+'-before.ts',route=>route.fulfill({contentType:'application/javascript',body:old}));
 }
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nwindow.treeView={scene,camera,renderer,shadows,celestialLighting,updateTreeShadows,updateSky,setupShadowMaterials,get c(){return character},set day(v){dayStartPhase=v;dayStart=Date.now();}};'});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Деревья');await page.locator('#start-game').click();
 await page.evaluate(()=>window.treeView.day=.25);await page.waitForTimeout(200);
 const inventory=await page.evaluate(async()=>{
  const t=window.treeView;t.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.display='none');
  const {createForest}=await import('/src/forest-before.ts'),{Treehouse}=await import('/src/treehouse-before.ts');
  t.after=t.scene.getObjectByName('Four woodland biomes');t.house=t.scene.getObjectByName('Oak treehouse, lookout, swing and leaf pile');
  t.before=createForest();t.before.visible=false;t.scene.add(t.before);t.before.updateMatrixWorld(true);
  t.oldHouse=new Treehouse().group;t.oldHouse.visible=false;t.scene.add(t.oldHouse);t.oldHouse.updateMatrixWorld(true);t.setupShadowMaterials();
  if(JSON.stringify(t.before.userData.treePositions)!==JSON.stringify(t.after.userData.treePositions))throw Error('Tree positions changed');
  const matrices=root=>{const a=[];root.getObjectByName('Decorative forest needles').traverse(o=>{if(o.isInstancedMesh)a.push({matrix:[...o.instanceMatrix.array],color:[...o.instanceColor.array],geometry:[...o.geometry.attributes.position.array]});});return a;};
  if(JSON.stringify(matrices(t.before))!==JSON.stringify(matrices(t.after)))throw Error('Conifers changed');
  const bytes=root=>{const buffers=new Set();root.traverse(o=>{if(o.isMesh)for(const a of [...Object.values(o.geometry.attributes),o.geometry.index,o.instanceMatrix,o.instanceColor])if(a)buffers.add(a.array.buffer);});return [...buffers].reduce((s,b)=>s+b.byteLength,0);};
  t.before.getObjectByName('Biome ground').visible=false;t.ground=t.after.getObjectByName('Biome ground');t.scene.attach(t.ground);
  return {trees:t.after.userData.treePositions.length,placementUnchanged:true,conifersUnchanged:true,beforeBytes:bytes(t.before),afterBytes:bytes(t.after)};
 });
 const rows=[];
 for(const [name,eye,look] of [
  ['spruce',[-112,4.8,-124],[-112,1,-168]],['birch',[115,4.8,-113],[115,1,-157]],['orchard',[115,4.8,157],[115,1,113]],['autumn',[-155,4.8,177],[-155,1,133]],['diagonal',[-205,8,-205],[205,8,205]],['oak',[154,21,81],[135,24,39]],
 ]){
  const row=await page.evaluate(async({name,eye,look})=>{
   const t=window.treeView;t.camera.position.fromArray(eye);t.camera.lookAt(...look);t.camera.updateMatrixWorld();t.c.actor.position.set(eye[0],0,eye[2]);t.shadows.update();
   const sample=async old=>{
    t.before.visible=old;t.after.visible=!old;
    t.oldHouse.visible=old;t.house.visible=!old;const gl=t.renderer.getContext(),times=[];let counts;
    for(let i=0;i<32;i++){await new Promise(requestAnimationFrame);t.renderer.info.reset();const at=performance.now();t.renderer.render(t.scene,t.camera);gl.finish();if(i>=12)times.push(performance.now()-at);counts={...t.renderer.info.render};}
    return {ms:times.sort((a,b)=>a-b)[Math.floor(times.length/2)],calls:counts.calls,triangles:counts.triangles};
   };
   const before=await sample(true),after=await sample(false),control=await sample(true);t.before.visible=false;t.after.visible=true;t.oldHouse.visible=false;t.house.visible=true;t.renderer.render(t.scene,t.camera);
   return {name,before,after,control,stable:Math.abs(before.ms-control.ms)/((before.ms+control.ms)/2)<.15};
  },{name,eye,look});rows.push(row);await page.screenshot({path:prefix+'-'+name+'.png'});
 }
 for(const kind of ['birch','orchard','autumn']){
  await page.evaluate(kind=>{
   const t=window.treeView,parts=t.after.userData.broadleafTrees.find(p=>p.kind===kind).parts;
   const part=parts.find(p=>Math.max(Math.abs(p.matrix.elements[12]),Math.abs(p.matrix.elements[14]))<180&&Math.hypot(p.matrix.elements[0],p.matrix.elements[2])>1.1)??parts[0],e=part.matrix.elements,s=Math.hypot(e[0],e[2]);
   t.target={x:e[12],z:e[14],s,h:kind==='birch'?10.2:8.3};t.camera.position.set(e[12]+10*s,6.8*s,e[14]+10*s);t.camera.lookAt(e[12],5.8*s,e[14]);t.camera.updateMatrixWorld();t.shadows.update();t.renderer.render(t.scene,t.camera);
  },kind);await page.screenshot({path:prefix+'-'+kind+'-close.png'});
  await page.evaluate(()=>{const t=window.treeView,p=t.target;t.camera.position.set(p.x+3.2*p.s,p.h*.8*p.s,p.z+3.2*p.s);t.camera.lookAt(p.x+2*p.s,p.h*.77*p.s,p.z+2*p.s);t.camera.updateMatrixWorld();t.shadows.update();t.renderer.render(t.scene,t.camera);});await page.screenshot({path:prefix+'-'+kind+'-leaf.png'});
 }
 await page.evaluate(async()=>{const t=window.treeView,{daylight}=await import('/src/day-cycle.ts'),day=daylight(.75);t.celestialLighting.update(day);t.updateTreeShadows(day);t.camera.position.set(150,20,72);t.camera.lookAt(135,23,39);t.camera.updateMatrixWorld();t.updateSky(0,t.camera,day);t.shadows.update();t.scene.updateMatrixWorld(true);t.renderer.render(t.scene,t.camera);});await page.screenshot({path:prefix+'-oak-night.png'});
 assert.deepEqual(errors,[]);const result={viewport:mobile?'phone-sized desktop Chrome':'desktop Chrome',method:'Median of 20 render + GPU finish samples; 12 warmup frames, frozen scene, old/new/old. Not real device FPS.',inventory,rows,errors};await writeFile(prefix+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
