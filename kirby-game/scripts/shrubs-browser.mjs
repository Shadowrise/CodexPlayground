// Same frozen world, old/new/old controls. Isolated browser, never modifies saves.
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
import assert from 'node:assert/strict';

const base=process.env.GAME_URL??'http://127.0.0.1:5174/',mobile=process.env.SHRUB_MOBILE==='1';
const out=new URL('../node_modules/.cache/',import.meta.url);await mkdir(out,{recursive:true});
const tag=process.env.MEADOW_COMPARE_TAG??'shrubs';
const prefix=new URL(tag+(mobile?'-mobile':''),out).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const baseline=process.env.SHRUB_BASELINE_REF??'83c76a5';
const source=process.env.MEADOW_BASELINE_FILE?await readFile(process.env.MEADOW_BASELINE_FILE,'utf8'):execFileSync('git',['show',baseline+':kirby-game/src/meadow-decor.ts'],{encoding:'utf8'});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:mobile?{width:844,height:390}:{width:1280,height:800},hasTouch:mobile}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 const current=await (await page.request.get(base+'src/meadow-decor.ts')).text(),imports=[...current.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
 const old=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>{
  const key=spec.startsWith('./')?'/src/'+spec.slice(2)+'.ts':spec==='three'?'/three.js':spec.split('/').at(-1).replace('.js','__js');
  const url=imports.find(p=>p.includes(key));if(!url)throw Error('Unmapped import '+spec);return 'from '+JSON.stringify(url);
 });
 await page.route('**/src/shrubs-before.ts',route=>route.fulfill({contentType:'application/javascript',body:old}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nwindow.shrubView={scene,camera,renderer,shadows,celestialLighting,updateSky,fruits,get c(){return character},set day(v){dayStartPhase=v;dayStart=Date.now();}};'});});
 await page.goto(base);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Кустики');await page.locator('#start-game').click();
 await page.evaluate(()=>window.shrubView.day=.25);await page.waitForTimeout(200);
 const inventory=await page.evaluate(async()=>{
  const t=window.shrubView,{createMeadowDecor}=await import('/src/shrubs-before.ts');
  t.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.display='none');
  const forest=t.scene.getObjectByName('Four woodland biomes');t.after=t.scene.getObjectByName('Biome meadow details');
  t.before=createMeadowDecor(forest.userData.treePositions,forest.userData.meadowLayout);t.before.visible=false;t.scene.add(t.before);t.before.updateMatrixWorld(true);t.after.userData.windTime.value=8;
  if(t.before.userData.windTime)t.before.userData.windTime.value=8;
  if(JSON.stringify(t.before.userData.sites)!==JSON.stringify(t.after.userData.sites))throw Error('Seeded plant placement changed');
  const grassMeshes=root=>{const meshes=[];root.getObjectByName('Meadow grass').traverse(o=>{if(o.isInstancedMesh)meshes.push(o);});return meshes;};
  const oldGrass=grassMeshes(t.before),newGrass=grassMeshes(t.after);
  // Main clears grass beneath edible fruits after building the environment.
  // Apply the same clearing to the fresh baseline before comparing budgets.
  const matrix=new t.camera.matrix.constructor,zero=new t.camera.position.constructor(0,0,0);
  for(const mesh of oldGrass){
   for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);const x=matrix.elements[12],z=matrix.elements[14];
    if(t.fruits.fruits.some(f=>Math.hypot(x-f.object.position.x,z-f.object.position.z)<2.6)){matrix.scale(zero);mesh.setMatrixAt(i,matrix);}
   }
   mesh.instanceMatrix.needsUpdate=true;
  }
  const sameArray=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  if(oldGrass.length!==newGrass.length)throw Error('Grass cell count changed');
  for(let i=0;i<oldGrass.length;i++){
   const a=oldGrass[i],b=newGrass[i];
   if(a.count!==b.count||!sameArray(a.instanceMatrix.array,b.instanceMatrix.array)||!sameArray(a.instanceColor.array,b.instanceColor.array))throw Error('Grass placement or biome colour changed');
   if(b.geometry.index.count/3>15)throw Error('Grass triangle budget exceeded');
  }
  const lods=root=>{const result=[];root.traverse(o=>{if(o.isLOD)result.push(o);});return result;};
  const oldLods=lods(t.before),newLods=lods(t.after);
  if(oldLods.length===newLods.length&&oldLods.every((o,i)=>o.name===newLods[i].name&&o.levels.length===newLods[i].levels.length&&o.position.distanceTo(newLods[i].position)<1e-6))t.lodPairs=oldLods.map((o,i)=>[o,newLods[i]]);
  const materials=new Set();t.before.traverse(o=>{if(o.isMesh)materials.add(o.material);});
  for(const material of materials){const surface=material.onBeforeCompile;t.shadows.setupMaterial(material);t.celestialLighting.setupMaterial(material);const light=material.onBeforeCompile;material.onBeforeCompile=(s,r)=>{light.call(material,s,r);surface.call(material,s,r);};}
  const bytes=root=>{const buffers=new Set();root.traverse(o=>{if(o.isMesh)for(const a of [...Object.values(o.geometry.attributes),o.geometry.index,o.instanceMatrix,o.instanceColor])if(a)buffers.add(a.array.buffer);});return [...buffers].reduce((sum,b)=>sum+b.byteLength,0);};
  return {bushes:t.after.userData.sites.filter(s=>s.kind==='bush').length,grassTufts:newGrass.reduce((sum,m)=>sum+m.count,0),beforeTrianglesPerTuft:oldGrass[0].geometry.index.count/3,afterTrianglesPerTuft:newGrass[0].geometry.index.count/3,beforeBytes:bytes(t.before),afterBytes:bytes(t.after),placementUnchanged:true};
 });
 const rows=[];
 for(const [name,eye,look] of [
  ['spruce',[-112,4.8,-124],[-112,1,-168]],['birch',[115,4.8,-113],[115,1,-157]],
  ['orchard',[115,4.8,157],[115,1,113]],['autumn',[-155,4.8,177],[-155,1,133]],
  ['diagonal',[-205,8,-205],[205,8,205]],
 ]){
  const row=await page.evaluate(async({name,eye,look})=>{
   const t=window.shrubView;t.camera.position.fromArray(eye);t.camera.lookAt(...look);t.camera.updateMatrixWorld();t.c.actor.position.set(eye[0],0,eye[2]);t.shadows.update();
   // Match the incoming hysteresis state for material-only comparisons.
   for(const [old,lod] of t.lodPairs??[])for(let i=0;i<old.levels.length;i++)old.levels[i].object.visible=lod.levels[i].object.visible;
   const sample=async old=>{
    t.before.visible=old;t.after.visible=!old;const gl=t.renderer.getContext(),times=[];let counts;
    for(let i=0;i<32;i++){await new Promise(requestAnimationFrame);t.renderer.info.reset();const at=performance.now();t.renderer.render(t.scene,t.camera);gl.finish();if(i>=12)times.push(performance.now()-at);counts={...t.renderer.info.render};}
    return {ms:times.sort((a,b)=>a-b)[Math.floor(times.length/2)],calls:counts.calls,triangles:counts.triangles};
   };
   const before=await sample(true),after=await sample(false),control=await sample(true);t.before.visible=false;t.after.visible=true;t.renderer.render(t.scene,t.camera);
   return {name,before,after,control,stable:Math.abs(before.ms-control.ms)/((before.ms+control.ms)/2)<.15};
  },{name,eye,look});rows.push(row);await page.screenshot({path:prefix+'-'+name+'.png'});
 }
 // Inspect each biome in the actual scene from normal playing distance.
 for(const biome of ['spruce','birch','orchard','autumn']){
  await page.evaluate(biome=>{
   const t=window.shrubView,sites=t.after.userData.sites,bush=sites.find(s=>s.kind==='bush'&&s.biome===biome&&s.radius>1.15&&Math.abs(s.x)<215&&Math.abs(s.z)<215);
   t.camera.position.set(bush.x+2.8,1.6,bush.z+2.8);t.camera.lookAt(bush.x,.65,bush.z);t.camera.updateMatrixWorld();t.shadows.update();t.renderer.render(t.scene,t.camera);
  },biome);await page.screenshot({path:prefix+'-'+biome+'-close.png'});
 }
 if(tag==='grass')for(const biome of ['spruce','birch','orchard','autumn']){
  await page.evaluate(async biome=>{
   const t=window.shrubView,Matrix4=t.camera.matrix.constructor,Vector3=t.camera.position.constructor,{biomeAt}=await import('/src/forest.ts');
   const bush=t.after.userData.sites.find(s=>s.kind==='bush'&&s.biome===biome&&s.radius>1.15&&Math.abs(s.x)<215&&Math.abs(s.z)<215);
   const matrix=new Matrix4(),p=new Vector3(),nearest=new Vector3();let distance=Infinity;
   t.after.getObjectByName('Meadow grass').traverse(o=>{
    if(!o.isInstancedMesh)return;
    for(let i=0;i<o.count;i++){
     o.getMatrixAt(i,matrix);if(matrix.elements[0]===0&&matrix.elements[1]===0&&matrix.elements[2]===0)continue;matrix.premultiply(o.matrixWorld);p.setFromMatrixPosition(matrix);
     const d=(p.x-bush.x-3)**2+(p.z-bush.z-2)**2;
     if(d<distance&&biomeAt(p.x,p.z)===biome){distance=d;nearest.copy(p);}
    }
   });
   t.camera.position.copy(nearest).add(new Vector3(1.2,.75,1.2));t.camera.lookAt(nearest.x,.18,nearest.z);t.camera.updateMatrixWorld();t.shadows.update();t.renderer.render(t.scene,t.camera);
  },biome);await page.screenshot({path:prefix+'-'+biome+'-blades.png'});
 }
 await page.evaluate(async()=>{
  const t=window.shrubView,{daylight}=await import('/src/day-cycle.ts'),day=daylight(.75);
  t.celestialLighting.update(day);t.renderer.toneMappingExposure=1+day.day*.2;t.updateSky(0,t.camera,day);t.shadows.update();t.renderer.render(t.scene,t.camera);
 });await page.screenshot({path:prefix+'-night.png'});
 const moving=await page.evaluate(()=>{
  const t=window.shrubView,s=t.after.userData.windTime;t.renderer.render(t.scene,t.camera);s.value+=1;t.renderer.render(t.scene,t.camera);return Number.isFinite(s.value);
 });assert(moving);
 assert.deepEqual(errors,[]);const report={mobile,inventory,rows,errors};await writeFile(prefix+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
