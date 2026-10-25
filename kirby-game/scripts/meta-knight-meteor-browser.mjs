import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const output=fileURLToPath(new URL('../artifacts/meta-knight-meteor-guidance-2026-10-25/',import.meta.url));
await mkdir(output+'screenshots/',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],frames=[];
 page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text())){errors.push(m.text());console.error(m.text());}});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('renderer.setAnimationLoop(', 'renderer.setAnimationLoop(window.__spinMainLoop = ')+'\nwindow.spinQA={THREE,travel:cosmicArena,renderer,chat,sounds,get c(){return character},mainFrame(time){previousTime=time-1000/60;window.__spinMainLoop(time)}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.spinQA,null,{timeout:180000});await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Гравитационный удар');await page.locator('#start-game').click();await page.waitForFunction(()=>!!spinQA.c);
 await page.evaluate(async()=>{
  const q=spinQA;await q.travel.enter(q.c);await q.sounds.prepareKnightCosmic();q.renderer.setAnimationLoop(null);
  q.rules=await import('/src/meta-knight-battle.ts');q.cosmic=await import('/src/meta-knight-cosmic.ts');q.spin=await import('/src/meta-knight-cosmic-spin.ts');
  q.c.actor.position.set(2000,0,-2);q.travel.soloNow=1000000;q.travel.startBattle();q.chat.show();
 });
 await page.locator('#chat-input').fill('/phase 4-2');await page.locator('#chat-input').press('Enter');
 await page.evaluate(()=>{
  const q=spinQA;q.base=structuredClone(q.travel.battle);q.c.actor.position.set(2009,0,9);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;q.elapsed=0;q.cues=[];
  q.initialGlErrors=[];for(let i=0;i<8;i++){const error=q.renderer.getContext().getError();if(!error)break;q.initialGlErrors.push(error);}
  const cue=q.travel.battleView.cue;q.travel.battleView.cue=kind=>{q.cues.push({kind,at:q.travel.soloNow});cue(kind);};
  q.input={forward:false,backward:false,left:false,right:false,jump:false,jumpPressed:false,dashHeld:false,sprint:false,attack:false,attackPressed:false};
  q.travel.setGodMode(true);
  q.step=(dt,input=q.input)=>{q.travel.update(dt,q.travel.soloNow/1000,q.c,input,0,0,false,false);q.elapsed=q.travel.soloNow-q.base.since;};
  q.metrics=()=>{q.elapsed=q.travel.soloNow-q.base.since;q.travel.render();const s=q.travel.battle,v=q.travel.battleView,core=v.cosmicOrbs.cores,dir=q.travel.camera.getWorldDirection(new q.THREE.Vector3());return {stage:s.stage,elapsed:q.elapsed,since:s.since,until:s.until,yaw:q.travel.knight.yaw,height:q.c.actor.position.y,radius:Math.hypot(q.c.actor.position.x-2000,q.c.actor.position.z),bossHeight:q.travel.knight.actor.position.y,hp:s.hp,life:s.players.solo.hp,orbs:core.count,bolts:v.cosmicOrbs.electricity.hot.count,green:v.bossTarget.group.visible,arrowY:v.bossTarget.arrow.getWorldPosition(new q.THREE.Vector3()).y,window:v.bossTarget.ring.material.uniforms.progress.value,cameraAngle:-Math.asin(dir.y)*180/Math.PI,glError:q.renderer.getContext().getError(),drawCalls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles};};
  q.advanceTo=ms=>{while(q.elapsed<ms-.001)q.step(Math.min(1/60,(ms-q.elapsed)/1000));return q.metrics();};
  q.resetSpin=()=>{
   q.travel.soloBattle=structuredClone(q.spinSnapshot);q.travel.withdrawnBattle=0;q.travel.soloNow=q.spinSnapshot.since;q.elapsed=q.travel.soloNow-q.base.since;q.c.actor.position.set(2000,180,41);q.c.yaw=Math.PI;q.c.actor.rotation.y=q.c.yaw;q.c.setActivity('Fly');q.c.playerDash.cooldown=0;q.travel.follow.reset(q.c.yaw);q.step(1/60);q.travel.setGodMode(false);return q.metrics();
  };
 });
 await page.evaluate(async()=>{
  const q=spinQA;q.met=await import('/src/meta-knight-cosmic-meteor.ts');
  q.restart=()=>{q.travel.soloNow=1000000;q.c.actor.position.set(2000,180,35);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;const player=q.travel.battle.players.solo;Object.assign(player,{hp:5,reflects:0,invulnerable:0,attackAt:-1e9,handled:-1e9});q.travel.setPhase(4,2);q.base=structuredClone(q.travel.battle);q.elapsed=0;q.step(0);q.c.actor.position.set(2000,180,35);q.travel.follow.reset(q.c.yaw);q.step(1/60);};q.restart();
 });
 const shot=async(ms,name,label)=>{const metrics=await page.evaluate(ms=>spinQA.advanceTo(ms),ms);assert.equal(metrics.glError,0);assert.equal(metrics.height,180);const path=output+`screenshots/${name}.png`;await page.screenshot({path});frames.push({...metrics,path,label});console.log(JSON.stringify({name,...metrics}));return metrics;};
 await shot(550,'01-attraction','Метеорит притягивается из космоса');
 await shot(1100,'02-overhead','Меч поднят · метеорит рядом');
 await shot(1490,'03-side-windup','Боковой замах · прицел следует за игроком');
 await shot(2010,'04-curved-throw','Метеорит летит по дуге');
 const close=await page.evaluate(()=>{
  const q=spinQA,T=q.THREE,c=q.travel.camera,m=q.travel.battleView.meteor.rock;q.savedCamera={p:c.position.clone(),q:c.quaternion.clone(),f:c.fov};
  const p=m.getWorldPosition(new T.Vector3());c.position.copy(p).add(new T.Vector3(3.8,1.5,6.1));c.lookAt(p);c.fov=42;c.updateProjectionMatrix();c.updateMatrixWorld();q.travel.render();return {glError:q.renderer.getContext().getError(),meteor:q.met.meteorPoint(q.travel.battle,q.travel.soloNow)};
 });assert.equal(close.glError,0);await page.screenshot({path:output+'screenshots/05-meteor-closeup.png'});
 frames.push({...close,path:output+'screenshots/05-meteor-closeup.png',label:'Крупно · камень, трещины, огонь и шлейф'});
 await page.evaluate(()=>{const q=spinQA,c=q.travel.camera,s=q.savedCamera;c.position.copy(s.p);c.quaternion.copy(s.q);c.fov=s.f;c.updateProjectionMatrix();c.updateMatrixWorld();});
 const hitAt=await page.evaluate(()=>{const q=spinQA,m=q.travel.battle.cosmicMeteor;return m.at+q.met.meteorPath(m).hitMs-q.base.since;});
 await shot(hitAt-60,'06-incoming','Быстрый подлёт · момент для отражения');
 const moving=await page.evaluate(()=>{
  const q=spinQA,results=[];
  for(const evade of [false,true]){
   q.restart();q.travel.setGodMode(false);q.c.yaw=Math.PI/2;q.c.actor.rotation.y=q.c.yaw;let lead=0,steering=0,frames=0;
   while(q.travel.battle.cosmicMeteor?.index===0&&q.travel.battle.stage!=='cosmic-meteor-gap'&&frames++<500){const m=q.travel.battle.cosmicMeteor,late=evade&&q.travel.soloNow>=m.at+q.met.meteorGuidanceMs(m)+40,input={...q.input,forward:!late,backward:late};q.travel.follow.face(Math.atan2(2000-q.c.actor.position.x,-q.c.actor.position.z));q.step(1/60,input);if(m.launched)lead=Math.max(lead,m.aim[0]-(q.c.actor.position.x-2000));steering=Math.max(steering,m.guidance?.length??0);}
   results.push({evade,lead,steering,...q.metrics()});
  }return results;
 });assert(moving[0].lead>3);assert(moving[0].steering>0);assert.equal(moving[0].life,4);assert.equal(moving[1].life,5);console.log(JSON.stringify({moving})); const unreflected=await page.evaluate(()=>{
  const q=spinQA;q.restart();q.travel.setGodMode(false);const indexes=new Set();let frames=0;
  while(q.travel.battle.stage!=='cosmic-star-draw'&&frames++<1400){if(q.travel.battle.cosmicMeteor)indexes.add(q.travel.battle.cosmicMeteor.index);q.step(1/60);}
  return {...q.metrics(),indexes:[...indexes],frames};
 });assert.equal(unreflected.hp,6);assert.equal(unreflected.stage,'cosmic-star-draw');assert.deepEqual(unreflected.indexes,[0,1,2]);assert(unreflected.life<5&&unreflected.life>0);console.log(JSON.stringify({unreflected}));
 await page.evaluate(()=>{spinQA.restart();spinQA.travel.setGodMode(false);});
 const parryAt=await page.evaluate(()=>{const q=spinQA;q.advanceTo(1510);const m=q.travel.battle.cosmicMeteor;return m.at+q.met.meteorPath(m).hitMs-q.base.since-130;});
 await page.evaluate(at=>spinQA.advanceTo(at),parryAt);
 await page.locator('canvas').first().focus();await page.keyboard.down('KeyQ');await page.evaluate(()=>{const q=spinQA;q.mainTime=performance.now();q.mainFrame(q.mainTime+=1000/60);});await page.keyboard.up('KeyQ');
 const reflected=await page.evaluate(()=>{const q=spinQA;for(let i=0;i<12;i++)q.mainFrame(q.mainTime+=1000/60);return {...q.metrics(),reflects:q.travel.battle.players.solo.reflects,index:q.travel.battle.cosmicMeteor.index};});
 assert.equal(reflected.stage,'cosmic-meteor-return');assert.equal(reflected.hp,6);assert.equal(reflected.reflects,1);assert.equal(reflected.life,5);await page.screenshot({path:output+'screenshots/07-reflected.png'});
 frames.push({...reflected,path:output+'screenshots/07-reflected.png',label:'Удар Q · метеорит отражён'});
 const impact=await page.evaluate(()=>{const q=spinQA;q.advanceTo(q.travel.battle.until-q.base.since+80);return q.metrics();});assert.equal(impact.hp,5);assert.equal(impact.stage,'cosmic-hit');await page.screenshot({path:output+'screenshots/08-impact.png'});
 frames.push({...impact,path:output+'screenshots/08-impact.png',label:'Попадание в Метакнайта · здоровье 6 → 5'});
 // The real chat shortcuts switch in space; the plain command still starts on the floor.
 const commands=[];for(const [command,stage,height] of [['/phase 4-1','cosmic-spin-warn',180],['/phase 4-2','cosmic-meteor-draw',180],['/phase 4-2','cosmic-meteor-draw',180],['/phase 4','transition',0]]){
  await page.evaluate(()=>spinQA.chat.show());await page.locator('#chat-input').fill(command);await page.locator('#chat-input').press('Enter');const state=await page.evaluate(()=>{const q=spinQA;q.step(1/60);return q.metrics();});assert.equal(state.stage,stage);assert.equal(state.height,height);commands.push({command,...state});
 }
 let video;
 if(process.argv.includes('--video')){
  video=await page.evaluate(async()=>{
   const q=spinQA;q.restart();q.travel.setGodMode(false);q.sounds.stopKnightCosmic();const ctx=q.sounds.context,destination=ctx.createMediaStreamDestination();q.sounds.master.connect(destination);await ctx.resume();
   const stream=new MediaStream([...q.renderer.domElement.captureStream(30).getVideoTracks(),...destination.stream.getAudioTracks()]),chunks=[],deltas=[];
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:6000000,audioBitsPerSecond:192000}),stopped=new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=resolve;});recorder.start();q.sounds.playKnight('cosmic-meteor-draw');
   let previous=performance.now(),elapsed=0,pressed=false,hitTime=0,ghostBursts=0;const throws=new Set(),begun=previous;
   await new Promise(resolve=>{const frame=time=>{
    const dt=Math.min(.06,Math.max(.001,(time-previous)/1000));previous=time;elapsed+=dt;deltas.push(dt);const s=q.travel.battle,m=s.cosmicMeteor,p=q.c.actor.position;let input={...q.input};
    if(m){
     throws.add(m.index);const toward=Math.atan2(2000-p.x,-p.z),side=toward-Math.PI/2,desired=m.index<2?side:toward,turn=Math.atan2(Math.sin(desired-q.c.yaw),Math.cos(desired-q.c.yaw));
     input.steer=Math.max(-1,Math.min(1,turn/(Math.PI*1.1*dt)));
     if(m.index<2){const locked=q.travel.soloNow>=m.at+q.met.meteorGuidanceMs(m)+40;input.forward=m.index===0&&locked;input.backward=m.index===1&&locked;input.dashHeld=m.index===0&&q.travel.soloNow>=m.at+q.met.meteorGuidanceMs(m)-200;}
     else if(s.stage==='cosmic-meteor-cast'&&!pressed){const arrival=m.at+q.met.meteorPath(m).hitMs;if(q.travel.soloNow>=arrival-140){input.attackPressed=true;pressed=true;}}
    }
    q.travel.follow.face(Math.atan2(2000-p.x,-p.z));q.step(dt,input);q.travel.render();if(m?.index<2&&q.travel.battleView.particles.visible)ghostBursts++;if(q.travel.battle.stage==='cosmic-hit')hitTime+=dt;
    if(elapsed<22&&hitTime<.65)requestAnimationFrame(frame);else resolve();
   };requestAnimationFrame(frame);});
   recorder.stop();await stopped;q.sounds.master.disconnect(destination);stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(chunks,{type:recorder.mimeType}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));deltas.sort((a,b)=>a-b);
   return {data:btoa(binary),elapsed,wallSeconds:(performance.now()-begun)/1000,medianMs:deltas[Math.floor(deltas.length*.5)]*1000,p95Ms:deltas[Math.floor(deltas.length*.95)]*1000,hp:q.travel.battle.hp,life:q.travel.battle.players.solo.hp,reflects:q.travel.battle.players.solo.reflects,height:q.c.actor.position.y,throws:[...throws],pressed,ghostBursts};
  });await writeFile(output+'meteors-in-game.webm',Buffer.from(video.data,'base64'));delete video.data;assert.equal(video.hp,5,'the recorded third throw must be reflected');assert.equal(video.reflects,1);assert.equal(video.height,180);assert.deepEqual(video.throws,[0,1,2]);assert(video.life>=3);assert.equal(video.ghostBursts,0,'no stale cyan hit particles during either unreflected throw');
 }
 const sheet=await browser.newPage({viewport:{width:1600,height:1000}}),images=await Promise.all(frames.map(async f=>({...f,src:`data:image/png;base64,${(await readFile(f.path)).toString('base64')}`})));
 await sheet.setContent(`<style>body{margin:0;padding:24px;background:#080d20;color:#e8edff;font:18px system-ui}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}figure{margin:0}img{width:100%}figcaption{padding:10px}</style><h1>Гравитационный удар · настоящие кадры из игры</h1><div class="grid">${images.map(f=>`<figure><img src="${f.src}"><figcaption>${f.label}</figcaption></figure>`).join('')}</div>`);await sheet.screenshot({path:output+'all-stages.png',fullPage:true});
 assert.deepEqual(errors,[]);await writeFile(output+'report.json',JSON.stringify({frames,close,moving,unreflected,reflected,impact,commands,video,errors,cues:await page.evaluate(()=>spinQA.cues)},null,2));console.log(JSON.stringify({output,unreflected,reflected,impact,video,errors}));
}finally{await browser.close();}
