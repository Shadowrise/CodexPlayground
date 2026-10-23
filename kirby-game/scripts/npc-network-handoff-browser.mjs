import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const output=new URL('../node_modules/.cache/npc-flight-heading/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const errors=[],pages=[];
try{
 const context=await browser.newContext({viewport:{width:800,height:600}});
 await context.addInitScript(()=>{
  localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');
  Object.defineProperty(document,'hidden',{get:()=>false});
  // Keep a deterministic test run while other chats edit this shared checkout.
  const NativeWebSocket=WebSocket;window.WebSocket=class extends NativeWebSocket{constructor(url,protocols){super(url,protocols);if(protocols==='vite-hmr')this.addEventListener('message',event=>event.stopImmediatePropagation());}};
 });
 await context.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.npcNetworkCheck={balloons,npcSwimming,get fireflies(){return fireflies;},get network(){return network;},get npcs(){return npcs;},get character(){return character;}};'});});
 async function enter(name){
  const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
  await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});await page.locator('#network-join').click();await page.locator('#player-name-input').fill(name);
  await page.locator('#start-game:not([disabled])').waitFor({timeout:60000});await page.locator('#start-game').click();await page.waitForFunction(()=>window.npcNetworkCheck?.character&&window.npcNetworkCheck.npcs.length===14,undefined,{timeout:120000});return page;
 }
 const host=await enter('NPC flight host'),guest=await enter('NPC flight guest');await host.waitForFunction(()=>window.npcNetworkCheck.network.actors.size===1&&window.npcNetworkCheck.network.host);
 // Put both humans away from the test NPC and send its live flight through the
 // real Worker. Closing the host transfers the most recent durable checkpoint.
 for(const page of [host,guest])await page.evaluate(()=>{
  const w=window.npcNetworkCheck,target=w.npcs[0];w.character.actor.position.set(100,0,100);
  // Keep the test NPC walking after landing instead of randomly choosing a
  // new bath or attraction while the forward-motion samples are collected.
  const prepare=w.fireflies.prepareNpcs.bind(w.fireflies),swim=w.npcSwimming.update.bind(w.npcSwimming);
  w.fireflies.prepareNpcs=(npcs,...args)=>prepare(npcs.filter(n=>n!==target),...args);
  w.npcSwimming.update=(dt,npcs,...args)=>swim(dt,npcs.filter(n=>n!==target),...args);
 });
 await host.evaluate(()=>{
  window.npcNetworkCheck.balloons.reset();const n=window.npcNetworkCheck.npcs[0];n.actor.position.set(0,0,0);n.yaw=Math.PI*.75;n.actor.rotation.set(0,n.yaw,0);n.surfaceY=0;n.flight.reset();n.networkAnimate('Fly',0);n.flight.press();
  const life=n.networkLife();life[1]=1;life[2]=-1;life[3]=0;n.networkApplyLife(life);
 });
 await guest.waitForFunction(()=>{const w=window.npcNetworkCheck.network.world;return w?.npcs[0].state==='Fly'&&w.npcLife[0][8]===1&&w.npcs[0].p[1]>.2;},undefined,{timeout:15000});
 const before=await guest.evaluate(()=>{const w=window.npcNetworkCheck.network.world;return {state:w.npcs[0].state,y:w.npcs[0].p[1],flight:w.npcLife[0].slice(7)};});await host.close();
 await guest.waitForFunction(()=>window.npcNetworkCheck.network.host,undefined,{timeout:15000});
 await guest.waitForFunction(()=>{const n=window.npcNetworkCheck.npcs[0];return n.flight.active&&n.state==='Fly'&&n.actor.position.y>.2;},undefined,{timeout:5000});
 const promoted=await guest.evaluate(()=>{const n=window.npcNetworkCheck.npcs[0];return {state:n.state,y:n.actor.position.y,ground:n.surfaceY};});assert(promoted.y<=2.901);assert(Math.abs(promoted.ground)<.002);
 await guest.waitForFunction(()=>{const n=window.npcNetworkCheck.npcs[0];return !n.flight.active&&n.state==='Walk'&&Math.abs(n.actor.position.y)<.02;},undefined,{timeout:12000});
 const landed=await guest.evaluate(()=>{
  const n=window.npcNetworkCheck.npcs[0];window.npcNetworkCheck.samples=[];
  window.npcNetworkCheck.timer=setInterval(()=>{const n=window.npcNetworkCheck.npcs[0];window.npcNetworkCheck.samples.push({state:n.state,p:n.actor.position.toArray(),q:n.actor.quaternion.toArray()});},16);
  return {state:n.state,y:n.actor.position.y};
 });
 await guest.waitForFunction(()=>window.npcNetworkCheck.samples.length>=60,undefined,{timeout:10000});
 const motion=await guest.evaluate(()=>{clearInterval(window.npcNetworkCheck.timer);return window.npcNetworkCheck.samples;});let checked=0,worstForward=1;
 for(let i=1;i<motion.length;i++){
  const a=motion[i-1],b=motion[i];if(a.state!==b.state||!['Walk','Run'].includes(b.state))continue;
  const dx=b.p[0]-a.p[0],dz=b.p[2]-a.p[2],length=Math.hypot(dx,dz);if(length<.0001||length>.5)continue;
  const [x,y,z,w]=b.q,fx=2*(x*z+w*y),fz=1-2*(x*x+y*y);worstForward=Math.min(worstForward,(dx*fx+dz*fz)/length);checked++;
 }
 assert(checked>=10);assert(worstForward>.99);assert.deepEqual(errors,[]);
 const report={before,promoted,landed,checked,worstForward,errors};await writeFile(new URL('network-checks.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){
 const diagnostics=await Promise.all(pages.filter(page=>!page.isClosed()).map(page=>page.evaluate(()=>{const w=window.npcNetworkCheck,n=w?.npcs[0];return {host:w?.network.host,roomHost:w?.network.room.host,id:w?.network.id,npc:n&&{state:n.state,p:n.actor.position.toArray(),life:n.networkLife()},world:w?.network.world?.npcs[0],errors:[]};}).catch(()=>undefined)));
 await writeFile(new URL('network-failure.json',output),JSON.stringify({message:String(error),diagnostics,errors},null,2));console.error(JSON.stringify({diagnostics,errors}));throw error;
}finally{await browser.close();}
