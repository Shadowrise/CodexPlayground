import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('kirby-language-v1','ru'));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.bossFix={get c(){return character},get q(){return currentCentipede()},get model(){return arenaCentipede},view:centipedeView,scene,renderer,camera,shadows,followCamera,boatTime,set day(v){dayStart=Date.now();dayStartPhase=v}};'});});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5174/');await page.locator('#startup-loader').waitFor({state:'hidden',timeout:120000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Друг');await page.locator('#start-game').click();
 await page.waitForFunction(()=>window.bossFix.c);
 const approach=()=>page.evaluate(()=>{const t=window.bossFix,head=t.model.startTrail(t.boatTime()).at(-1);t.c.setActivity('Idle');t.c.actor.position.set(head[0]+3,0,head[1]);t.day=.25;});
 await approach();await page.waitForFunction(()=>document.querySelector('#action-hint').textContent.includes('Поиграть'));
 await page.keyboard.press('e');await page.waitForFunction(()=>window.bossFix.q?.stage==='invite');
 await page.evaluate(()=>{window.bossFix.q.stageAt=Date.now()-2600;});await page.waitForFunction(()=>window.bossFix.q.stage==='warning');
 await page.evaluate(()=>{const t=window.bossFix;t.q.stageAt=Date.now();t.c.actor.position.set(140,0,-45);t.c.yaw=.5;t.followCamera.reset(t.c.yaw);});
 await page.waitForTimeout(250);await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-day-lane.png'});
 const hud=await page.locator('#centipede-event-hud').boundingBox();assert(Math.abs(hud.x+hud.width/2-720)<1);
 assert((await page.locator('#centipede-event-hud').innerText()).includes('жёлтой дорожки'));
 await page.evaluate(()=>{const t=window.bossFix;t.day=.75;t.q.stageAt=Date.now();});
 await page.waitForTimeout(250);await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-night-lane.png'});
 assert(await page.evaluate(()=>{const lane=window.bossFix.view.group.children[0],u=lane.material.uniforms;return lane.visible&&lane.geometry.getAttribute('uv')&&u.progress.value>0&&u.progress.value<1&&u.attack.value===0&&!lane.material.toneMapped;}));
 await page.evaluate(()=>{const t=window.bossFix;t.day=.25;t.q.stageAt=Date.now()-1900;});await page.waitForFunction(()=>window.bossFix.q.stage==='charge');
 await page.evaluate(()=>{window.bossFix.q.stageAt=Date.now()-6100;});await page.waitForFunction(()=>window.bossFix.q.stage==='balls');
 await page.evaluate(async()=>{const t=window.bossFix,{centipedeSegments}=await import('/src/centipede-event.ts'),head=centipedeSegments(t.q,Date.now()+700)[0];t.c.setActivity('Idle');t.c.actor.position.set(head.x+Math.sin(head.yaw)*7,0,head.z+Math.cos(head.yaw)*7);t.c.yaw=head.yaw+Math.PI;t.followCamera.reset(t.c.yaw);});
 await page.waitForTimeout(900);await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-bent-head.png'});
 // The real solo loop opens the bell promptly, and the ordinary push rings it.
 await page.evaluate(async()=>{const {CENTIPEDE_TIMES}=await import('/src/centipede-event.ts');window.bossFix.q.stageAt=Date.now()-CENTIPEDE_TIMES.balls+150;});
 await page.waitForFunction(()=>window.bossFix.q.stage==='exhausted',{},{timeout:1500});
 await page.evaluate(async()=>{const t=window.bossFix,{centipedeTarget}=await import('/src/centipede-event.ts'),p=centipedeTarget(t.q);t.c.setActivity('Idle');t.c.actor.position.set(p[0],0,p[2]+2);t.c.yaw=Math.PI;});
 await page.keyboard.press('q');await page.waitForFunction(()=>window.bossFix.q.stage==='tickle');
 // Use the real animated back surfaces and the game's ordinary ground pass.
 await page.evaluate(()=>{const t=window.bossFix;t.q.phase=2;t.q.hits=3;t.q.stage='back';t.q.stageAt=Date.now();t.c.setActivity('Idle');t.c.actor.position.set(140,5,-45);});
 await page.waitForTimeout(220);
 await page.evaluate(()=>{const t=window.bossFix,b=t.model.collision.bodies[3];t.c.actor.position.set(b.x,b.y+b.ry+.3,b.z);});
 await page.waitForFunction(()=>window.bossFix.c.surfaceY>2.5);
 const surface=await page.evaluate(()=>window.bossFix.c.surfaceY);await page.keyboard.press('Space');
 await page.waitForFunction(y=>window.bossFix.c.actor.position.y>y+.5,surface);await page.waitForTimeout(2600);
 assert(await page.evaluate(()=>window.bossFix.c.surfaceY>2.5));
 await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-standing-back.png'});
 // Leaving begins a visible countdown; returning preserves the same event.
 const started=await page.evaluate(()=>window.bossFix.q.startedAt);
 await page.evaluate(()=>{const t=window.bossFix;t.c.setActivity('Idle');t.c.actor.position.set(140,0,5);});
 await page.waitForFunction(()=>window.bossFix.q.emptySince!==undefined);
 assert((await page.locator('#centipede-event-hud').innerText()).includes('Игра сбросится через'));
 // World effects are culled at this distance; the ten-second HUD must not be.
 await page.evaluate(()=>{window.bossFix.c.actor.position.set(-100,0,-120);});
 await page.waitForFunction(()=>window.bossFix.view.group.visible===false);
 assert(await page.locator('#centipede-event-hud').isVisible());
 assert((await page.locator('#centipede-event-hud').innerText()).includes('Игра сбросится через'));
 await page.evaluate(()=>{window.bossFix.c.actor.position.set(170,0,-45);});
 await page.waitForFunction(()=>window.bossFix.q.emptySince===undefined);assert.equal(await page.evaluate(()=>window.bossFix.q.startedAt),started);
 await page.evaluate(()=>{window.bossFix.c.actor.position.set(140,0,5);});await page.waitForFunction(()=>window.bossFix.q.emptySince!==undefined);
 await page.evaluate(()=>{window.bossFix.q.emptySince=Date.now()-10001;});await page.waitForFunction(()=>!window.bossFix.q);
 // A rectangular sign with the same physical/canvas aspect ratio, no stretched type.
 await page.evaluate(()=>{const t=window.bossFix;t.renderer.setAnimationLoop(null);document.querySelectorAll('body > :not(#game)').forEach(e=>e.style.display='none');t.camera.position.set(140,7.3,17);t.camera.lookAt(140,6.2,-5);t.camera.updateMatrixWorld();t.renderer.render(t.scene,t.camera);});
 await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-arena-sign.png'});
 // Sample accepted animation transitions in the real scene, from one route clock.
 await page.evaluate(async()=>{
  const t=window.bossFix,{startCentipede}=await import('/src/centipede-event.ts'),trail=t.model.startTrail(25),head=trail.at(-1);
  const q=startCentipede(trail,{id:'test',p:[head[0],0,head[1]],yaw:0,size:1,available:true,done:false,points:0},100000);
  window.transitionSample=q;t.camera.position.set(140,90,-35);t.camera.lookAt(140,0,-45);t.camera.updateMatrixWorld();
 });
 for(const [stage,phase,at,elapsed] of [['gather',2,100000,0],['gather',2,100000,6000],['gather',2,100000,12000],['coil',2,112000,1200],['lower',2,115000,900],['rise',2,117000,900]]){
  await page.evaluate(({stage,phase,at,elapsed})=>{const t=window.bossFix,q=window.transitionSample;q.stage=stage;q.phase=phase;q.stageAt=at;t.model.update((at+elapsed)/1000,t.camera.position,q,at+elapsed);t.view.group.visible=false;t.renderer.render(t.scene,t.camera);},{stage,phase,at,elapsed});
  if(stage==='gather'&&elapsed===6000||stage==='coil'||stage==='rise')await page.screenshot({path:process.env.TEMP+`/kirby-topotushka-natural-${stage}.png`});
 }
 // Rounded ends of both types are checked in the actual world shaders.
 await page.evaluate(()=>{const t=window.bossFix,q=window.transitionSample;q.phase=1;q.stage='warning';q.stageAt=130000;q.route=[[122,-60],[126,-73],[144,-67],[158,-49],[148,-24]];q.from=q.route[0];q.control=q.route[1];q.to=q.route.at(-1);t.view.update(q,'test',130000,t.c.actor.position.clone().set(140,0,-45),true,'Q',t.camera);t.renderer.render(t.scene,t.camera);});
 await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-rounded-run.png'});
 await page.evaluate(()=>{const t=window.bossFix,q=window.transitionSample;q.stage='balls';q.stageAt=131000;t.model.update(131,t.camera.position,q,131000);t.view.update(q,'test',131300,t.c.actor.position.clone().set(140,0,-45),true,'Q',t.camera);t.renderer.render(t.scene,t.camera);});
 await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-rounded-balls.png'});
 const restingFeet=await page.evaluate(async()=>{
  const t=window.bossFix,{Box3,Vector3}=await import('/node_modules/.vite/deps/three.js');t.view.group.visible=false;
  t.model.update(22,t.camera.position,undefined,500000);t.model.update(22,t.camera.position,undefined,500500);t.model.group.updateMatrixWorld(true);
  const boots=[];t.model.group.traverse(o=>{if(o.isMesh&&o.parent.name.startsWith('Boot_')){o.geometry.computeBoundingBox();boots.push(o);}});
  const initial=boots.map(o=>o.getWorldPosition(new Vector3()));let groundError=0,slide=0;
  for(let i=0;i<=30;i++){
   t.model.update(22+i/30,t.camera.position,undefined,500500+i/30*1000);t.model.group.updateMatrixWorld(true);
   boots.forEach((o,index)=>{groundError=Math.max(groundError,Math.abs(new Box3().copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).min.y-.025));slide=Math.max(slide,o.getWorldPosition(new Vector3()).distanceTo(initial[index]));});
  }
  const centre=t.model.group.getObjectByName('Segment_5').getWorldPosition(new Vector3());t.camera.position.copy(centre).add(new Vector3(17,4,9));t.camera.lookAt(centre);t.camera.updateMatrixWorld();t.shadows?.update();t.renderer.render(t.scene,t.camera);
  return {boots:boots.length,groundError,slide};
 });
 assert.equal(restingFeet.boots,22);assert(restingFeet.groundError<.004);assert(restingFeet.slide<.004);
 await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-planted-feet.png'});
 await page.evaluate(()=>{const t=window.bossFix;t.camera.position.set(140,75,-20);t.camera.lookAt(140,0,-45);t.camera.updateMatrixWorld();t.renderer.render(t.scene,t.camera);});
 await page.screenshot({path:process.env.TEMP+'/kirby-topotushka-dark-arena.png'});
 assert.deepEqual(errors,[]);console.log('PASS centred HUD, rounded warnings, natural phase transitions, actual back landing/jump, far-away countdown, returning/empty reset, arena sign, prompt tail push and planted feet',JSON.stringify(restingFeet));
}finally{await browser.close();}
