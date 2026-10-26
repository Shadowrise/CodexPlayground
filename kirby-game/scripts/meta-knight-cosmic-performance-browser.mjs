import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Exercise the real arena, including cold shader variants and subsequent frames.
const output=resolve(process.env.PERF_OUTPUT??'node_modules/.cache/meta-knight-cosmic-performance');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('console',m=>{if(m.text().startsWith('[cosmic-perf]'))console.log(m.text());});
 page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});
 page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await page.route('**/@vite/client',r=>r.fulfill({contentType:'text/javascript',body:`
 export const createHotContext=()=>({accept(){},dispose(){},prune(){},on(){},off(){},send(){},invalidate(){},data:{}});
 export function updateStyle(id,css){let style=document.getElementById(id);if(!style){style=document.createElement('style');style.id=id;document.head.append(style);}style.textContent=css;}
 export function removeStyle(id){document.getElementById(id)?.remove();}
 export const injectQuery=url=>url;
 `}));
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.cosmicPerf={THREE,travel:cosmicArena,renderer,sounds,get c(){return character}};'});});
 await page.route('**/src/meta-knight-battle-view.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('await renderer.compileAsync(scene, camera);','console.log("[cosmic-perf] compile start");await renderer.compileAsync(scene, camera);console.log("[cosmic-perf] compile done");').replace('renderer.render(scene, camera);','console.log("[cosmic-perf] warm draw start");renderer.render(scene, camera);console.log("[cosmic-perf] warm draw done");')});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');
 await page.waitForFunction(()=>!!window.cosmicPerf,null,{timeout:180000});
 await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Cosmic performance');await page.locator('#start-game').click();
 await page.waitForFunction(()=>!!window.cosmicPerf?.c,null,{timeout:180000});
 console.log('[cosmic-perf] game loaded');
 const entry=await page.evaluate(async()=>{const q=cosmicPerf,start=performance.now();await q.travel.enter(q.c);q.renderer.setAnimationLoop(null);return {ms:performance.now()-start,programs:q.renderer.info.programs.length};});
 console.log(JSON.stringify({entry}));
 await page.evaluate(()=>{
  const q=cosmicPerf;q.c.actor.position.set(2000,0,-2);q.travel.soloNow=1000000;q.travel.startBattle();q.travel.setGodMode(true);
  q.input={forward:false,backward:false,left:false,right:false,jump:false,jumpPressed:false,dashPressed:false,attack:false,attackPressed:false};
  q.tick=(dt=1/60)=>q.travel.update(dt,q.travel.soloNow/1000,q.c,q.input,0,0,false,!!q.paused);
  q.draw=()=>{q.travel.render();q.renderer.getContext().finish();};
  q.next=()=>{q.travel.soloNow=q.travel.battle.until;q.tick(0);};
  q.measure=()=>{const programs=q.renderer.info.programs.length,a=performance.now();q.tick();const b=performance.now();q.draw();const c=performance.now();let lights=0;q.travel.scene.traverseVisible(o=>{if(o.isPointLight)lights++;});return {stage:q.travel.battle.stage,updateMs:b-a,renderMs:c-b,totalMs:c-a,newPrograms:q.renderer.info.programs.length-programs,programs:q.renderer.info.programs.length,geometries:q.renderer.info.memory.geometries,calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,lights};};
 });
 const samples=[];
 const scenarios=process.argv.includes('--meteor-only')?['meteor-draw','meteor-flight']:['meteor-draw','meteor-flight','star-draw','planet-pull','planet-sweep','planet-break','planet-repeat',...[0,2,3,4,5,6,7,8,9,10].map(i=>'planet-world-'+i),'pause','resume'];
 for(const scenario of scenarios){
  const result=await page.evaluate(scenario=>{
   const q=cosmicPerf,setupStart=performance.now(),programs=q.renderer.info.programs.length;
   if(scenario==='meteor-draw'){q.travel.setPhase(4,2);}
   if(scenario==='meteor-flight'){q.next();q.travel.soloNow+=500;}
   if(scenario==='star-draw'||scenario==='planet-repeat')q.travel.setPhase(4,3);
   if(scenario==='planet-pull'){q.next();q.next();q.travel.soloNow+=700;}
   if(scenario==='planet-sweep'){q.next();q.travel.soloNow+=2000;}
   if(scenario==='planet-break'){q.travel.soloNow=q.travel.battle.until;}
   if(scenario.startsWith('planet-world-')){q.travel.setPhase(4,3);q.travel.battle.cosmicRefuge.world=Number(scenario.slice('planet-world-'.length));q.tick(0);q.next();q.next();q.next();q.travel.soloNow+=2000;}
   if(scenario==='pause')q.paused=true;if(scenario==='resume')q.paused=false;
   const setupMs=performance.now()-setupStart,first=q.measure(),frames=[];
   for(let i=0;i<24;i++)frames.push(q.measure());
   const median=key=>frames.map(f=>f[key]).sort((a,b)=>a-b)[12];
   return {scenario,setupMs,first,median:{updateMs:median('updateMs'),renderMs:median('renderMs'),totalMs:median('totalMs')},newPrograms:q.renderer.info.programs.length-programs,frames};
  },scenario);
  samples.push(result);console.log(JSON.stringify({...result,frames:undefined}));
  if(scenario==='meteor-draw'){
   const blue=await page.evaluate(()=>{const q=cosmicPerf,colors=[];q.travel.knight.actor.getObjectByName('Eyes_glow').traverse(o=>{if(o.isMesh)colors.push(o.material.color.toArray());});return {eyes:colors,bolt:q.travel.battleView.meteor.lightning.hotMaterial.color.toArray(),segments:q.travel.battleView.meteor.lightning.hot.count};});
   assert(blue.eyes.length&&blue.eyes.every(c=>c[2]>c[0]*5));assert(blue.bolt[2]>blue.bolt[0]*5);assert(blue.segments>0);result.blue=blue;
  }
  if(['meteor-draw','planet-sweep','planet-break'].includes(scenario))await page.screenshot({path:resolve(output,scenario+'.png')});
 }
 assert.deepEqual(errors,[]);
 if(process.env.PERF_VERIFY==='1'){
  for(const sample of samples)assert.equal(sample.newPrograms,0,`${sample.scenario}: compiles shaders during combat`);
  for(const sample of samples){assert.equal(sample.first.lights,4,`${sample.scenario}: changes visible light slots`);if(sample.scenario.startsWith('planet-'))assert.equal(sample.first.geometries,samples.find(s=>s.scenario==='star-draw').first.geometries,`${sample.scenario}: allocates GPU geometry`);}
 }
 await writeFile(resolve(output,'report.json'),JSON.stringify({entry,samples,errors},null,2));
 console.log(JSON.stringify({output,entry,errors}));
}finally{await browser.close();}
