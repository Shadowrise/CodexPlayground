// Run against local Vite + game-server: GAME_URL=http://127.0.0.1:5198 node scripts/pidgie-follow-network-browser.mjs
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],base=process.env.GAME_URL??'http://127.0.0.1:5173';
try{
 const context=await browser.newContext({viewport:{width:800,height:600}});
 await context.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 await context.route('**/src/main.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.pidgieTest={bread,pidgieSafeWalk,constrainNpc,get network(){return network;},get bird(){return pidgieNpc;},get character(){return character;}};'});
 });
 const enter=async name=>{
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#network-join').click();await page.locator('#player-name-input').fill(name);
  await page.waitForFunction(()=>!document.querySelector('#start-game')?.disabled,undefined,{timeout:120000});
  await page.locator('#start-game').click();await page.waitForFunction(()=>window.pidgieTest?.character&&window.pidgieTest?.bird,undefined,{timeout:120000});return page;
 };
 const host=await enter('Pidgie follow host'),guest=await enter('Pidgie follow guest');
 const move=async(page,p)=>page.evaluate(p=>{const c=window.pidgieTest.character;c.setActivity('Idle');c.actor.position.fromArray(p);c.surfaceY=p[1];c.yaw=0;c.actor.rotation.set(0,0,0);},p);
 await host.waitForFunction(()=>window.pidgieTest.network.actors.size===1);
 await move(guest,await guest.evaluate(()=>window.pidgieTest.bread.state.p));
 await guest.waitForFunction(()=>window.pidgieTest.bread.state.owner===window.pidgieTest.network.id);
 await move(host,[0,0,0]);
 // This forest route stalled at (93.65, -61.63) with the former landing-clearance steering.
 const start=[95.129,0,-78.006],end=[95.129,0,-33.006];
 await move(guest,[start[0],0,start[2]+8]);
 await host.evaluate(p=>{
  const b=window.pidgieTest.bird,s=b.networkState();
  b.applyNetworkState({...s,phase:'wander',p,yaw:0,elapsed:0,refuge:[p[0],p[2]],target:[p[0],p[2]],pause:1,cooldown:0,clip:'Idle',clipTime:0,followId:undefined,followSpeed:undefined},true);
 },start);
 await host.waitForFunction(()=>window.pidgieTest.bird.phase==='follow');
 const carrier=await guest.evaluate(()=>window.pidgieTest.network.id);
 await move(guest,end);
 await host.waitForFunction(()=>window.pidgieTest.bird.state==='Run');
 await guest.waitForFunction(()=>window.pidgieTest.bird.state==='Run');
 const settled=()=>{
  const w=window.pidgieTest,s=w.bird.networkState();
  return s.phase==='follow'&&s.clip==='Idle'&&Math.abs(Math.hypot(s.p[0]-95.129,s.p[2]+33.006)-8)<.85;
 };
 await host.waitForFunction(settled,undefined,{timeout:20000});await guest.waitForFunction(settled,undefined,{timeout:10000});
 const a=await host.evaluate(()=>window.pidgieTest.bird.networkState()),b=await guest.evaluate(()=>window.pidgieTest.bird.networkState());
 assert.equal(a.followId,carrier);assert.equal(b.followId,carrier);assert.equal(a.fearCount,0);assert(Math.hypot(a.p[0]-b.p[0],a.p[2]-b.p[2])<.4);
 // Transfer authority while the guest with bread moves back through the grove.
 await move(guest,[start[0],0,start[2]+8]);await host.waitForFunction(()=>window.pidgieTest.bird.state==='Run');await host.close();
 await guest.waitForFunction(()=>window.pidgieTest.network.host);
 await guest.waitForFunction(()=>{
  const w=window.pidgieTest,s=w.bird.networkState(),p=w.character.actor.position;
  return s.phase==='follow'&&s.clip==='Idle'&&Math.abs(Math.hypot(s.p[0]-p.x,s.p[2]-p.z)-8)<.85;
 },undefined,{timeout:20000});
 const promoted=await guest.evaluate(()=>window.pidgieTest.bird.networkState());assert.equal(promoted.followId,carrier);assert.equal(promoted.fearCount,0);assert.equal(promoted.p[1],0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,route:{start,end},guestFollowing:a.p,remoteFollowing:b.p,afterHostTransfer:promoted.p,errors}));
}finally{await browser.close();}
