import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';

const out=fileURLToPath(new URL('../node_modules/.cache/water-surface/',import.meta.url));
await mkdir(out,{recursive:true});
const server=process.env.GAME_URL?undefined:await createServer({server:{host:'127.0.0.1',port:5194,strictPort:true}});
await server?.listen();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];
 page.setDefaultTimeout(180000);
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.waterQA={THREE,scene,camera,renderer,ponds,fountain,watermill,shadows,preparedShadows,sceneryVisibility,celestialLighting,updateTreeShadows,updateSky,setupShadowMaterials,get c(){return character},get npcs(){return npcs}};'});});
 if(process.env.WATER_COMPARE==='1')for(const name of ['ponds','water-surface','fountain','watermill']){
  const source=execFileSync('git',['show',(process.env.WATER_BASE_REF??'HEAD')+':kirby-game/src/'+name+'.ts'],{encoding:'utf8'});
  const body=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>'from '+JSON.stringify(spec==='three'?'/node_modules/.vite/deps/three.js':spec.startsWith('three/addons/')?'/node_modules/three/examples/jsm/'+spec.slice(13):spec==='./water-surface'?'/water-baseline/water-surface.js':spec.startsWith('./')?'/src/'+spec.slice(2)+'.ts':spec));
  await page.route('**/water-baseline/'+name+'.js',r=>r.fulfill({contentType:'application/javascript',body}));
 }
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5194/');
 await page.locator('#startup-loader').waitFor({state:'hidden'});
 await page.click('#new-game');await page.fill('#player-name-input','Вода');await page.click('#start-game');
 await page.waitForFunction(()=>window.waterQA?.c);
 const sites=await page.evaluate(async()=>{
  const q=waterQA,{PONDS,RIVERS}=await import('/src/pond-layout.ts'),{FOUNTAIN_SITE}=await import('/src/fountain-site.ts'),{newMillQuest}=await import('/src/mill-quest.ts');
  q.renderer.setAnimationLoop(null);q.renderer.toneMappingExposure=1.2;
  q.watermill.setQuest({...newMillQuest(),stage:'flow',gate:1},1000);
  for(let i=0;i<100;i++){q.watermill.update(.1);q.ponds.update(.1);q.fountain.update(.1,1);}
  q.c.actor.visible=false;q.npcs.forEach(n=>n.actor.visible=false);
  document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.visibility='hidden');
  return {pond:[PONDS[1].x,0,PONDS[1].z],river:RIVERS[0][Math.floor(RIVERS[0].length*.45)].toArray(),mill:q.watermill.group.position.toArray(),fountain:[FOUNTAIN_SITE.x,0,FOUNTAIN_SITE.z]};
 });
 if(process.env.WATER_COMPARE==='1')await page.evaluate(async()=>{
  const q=waterQA,{Ponds}=await import('/water-baseline/ponds.js'),{RainbowFountain}=await import('/water-baseline/fountain.js'),{Watermill}=await import('/water-baseline/watermill.js');
  const old=[new Ponds(),new RainbowFountain(),new Watermill()];old[0].update(10);old[1].update(10,1);old[2].update(10);
  q.waterPairs=[];
  for(const [i,current] of [q.ponds,q.fountain,q.watermill].entries()){
   q.setupShadowMaterials(old[i].group);
   const before=[],after=[];
   old[i].group.traverse(o=>{if(o.isMesh&&(o.name==='Lake and river water'||o.name==='Fountain water arcs'||o.material?.uniforms?.brightness||o.material?.uniforms?.phase||o.material?.userData?.waterPhase))before.push(o);});
   current.group.traverse(o=>{if(o.isMesh&&o.material?.userData?.waterPhase)after.push(o);});
   if(before.length!==after.length)throw new Error('Water mesh count changed: '+before.length+'/'+after.length);
   after.forEach((mesh,j)=>q.waterPairs.push({mesh,current:{material:mesh.material,geometry:mesh.geometry},legacy:{material:before[j].material,geometry:before[j].geometry}}));
  }
 });
 const report={views:[],errors},stage=process.env.WATER_STAGE??'after';
 const photo=async(name,base,eye,look,phase=.25)=>{
  const row=await page.evaluate(async({base,eye,look,phase})=>{
   const q=waterQA,T=q.THREE,{daylight}=await import('/src/day-cycle.ts');q.day=daylight(phase);
   q.celestialLighting.update(q.day);q.updateTreeShadows(q.day);q.scene.background.set(q.day.day?'#b3d9ef':'#17243e');q.scene.fog.color.set(q.day.day?'#d8e9eb':'#1c2943');
   q.fountain.update(0,q.day.day);
   const b=new T.Vector3(...base);q.camera.position.copy(b).add(new T.Vector3(...eye));q.camera.lookAt(b.clone().add(new T.Vector3(...look)));q.camera.updateMatrixWorld();
   q.sceneryVisibility.update(q.camera,360);q.preparedShadows.update(q.day,q.camera.position);q.shadows.update();q.updateSky(0,q.camera,q.day);
   const gl=q.renderer.getContext(),startupGlError=gl.getError(),times=[];
   for(let i=0;i<24;i++){await new Promise(requestAnimationFrame);const at=performance.now();q.renderer.render(q.scene,q.camera);gl.finish();if(i>=12)times.push(performance.now()-at);}
   times.sort((a,b)=>a-b);
   const maps=new Set();for(const root of [q.ponds.group,q.fountain.group,q.watermill.group])root.traverse(o=>{if(o.isMesh&&o.material?.map?.name?.includes('water'))maps.add(o.material.map.uuid);});
   const row={calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,textures:q.renderer.info.memory.textures,waterTextures:maps.size,medianRenderMs:times[6],startupGlError,glError:gl.getError()};
   if(q.waterPairs){
    const measure=async variant=>{
     for(const pair of q.waterPairs){pair.mesh.material=pair[variant].material;pair.mesh.geometry=pair[variant].geometry;}
     const samples=[];for(let i=0;i<22;i++){await new Promise(requestAnimationFrame);const start=performance.now();q.renderer.render(q.scene,q.camera);gl.finish();if(i>=10)samples.push(performance.now()-start);}
     samples.sort((a,b)=>a-b);return {medianMs:samples[6],calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles};
    };
    row.paired=[];for(let round=0;round<3;round++)for(const variant of (round%2?['current','legacy']:['legacy','current']))row.paired.push({variant,...await measure(variant)});
    for(const pair of q.waterPairs){pair.mesh.material=pair.current.material;pair.mesh.geometry=pair.current.geometry;}
    q.renderer.render(q.scene,q.camera);row.glError=gl.getError();
   }
   return row;
  },{base,eye,look,phase});
  assert.equal(row.glError,0);if(stage!=='before')assert.equal(row.waterTextures,1);report.views.push({name,...row});await page.screenshot({path:out+stage+'-'+name+'.png'});
 };
 await photo('pond',sites.pond,[10,9,19],[0,-.3,0]);
 await photo('river',sites.river,[6,4.2,9],[0,-.42,0]);
 await photo('fountain',sites.fountain,[13,11,18],[0,1,0]);
 await photo('fountain-low',sites.fountain,[7,2.5,11],[0,.6,0]);
 await photo('mill',sites.mill,[4,9,6],[10.8,3.5,-3]);
 await photo('millrace',sites.mill,[7.2,9,-11],[10.8,6.6,-7]);
 await photo('pond-night',sites.pond,[10,9,19],[0,-.3,0],.75);
 await photo('fountain-night',sites.fountain,[13,11,18],[0,1,0],.75);
 await photo('mill-night',sites.mill,[4,9,6],[10.8,3.5,-3],.75);
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{waterQA.camera.aspect=844/390;waterQA.camera.updateProjectionMatrix();});
 await photo('fountain-mobile',sites.fountain,[13,11,18],[0,1,0]);
 assert.deepEqual(errors,[]);await writeFile(out+stage+'-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify({out,...report}));
}finally{await browser.close();await server?.close();}
