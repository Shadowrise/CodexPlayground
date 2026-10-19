import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const url=process.env.KIRBY_URL??'http://127.0.0.1:5194/';
const output=resolve('node_modules/.cache/pigeon-air-peck');await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={runs:[],errors:[]};
async function prepare(page){
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.routeWebSocket(`ws://${new URL(url).host}/**`,ws=>{const server=ws.connectToServer();server.onMessage(message=>{if(typeof message==='string'){try{if(['full-reload','update'].includes(JSON.parse(message).type))return;}catch{}}ws.send(message);});});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');localStorage.setItem('kirby-pidgie-unlocked-v1','1');});
 await page.route('http://127.0.0.1:8787/**',r=>r.fulfill({json:{count:0,players:0,occupiedVariants:[],capacity:19,ok:true}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`
 window.peckQA={get c(){return character},get playing(){return playing},renderer,scene,camera,history:[],elapsed:0};
 `});});
 await page.goto(url);await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.waitForFunction(()=>window.peckQA&&!document.querySelector('#start-game').disabled,null,{timeout:120000});
 await page.locator('#new-game').click();await page.locator('#variant-grid .pigeon-character').click();await page.locator('#player-name-input').fill('Крылья');await page.locator('#start-game').click();
 await page.waitForFunction(()=>peckQA.playing&&peckQA.c?.isPigeon,null,{timeout:120000});
 await page.evaluate(()=>{
  const q=peckQA,c=q.c,update=c.update.bind(c);c.setActivity('Idle');c.actor.position.set(135,0,146);c.surfaceY=0;
  c.update=(dt,input)=>{update(dt,input);q.elapsed+=dt;q.history.push({t:q.elapsed,dt,attack:!!input.attack,pressed:!!input.attackPressed,hit:c.attackHit,active:c.flight.active,hover:c.flight.levitating,state:c.state,pushTime:c.actions.get('Push').time,bodyZ:c.actor.getObjectByName('Body').position.z,wings:['Left','Right'].map(side=>({q:c.actor.getObjectByName(side+'_wing').quaternion.toArray(),flat:c.actor.getObjectByName(side+'_wing_vane').scale.x}))});};
 });
}
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();await prepare(page);
  const jumpBox=mobile?await page.locator('#touch-jump').boundingBox():undefined,attackBox=mobile?await page.locator('#touch-attack').boundingBox():undefined;
  const tap=box=>page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
  const jump=()=>mobile?tap(jumpBox):page.keyboard.press('Space'),push=()=>mobile?tap(attackBox):page.keyboard.press('q');
  await jump();await page.waitForFunction(()=>peckQA.c.flight.height>.35&&peckQA.c.flight.networkState()[6]>0);await jump();
  await page.waitForFunction(()=>peckQA.c.flight.levitating&&peckQA.c.flight.atTop);
  await page.evaluate(()=>{peckQA.history=[];peckQA.elapsed=0;});
  for(let press=0;press<3;press++){
   await push();await page.waitForFunction(count=>peckQA.history.filter(f=>f.hit).length===count,press+1);
   if(press<2)await page.waitForFunction(delay=>peckQA.elapsed-peckQA.history.filter(f=>f.hit).at(-1).t>delay,press===0?.2:.75);
  }
  await page.waitForFunction(()=>peckQA.elapsed-peckQA.history.filter(f=>f.hit).at(-1).t>.28);
  const frames=await page.evaluate(()=>peckQA.history),hits=frames.filter(f=>f.hit);
  assert.equal(hits.length,3);assert(hits.every(f=>f.active&&f.pressed&&f.pushTime<=f.dt+.00001),'every real press restarts the airborne peck');
  const attacking=frames.filter(f=>f.active&&f.state==='Push');assert(attacking.length>10);
  assert(attacking.every(f=>f.wings.every(w=>Math.abs(w.flat-.3)<1e-6)),'neither wing folds during a peck');
  const first=attacking[0].wings[0].q,wingMotion=Math.max(...attacking.map(f=>Math.hypot(...f.wings[0].q.map((v,i)=>v-first[i]))));assert(wingMotion>.1,'wings keep beating while the chest pecks');
  assert(frames.some(f=>f.bodyZ>.15),'the peck remains visible');
  await page.addStyleTag({content:'.right-hud,.status-cluster{visibility:hidden}'});
  await page.evaluate(()=>{const q=peckQA,render=q.renderer.render;q.renderer.render=function(scene,camera){if(scene!==q.scene)return render.call(this,scene,camera);const p=q.c.actor.position,photo=camera.clone();photo.position.set(p.x+4,p.y+2.7,p.z+5);photo.lookAt(p.x,p.y+1.4,p.z);photo.updateMatrixWorld();return render.call(this,scene,photo);};});
  await page.screenshot({path:resolve(output,mobile?'touch-peck.png':'keyboard-peck.png')});
  await page.waitForFunction(()=>!peckQA.c.flight.active);
  await push();await page.waitForFunction(()=>peckQA.c.state==='Push');
  assert(await page.evaluate(()=>['Left','Right'].every(side=>peckQA.c.actor.getObjectByName(side+'_wing_vane').scale.x===1)),'ground pecks restore the folded wings');
  report.runs.push({mobile,hits:hits.map(f=>({time:f.t,animation:f.pushTime})),wingMotion,groundRestored:true});console.log(`PASS ${mobile?'touch':'keyboard'}: three pecks replay, both wings keep flying, ground pose restores`);
  await context.close();
 }
 assert.deepEqual(report.errors,[]);await writeFile(resolve(output,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){
 for(const context of browser.contexts())for(const page of context.pages())console.error(JSON.stringify(await page.evaluate(()=>({hits:peckQA.history.filter(f=>f.hit),last:peckQA.history.slice(-3)})).catch(()=>({closed:true}))));throw error;
}finally{await browser.close();}
