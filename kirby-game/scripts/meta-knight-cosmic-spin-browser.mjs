import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const output=fileURLToPath(new URL('../artifacts/meta-knight-phase4-spin-2026-10-24-v3/',import.meta.url));
await mkdir(output+'screenshots/',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],frames=[];
 page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text())){errors.push(m.text());console.error(m.text());}});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('renderer.setAnimationLoop(', 'renderer.setAnimationLoop(window.__spinMainLoop = ')+'\nwindow.spinQA={THREE,travel:cosmicArena,renderer,chat,sounds,get c(){return character},mainFrame(time){previousTime=time-1000/60;window.__spinMainLoop(time)}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.spinQA,null,{timeout:180000});await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Грозовой вихрь');await page.locator('#start-game').click();await page.waitForFunction(()=>!!spinQA.c);
 await page.evaluate(async()=>{
  const q=spinQA;await q.travel.enter(q.c);await q.sounds.prepareKnightCosmic();q.renderer.setAnimationLoop(null);
  q.rules=await import('/src/meta-knight-battle.ts');q.cosmic=await import('/src/meta-knight-cosmic.ts');q.spin=await import('/src/meta-knight-cosmic-spin.ts');
  q.c.actor.position.set(2000,0,-2);q.travel.soloNow=1000000;q.travel.startBattle();q.chat.show();
 });
 await page.locator('#chat-input').fill('/phase 4');await page.locator('#chat-input').press('Enter');
 await page.evaluate(()=>{
  const q=spinQA;q.base=structuredClone(q.travel.battle);q.c.actor.position.set(2009,0,9);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;q.elapsed=0;q.cues=[];
  q.initialGlErrors=[];for(let i=0;i<8;i++){const error=q.renderer.getContext().getError();if(!error)break;q.initialGlErrors.push(error);}
  const cue=q.travel.battleView.cue;q.travel.battleView.cue=kind=>{q.cues.push({kind,at:q.travel.soloNow});cue(kind);};
  q.input={forward:false,backward:false,left:false,right:false,jump:false,jumpPressed:false,dashPressed:false,attack:false,attackPressed:false};
  q.travel.setGodMode(true);
  q.step=(dt,input=q.input)=>{q.travel.update(dt,q.travel.soloNow/1000,q.c,input,0,0,false,false);q.elapsed=q.travel.soloNow-q.base.since;};
  q.metrics=()=>{q.elapsed=q.travel.soloNow-q.base.since;q.travel.render();const s=q.travel.battle,v=q.travel.battleView,core=v.cosmicOrbs.cores,dir=q.travel.camera.getWorldDirection(new q.THREE.Vector3());return {stage:s.stage,elapsed:q.elapsed,since:s.since,until:s.until,yaw:q.travel.knight.yaw,height:q.c.actor.position.y,radius:Math.hypot(q.c.actor.position.x-2000,q.c.actor.position.z),bossHeight:q.travel.knight.actor.position.y,hp:s.hp,life:s.players.solo.hp,orbs:core.count,bolts:v.cosmicOrbs.electricity.hot.count,green:v.bossTarget.group.visible,arrowY:v.bossTarget.arrow.getWorldPosition(new q.THREE.Vector3()).y,window:v.bossTarget.ring.material.uniforms.progress.value,cameraAngle:-Math.asin(dir.y)*180/Math.PI,glError:q.renderer.getContext().getError(),drawCalls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles};};
  q.advanceTo=ms=>{while(q.elapsed<ms-.001)q.step(Math.min(1/60,(ms-q.elapsed)/1000));return q.metrics();};
  q.resetSpin=()=>{
   q.travel.soloBattle=structuredClone(q.spinSnapshot);q.travel.withdrawnBattle=0;q.travel.soloNow=q.spinSnapshot.since;q.elapsed=q.travel.soloNow-q.base.since;q.c.actor.position.set(2000,180,41);q.c.yaw=Math.PI;q.c.actor.rotation.y=q.c.yaw;q.c.setActivity('Fly');q.c.playerDash.cooldown=0;q.travel.follow.reset(q.c.yaw);q.step(1/60);q.travel.setGodMode(false);return q.metrics();
  };
 });
 const shot=async(ms,name,label)=>{const metrics=await page.evaluate(ms=>spinQA.advanceTo(ms),ms);assert.equal(metrics.glError,0);assert.equal(metrics.height,180);assert.equal(metrics.bossHeight,180);const path=output+`screenshots/${name}.png`;await page.screenshot({path});frames.push({...metrics,path,label});console.log(JSON.stringify(metrics));return metrics;};
 const profile=async(name,label,rear=false)=>{
  const metrics=await page.evaluate(rear=>{
   const q=spinQA,T=q.THREE,c=q.travel.camera,actor=q.travel.knight.actor;
   q.profileCamera={p:c.position.clone(),q:c.quaternion.clone(),f:c.fov};
   const centre=actor.getObjectByName('Body_motion').getWorldPosition(new T.Vector3()),rotation=actor.getWorldQuaternion(new T.Quaternion());
   c.position.copy(centre).add((rear?new T.Vector3(12,-2,-16):new T.Vector3(18,1.5,5)).applyQuaternion(rotation));c.lookAt(centre);c.fov=44;c.updateProjectionMatrix();c.updateMatrixWorld();
   const feet=['Left','Right'].map(side=>{
    const foot=actor.getObjectByName(side+'_foot_pivot'),point=new T.Vector3();let front=-Infinity,rear=Infinity;
    foot.traverse(o=>{if(o.isMesh){const positions=o.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i);o.localToWorld(point);actor.worldToLocal(point);front=Math.max(front,point.z);rear=Math.min(rear,point.z);}}});
    return {side,front,rear,pitch:foot.rotation.x};
   });return {...q.metrics(),feet};
  },rear);
  assert.equal(metrics.glError,0);assert(metrics.feet.every(foot=>foot.front<-.08&&foot.pitch>1),'the actual boot meshes must trail behind the torso, toes down');
  const path=output+`screenshots/${name}.png`;await page.screenshot({path});frames.push({...metrics,path,label});
  await page.evaluate(()=>{const q=spinQA,c=q.travel.camera,s=q.profileCamera;c.position.copy(s.p);c.quaternion.copy(s.q);c.fov=s.f;c.updateProjectionMatrix();c.updateMatrixWorld();});return metrics;
 };
 await page.evaluate(()=>spinQA.advanceTo(11000));
 const ascentProfile=await profile('00-ascent-profile','Взлёт · ноги отведены назад');
 await shot(16000,'01-arrival','Прибытие · обычный полёт');
 const flightProfile=await profile('01b-flight-profile','Парение · вид сбоку');
 const flightRear=await profile('01c-flight-rear','Парение · плащ над ногами, вид сзади',true);
 const timing=await page.evaluate(()=>{const q=spinQA,C=q.spin.COSMIC_SPIN,start=q.travel.battle.until+C.warnMs-q.base.since;return {start,warn:C.warnMs,spin:C.spinMs,open:C.openMs};});
 await shot(timing.start-timing.warn*.45,'02-two-handed-windup','Две руки на мече · подготовка вихря');
 await page.evaluate(at=>{const q=spinQA;q.advanceTo(at+1);q.spinSnapshot=structuredClone(q.travel.battle);if(q.spinSnapshot.stage!=='cosmic-spin')throw Error('the checkpoint must be at the start of the actual spin');},timing.start);
 const slow=await shot(timing.start+timing.spin*.12,'03-slow-rotation','Медленное начало вращения');
 const middle=await shot(timing.start+timing.spin*.5,'04-rising-spiral','Разгон · электрическая спираль');
 assert.equal(slow.stage,'cosmic-spin');assert(middle.orbs>slow.orbs);
 const spinProfile=await profile('04b-spin-profile','Вращение · плащ и ноги сбоку');
 const spinRear=await profile('04c-spin-rear','Вращение · плащ и ноги сзади',true);
 // The same sphere seen from close by: no replacement illustration or texture.
 const close=await page.evaluate(()=>{
  const q=spinQA,T=q.THREE,c=q.travel.camera;q.savedCamera={p:c.position.clone(),q:c.quaternion.clone(),f:c.fov};
  const shot=q.spin.cosmicOrbs(q.travel.battle,q.travel.soloNow).find(o=>o.distance>25&&o.distance<32),world=new T.Vector3(2000+shot.p[0],shot.p[1],shot.p[2]).add(q.travel.cosmicFrame.position);
  c.position.copy(world).add(new T.Vector3(2.7,1.7,5));c.lookAt(world);c.fov=44;c.updateProjectionMatrix();c.updateMatrixWorld();q.travel.render();return {shot,glError:q.renderer.getContext().getError()};
 });assert.equal(close.glError,0);await page.screenshot({path:output+'screenshots/05-orb-closeup.png'});
 await page.evaluate(()=>{const q=spinQA,c=q.travel.camera;c.position.copy(q.savedCamera.p);c.quaternion.copy(q.savedCamera.q);c.fov=q.savedCamera.f;c.updateProjectionMatrix();c.updateMatrixWorld();});
 const fast=await shot(timing.start+timing.spin-400,'06-fast-rotation','Максимальная скорость · последние разряды');assert(fast.orbs>middle.orbs);assert(fast.bolts<8192);
 const resting=await shot(timing.start+timing.spin+700,'07-exhaustion','Метакнайт устал · зелёная метка и стрелка');assert(resting.green);assert.equal(resting.until-resting.since,12000);
 const restProfile=await profile('07b-exhaustion-profile','Усталость · ноги остаются сзади');
 const restRear=await profile('07c-exhaustion-rear','Усталость · плащ и ноги сзади',true);
 const clear=await shot(timing.start+timing.spin+3000,'08-open-clear','Последние шары ушли · можно подлетать');assert.equal(clear.orbs,0);assert(clear.green);assert(clear.window>0&&clear.window<.3);
 const approach=await page.evaluate(()=>{const q=spinQA;q.travel.setGodMode(false);q.approachStart=q.c.actor.position.clone();q.c.yaw=Math.atan2(2000-q.c.actor.position.x,-q.c.actor.position.z);q.c.actor.rotation.y=q.c.yaw;q.input.forward=true;q.advanceTo(q.travel.battle.since-q.base.since+9700);q.input.forward=false;return {...q.metrics(),distance:q.c.actor.position.distanceTo(q.approachStart),seconds:6.7};});
 assert(approach.green&&approach.radius<4.8&&approach.radius>3);assert.equal(approach.life,5);await page.screenshot({path:output+'screenshots/09-reached-without-dash.png'});
 await page.locator('canvas').first().focus();await page.keyboard.down('KeyQ');await page.evaluate(()=>{const q=spinQA;q.mainTime=performance.now();q.mainFrame(q.mainTime+=1000/60);});await page.keyboard.up('KeyQ');
 const hit=await page.evaluate(()=>{const q=spinQA;for(let i=0;i<12;i++)q.mainFrame(q.mainTime+=1000/60);return q.metrics();});assert.equal(hit.hp,5);assert.equal(hit.stage,'cosmic-hit');assert(!hit.green);assert.equal(hit.height,180);await page.screenshot({path:output+'screenshots/10-counterattack.png'});
 const repeat=await page.evaluate(()=>{const q=spinQA;q.advanceTo(q.travel.battle.until-q.base.since+900);return q.metrics();});assert.equal(repeat.stage,'cosmic-meteor-draw');assert.equal(repeat.height,180);
 // Honest static exposure, with god mode OFF. The stationary player gets hit.
 const stationary=await page.evaluate(()=>{const q=spinQA;q.resetSpin();const before=q.c.actor.position.clone(),start=q.elapsed;let lowest=5;for(let i=0;i<(q.spin.COSMIC_SPIN.spinMs/1000+3)*60&&q.rules.knightBattleActive(q.travel.battle);i++){q.step(1/60);lowest=Math.min(lowest,q.travel.battle.players.solo.hp);}return {...q.metrics(),lowest,moved:q.c.actor.position.distanceTo(before),duration:q.elapsed-start};});assert(stationary.lowest<5);console.log(JSON.stringify({stationary}));
 // A short-horizon controller uses only ordinary W/S and turning, without
 // teleporting, direct moveYaw, Shift, Space, or invulnerability.
 const dodging=await page.evaluate(()=>{
  const q=spinQA;q.resetSpin();q.c.yaw=Math.PI/2;q.c.actor.rotation.y=q.c.yaw;const start=q.elapsed,route=[];let chosen=q.input,moved=0,last=q.c.actor.position.clone();
  const candidates=[];for(const direction of [1,-1,0])for(const steer of [-1,-.35,0,.35,1])candidates.push({...q.input,forward:direction===1,backward:direction===-1,steer});
  for(let frame=0;frame<(q.spin.COSMIC_SPIN.spinMs/1000+3)*60&&q.rules.knightBattleActive(q.travel.battle);frame++){
   if(frame%8===0){
    const s=q.travel.battle,future=Array.from({length:24},(_,i)=>q.spin.cosmicOrbs(s,q.travel.soloNow+(i+1)*100));let best=Infinity;
    for(const input of candidates){let x=q.c.actor.position.x-2000,z=q.c.actor.position.z,yaw=q.c.yaw,cost=0;
     for(let i=0;i<24;i++){
      yaw+=input.steer*Math.PI*1.1*.1;const speed=(input.forward?2.72:input.backward?-2.24:0)*q.cosmic.COSMIC.flightSpeedMultiplier;x+=Math.sin(yaw)*speed*.1;z+=Math.cos(yaw)*speed*.1;const r=Math.hypot(x,z);
      if(r>41||r<13)cost+=1000+Math.abs(r-32)*30;
      for(const orb of future[i]){const d=Math.hypot(x-orb.p[0],z-orb.p[2]);if(d<1.55)cost+=10000*(1-i/30);else if(d<5)cost+=(5-d)**2*(1-i/30);}
      cost+=(r-35)**2*.007;
     }cost+=Math.abs(input.steer)*.18+(input.forward||input.backward?0:2);
     if(cost<best){best=cost;chosen=input;}
    }route.push({at:q.travel.soloNow-q.spinSnapshot.since,input:chosen});
   }
   q.step(1/60,chosen);moved+=q.c.actor.position.distanceTo(last);last.copy(q.c.actor.position);
  }
  q.dodgeRoute=route;return {...q.metrics(),duration:q.elapsed-start,moved,route};
 });assert(dodging.life>=4&&dodging.moved>15,'ordinary native movement must provide a survivable dodge route');console.log(JSON.stringify({dodging:{...dodging,route:undefined}}));
 await page.screenshot({path:output+'screenshots/11-active-dodging.png'});
 // The physical Space key still triggers the dash while projectiles are active.
 await page.evaluate(()=>{const q=spinQA;q.resetSpin();q.travel.setGodMode(true);q.mainTime=performance.now();q.dashFrom=q.c.actor.position.clone();});
 await page.keyboard.down('Space');const dash=await page.evaluate(()=>{const q=spinQA;for(let i=0;i<36;i++)q.mainFrame(q.mainTime+=1000/60);return {...q.metrics(),state:q.c.state,moved:q.c.actor.position.distanceTo(q.dashFrom)};});await page.keyboard.up('Space');assert.equal(dash.state,'Dash');assert.equal(dash.height,180);assert(dash.moved>3);await page.screenshot({path:output+'screenshots/12-space-dash.png'});
 const camera=await page.evaluate(()=>{const q=spinQA,before=q.travel.follow.azimuth;for(let i=0;i<70;i++)q.travel.update(1/60,q.travel.soloNow/1000,q.c,q.input,1,0,false,false);return {...q.metrics(),orbit:q.travel.follow.azimuth-before};});assert(Math.abs(camera.orbit)>1,'combat must not force the camera back toward the boss');
 // Check a real portrait viewport with the marker showing.
 await page.setViewportSize({width:550,height:900});await page.evaluate(()=>{const q=spinQA;q.resetSpin();q.travel.setGodMode(true);q.advanceTo(q.spinSnapshot.since-q.base.since+q.spin.COSMIC_SPIN.spinMs+3500);q.travel.follow.reset(q.c.yaw);for(let i=0;i<90;i++)q.step(1/60);q.travel.render();});await page.screenshot({path:output+'screenshots/13-portrait-opening.png'});await page.setViewportSize({width:1600,height:1000});
 const reset=await page.evaluate(()=>{const q=spinQA;q.travel.setPhase(2);q.step(1/60);const old=q.metrics();q.travel.setPhase(4);q.step(1/60);q.travel.cancelBattle();q.step(1/60);return {old,cancel:q.metrics()};});assert.equal(reset.old.height,0);assert.equal(reset.old.orbs,0);assert.equal(reset.cancel.stage,'cancelled');assert.equal(reset.cancel.height,0);
 let video;
 if(process.argv.includes('--video')){
  video=await page.evaluate(async()=>{
   const q=spinQA;q.travel.soloBattle=structuredClone(q.spinSnapshot);q.travel.withdrawnBattle=0;const s=q.travel.battle;Object.assign(s,{stage:'cosmic-spin-warn',since:q.spinSnapshot.since-q.spin.COSMIC_SPIN.warnMs,until:q.spinSnapshot.since});delete s.cosmicSpin;
   q.travel.soloNow=s.since;q.elapsed=s.since-q.base.since;q.c.setActivity('Fly');q.c.playerDash.cooldown=0;q.travel.setGodMode(false);q.step(0);q.c.actor.position.set(2000,180,41);q.c.yaw=Math.PI;q.c.actor.rotation.y=q.c.yaw;q.travel.follow.reset(q.c.yaw);q.sounds.stopKnightCosmic();
   const ctx=q.sounds.context,destination=ctx.createMediaStreamDestination();q.sounds.master.connect(destination);await ctx.resume();
   const stream=new MediaStream([...q.renderer.domElement.captureStream(30).getVideoTracks(),...destination.stream.getAudioTracks()]),chunks=[],deltas=[];
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:6000000,audioBitsPerSecond:192000}),stopped=new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=resolve;});recorder.start();
   const begun=performance.now();let previous=begun,elapsed=0,routeIndex=0,pushed=false;
   await new Promise(resolve=>{const frame=time=>{
    const dt=Math.min(.08,Math.max(.001,(time-previous)/1000));previous=time;elapsed+=dt;deltas.push(dt);let input=q.input;
    const spinElapsed=(q.travel.soloNow-q.spinSnapshot.since)/1000,p=q.c.actor.position;
    if(spinElapsed<0){const turn=Math.atan2(Math.sin(Math.PI/2-q.c.yaw),Math.cos(Math.PI/2-q.c.yaw));input={...q.input,steer:Math.max(-1,Math.min(1,turn/(Math.PI*1.1*dt)))};}
    else if(spinElapsed<q.spin.COSMIC_SPIN.spinMs/1000+3){while(routeIndex+1<q.dodgeRoute.length&&q.dodgeRoute[routeIndex+1].at<=spinElapsed*1000)routeIndex++;input=q.dodgeRoute[routeIndex].input;}
    else{
     const toward=Math.atan2(2000-p.x,-p.z),turn=Math.atan2(Math.sin(toward-q.c.yaw),Math.cos(toward-q.c.yaw)),distance=Math.hypot(p.x-2000,p.z);
     const attackPressed=distance<4.7&&!pushed&&q.travel.battle.stage==='cosmic-open';if(attackPressed)pushed=true;
     input={...q.input,steer:Math.max(-1,Math.min(1,turn/(Math.PI*1.1*dt))),forward:distance>4.6&&Math.abs(turn)<.35,attackPressed};
    }
    // Equivalent to manually orbiting the regular camera toward the opponent.
    q.travel.follow.face(Math.atan2(2000-p.x,-p.z));q.step(dt,input);q.travel.render();if(elapsed<(q.spin.COSMIC_SPIN.warnMs+q.spin.COSMIC_SPIN.spinMs)/1000+12)requestAnimationFrame(frame);else resolve();
   };requestAnimationFrame(frame);});
   recorder.stop();await stopped;q.sounds.master.disconnect(destination);stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(chunks,{type:recorder.mimeType}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));deltas.sort((a,b)=>a-b);return {data:btoa(binary),elapsed,frames:deltas.length,wallSeconds:(performance.now()-begun)/1000,medianMs:deltas[Math.floor(deltas.length*.5)]*1000,p95Ms:deltas[Math.floor(deltas.length*.95)]*1000,stage:q.travel.battle.stage,hp:q.travel.battle.hp,life:q.travel.battle.players.solo.hp,height:q.c.actor.position.y};
  });await writeFile(output+'first-subphase-in-game.webm',Buffer.from(video.data,'base64'));delete video.data;assert.equal(video.height,180);assert.equal(video.hp,5,'the live video must include an actual successful counterattack');assert(video.life>=4);
 }
 const sheet=await browser.newPage({viewport:{width:1600,height:1000}}),images=await Promise.all(frames.map(async f=>({...f,src:`data:image/png;base64,${(await readFile(f.path)).toString('base64')}`})));
 await sheet.setContent(`<style>body{margin:0;padding:24px;background:#080d20;color:#e8edff;font:18px system-ui}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}figure{margin:0}img{width:100%}figcaption{padding:10px}</style><h1>Четвёртая фаза · грозовой вихрь · кадры из игры</h1><div class="grid">${images.map(f=>`<figure><img src="${f.src}"><figcaption>${f.label}</figcaption></figure>`).join('')}</div>`);await sheet.screenshot({path:output+'all-stages.png',fullPage:true});
 assert.deepEqual(errors,[]);await writeFile(output+'report.json',JSON.stringify({timing,frames,ascentProfile,flightProfile,flightRear,spinProfile,spinRear,restProfile,restRear,close,approach,hit,repeat,stationary,dodging,dash,camera,reset,video,errors,cues:await page.evaluate(()=>spinQA.cues)},null,2));console.log(JSON.stringify({output,timing,frames:frames.length,approach,hit,stationary,dodgeLife:dodging.life,video,errors}));
}finally{await browser.close();}
