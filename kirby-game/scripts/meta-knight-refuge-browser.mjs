import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const forcedDirection=process.env.PLANET_DIRECTION==='-1'?-1:process.env.PLANET_DIRECTION==='1'?1:undefined;
const output=process.env.COSMIC_OUTPUT??fileURLToPath(new URL('../artifacts/meta-knight-phase4-refuge-2026-10-25-v4/',import.meta.url));
await mkdir(output+'screenshots/',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],frames=[];
 page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text())){errors.push(m.text());console.error(m.text());}});
 await page.routeWebSocket(/.*/,ws=>ws.onMessage(()=>{}));
 await page.addInitScript(direction=>{window.__qaPlanetDirection=direction;},forcedDirection);
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('renderer.setAnimationLoop(', 'renderer.setAnimationLoop(window.__spinMainLoop = ')+'\nwindow.spinQA={THREE,travel:cosmicArena,renderer,chat,sounds,get c(){return character},mainFrame(time){previousTime=time-1000/60;window.__spinMainLoop(time)}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.spinQA,null,{timeout:180000});await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('Звёздное убежище');await page.locator('#start-game').click();await page.waitForFunction(()=>!!spinQA.c);
 await page.evaluate(async()=>{
  const q=spinQA;await q.travel.enter(q.c);await q.sounds.prepareKnightCosmic();q.renderer.setAnimationLoop(null);
  q.rules=await import('/src/meta-knight-battle.ts');q.cosmic=await import('/src/meta-knight-cosmic.ts');q.spin=await import('/src/meta-knight-cosmic-spin.ts');
  q.c.actor.position.set(2000,0,-2);q.travel.soloNow=1000000;q.travel.startBattle();q.chat.show();
 });
 await page.locator('#chat-input').fill('/phase 4-3');await page.locator('#chat-input').press('Enter');
 await page.evaluate(()=>{
  const q=spinQA;q.base=structuredClone(q.travel.battle);q.c.actor.position.set(2009,0,9);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;q.elapsed=0;q.cues=[];
  q.initialGlErrors=[];for(let i=0;i<8;i++){const error=q.renderer.getContext().getError();if(!error)break;q.initialGlErrors.push(error);}
  const cue=q.travel.battleView.cue;q.travel.battleView.cue=(kind,rate)=>{q.cues.push({kind,rate,at:q.travel.soloNow});cue(kind,rate);};
  q.input={forward:false,backward:false,left:false,right:false,jump:false,jumpPressed:false,dashPressed:false,attack:false,attackPressed:false};
  q.travel.setGodMode(true);
  q.step=(dt,input=q.input)=>{q.travel.update(dt,q.travel.soloNow/1000,q.c,input,0,0,false,false);q.elapsed=q.travel.soloNow-q.base.since;};
  q.metrics=()=>{q.elapsed=q.travel.soloNow-q.base.since;q.travel.render();const s=q.travel.battle,v=q.travel.battleView,core=v.cosmicOrbs.cores,dir=q.travel.camera.getWorldDirection(new q.THREE.Vector3());return {stage:s.stage,elapsed:q.elapsed,since:s.since,until:s.until,yaw:q.travel.knight.yaw,height:q.c.actor.position.y,radius:Math.hypot(q.c.actor.position.x-2000,q.c.actor.position.z),bossHeight:q.travel.knight.actor.position.y,hp:s.hp,life:s.players.solo.hp,orbs:core.count,bolts:v.cosmicOrbs.electricity.hot.count,green:v.bossTarget.group.visible,arrowY:v.bossTarget.arrow.getWorldPosition(new q.THREE.Vector3()).y,window:v.bossTarget.ring.material.uniforms.progress.value,cameraAngle:-Math.asin(dir.y)*180/Math.PI,glError:q.renderer.getContext().getError(),drawCalls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles};};
  q.advanceTo=ms=>{while(q.elapsed<ms-.001)q.step(Math.min(1/60,(ms-q.elapsed)/1000));return q.metrics();};
  q.resetSpin=()=>{
   q.travel.soloBattle=structuredClone(q.spinSnapshot);q.travel.withdrawnBattle=0;q.travel.soloNow=q.spinSnapshot.since;q.elapsed=q.travel.soloNow-q.base.since;q.c.actor.position.set(2000,180,41);q.c.yaw=Math.PI;q.c.actor.rotation.y=q.c.yaw;q.c.setActivity('Fly');q.c.playerDash.cooldown=0;q.travel.follow.reset(q.c.yaw);q.step(1/60);q.travel.setGodMode(false);return q.metrics();
  };
 });
 await page.evaluate(async()=>{
  const q=spinQA;q.ref=await import('/src/meta-knight-cosmic-refuge.ts');
  q.restart=(hp=6)=>{q.travel.soloNow+=1000;q.c.actor.position.set(2000,180,35);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;Object.assign(q.travel.battle.players.solo,{hp:5,hits:0,reflects:0,invulnerable:0,attackAt:-1e9,handled:-1e9});q.travel.setPhase(4,3);q.actualApproach=structuredClone(q.travel.battle.cosmicRefuge);if(window.__qaPlanetDirection)q.travel.battle.cosmicRefuge.direction=window.__qaPlanetDirection;q.travel.battle.hp=hp;q.base=structuredClone(q.travel.battle);q.elapsed=0;q.step(0);q.c.actor.position.set(2000,180,35);q.travel.follow.reset(q.c.yaw);q.step(1/60);};
  const metrics=q.metrics;q.metrics=()=>{const v=q.travel.battleView.refuge,s=q.travel.battle;return {...metrics(),marker:v.target.group.visible,dome:v.dome.visible,activated:s.cosmicRefuge?.activatedAt!==undefined,attackAt:s.players.solo.attackAt,star:s.cosmicRefuge?q.ref.refugeStar(s,q.travel.soloNow):undefined,planet:v.planet?.position.toArray(),chunks:v.chunks.visible,gravity:v.gravity.hot.count,direction:q.ref.refugeDirection(s),planetAngle:s.cosmicRefuge?q.ref.refugePlanetAngle(s,q.travel.soloNow):undefined,actualApproach:q.actualApproach,safety:!!q.travel.refugeGlows.get(q.c)?.group.visible,visibleStar:v.star.position.toArray(),blueEyes:q.travel.knight.actor.getObjectByName('Eyes_glow').children.map(o=>(o.material?.emissive??o.material?.color)?.toArray()),dazed:q.travel.knight.actor.getObjectByName('Duel dazed eyes')?.visible};};
  q.steerStar=()=>{const p=q.ref.refugeStar(q.travel.battle,q.travel.soloNow),dx=2000+p[0]-q.c.actor.position.x,dz=p[2]-q.c.actor.position.z,d=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),turn=Math.atan2(Math.sin(yaw-q.c.yaw),Math.cos(yaw-q.c.yaw));return {...q.input,forward:d>1&&Math.abs(turn)<.6,steer:Math.max(-1,Math.min(1,turn/(Math.PI*1.1/60))),distance:d};};
  q.followStarTo=ms=>{while(q.elapsed<ms-.001){const input=q.steerStar();q.travel.follow.face(Math.atan2(2000-q.c.actor.position.x,-q.c.actor.position.z));q.step(Math.min(1/60,(ms-q.elapsed)/1000),input);}return q.metrics();};q.restart();q.travel.setGodMode(false);
 });
 const shot=async(ms,name,label,follow=false)=>{const metrics=await page.evaluate(({ms,follow})=>follow?spinQA.followStarTo(ms):spinQA.advanceTo(ms),{ms,follow});assert.equal(metrics.glError,0);const path=output+`screenshots/${name}.png`;await page.screenshot({path});frames.push({...metrics,path,label});console.log(JSON.stringify({name,...metrics}));return metrics;};
 await shot(650,'01-star-pull','Синие лучи вытягивают фоновую звёздочку');
 const open=await shot(1800,'02-automatic-dome','Прилёт · звезда сама включает общий купол');assert(!open.marker&&open.dome&&open.activated);assert.equal(open.attackAt,-1e9);assert(open.gravity>60);
 const approach=await page.evaluate(()=>{const q=spinQA;let frames=0;while(q.steerStar().distance>3.6&&q.travel.battle.stage==='cosmic-star-open'&&frames++<300)q.step(1/60,q.steerStar());return {...q.metrics(),distance:q.steerStar().distance};});assert(approach.distance<3.7&&approach.activated);
 const activated=await page.evaluate(()=>{const q=spinQA;return q.followStarTo(q.elapsed+350);});assert(activated.activated&&activated.dome&&!activated.marker);assert.equal(activated.attackAt,-1e9);assert.equal(activated.life,5);assert(activated.safety);assert(activated.gravity>60);await page.screenshot({path:output+'screenshots/03-shared-dome.png'});frames.push({...activated,path:output+'screenshots/03-shared-dome.png',label:'Купол включён автоматически · игрок подлетает без атаки'}); const R=await page.evaluate(()=>spinQA.ref.COSMIC_REFUGE),pull=R.drawMs+R.openMs,sweep=pull+R.pullMs,rollMs=await page.evaluate(()=>spinQA.ref.refugeSweepMs(spinQA.travel.battle)),breakAt=sweep+rollMs,strikeAt=breakAt;
 const pulled=await shot(pull+R.pullMs*.52,'04-planet-pull','Синие глаза · молнии обхватывают планету',true);assert(pulled.blueEyes[0][2]>pulled.blueEyes[0][0]*5);
 const early=await shot(sweep+300,'05-roll-start','Планета у выбранной границы купола',true);assert(early.dome);
 const middle=await shot(sweep+rollMs*.5,'06-roll-middle','Прокатывание в выбранном направлении',true);assert.equal(middle.life,5);assert((middle.planetAngle-early.planetAngle)*early.direction>0);assert(Math.abs(Math.abs(early.actualApproach.angle)-Math.PI/2)<1e-8);assert(Math.abs(Math.hypot(middle.star[0]-early.star[0],middle.star[2]-early.star[2])-2*R.orbit*Math.sin((middle.elapsed-early.elapsed)*R.starSpeed/2000))<.001);
 await shot(breakAt-100,'07-roll-end','Планета подходит к другой стороне купола',true);
 await shot(breakAt+60,'08a-collision-flash','Столкновение · горячая трещина и вспышка',true);
 const broken=await shot(breakAt+220,'08-planet-shatter','Планета разбивается о купол',true);assert(broken.chunks);assert.equal(broken.life,5);
 await shot(strikeAt+460,'09-star-counter','Звезда летит в Метакнайта',true);
 const forehead=await shot(strikeAt+R.strikeMs,'09b-forehead-contact','Звезда ударяет точно в лоб',true);assert.equal(forehead.hp,5);assert(forehead.dazed);
 const stunned=await shot(strikeAt+R.strikeMs+120,'10-forehead-stun','Попадание в лоб · секунда оглушения',true);assert.equal(stunned.hp,5);assert(stunned.dazed);assert(!stunned.safety);
 const returned=await shot(strikeAt+R.strikeMs+R.stunMs+400,'11-star-return','Отскок от лба · звёздочка уходит по дуге',true);assert.equal(returned.hp,5);assert.equal(returned.life,5);
 const repeat=await page.evaluate(()=>{const q=spinQA;q.advanceTo(q.travel.battle.until-q.base.since+50);return q.metrics();});assert.equal(repeat.stage,'cosmic-spin-warn');
 const failed=await page.evaluate(()=>{const q=spinQA;q.restart();q.travel.setGodMode(false);let frames=0;while(q.travel.battle.stage!=='cosmic-spin-warn'&&frames++<1800)q.step(1/60);return q.metrics();});assert.equal(failed.hp,5);assert.equal(failed.life,4);assert.equal(failed.stage,'cosmic-spin-warn');console.log(JSON.stringify({failed}));
 // Last-hit fixture verifies the real shared descent and the seated finish.
 await page.evaluate(()=>{const q=spinQA;q.restart(1);q.travel.setGodMode(false);q.advanceTo(1500);while(q.steerStar().distance>3.5&&q.travel.battle.stage==='cosmic-star-open')q.step(1/60,q.steerStar());q.step(1/60,q.steerStar());for(let i=0;i<14;i++)q.step(1/60,q.steerStar());});
 const descent=await page.evaluate(at=>{const q=spinQA;q.followStarTo(at);return q.metrics();},strikeAt+R.strikeMs+R.stunMs+50);assert.equal(descent.hp,0);assert.equal(descent.stage,'cosmic-descent');
 await shot(strikeAt+R.strikeMs+R.stunMs+1500,'12-descent','Последний удар · все возвращаются на арену');
 const won=await shot(strikeAt+R.strikeMs+R.stunMs+3100,'13-dazed-finish','Бой окончен · Метакнайт dazed на арене');assert.equal(won.stage,'won');assert.equal(won.height,0);
 // Restart a fresh duel for a continuous native-control recording.
 await page.evaluate(()=>{const q=spinQA;q.travel.cancelBattle();q.c.actor.position.set(2000,0,-2);q.travel.soloBattle=undefined;q.travel.withdrawnBattle=0;q.travel.startBattle();q.restart();q.travel.setGodMode(false);});
 let video;
 if(process.argv.includes('--video')){
  video=await page.evaluate(async()=>{
   const q=spinQA;q.sounds.stopKnightCosmic();const ctx=q.sounds.context,destination=ctx.createMediaStreamDestination();q.sounds.master.connect(destination);await ctx.resume();
   const stream=new MediaStream([...q.renderer.domElement.captureStream(30).getVideoTracks(),...destination.stream.getAudioTracks()]),chunks=[],deltas=[],stages=new Set();
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:6500000,audioBitsPerSecond:192000}),stopped=new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=resolve;});recorder.start();q.sounds.playKnight('cosmic-refuge-call');
   let previous=performance.now(),elapsed=0,pressed=false;const begun=previous;
   await new Promise(resolve=>{const frame=time=>{
    const dt=Math.min(.06,Math.max(.001,(time-previous)/1000));previous=time;elapsed+=dt;deltas.push(dt);const s=q.travel.battle;stages.add(s.stage);let input={...q.input};
    if(s.cosmicRefuge){const star=q.ref.refugeStar(s,q.travel.soloNow),dx=2000+star[0]-q.c.actor.position.x,dz=star[2]-q.c.actor.position.z,d=Math.hypot(dx,dz),toward=Math.atan2(dx,dz),turn=Math.atan2(Math.sin(toward-q.c.yaw),Math.cos(toward-q.c.yaw));
     input.steer=Math.max(-1,Math.min(1,turn/(Math.PI*1.1*dt)));input.forward=d>1.2&&Math.abs(turn)<.6&&s.stage!=='cosmic-star-draw'&&s.stage!=='cosmic-star-retreat';}
    q.travel.follow.face(Math.atan2(2000-q.c.actor.position.x,-q.c.actor.position.z));q.step(dt,input);q.travel.render();if(elapsed<25&&q.travel.battle.stage!=='cosmic-spin-warn')requestAnimationFrame(frame);else resolve();
   };requestAnimationFrame(frame);});
   recorder.stop();await stopped;q.sounds.master.disconnect(destination);stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(chunks,{type:recorder.mimeType}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));deltas.sort((a,b)=>a-b);return {data:btoa(binary),elapsed,wallSeconds:(performance.now()-begun)/1000,medianMs:deltas[Math.floor(deltas.length*.5)]*1000,p95Ms:deltas[Math.floor(deltas.length*.95)]*1000,hp:q.travel.battle.hp,life:q.travel.battle.players.solo.hp,height:q.c.actor.position.y,stages:[...stages],hits:q.travel.battle.players.solo.hits,pressed};
  });await writeFile(output+'stellar-refuge-in-game.webm',Buffer.from(video.data,'base64'));delete video.data;assert.equal(video.hp,5);assert.equal(video.life,5);assert.equal(video.hits,1);assert.equal(video.height,180);assert(!video.pressed);
 }
 const sheet=await browser.newPage({viewport:{width:1600,height:1000}}),images=await Promise.all(frames.map(async f=>({...f,src:`data:image/png;base64,${(await readFile(f.path)).toString('base64')}`})));
 await sheet.setContent(`<style>body{margin:0;padding:24px;background:#080d20;color:#e8edff;font:18px system-ui}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}figure{margin:0}img{width:100%}figcaption{padding:10px}</style><h1>Звёздное убежище · игровые кадры</h1><div class="grid">${images.map(f=>`<figure><img src="${f.src}"><figcaption>${f.label}</figcaption></figure>`).join('')}</div>`);await sheet.screenshot({path:output+'all-stages.png',fullPage:true});
 assert.deepEqual(errors,[]);await writeFile(output+'report.json',JSON.stringify({R,frames,approach,activated,repeat,failed,descent,won,video,errors,cues:await page.evaluate(()=>spinQA.cues)},null,2));console.log(JSON.stringify({output,failed,won,video,errors}));
}finally{await browser.close();}
