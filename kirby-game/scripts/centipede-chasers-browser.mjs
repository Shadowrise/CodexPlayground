import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('kirby-language-v1','ru'));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.chaserTest={get character(){return character;},get event(){return currentCentipede();},get model(){return arenaCentipede;},view:centipedeView,followCamera,scene,renderer,camera,boatTime};'});});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5174/');await page.waitForSelector('#startup-loader',{state:'hidden',timeout:120000});
 await page.fill('#player-name-input','Догонялки');await page.click('#new-game');await page.click('#start-game');await page.waitForFunction(()=>window.chaserTest?.character);
 await page.evaluate(()=>{const t=window.chaserTest,p=t.model.startTrail(t.boatTime()).at(-1),c=t.character;c.actor.position.set(p[0]+3,0,p[1]);c.yaw=-Math.PI/2;c.actor.rotation.set(0,c.yaw,0);t.followCamera.reset(c.yaw);});
 await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Поиграть с Топотушкой'));await page.keyboard.press('e');await page.waitForFunction(()=>window.chaserTest.event?.stage==='invite');
 await page.evaluate(()=>{const t=window.chaserTest;t.event.stage='gather';t.event.phase=2;t.event.stageAt=Date.now();t.character.setActivity('Idle');t.character.actor.position.set(160,0,-32);t.character.yaw=0;t.character.actor.rotation.set(0,0,0);t.followCamera.reset(0);});
 await page.waitForFunction(()=>window.chaserTest.event?.chasers?.balls.length===3);
 await page.waitForTimeout(1100);
 const chase=await page.evaluate(()=>{const t=window.chaserTest;return {balls:t.event.chasers.balls.length,draws:t.view.group.getObjectByName('Разноцветные полосатые шарики').count,hint:document.querySelector('#centipede-event-hud').textContent};});
 assert.equal(chase.draws,3);assert(chase.hint.includes('мячики'));
 await page.evaluate(()=>{const t=window.chaserTest,c=t.character,b=t.event.chasers.balls[0];b.x=c.actor.position.x;b.z=c.actor.position.z+3.2;b.vx=b.vz=0;b.contactAfter=Date.now()+1000;});
 await page.keyboard.press('q');await page.waitForFunction(()=>window.chaserTest.event.chasers.balls[0].serial===1);
 assert(await page.evaluate(()=>!window.chaserTest.character.roll.active),'proactive real Q pushes only the ball');
 await page.waitForTimeout(650);
 await page.evaluate(()=>{const t=window.chaserTest,c=t.character,b=t.event.chasers.balls[0];b.x=c.actor.position.x+.3;b.z=c.actor.position.z+.3;b.vx=b.vz=0;b.kickUntil=b.contactAfter=0;});
 await page.waitForFunction(()=>window.chaserTest.character.roll.active);
 const before=await page.evaluate(()=>window.chaserTest.character.actor.position.toArray());await page.waitForTimeout(350);
 const after=await page.evaluate(()=>window.chaserTest.character.actor.position.toArray());assert(Math.hypot(after[0]-before[0],after[2]-before[2])>.5);
 await page.waitForTimeout(750);await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-chasers.png'});
 const points=await page.evaluate(()=>window.chaserTest.character.eventPoints);assert.equal(points,0,'chasers do not award extra points');
 const pair=await page.evaluate(async()=>{
  const {chaseBallHeight,CHASERS}=await import('/src/centipede-chasers.ts'),t=window.chaserTest,state=t.event.chasers;
  state.balls.length=2;state.at=Date.now();
  Object.assign(state.balls[0],{x:138.6,z:-21,vx:8,vz:0,kickUntil:Date.now()+5000,contactAfter:Date.now()+5000});
  Object.assign(state.balls[1],{x:141.4,z:-21,vx:-8,vz:0,kickUntil:Date.now()+5000,contactAfter:Date.now()+5000});
  let minimum=Infinity;
  for(let frame=0;frame<36;frame++){
   await new Promise(requestAnimationFrame);const [a,b]=state.balls,now=Date.now();
   minimum=Math.min(minimum,Math.hypot(a.x-b.x,a.z-b.z,chaseBallHeight(state,0,now)-chaseBallHeight(state,1,now)));
  }
  const [a,b]=state.balls;return {minimum,diameter:CHASERS.radius*2,leftVelocity:a.vx,rightVelocity:b.vx};
 });
 assert(pair.minimum>=pair.diameter-.002);assert(pair.leftVelocity<0&&pair.rightVelocity>0,'real scene balls bounce apart');
 await page.evaluate(()=>{const t=window.chaserTest;t.event.stage='back';t.event.stageAt=Date.now();});
 await page.waitForFunction(()=>!window.chaserTest.view.group.getObjectByName('Топотушка — прыгучие шарики').visible);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS real E/Q, pursuing balls, mutual recoil, ball-to-ball collisions, transition cleanup, no extra points',chase,pair,errors,screenshot:process.env.TEMP+'/kirby-topotushka-chasers.png'}));
}finally{await browser.close();}
