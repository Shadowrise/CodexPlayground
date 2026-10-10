import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('kirby-language-v1','ru'));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.centipedeTest={get character(){return character;},get event(){return currentCentipede();},get model(){return arenaCentipede;},view:centipedeView,followCamera,scene,renderer,camera,music,sounds,boatTime};'});});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5174/');await page.waitForSelector('#startup-loader',{state:'hidden',timeout:120000});await page.fill('#player-name-input','Друг Топотушки');await page.click('#new-game');await page.click('#start-game');await page.waitForFunction(()=>window.centipedeTest?.character);
 async function approach(){await page.evaluate(()=>{const t=window.centipedeTest,p=t.model.startTrail(t.boatTime()).at(-1),c=t.character;c.actor.position.set(p[0]+3,0,p[1]);c.yaw=-Math.PI/2;c.actor.rotation.set(0,c.yaw,0);t.followCamera.reset(c.yaw);});await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Поиграть с Топотушкой'));await page.keyboard.press('e');await page.waitForFunction(()=>window.centipedeTest.event?.stage==='invite');}
 async function expire(){const old=await page.evaluate(()=>window.centipedeTest.event.stage);await page.evaluate(async()=>{const {CENTIPEDE_TIMES}=await import('/src/centipede-event.ts');const t=window.centipedeTest;t.character.setActivity('Idle');t.character.actor.position.set(140,5,-45);t.event.stageAt=Date.now()-CENTIPEDE_TIMES[t.event.stage]-1;});await page.waitForFunction(old=>window.centipedeTest.event?.stage!==old,old);}
 async function finish(replay=false){
  for(let hit=0;hit<9;hit++){
   let guard=0;
   while(!['exhausted','back','dizzy','celebrate'].includes(await page.evaluate(()=>window.centipedeTest.event.stage))){
    assert(++guard<25);
    const stage=await page.evaluate(()=>window.centipedeTest.event.stage);
    if(['stomp','wheelRoll'].includes(stage)&&hit%3===0){
     await page.evaluate(async stage=>{const {centipedeWheel}=await import('/src/centipede-event.ts');const t=window.centipedeTest,c=t.character;t.event.stageAt=Date.now()-4400;const p=stage==='stomp'?{x:140,z:-45}:centipedeWheel(t.event,Date.now());c.setActivity('Idle');c.actor.position.set(p.x+12,0,p.z+12);c.yaw=-Math.PI*.75;c.actor.rotation.set(0,c.yaw,0);t.followCamera.reset(c.yaw);},stage);await page.waitForTimeout(250);await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-'+stage+'.png'});
     assert(await page.evaluate(()=>window.centipedeTest.view.group.getObjectByName('Топотушка — волны и радужный мяч').visible));
    }
    assert(await page.evaluate(()=>!window.centipedeTest.view.group.getObjectByName('Топотушка — радужный салют').visible));await expire();
   }
   const stage=await page.evaluate(()=>window.centipedeTest.event.stage);assert.equal(stage,['exhausted','back','dizzy'][Math.floor(hit/3)]);
   await page.evaluate(async()=>{const {centipedeTarget,centipedeWheel}=await import('/src/centipede-event.ts');const t=window.centipedeTest,p=centipedeTarget(t.event),c=t.character;c.setActivity('Idle');c.actor.position.set(p[0],0,p[2]+(t.event.stage==='dizzy'?0:1));const target=t.event.stage==='dizzy'?centipedeWheel(t.event,Date.now()):{x:p[0],z:p[2]};c.yaw=Math.atan2(target.x-c.actor.position.x,target.z-c.actor.position.z);c.actor.rotation.set(0,c.yaw,0);t.followCamera.reset(c.yaw);});await page.waitForTimeout(150);
   if(stage==='back'){await page.keyboard.press('Space');await page.waitForTimeout(200);await page.keyboard.press('Space');await page.waitForFunction(()=>window.centipedeTest.character.actor.position.y>2.6);}
   if(hit===6)await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-rainbow-ball.png'});
   await page.keyboard.press('q');await page.waitForFunction(hit=>window.centipedeTest.event.hits===hit+1,hit,{timeout:5000});
   if(!replay)assert(await page.evaluate(()=>!window.centipedeTest.character.achievements.has('centipede')),'friendship waits for completed finale');
   await expire();
  }
  while((await page.evaluate(()=>window.centipedeTest.event.stage))!=='celebrate')await expire();
  await page.waitForFunction(()=>window.centipedeTest.character.achievements.has('centipede'));
 }
 await approach();
 const centred=await page.locator('#centipede-event-hud').boundingBox();assert(centred&&Math.abs(centred.x+centred.width/2-720)<1);
 assert(await page.evaluate(()=>!document.querySelector('#action-hint').textContent.includes('Поиграть с Топотушкой')));
 await finish();assert(await page.evaluate(()=>window.centipedeTest.character.achievements.has('centipede')));
 const first=await page.evaluate(async()=>{const {scoreOf}=await import('/src/score.ts');const t=window.centipedeTest;return {points:scoreOf(t.character),eventPoints:t.character.eventPoints,buffers:[...t.sounds.buffers.keys()].filter(k=>k.startsWith('centipede-')),worldDraws:t.renderer.info.render.calls};});assert(first.points>=9);assert(first.buffers.includes('centipede-warning'));assert(first.buffers.includes('centipede-exhausted')&&first.buffers.includes('centipede-stomp')&&first.buffers.includes('centipede-wheelRoll'));
 assert(await page.evaluate(()=>{const t=window.centipedeTest;return t.music.eventAudio.src.endsWith('topotushka-victory.wav')&&!t.music.eventAudio.loop&&t.view.group.getObjectByName('Топотушка — радужный салют').visible;}));
 await page.waitForTimeout(2100);
 const salute=await page.evaluate(()=>{const {renderer,scene,camera,view}=window.centipedeTest,mesh=view.group.getObjectByName('Топотушка — радужный салют'),gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,a=new Uint8Array(w*h*4),b=new Uint8Array(a.length);renderer.render(scene,camera);const withSalute=renderer.info.render.calls;gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);mesh.visible=false;renderer.render(scene,camera);const withoutSalute=renderer.info.render.calls;gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);mesh.visible=true;let pixels=0;for(let i=0;i<a.length;i+=4)if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>2)pixels++;return {draws:withSalute-withoutSalute,pixels};});assert.equal(salute.draws,1);assert(salute.pixels>50,'salute is visible in the normal player camera');
 await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-friends.png'});
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>document.body.classList.add('touch-ui'));await page.waitForTimeout(100);const hud=await page.locator('#centipede-event-hud').boundingBox();assert(hud&&hud.y>=0&&hud.y+hud.height<390);await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-mobile.png'});await page.evaluate(()=>document.body.classList.remove('touch-ui'));await page.setViewportSize({width:1440,height:900});
 await expire();assert.equal(await page.evaluate(()=>window.centipedeTest.event.stage),'rest');assert(await page.evaluate(()=>!window.centipedeTest.music.eventActive));const restingId=await page.evaluate(()=>window.centipedeTest.event.startedAt);await page.keyboard.press('e');assert.equal(await page.evaluate(()=>window.centipedeTest.event.startedAt),restingId,'E cannot restart during cooldown');
 await page.evaluate(()=>{window.centipedeTest.event.stageAt=Date.now()-59000;});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.centipedeTest.event.stage),'rest');await expire();assert(await page.evaluate(()=>!window.centipedeTest.event));await approach();
 // Replaying is allowed after the full minute. Check score through every hit.
 await finish(true);
 assert.equal(await page.evaluate(async()=>{const {scoreOf}=await import('/src/score.ts');return scoreOf(window.centipedeTest.character);}),first.points);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS real E/Q/Space, nine hits across three phases, no early friendship/salute, minute cooldown, unchanged replay score, mobile HUD',first,salute,errors}));
}finally{await browser.close();}
