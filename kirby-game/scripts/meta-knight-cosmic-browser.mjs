import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {knightSound,KNIGHT_SOUND_RATE} from '../src/meta-knight-sounds.ts';
import {Vector3} from 'three';

const output=fileURLToPath(new URL('../artifacts/meta-knight-phase4-transition-2026-10-24-v8/',import.meta.url));
await mkdir(output+'screenshots/',{recursive:true});
async function screenshot(page,path,options={}){const bytes=await page.screenshot(options);for(let attempt=0;;attempt++){try{await writeFile(path,bytes);return;}catch(error){if(attempt>=5)throw error;await new Promise(resolve=>setTimeout(resolve,200*(attempt+1)));}}}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],frames=[];
 const warnings=new Set();page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});page.on('console',m=>{if(/WebGL|THREE|shader/i.test(m.text())){if(m.type()==='error'){errors.push(m.text());console.error(m.text());}else warnings.add(m.text());}});
 await page.addInitScript(()=>{localStorage.setItem('kirby-language-v1','ru');localStorage.setItem('kirby-tutorial-completed-v1','1');});
 for(const endpoint of ['room','players','history/solo'])await page.route('**/'+endpoint,r=>r.fulfill({json:{ok:true,players:0,occupiedVariants:[],capacity:14}}));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('renderer.setAnimationLoop(', 'renderer.setAnimationLoop(window.__cosmicMainLoop = ')+'\nwindow.cosmicQA={THREE,travel:cosmicArena,renderer,chat,sounds,get c(){return character},mainFrame(time){previousTime=time-1000/60;window.__cosmicMainLoop(time)}};'});});
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.cosmicQA,null,{timeout:180000});await page.locator('#startup-loader').waitFor({state:'hidden',timeout:180000});
 await page.locator('#new-game').click();await page.locator('#player-name-input').fill('К звёздам');await page.locator('#start-game').click();await page.waitForFunction(()=>!!cosmicQA.c);
 await page.evaluate(async()=>{const q=cosmicQA;await q.travel.enter(q.c);await q.sounds.prepareKnightCosmic();q.renderer.setAnimationLoop(null);q.rules=await import('/src/meta-knight-battle.ts');q.cosmic=await import('/src/meta-knight-cosmic.ts');q.worlds=await import('/src/meta-knight-cosmic-world.ts');q.c.actor.position.set(2000,0,-2);q.travel.soloNow=1000000;q.travel.startBattle();q.chat.show();});
 const initialWorlds=await page.evaluate(()=>{const q=cosmicQA;q.travel.render();return q.travel.current.cosmicSky.planets.map(p=>p.getWorldPosition(new q.THREE.Vector3()).toArray());});
 await screenshot(page,output+'screenshots/00-worlds-before-ascent.png');
 await page.locator('#chat-input').fill('/phase ');
 assert.deepEqual(await page.locator('#chat-command-list code').allTextContents(),['1','2','3','4']);
 await page.locator('#chat-input').fill('/phase 4');await page.locator('#chat-input').press('Enter');
 assert.equal(await page.evaluate(()=>cosmicQA.travel.battle.phase),4);
 await page.evaluate(()=>{
  const q=cosmicQA;q.base=structuredClone(q.travel.battle);q.elapsed=0;q.c.actor.position.set(2009,0,9);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;q.cues=[];
  q.initialGlErrors=[];for(let i=0;i<8;i++){const error=q.renderer.getContext().getError();if(!error)break;q.initialGlErrors.push(error);}
  const original=q.travel.battleView.cue;q.travel.battleView.cue=kind=>{q.cues.push({kind,at:q.travel.soloNow});original(kind);};
  q.input={forward:false,backward:false,left:false,right:false,jump:false,sprint:false,attack:false};
  q.advanceTo=ms=>{
   while(q.elapsed<ms-.001){
    const dt=Math.min(1/60,(ms-q.elapsed)/1000);q.travel.update(dt,(q.base.since+q.elapsed)/1000,q.c,q.input,0,0,false,false);q.elapsed+=dt*1000;
    if(q.cosmic.cosmicAirborne(q.travel.battle)){
     const fly=q.c.actions.get('Fly');if(!fly.isRunning())throw Error(`the flight clip must play on every airborne frame: ${q.c.state}, ${fly.time}, ${q.c.actor.position.y}`);
     // A repeating clip may legitimately wrap to time zero during the ascent.
     if(!q.takeoff&&q.c.actor.position.y>.00001&&fly.time>0)q.takeoff={height:q.c.actor.position.y,state:q.c.state,clip:fly.getClip().name,time:fly.time,weight:fly.getEffectiveWeight(),elapsed:q.elapsed};
    }
   }
   q.travel.render();const s=q.travel.battle,knight=q.travel.knight.actor,light=q.travel.battleView.cosmic.lightning;
   if(q.cosmic.cosmicAirborne(s)){const fly=q.c.actions.get('Fly');if(!fly.isRunning()||fly.time<=0)throw Error('the flight animation is missing on an airborne frame');}
   const arena=q.travel.scene.getObjectByName('Cosmic marble fighting floor'),v=new q.THREE.Vector3(2000,0,0).project(q.travel.camera);
   const tip=knight.getObjectByName('Galaxia').localToWorld(new q.THREE.Vector3(-.315,2.05,0)).project(q.travel.camera),boss=knight.getWorldPosition(new q.THREE.Vector3()).project(q.travel.camera);
   const direction=q.travel.camera.getWorldDirection(new q.THREE.Vector3());
   const crystalOpacity=Math.min(...q.travel.current.root.children.filter(o=>o.name.startsWith('Cosmic arena crystal ')).map(o=>o.material.opacity));
   return {stage:s.stage,ms,height:q.c.actor.position.y,radius:Math.hypot(q.c.actor.position.x-2000,q.c.actor.position.z),crystalOpacity,bossHeight:knight.position.y,bodyHeight:knight.getObjectByName('Body_motion').getWorldPosition(new q.THREE.Vector3()).y,formation:q.travel.cosmicFrame.position.toArray(),worlds:q.travel.current.cosmicSky.planets.map(p=>p.getWorldPosition(new q.THREE.Vector3()).toArray()),flight:q.c.flight.active,state:q.c.state,hp:s.hp,life:s.players.solo.hp,bolts:light.hot.count,coreColor:light.hotMaterial.color.getHexString(),glowColor:light.glowMaterial.color.getHexString(),cameraAngle:-Math.asin(direction.y)*180/Math.PI,tipNdc:tip.toArray(),bossNdc:boss.toArray(),arenaNdc:v.toArray(),arenaVisible:arena.visible,drawCalls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,glError:q.renderer.getContext().getError()};
  };
 });
 const shots=[
  [2000,'01-charge-start','Начало заряда'],[4000,'02-charge-full','Глаза и меч под напряжением'],[4700,'03-sword-plunge','Прыжок перед ударом меча'],
  [5350,'04-lightning-spread','Молнии расходятся по арене'],[6550,'05-arena-charged','Арена заряжена'],[7870,'06-sword-raised','Меч снова поднят'],
  [9550,'07-ascent-start','Общий взлёт'],[11100,'08-ascent-high','Арена остаётся внизу'],[13200,'09-arrival','Торможение в космосе'],[16000,'10-cosmic-flight','Свободный полёт в одной плоскости'],
 ];
 for(const [ms,name,label] of shots){
  if(name==='07-ascent-start')for(const [at,suffix] of [[8600,'06a-first-airborne'],[8740,'06b-flight-wings']]){await page.evaluate(ms=>cosmicQA.advanceTo(ms),at);await screenshot(page,output+'screenshots/'+suffix+'.png');}
  if(name==='05-arena-charged')for(const [at,suffix] of [[5550,'04b-crawling'],[5850,'04c-branching'],[6200,'04d-edge']]){await page.evaluate(ms=>cosmicQA.advanceTo(ms),at);await screenshot(page,output+'screenshots/'+suffix+'.png');}
  const metrics=await page.evaluate(ms=>cosmicQA.advanceTo(ms),ms);
  const path=output+'screenshots/'+name+'.png';await screenshot(page,path);frames.push({...metrics,path,label});console.log(JSON.stringify(metrics));
  if(name==='02-charge-full'){
   await page.evaluate(()=>{const q=cosmicQA,c=q.travel.camera;q.savedCamera={p:c.position.clone(),q:c.quaternion.clone(),fov:c.fov};c.position.set(2018,12,25);c.lookAt(2000,6,0);c.fov=50;c.updateProjectionMatrix();c.updateMatrixWorld();q.travel.render();});
   await screenshot(page,output+'screenshots/12-charge-closeup.png');
   await page.evaluate(()=>{const q=cosmicQA,c=q.travel.camera;c.position.copy(q.savedCamera.p);c.quaternion.copy(q.savedCamera.q);c.fov=q.savedCamera.fov;c.updateProjectionMatrix();c.updateMatrixWorld();q.travel.render();});
  }
  assert.equal(metrics.glError,0);assert.equal(metrics.hp,6);assert.equal(metrics.life,5);assert(Math.abs(metrics.tipNdc[1])<.82,'the raised blade stays inside the frame and below the HUD');if(ms>8100)assert(Math.abs(metrics.height-metrics.bossHeight)<1e-8);
  assert.equal(metrics.glowColor,'ffb52b');if(ms===4000)assert(metrics.bolts>=162*5);if(ms===4700)assert(metrics.bodyHeight>6);
  if(ms>=7870)assert(Math.abs(metrics.radius-41)<.001,'the electrical recoil reaches the rim before takeoff');if(ms>=5350&&ms<=7870)assert.equal(metrics.height,0);
  if(ms===6550)assert(metrics.crystalOpacity<.2,'the foreground rim crystal must not hide the recoiling player');if(ms===16000)assert(metrics.crystalOpacity>.999,'rim crystals recover their full opacity after takeoff');
  if(ms>=7870)assert(Math.abs(metrics.bossNdc[0])<.08&&Math.abs(metrics.bossNdc[1])<.7,'the transition camera keeps Meta Knight ahead of the player');
  for(let i=0;i<initialWorlds.length;i++){assert.equal(metrics.worlds[i][1],initialWorlds[i][1]);assert(new Vector3().fromArray(metrics.worlds[i]).distanceTo(new Vector3().fromArray(initialWorlds[i]))<35,'the same worlds follow their independent orbits during the whole ascent');}
  if(ms===16000){assert(Math.abs(metrics.cameraAngle)<15);assert(metrics.arenaNdc[1]<-.4&&metrics.arenaNdc[1]>-.95,'the real arena remains in the lower frame');assert(Math.abs(Math.hypot(metrics.formation[0],metrics.formation[2])-240)<.001);}
 }
 // This ascent-only harness holds arrival for the sky/control inspection.
 // The finite arrival and attack loop have their own cosmic-spin browser test.
 await page.evaluate(()=>{cosmicQA.travel.battle.until=1e12;});
 // Real DOM Space -> the unchanged main.ts input pipeline -> the actual arena.
 await page.locator('canvas').first().focus();await page.keyboard.down('Space');
 const spaceDash=await page.evaluate(()=>{
  const q=cosmicQA;q.mainTime=performance.now();q.dashOrigin=q.c.actor.position.clone();
  for(let i=0;i<36;i++)q.mainFrame(q.mainTime+=1000/60);
  return {state:q.c.state,progress:q.c.playerDash.progress,moved:q.c.actor.position.distanceTo(q.dashOrigin),height:q.c.actor.position.y,cooldown:q.c.playerDash.cooldown};
 });assert.equal(spaceDash.state,'Dash');assert(spaceDash.moved>2&&spaceDash.progress>.3);assert.equal(spaceDash.height,180);
 await screenshot(page,output+'screenshots/16-space-dash.png');
 const spaceHold=await page.evaluate(()=>{
  const q=cosmicQA;for(let i=0;i<384;i++)q.mainFrame(q.mainTime+=1000/60);
  return {state:q.c.state,moved:q.c.actor.position.distanceTo(q.dashOrigin),height:q.c.actor.position.y,cooldown:q.c.playerDash.cooldown,active:q.c.playerDash.active};
 });assert.equal(spaceHold.state,'Fly');assert(Math.abs(spaceHold.moved-12)<.001);assert.equal(spaceHold.height,180);assert.equal(spaceHold.cooldown,0);assert(!spaceHold.active);
 await page.keyboard.up('Space');await page.evaluate(()=>{const q=cosmicQA;q.mainFrame(q.mainTime+=1000/60);});await page.keyboard.down('Space');
 const spaceRepeat=await page.evaluate(()=>{const q=cosmicQA;for(let i=0;i<36;i++)q.mainFrame(q.mainTime+=1000/60);const result={state:q.c.state,height:q.c.actor.position.y};for(let i=0;i<24;i++)q.mainFrame(q.mainTime+=1000/60);return result;});
 assert.equal(spaceRepeat.state,'Dash');assert.equal(spaceRepeat.height,180);await page.keyboard.up('Space');await page.evaluate(()=>{const q=cosmicQA;q.mainFrame(q.mainTime+=1000/60);});
 const flight=await page.evaluate(()=>{
  const q=cosmicQA,before=q.c.actor.position.clone(),height=q.c.actor.position.y;
  for(let i=0;i<180;i++)q.travel.update(1/60,q.travel.soloNow/1000,q.c,{...q.input,forward:true,jump:true,jumpPressed:i%20===0,dashHeld:true},0,0,false,false);
  return {height,after:q.c.actor.position.y,moved:Math.hypot(q.c.actor.position.x-before.x,q.c.actor.position.z-before.z),active:q.c.flight.active,state:q.c.state,stage:q.travel.battle.stage};
 });assert.equal(flight.height,180);assert.equal(flight.after,180);assert(flight.moved>4&&flight.active);assert.equal(flight.stage,'cosmic-flight');
 const controls=await page.evaluate(()=>{
  const q=cosmicQA,before=q.c.actor.position.clone(),yaw=q.c.yaw;
  for(let i=0;i<45;i++)q.travel.update(1/60,q.travel.soloNow/1000,q.c,{...q.input,left:true},0,0,false,false);
  const turnMoved=q.c.actor.position.distanceTo(before),turn=Math.atan2(Math.sin(q.c.yaw-yaw),Math.cos(q.c.yaw-yaw)),f=q.travel.follow,orbit=f.azimuth;
  for(let i=0;i<45;i++)q.travel.update(1/60,q.travel.soloNow/1000,q.c,q.input,1,-.2,false,false);
  f.zoom(200);for(let i=0;i<45;i++)q.travel.update(1/60,q.travel.soloNow/1000,q.c,q.input,0,0,false,false);
  const orbitChanged=Math.abs(f.azimuth-orbit),distance=f.distance;
  q.c.yaw=Math.atan2(2000-q.c.actor.position.x,-q.c.actor.position.z);q.c.actor.rotation.y=q.c.yaw;f.reset(q.c.yaw);
  for(let i=0;i<90;i++)q.travel.update(1/60,q.travel.soloNow/1000,q.c,q.input,0,0,false,false);
  return {turnMoved,turn,orbitChanged,distance,height:q.c.actor.position.y};
 });assert(controls.turnMoved<.001&&Math.abs(controls.turn)>1);assert(controls.orbitChanged>.2&&controls.distance>12);assert.equal(controls.height,180);
 const orbitViews=[];
 for(let i=0;i<8;i++){
  const metrics=await page.evaluate(i=>{const q=cosmicQA,T=q.THREE,f=q.travel.follow;f.reset(q.c.yaw);f.orbit(-i*Math.PI/4/.005,0);for(let step=0;step<90;step++)q.travel.update(1/60,q.travel.soloNow/1000,q.c,q.input,0,0,false,false);q.travel.render();const camera=q.travel.camera,frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));return {angle:i*45,visible:q.travel.current.cosmicSky.planets.filter((planet,j)=>frustum.intersectsSphere(new T.Sphere(planet.getWorldPosition(new T.Vector3()),q.worlds.COSMIC_WORLDS[j].radius))).map(p=>p.name),glError:q.renderer.getContext().getError()};},i);
  assert.equal(metrics.glError,0);assert(metrics.visible.length>=2,`the ${i*45} degree view must contain planets`);const path=output+`screenshots/orbit-${String(i*45).padStart(3,'0')}.png`;await screenshot(page,path);orbitViews.push({...metrics,path});
 }
 const planetViews=[];
 for(let i=0;i<12;i++){
  const metrics=await page.evaluate(i=>{
   const q=cosmicQA,T=q.THREE,world=q.worlds.COSMIC_WORLDS[i],planet=q.travel.current.cosmicSky.planets[i],camera=q.travel.camera;
   if(i===0)q.atlasCamera={position:camera.position.clone(),rotation:camera.quaternion.clone(),fov:camera.fov};
   const target=planet.getWorldPosition(new T.Vector3()),distance=world.extent*3.2;
   camera.position.copy(target).add(new T.Vector3(.22,.28,1).normalize().multiplyScalar(distance));camera.lookAt(target);camera.fov=44;camera.updateProjectionMatrix();camera.updateMatrixWorld();q.travel.render();
   const rings=planet.getObjectByName('Three opaque connected ring bands');
   return {name:world.name,kind:world.kind,rings:rings?.children.map(r=>({color:r.material.color.getHexString(),transparent:r.material.transparent,opacity:r.material.opacity,depthWrite:r.material.depthWrite,inner:r.geometry.parameters.innerRadius,outer:r.geometry.parameters.outerRadius})),glError:q.renderer.getContext().getError()};
  },i);
  assert.equal(metrics.glError,0);if(metrics.rings){assert.equal(metrics.rings.length,3);assert.equal(new Set(metrics.rings.map(r=>r.color)).size,3);metrics.rings.forEach((r,j)=>{assert(!r.transparent&&r.opacity===1&&r.depthWrite);if(j>0)assert.equal(r.inner,metrics.rings[j-1].outer);});}
  const path=output+`screenshots/planet-${String(i+1).padStart(2,'0')}.png`;await screenshot(page,path);planetViews.push({...metrics,path});
 }
 assert.equal(new Set(planetViews.map(p=>p.kind)).size,12);assert.equal(planetViews.filter(p=>p.rings).length,2);assert.equal(new Set(planetViews.flatMap(p=>p.rings?.map(r=>r.color)??[])).size,6);
 await page.evaluate(()=>{const q=cosmicQA,c=q.travel.camera;c.position.copy(q.atlasCamera.position);c.quaternion.copy(q.atlasCamera.rotation);c.fov=q.atlasCamera.fov;c.updateProjectionMatrix();c.updateMatrixWorld();q.travel.render();});
 const remotes=await page.evaluate(()=>{
  const q=cosmicQA,make=()=>({actor:new q.THREE.Group(),cloud:{visible:true},flight:new q.c.flight.constructor(),state:'Fly',surfaceY:0,updateDuelDazedPose(){}}),ally=make(),spectator=make();
  for(const c of [ally,spectator]){c.actor.userData.location='meta-knight-arena';c.actor.position.set(2003,180,2);}
  q.travel.battle.players.ally={hp:5,invulnerable:0};q.travel.routeRemotes([['ally',ally],['spectator',spectator]]);
  const world=ally.actor.getWorldPosition(new q.THREE.Vector3()),result={allyFlying:ally.flight.active,allyInFormation:ally.actor.parent===q.travel.cosmicFrame,spectatorOnGround:spectator.actor.parent===q.travel.scene,offset:world.x-ally.actor.position.x};
  ally.actor.removeFromParent();spectator.actor.removeFromParent();delete q.travel.battle.players.ally;q.travel.routeRemotes([]);return result;
 });assert(remotes.allyFlying&&remotes.allyInFormation&&remotes.spectatorOnGround&&remotes.offset>100);
 // Check the existing game's responsive camera in the SAME running encounter.
 await page.setViewportSize({width:550,height:900});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const mobile=await page.evaluate(()=>{const q=cosmicQA;for(let i=0;i<60;i++)q.travel.update(1/60,q.travel.soloNow/1000,q.c,q.input,0,0,false,false);q.travel.render();return {height:q.c.actor.position.y,boss:q.travel.knight.actor.position.y,glError:q.renderer.getContext().getError()};});assert.equal(mobile.height,mobile.boss);assert.equal(mobile.glError,0);await screenshot(page,output+'screenshots/11-portrait-flight.png');
 await page.setViewportSize({width:1600,height:1000});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const reset=await page.evaluate(()=>{const q=cosmicQA;q.travel.setPhase(2);q.travel.update(1/60,0,q.c,q.input,0,0,false,false);const result={height:q.c.actor.position.y,flight:q.c.flight.active,visible:q.travel.battleView.cosmic.group.visible,sky:q.travel.current.root.getObjectByName('Fourth phase deep cosmic vista').visible,phase:q.travel.battle.phase};q.travel.setPhase(4);q.elapsed=0;q.base=structuredClone(q.travel.battle);q.travel.soloNow=q.base.since;q.c.actor.position.set(2009,0,9);const before=q.c.actor.position.clone();q.input.forward=true;q.advanceTo(3000);const freeMovement={moved:before.distanceTo(q.c.actor.position),stage:q.travel.battle.stage,height:q.c.actor.position.y};q.input.forward=false;const rim=q.advanceTo(8000);q.advanceTo(10000);q.travel.cancelBattle();q.travel.update(1/60,0,q.c,q.input,0,0,false,false);return {phaseReset:result,freeMovement,rim,cancel:{height:q.c.actor.position.y,flight:q.c.flight.active,visible:q.travel.battleView.cosmic.group.visible,stage:q.travel.battle.stage}};});
 assert(reset.freeMovement.moved>4);assert.equal(reset.freeMovement.stage,'cosmic-charge');assert.equal(reset.rim.height,0);assert(Math.abs(reset.rim.radius-41)<.001);
 assert.equal(reset.phaseReset.height,0);assert(!reset.phaseReset.flight&&!reset.phaseReset.visible&&reset.phaseReset.sky);assert.equal(reset.cancel.height,0);assert(!reset.cancel.flight&&!reset.cancel.visible);assert.equal(reset.cancel.stage,'cancelled');
 const impacts=[];
 for(const phase of [1,2,3]){
  const metrics=await page.evaluate(phase=>{
   const q=cosmicQA,T=q.THREE,now=3000000+phase*10000,s=q.rules.startKnightBattle([{id:'solo',p:[0,0,-2],yaw:0,available:true}],'solo',now-1000);
   Object.assign(s,{phase,hp:phase===1?12:phase===2?8:4,stage:phase===3?'shield':'open',pattern:phase===3?'star':phase===2?'dive':'leap',since:now-240,until:now+3000,checked:now,from:[0,0,0],to:[0,0,0],activeCrystal:phase===3?2:undefined});
   q.travel.soloBattle=s;q.travel.soloNow=now;q.c.actor.position.set(2009,0,9);q.c.flight.reset();q.travel.update(0,now/1000,q.c,q.input,0,0,false,false);q.travel.render();
   const cores=q.travel.scene.getObjectByName('Sword impact lightning cores'),matrix=new T.Matrix4(),point=new T.Vector3();let reach=0;
   for(let i=0;i<cores.count;i++){cores.getMatrixAt(i,matrix);point.set(0,.5,0).applyMatrix4(matrix);reach=Math.max(reach,Math.hypot(point.x,point.z));}
   return {phase,bolts:cores.count,reach,color:cores.material.color.getHexString(),glError:q.renderer.getContext().getError()};
  },phase);assert.equal(metrics.glError,0);assert(metrics.reach>20);await screenshot(page,output+`screenshots/${12+phase}-phase${phase}-gold-impact.png`);impacts.push(metrics);
 }
 await page.evaluate(()=>cosmicQA.travel.cancelBattle());
 const closeCases=[];
 for(const [name,p] of [['centre',[2000,0,0]],['west',[1998,0,0]],['north',[2000,0,-2]]]){
  const metrics=await page.evaluate(p=>{const q=cosmicQA;q.travel.startBattle();q.travel.setPhase(4);q.base=structuredClone(q.travel.battle);q.elapsed=0;q.travel.soloNow=q.base.since;q.c.actor.position.fromArray(p);q.c.yaw=1.4;q.c.actor.rotation.y=1.4;const ground=q.advanceTo(8000),air=q.advanceTo(11100);return {ground,air};},p);
  assert(Math.abs(metrics.ground.radius-41)<.001&&metrics.ground.height===0);assert(Math.abs(metrics.air.radius-41)<.001&&Math.abs(metrics.air.bossNdc[0])<.08);await screenshot(page,output+`screenshots/close-${name}.png`);closeCases.push({name,...metrics});await page.evaluate(()=>cosmicQA.travel.cancelBattle());
 }
 // Reusable contact sheet contains UNEDITED game screenshots; only layout is HTML.
 const sheet=await browser.newPage({viewport:{width:1600,height:1000}}),images=await Promise.all(frames.map(async f=>({...f,src:`data:image/png;base64,${(await readFile(f.path)).toString('base64')}`})));
 await sheet.setContent(`<style>body{margin:0;padding:24px;background:#080d20;color:#e8edff;font:18px system-ui}h1{font-size:28px;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}figure{margin:0;background:#141e38;border:1px solid #2a3b60;border-radius:12px;overflow:hidden}img{width:100%;display:block}figcaption{padding:12px 14px}</style><h1>Мета Кнайт · переход в четвёртую фазу · кадры из игры</h1><div class="grid">${images.map((f,i)=>`<figure><img src="${f.src}"><figcaption>${i+1}. ${f.label}</figcaption></figure>`).join('')}</div>`);await screenshot(sheet,output+'all-stages.png',{fullPage:true});
 const orbitImages=await Promise.all(orbitViews.map(async f=>({...f,src:`data:image/png;base64,${(await readFile(f.path)).toString('base64')}`})));await sheet.setContent(`<style>body{margin:0;padding:24px;background:#080d20;color:#e8edff;font:18px system-ui}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}figure{margin:0}img{width:100%}figcaption{padding:8px}</style><h1>Космос вокруг игрока · 360°</h1><div class="grid">${orbitImages.map(f=>`<figure><img src="${f.src}"><figcaption>${f.angle}° · Планет в кадре: ${f.visible.length}</figcaption></figure>`).join('')}</div>`);await screenshot(sheet,output+'orbit-360.png',{fullPage:true});
 const planetImages=await Promise.all(planetViews.map(async f=>({...f,src:`data:image/png;base64,${(await readFile(f.path)).toString('base64')}`})));await sheet.setContent(`<style>body{margin:0;padding:24px;background:#080d20;color:#e8edff;font:18px system-ui}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0}img{width:100%}figcaption{padding:8px}</style><h1>12 разных миров · два набора сплошных колец</h1><div class="grid">${planetImages.map((f,i)=>`<figure><img src="${f.src}"><figcaption>${i+1}. ${f.name}</figcaption></figure>`).join('')}</div>`);await screenshot(sheet,output+'planets.png',{fullPage:true});
 let video;
 if(process.argv.includes('--video')){
  video=await page.evaluate(async()=>{
   const q=cosmicQA;q.sounds.stopKnightCosmic();q.travel.startBattle();q.travel.setPhase(4);q.travel.soloNow=q.travel.battle.since;q.c.actor.position.set(2009,0,9);q.c.yaw=Math.PI;q.c.actor.rotation.y=Math.PI;
   q.travel.camera.position.set(2012,29,49);q.travel.cosmicCameraHeight=0;q.travel.cosmicFocus.set(2000,3,0);q.travel.camera.lookAt(q.travel.cosmicFocus);
   const canvas=q.renderer.domElement,ctx=q.sounds.context,destination=ctx.createMediaStreamDestination();q.sounds.master.connect(destination);await ctx.resume();
   const stream=new MediaStream([...canvas.captureStream(30).getVideoTracks(),...destination.stream.getAudioTracks()]);
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:6000000,audioBitsPerSecond:192000}),chunks=[],deltas=[];
   const stopped=new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=resolve;});recorder.start();
   const started=performance.now();let previous=started,elapsed=0;
   await new Promise(resolve=>{const frame=time=>{const dt=Math.min(.1,Math.max(.001,(time-previous)/1000));previous=time;elapsed+=dt;deltas.push(dt);q.travel.update(dt,q.travel.soloNow/1000,q.c,q.input,elapsed>17?Math.PI*2/8/1.5:0,0,false,false);if(q.travel.battle.stage==='cosmic-flight')q.travel.battle.until=1e12;q.travel.render();if(elapsed<25)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
   recorder.stop();await stopped;q.sounds.master.disconnect(destination);stream.getTracks().forEach(t=>t.stop());
   const bytes=new Uint8Array(await new Blob(chunks,{type:recorder.mimeType}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
   deltas.sort((a,b)=>a-b);return {data:btoa(binary),frames:deltas.length,elapsed,wallSeconds:(performance.now()-started)/1000,medianMs:deltas[Math.floor(deltas.length*.5)]*1000,p95Ms:deltas[Math.floor(deltas.length*.95)]*1000,stage:q.travel.battle.stage};
  });
  await writeFile(output+'transition-in-game.webm',Buffer.from(video.data,'base64'));delete video.data;
 }
 const loadedSamples=await page.evaluate(()=>Object.fromEntries(['cosmic-charge','cosmic-impact','cosmic-draw','cosmic-ascent','cosmic-arrive'].map(kind=>{const b=cosmicQA.sounds.buffers.get('knight-v2-'+kind);return [kind,b?.duration];})));
 for(const duration of Object.values(loadedSamples))assert(duration>1,'the recorded sound samples were decoded');
 const takeoff=await page.evaluate(()=>cosmicQA.takeoff);assert.equal(takeoff.clip,'Fly');assert(takeoff.height<.001&&takeoff.time>0);
 assert.deepEqual(errors,[]);await writeFile(output+'report.json',JSON.stringify({initialWorlds,takeoff,frames,spaceDash,spaceHold,spaceRepeat,flight,controls,orbitViews,planetViews,closeCases,remotes,mobile,reset,impacts,loadedSamples,video,errors,cues:await page.evaluate(()=>cosmicQA.cues)},null,2));
 console.log(JSON.stringify({output,frames:frames.length,flight,mobile,reset,errors}));
}finally{await browser.close();}

// Audition of the exact effect buffers and cue timings used by the encounter.
const cues=[['phase',0],['cosmic-charge',1.5],['cosmic-impact',5.15],['cosmic-draw',7.05],['cosmic-ascent',8.10],['cosmic-arrive',13.70]],rate=KNIGHT_SOUND_RATE,n=Math.ceil(rate*17),left=new Float32Array(n),right=new Float32Array(n);
for(const [kind,at] of cues){
 let samples;
 if(kind.startsWith('cosmic-')){const wav=await readFile(new URL(`../public/audio/meta-knight-cosmic/${kind}.wav`,import.meta.url)),length=wav.readUInt32LE(40)/4;samples={left:new Float32Array(length),right:new Float32Array(length)};for(let i=0;i<length;i++){samples.left[i]=wav.readInt16LE(44+i*4)/32768;samples.right[i]=wav.readInt16LE(46+i*4)/32768;}}
 else samples=knightSound(kind);
 const offset=Math.round(at*rate);for(let i=0;i<samples.left.length&&i+offset<n;i++){left[i+offset]+=samples.left[i]*.85;right[i+offset]+=samples.right[i]*.85;}
}
let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));const gain=Math.min(1,.9/peak),wav=Buffer.alloc(44+n*4);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*4,40);for(let i=0;i<n;i++){wav.writeInt16LE(Math.round(left[i]*gain*32767),44+i*4);wav.writeInt16LE(Math.round(right[i]*gain*32767),46+i*4);}await writeFile(output+'transition-sound.wav',wav);
