import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const output=resolve(process.env.SEAL_OUTPUT??fileURLToPath(new URL('../node_modules/.cache/meta-knight-seal-game/',import.meta.url)));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('http://127.0.0.1:8787/**',route=>route.fulfill({json:{count:0,occupiedVariants:[]}}));
 // Test-only access: this response is never written into the shipped game.
 await page.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
  window.sealWorldTest={scene,camera,renderer,shadows,celestialLighting,setupShadowMaterials,get c(){return character},get reflections(){return metaKnightReflections},setDay(){dayStart=Date.now();dayStartPhase=.25;}};
  `});
 });
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5184/');
 await page.waitForFunction(()=>window.sealWorldTest?.reflections&&!document.querySelector('#start-game')?.disabled,null,{timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Проверка печати');await page.locator('#start-game').click();
 await page.waitForFunction(()=>window.sealWorldTest?.c);await page.evaluate(()=>sealWorldTest.setDay());await page.waitForTimeout(350);
 const report=await page.evaluate(async()=>{
  const api=sealWorldTest,T=await import('/node_modules/.vite/deps/three.js'),{MetaKnightSeal}=await import('/src/meta-knight-seal.ts');
  api.renderer.setAnimationLoop(null);api.renderer.setPixelRatio(1);api.renderer.shadowMap.autoUpdate=false;
  const center=api.c.actor.position.clone();api.c.actor.visible=false;
  api.camera.position.copy(center).add(new T.Vector3(2.6,3.4,7.5));api.camera.lookAt(center.clone().add(new T.Vector3(0,1.75,0)));
  api.camera.fov=42;api.camera.updateProjectionMatrix();api.camera.updateMatrixWorld();api.shadows.updateFrustums();api.shadows.update();
  const seals=Array.from({length:3},(_,i)=>{const seal=new MetaKnightSeal(i*.5);seal.group.position.copy(center).add(new T.Vector3((i-1)*1.9,1.8,0));seal.spinEnabled=false;api.scene.add(seal.group);api.reflections.add(seal.model);seal.update(0,api.camera.position);return seal;});
  api.setupShadowMaterials();
  const draw=()=>api.renderer.render(api.scene,api.camera);
  const state=()=>{const r=api.renderer.info;return {calls:r.render.calls,triangles:r.render.triangles,points:r.render.points,geometries:r.memory.geometries,textures:r.memory.textures};};
  const sample=()=>{for(let i=0;i<6;i++)draw();const times=[];for(let i=0;i<9;i++){const from=performance.now();draw();times.push(performance.now()-from);}times.sort((a,b)=>a-b);return {...state(),cpuSubmitMedianMs:times[4]};};
  seals.forEach(s=>s.active=false);const baseline=sample();
  seals[1].active=true;seals[1].update(0,api.camera.position);const one=sample();
  seals.forEach(s=>{s.active=true;s.update(0,api.camera.position);});const three=sample();
  seals.forEach(s=>{s.mistEnabled=false;s.update(0,api.camera.position);});const threeWithoutMist=sample();
  seals.forEach(s=>{s.mistEnabled=true;s.update(0,api.camera.position.clone().addScalar(1000));});const culled=sample();
  seals.forEach(s=>{s.update(0,api.camera.position);});draw();
  api.seals=seals;api.draw=draw;
  // Hide interface only in this diagnostic page, retaining the actual meadow.
  document.querySelectorAll('body > *').forEach(e=>{if(e!==api.renderer.domElement&&!e.contains(api.renderer.domElement))e.style.display='none';});
  api.renderer.domElement.style.cssText='position:fixed;inset:0;width:100%;height:100%;visibility:visible';
  const geometries=new Set(),materials=new Set();seals.forEach(s=>s.group.traverse(o=>{if(o.isMesh||o.isPoints){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}}));
  return {baseline,one,three,threeWithoutMist,culled,sharedResources:{geometries:geometries.size,materials:materials.size},measurement:'Same frozen real game scene and camera, DPR1, unchanged daylight, no additional shadow updates. Timings measure CPU render submission, not FPS or GPU frame time.'};
 });
 const delta=(a,b)=>({calls:a.calls-b.calls,triangles:a.triangles-b.triangles,points:a.points-b.points,geometries:a.geometries-b.geometries,textures:a.textures-b.textures});
 report.delta={one:delta(report.one,report.baseline),three:delta(report.three,report.baseline),mist:delta(report.three,report.threeWithoutMist)};
 assert(report.delta.one.calls>0&&report.delta.one.calls<=5,JSON.stringify(report));
 assert.equal(report.delta.three.calls,report.delta.one.calls*3);assert.equal(report.delta.three.triangles,report.delta.one.triangles*3);
 assert(report.delta.three.triangles<=16000,'three complete displays stay within the geometry budget');
 assert.equal(report.three.geometries,report.one.geometries,'three seals share GPU buffers');assert.equal(report.three.textures,report.one.textures,'three seals add no extra textures');
 assert(report.delta.mist.calls<=3,'at most one mist draw per seal');assert.equal(report.culled.calls,report.baseline.calls);assert.equal(report.culled.triangles,report.baseline.triangles);
 await page.screenshot({path:resolve(output,'three-seals-in-meadow.png')});
 await page.evaluate(()=>{sealWorldTest.seals.forEach((s,i)=>s.group.visible=i===1);sealWorldTest.draw();});
 await page.screenshot({path:resolve(output,'seal-in-meadow.png')});
 assert.deepEqual(errors,[]);report.errors=errors;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,delta:report.delta,sharedResources:report.sharedResources,errors}));
}finally{await browser.close();}
