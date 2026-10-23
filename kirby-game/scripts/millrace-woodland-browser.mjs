import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';

const out=fileURLToPath(new URL('../node_modules/.cache/millrace-woodland/',import.meta.url));
await mkdir(out,{recursive:true});
const server=process.env.GAME_URL?undefined:await createServer({server:{host:'127.0.0.1',port:5193,strictPort:true}});
await server?.listen();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];
 page.setDefaultTimeout(180000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.detailQA={THREE,scene,camera,renderer,watermill,shadows,preparedShadows,sceneryVisibility,celestialLighting,updateTreeShadows,updateSky,get c(){return character},get boss(){return arenaCentipede},get npcs(){return npcs}};'});});
 if(process.env.DETAIL_STAGE==='before'){
  const source=execFileSync('git',['show','HEAD:kirby-game/src/watermill.ts'],{encoding:'utf8'});
  const body=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>'from '+JSON.stringify(spec==='three'?'/node_modules/.vite/deps/three.js':'/src/'+spec.slice(2)+'.ts'));
  await page.route('**/src/watermill.ts*',r=>r.fulfill({contentType:'application/javascript',body}));
  for(const name of ['environment.bin.gz','environment.manifest.json']){
   const bytes=execFileSync('git',['show','HEAD:kirby-game/public/world/'+name],{maxBuffer:32*1024*1024});
   await page.route('**/world/'+name+'*',r=>r.fulfill({contentType:name.endsWith('json')?'application/json':'application/octet-stream',body:bytes}));
  }
 }
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5193/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.click('#new-game');await page.fill('#player-name-input','Детали');await page.click('#start-game');await page.waitForFunction(()=>window.detailQA?.c,null,{timeout:180000});
 const sites=await page.evaluate(async()=>{
  const q=detailQA,{LANDMARKS}=await import('/src/landmark-sites.ts'),{daylight}=await import('/src/day-cycle.ts'),{newMillQuest}=await import('/src/mill-quest.ts');
  q.renderer.setAnimationLoop(null);q.day=daylight(.28);q.celestialLighting.update(q.day);q.updateTreeShadows(q.day);q.renderer.toneMappingExposure=1.2;q.scene.background.set('#b3d9ef');q.scene.fog.color.set('#d8e9eb');
  q.watermill.setQuest({...newMillQuest(),stage:'flow',gate:1},1000);for(let i=0;i<100;i++)q.watermill.update(.1);
  q.c.actor.visible=false;if(q.boss)q.boss.group.visible=false;q.npcs.forEach(n=>n.actor.visible=false);document.querySelectorAll('body > :not(#game)').forEach(el=>el.style.visibility='hidden');
  return {mill:q.watermill.group.position.toArray(),woodland:LANDMARKS.filter(p=>p.kind===2)[2]};
 });
 const report={views:[],errors},stage=process.env.DETAIL_STAGE??'after';
 const photo=async(name,base,eye,look)=>{
  const row=await page.evaluate(async({base,eye,look})=>{
   const q=detailQA,T=q.THREE,b=new T.Vector3(...base);q.camera.position.copy(b).add(new T.Vector3(...eye));q.camera.lookAt(b.clone().add(new T.Vector3(...look)));q.camera.updateMatrixWorld();
   q.sceneryVisibility.update(q.camera,360);q.preparedShadows.update(q.day,q.camera.position);q.shadows.update();q.updateSky(0,q.camera,q.day);
   const gl=q.renderer.getContext(),startupGlError=gl.getError(),times=[];for(let i=0;i<24;i++){await new Promise(requestAnimationFrame);const at=performance.now();q.renderer.render(q.scene,q.camera);gl.finish();if(i>=12)times.push(performance.now()-at);}times.sort((a,b)=>a-b);
   return {calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,medianRenderMs:times[6],startupGlError,glError:gl.getError()};
  },{base,eye,look});assert.equal(row.glError,0);report.views.push({name,...row});await page.screenshot({path:out+stage+'-'+name+'.png'});
 };
 await photo('mill-overview',sites.mill,[-9,13,15],[12,5,-4]);
 await photo('millrace',sites.mill,[3,11,-1],[10.8,6,-8]);
 await photo('spring',sites.mill,[4,7,-20],[10.8,4.3,-13]);
 const base=[sites.woodland.x,0,sites.woodland.z];
 await photo('woodland',base,[10,6.5,13],[.5,.7,0]);
 await photo('stump',base,[-5.5,3.9,4.5],[-1.6,.8,0]);
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{detailQA.camera.aspect=844/390;detailQA.camera.updateProjectionMatrix();});
 await photo('mill-mobile',sites.mill,[-9,13,15],[12,5,-4]);await photo('woodland-mobile',base,[10,6.5,13],[.5,.7,0]);
 assert.deepEqual(errors,[]);await writeFile(out+stage+'-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify({out,...report}));
}finally{await browser.close();await server?.close();}
