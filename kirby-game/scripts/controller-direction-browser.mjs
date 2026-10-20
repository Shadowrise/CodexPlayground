import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const output=new URL('../node_modules/.cache/controller-direction/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],checks=[];
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage(mobile?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:800}});
  page.on('pageerror',e=>errors.push(e.stack));
  await page.addInitScript(()=>{
   localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');
   window.testPad={id:'QA standard pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0,touched:false}))};
   Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad]});
  });
  for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
  await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch();let body=await response.text();
   assert(body.includes('renderer.setAnimationLoop('));
   body=body.replace('renderer.setAnimationLoop(','renderer.setAnimationLoop(window.controlsFrame=');
   await route.fulfill({response,body:body+`
window.controlsQA={travel:cosmicArena,renderer,pad:gamepad.input,get touch(){return touch},get c(){return character},
 stop(){renderer.setAnimationLoop(null)},step(dt=1/60){window.controlsFrame(previousTime+dt*1000)},
 reset(yaw=0){character.setActivity('Idle');character.actor.position.set(cosmicArena.active?2020:140,0,15);character.yaw=yaw;character.actor.rotation.y=yaw},
 sample(){return {x:character.actor.position.x,z:character.actor.position.z,yaw:character.yaw,state:character.state}},
};`});
  });
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:5193/');
  await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
  await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Направление');await page.locator('#start-game').click();
  await page.waitForFunction(()=>!!window.controlsQA?.c);await page.evaluate(()=>{controlsQA.stop();controlsQA.reset();controlsQA.step();});
  if(!mobile){
   const rates=await page.evaluate(()=>{
    const q=controlsQA,results={};
    for(const analog of [false,true]){
     q.pad.select(analog?JSON.stringify([testPad.id,0]):'keyboard');q.step();q.reset();
     // Use real key events so main.ts assembles both inputs through its normal path.
     if(analog)testPad.axes=[-1,0,0,0];else window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA'}));
     for(let frame=0;frame<60;frame++)q.step();results[analog?'gamepad':'keyboard']=q.c.yaw*180/Math.PI;
     testPad.axes=[0,0,0,0];window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyA'}));q.step();
    }return results;
   });
   assert(Math.abs(rates.keyboard-198)<1e-7);assert(Math.abs(rates.gamepad-198)<1e-7);checks.push({rates});
  }
  await page.evaluate(async()=>{
   const q=controlsQA;q.pad.select('keyboard');testPad.axes=[0,0,0,0];q.step();await q.travel.enter(q.c);
   q.c.actor.position.set(2000,0,-2);q.travel.startBattle();while(q.travel.battle.stage==='intro')q.step(.05);q.travel.toggleGodMode();
  });
  const modes=mobile?['touch']:['gamepad','keyboard'];
  for(const mode of modes){
   await page.evaluate(mode=>{const q=controlsQA;q.pad.select(mode==='gamepad'?JSON.stringify([testPad.id,0]):'keyboard');q.step();},mode);
   for(const phase of [1,2,3]){
    await page.evaluate(phase=>{const q=controlsQA;if(q.travel.battle.phase!==phase)q.travel.setPhase(phase);q.step();},phase);
    for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const [x,y] of [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1]]){
     let touchSession;
     if(mode==='touch'){
      const box=await page.locator('#touch-stick').boundingBox(),radius=box.width*.34*.7,length=Math.max(1,Math.hypot(x,y));
      touchSession=await page.context().newCDPSession(page);await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2+x/length*radius,y:box.y+box.height/2+y/length*radius}]});
     }
     const result=await page.evaluate(({mode,x,y,yaw})=>{
      const q=controlsQA;q.reset(yaw);
      const codes=[...(x>0?['KeyD']:x<0?['KeyA']:[]),...(y>0?['KeyS']:y<0?['KeyW']:[])];
      if(mode==='gamepad')testPad.axes=[x,y,0,0];else if(mode==='keyboard')for(const code of codes)window.dispatchEvent(new KeyboardEvent('keydown',{code}));
      const before=q.sample();q.step();const after=q.sample();
      if(mode==='gamepad')testPad.axes=[0,0,0,0];else if(mode==='keyboard')for(const code of codes)window.dispatchEvent(new KeyboardEvent('keyup',{code}));
      return {dx:after.x-before.x,dz:after.z-before.z,yaw:after.yaw,phase:q.travel.battle.phase};
     },{mode,x,y,yaw});
     const length=Math.hypot(x,y),distance=3.4/60;
     assert(Math.abs(result.dx-x/length*distance)<1e-7,JSON.stringify({mode,x,y,yaw,result}));
     assert(Math.abs(result.dz-y/length*distance)<1e-7,JSON.stringify({mode,x,y,yaw,result}));
     if(touchSession){await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touchSession.detach();}
     const stopped=await page.evaluate(()=>{const q=controlsQA,before=q.sample();q.step();return {before,after:q.sample()};});
     assert.equal(stopped.before.x,stopped.after.x);assert.equal(stopped.before.z,stopped.after.z);assert.equal(stopped.before.yaw,stopped.after.yaw);
    }
   }
   checks.push({mode,phases:[1,2,3],directions:8,initialHeadings:4,releaseStops:true});
  }
  if(!mobile){
   // A paused fight and the LB emote wheel must never leak the raw stick into movement.
   await page.evaluate(()=>{const q=controlsQA;q.pad.select(JSON.stringify([testPad.id,0]));q.step();q.reset();testPad.axes=[0,-1,0,0];document.querySelector('#settings-toggle').click();});
   const paused=await page.evaluate(()=>{const q=controlsQA,before=q.sample();q.step();return {before,after:q.sample()};});assert.deepEqual(paused.before,paused.after);
   await page.locator('#settings-toggle').click();
   const wheel=await page.evaluate(()=>{const q=controlsQA;q.reset();testPad.buttons[4]={pressed:true,value:1};const before=q.sample();q.step();return {before,after:q.sample()};});assert.deepEqual(wheel.before,wheel.after);
   const free=await page.evaluate(()=>{
    const q=controlsQA;testPad.axes=[0,0,0,0];testPad.buttons[4]={pressed:false,value:0};q.step();q.travel.cancelBattle();q.reset();testPad.axes=[1,0,0,0];const before=q.sample();q.step();return {before,after:q.sample(),engaged:q.travel.engaged};
   });assert(!free.engaged);assert.equal(free.before.x,free.after.x);assert.equal(free.before.z,free.after.z);assert(free.after.yaw<free.before.yaw);
   checks.push({pauseBlocksStick:true,emoteWheelBlocksStick:true,cancelRestoresTankSteering:true});
  }
  await page.screenshot({path:new URL(mobile?'touch.png':'desktop.png',output).pathname.replace(/^\/([A-Z]:)/,'$1')});
  await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('checks.json',output),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
