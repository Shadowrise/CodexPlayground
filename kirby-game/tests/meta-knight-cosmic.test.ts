import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {MetaKnightBattleMotion} from '../src/meta-knight-battle-motion';
import {KNIGHT,startKnightBattle,setKnightPhase,advanceKnightBattle,knightPosition,knightAttack,type KnightActor} from '../src/meta-knight-battle';
import {COSMIC,COSMIC_SEQUENCE,cosmicHeight,cosmicAirborne,cosmicControlsLocked,cosmicPlayerPush} from '../src/meta-knight-cosmic';
import {COSMIC_SOUNDS} from '../src/meta-knight-cosmic-sounds';
import {knightSound} from '../src/meta-knight-sounds';
import {Flight} from '../src/flight';
import {cosmicCameraPose} from '../src/meta-knight-cosmic-camera';
import {MetaKnightCosmicView} from '../src/meta-knight-cosmic-view';
import {MetaKnightCrystalLightning} from '../src/meta-knight-crystal-lightning';
import {buildCosmicSurface} from '../src/meta-knight-cosmic-electricity';
import {FollowCamera} from '../src/follow-camera';
import {COSMIC_WORLDS,cosmicWorldPosition,cosmicTravel} from '../src/meta-knight-cosmic-world';

const a:KnightActor={id:'solo',p:[0,0,-2],yaw:0,available:true};
const battle=()=>startKnightBattle([a],'solo',1000)!;
test('fourth phase owns one finite shared ascent and a free-flight arrival before the first attack',()=>{
 const s=battle();s.players.solo.hp=3;s.returnFrom=[0,1,30];s.impactWave={at:2000,origin:[0,0,0]};s.shotContacts={solo:2000};
 assert(setKnightPhase(s,4,[a],3000));assert.equal(s.hp,6);assert.equal(s.players.solo.hp,3);assert(!s.impactWave&&!s.returnFrom&&!s.shotContacts);
 let now=s.until;advanceKnightBattle(s,[a],now);
 for(const [stage,ms] of COSMIC_SEQUENCE){
  assert.equal(s.stage,stage);assert.equal(s.until-s.since,ms);assert.equal(s.hp,6);assert.equal(s.players.solo.hp,3);
  if(stage!=='cosmic-flight')assert(!knightAttack(s,a,s.since+10));
  if(stage==='cosmic-rise'){
   let before=-1;for(let i=0;i<=100;i++){const time:number=s.since+ms*i/100,height:number=cosmicHeight(s,time);assert(height>=before&&height>=0&&height<=COSMIC.height);assert.equal(knightPosition(s,time)[1],height);before=height;}
  }else assert.equal(cosmicHeight(s,s.since),stage==='cosmic-flight'?COSMIC.height:0);
  if(stage==='cosmic-flight')break;now=s.until;advanceKnightBattle(s,[a],now);
 }
 advanceKnightBattle(s,[a],s.until-1);assert.equal(s.stage,'cosmic-flight');assert.equal(s.hp,6);assert.equal(s.players.solo.hp,3);
 advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'cosmic-spin-warn');assert.equal(cosmicHeight(s,s.since),180);
 assert(setKnightPhase(s,1,[a],s.since+1000));assert.equal(s.hp,12);assert.equal(cosmicHeight(s,s.since),0);assert.deepEqual(s.from,[0,0,-9]);
});
test('persistent planar flight never gains height or falls when time advances',()=>{
 const flight=new Flight();for(let i=0;i<600;i++){flight.holdPlane();flight.update(1/30);assert(flight.active);assert(flight.levitating);assert.equal(flight.height,0);}flight.reset();assert(!flight.active);
});
test('the sword impact captures every participant, pushes outward to the rim, and finishes before takeoff',()=>{
 const actors:KnightActor[]=[structuredClone(a),{id:'west',p:[-15,0,7],yaw:1,available:true},{id:'centre',p:[0,0,0],yaw:.7,available:true},{id:'withdrawn',p:[8,0,8],yaw:0,available:true}];
 const s=startKnightBattle(actors,'solo',1000)!;s.players.withdrawn.withdrawn=true;setKnightPhase(s,4,actors,3000);
 assert(!cosmicControlsLocked(s));advanceKnightBattle(s,actors,s.until);assert.equal(s.stage,'cosmic-charge');assert(!cosmicControlsLocked(s));
 actors[0].p=[13,0,9];advanceKnightBattle(s,actors,s.until);assert.equal(s.stage,'cosmic-strike');assert(!cosmicControlsLocked(s));assert(!s.cosmicLaunch);
 advanceKnightBattle(s,actors,s.until);assert.equal(s.stage,'cosmic-surge');assert(cosmicControlsLocked(s));assert.deepEqual(s.cosmicLaunch!.players.solo.from,[13,0,9]);assert(!s.cosmicLaunch!.players.withdrawn);
 const saved=structuredClone(s),at=s.since;
 for(const actor of actors.filter(a=>a.id!=='withdrawn')){
  let previous=Math.hypot(actor.p[0],actor.p[2]);for(let t=0;t<=COSMIC.surgeMs;t+=10){const push=cosmicPlayerPush(s,actor.id,at+t)!;const r=Math.hypot(push.point[0],push.point[2]);assert(r>=previous-1e-8&&r<=41.00001);assert.equal(push.point[1],0);assert.equal(cosmicHeight(s,at+t),0);previous=r;}
  assert(Math.abs(previous-41)<.00001);assert.deepEqual(cosmicPlayerPush(s,actor.id,at+890),cosmicPlayerPush(saved,actor.id,at+890),'a saved or network snapshot reconstructs exactly the same recoil');
 }
 advanceKnightBattle(s,actors,s.until);assert.equal(s.stage,'cosmic-lift');assert.equal(cosmicHeight(s,s.since+500),0);
 advanceKnightBattle(s,actors,s.until);assert.equal(s.stage,'cosmic-rise');assert.equal(Math.hypot(...cosmicPlayerPush(s,'solo',s.since)!.point.filter((_,i)=>i!==1)),41);
 setKnightPhase(s,2,actors,s.since+100);assert(!s.cosmicLaunch);assert(!cosmicControlsLocked(s));
});
test('forced takeoff runs the actual flying animation from its first frame on every rig',async()=>{
 for(const name of ['kirby','pigeon','snowball','meta-knight']){
  const bytes=await readFile(new URL(`../public/models/${name}-animated.glb`,import.meta.url)),loader=new GLTFLoader();loader.register(()=>({name:'test-no-image-decoding',loadTexture:()=>Promise.resolve(new T.Texture())}));
  const asset=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),c=new CharacterController(asset.scene,asset.animations);
  c.setActivity('Fly');c.flight.holdPlane();c.updateActivity(1/60);
  const fly=c.actions.get('Fly')!;assert(fly.isRunning(),`${name}: the Fly action is playing on the first airborne frame`);assert(fly.time>0);
  for(let i=0;i<14;i++){c.flight.holdPlane();c.updateActivity(1/60);}assert(fly.getEffectiveWeight()>.999,`${name}: the flight clip has fully replaced idle`);
  const pose=new Map<string,T.Quaternion>();c.actor.traverse(o=>pose.set(o.uuid,o.quaternion.clone()));
  for(let i=0;i<9;i++){c.flight.holdPlane();c.updateActivity(1/60);}let motion=0;c.actor.traverse(o=>motion=Math.max(motion,o.quaternion.angleTo(pose.get(o.uuid)!)));
  assert(motion>.01,`${name}: the rig keeps animating during the ascent`);assert.equal(c.flight.height,0);c.disposeEffects();
 }
});
test('arrival doubles the camera distance, keeps the real arena below and respects manual orbit and zoom',()=>{
 const s=battle();Object.assign(s,{phase:4,stage:'cosmic-flight',since:20000,until:1e12});
 const follow=new FollowCamera();follow.reset(-Math.PI*.75);
 const pose=cosmicCameraPose(s,23000,[9,180,9],1600,1000,follow),p=new T.Vector3().fromArray(pose.position),target=new T.Vector3().fromArray(pose.focus),delta=p.clone().sub(target);
 assert(Math.abs(Math.atan2(delta.y,Math.hypot(delta.x,delta.z))*180/Math.PI)<15);assert(Math.abs(p.distanceTo(new T.Vector3(9,180.9,9))-follow.distance*2)<.001);
 const camera=new T.PerspectiveCamera(pose.fov,1.6,.25,1400);camera.position.copy(p);camera.lookAt(target);camera.updateMatrixWorld();
 const boss=new T.Vector3(0,184,0).project(camera),player=new T.Vector3(9,181,9).project(camera),feet=new T.Vector3(0,180,0).project(camera),head=new T.Vector3(0,188,0).project(camera);
 assert(Math.abs(boss.x)<.3&&Math.abs(boss.y)<.6);assert(head.y-feet.y>.3,'the boss is readable with the wider camera');assert(Math.abs(player.x)<.5&&Math.abs(player.y)<.9);
 const drift=new T.Vector3().fromArray(cosmicTravel(s,23000,Math.PI/4));camera.position.add(drift);camera.lookAt(target.clone().add(drift));camera.updateMatrixWorld();
 const arena=new T.Vector3(0,0,0).project(camera);assert(Math.abs(arena.x)<.1&&arena.y<-.4&&arena.y>-.95,'the original arena is visible in the bottom of the frame');
 follow.orbit(100,30);follow.zoom(200);for(let i=0;i<90;i++)follow.update(1/60,-Math.PI*.75,false,0,0);
 const moved=cosmicCameraPose(s,23000,[9,180,9],1600,1000,follow);assert(new T.Vector3().fromArray(moved.position).distanceTo(p)>3);assert(follow.distance>10&&follow.elevation>.3);
});
test('worlds remain on separate orbital bands and the formation never flies through a planet',()=>{
 assert.equal(COSMIC_WORLDS.length,12);assert.equal(new Set(COSMIC_WORLDS.map(w=>w.high)).size,12);assert.equal(new Set(COSMIC_WORLDS.map(w=>w.kind)).size,12);
 const s=battle();Object.assign(s,{phase:4,stage:'cosmic-flight',since:0,until:1e12});const drift=new T.Vector3().fromArray(cosmicTravel(s,10000,Math.PI/4));
 for(const seconds of [0,900,6000])for(let degrees=0;degrees<360;degrees+=5){
  const pose=cosmicCameraPose(s,10000,[41/Math.sqrt(2),180,41/Math.sqrt(2)],1600,1000,{azimuth:degrees*Math.PI/180,elevation:.25,distance:10}),camera=new T.PerspectiveCamera(pose.fov,1.6,.25,3000);
  camera.position.fromArray(pose.position).add(drift);camera.lookAt(new T.Vector3().fromArray(pose.focus).add(drift));camera.updateMatrixWorld();const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  assert(COSMIC_WORLDS.some((w,i)=>frustum.intersectsSphere(new T.Sphere(new T.Vector3().fromArray(cosmicWorldPosition(i,seconds)),w.radius))),`${seconds}s, ${degrees}°: the actual camera must see a planet in every direction`);
 }
 for(const world of COSMIC_WORLDS)assert(Math.hypot(world.orbit,world.height)+world.extent<1800,'all worlds stay inside the same sky throughout flight');
 for(let seconds=0;seconds<6000;seconds+=7){
  const positions=COSMIC_WORLDS.map((_,i)=>new T.Vector3().fromArray(cosmicWorldPosition(i,seconds)));
  for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++)assert(positions[i].distanceTo(positions[j])>COSMIC_WORLDS[i].extent+COSMIC_WORLDS[j].extent+50,'the atmospheres and rings never intersect');
 }
 for(const world of COSMIC_WORLDS)for(let i=0;i<=100;i++){
  const u=i/100,radial=world.orbit-240*u,vertical=world.height-180*u;
  assert(Math.hypot(radial,vertical)>world.extent+46,'even the nearest edge of the player plane clears the planets');
 }
});
test('the charge has five times as many bolt segments and uses the exact third-phase gold',async()=>{
 const bytes=await readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url)),asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const c=new CharacterController(asset.scene,asset.animations),scene=new T.Scene();scene.add(c.actor);c.actor.position.x=2000;c.actor.scale.setScalar(KNIGHT.modelScale);
 const fx=new MetaKnightCosmicView(c.actor,scene),crystals=new MetaKnightCrystalLightning(),s=battle();scene.add(fx.group);fx.group.position.x=2000;Object.assign(s,{phase:4,stage:'cosmic-charge',since:10000,until:12800});
 fx.update(s,12500);assert(fx.lightning.hot.count>=162*5);assert(fx.lightning.hotMaterial.color.equals((crystals.cores.material as T.MeshBasicMaterial).color));
 assert(fx.lightning.glowMaterial.color.equals((crystals.group.children[1] as T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>).material.color));
 assert(fx.lightning.hot.count<8192);
 const before=new T.Matrix4(),after=new T.Matrix4();fx.lightning.hot.getMatrixAt(0,before);
 const formation=new T.Group();scene.add(formation);formation.add(c.actor,fx.group);formation.position.set(170,0,170);fx.update(s,12500);fx.lightning.hot.getMatrixAt(0,after);
 before.elements.forEach((value,i)=>assert(Math.abs(value-after.elements[i])<.00001,'sword and eye electricity stays attached when the formation travels in space'));
 assert.equal(c.actor.position.x,2000,'presentation travel does not change combat coordinates');
 Object.assign(s,{stage:'cosmic-strike',since:19000,until:19850});fx.update(s,19500);const attached=fx.lightning.hot.count;
 Object.assign(s,{stage:'cosmic-surge',since:20000,until:21900});fx.update(s,20300);const earlyCount=fx.lightning.hot.count,early=new T.Matrix4();fx.lightning.hot.getMatrixAt(attached,early);
 fx.update(s,21100);const late=new T.Matrix4();fx.lightning.hot.getMatrixAt(attached,late);
 assert.deepEqual(early.elements,late.elements,'a completed ground segment stays at the same world coordinates as electricity moves outward');
 assert(fx.lightning.hot.count>earlyCount*2,'new branches appear progressively, instead of scaling an existing image');assert(fx.lightning.hot.count<8192);
 fx.dispose();crystals.dispose();c.disposeEffects();
});
test('surface electricity reaches the real arena rim with independently timed branches and no floor paths in the void',()=>{
 for(const seed of [0,987,174099123]){
  const surface=buildCosmicSurface(seed);assert(surface.segments.length>4000);assert(surface.segments.length<6000);assert(surface.tips.length>=36);
  for(const {a,b,at,duration} of surface.segments){assert(Math.hypot(a[0],a[2])<=46.00001);assert(Math.hypot(b[0],b[2])<=46.00001);assert(Number.isFinite(at)&&duration>0);}
  for(const tip of surface.tips){assert(Math.abs(Math.hypot(tip.p[0],tip.p[2])-46)<.00001);assert(tip.at>650&&tip.at<1900);}
  const edges=surface.tips.map(t=>t.at);assert(Math.max(...edges)-Math.min(...edges)>200,'the rim is reached at different moments, without a uniform circular front');
 }
});
test('downloaded transition samples have the correct cue lengths, stereo detail, silent boundaries and headroom',async()=>{
 for(const [kind,seconds] of [['charge',2.8],['impact',4.6],['draw',1.05],['ascent',5.6],['arrive',3.2]] as const){
  const wav=await readFile(new URL(`../public/audio/meta-knight-cosmic/cosmic-${kind}.wav`,import.meta.url));
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt32LE(24),44100);assert.equal(wav.readUInt32LE(40),Math.ceil(seconds*44100)*4);
  let peak=0,stereo=0;for(let i=44;i<wav.length;i+=4){const l=wav.readInt16LE(i)/32768,r=wav.readInt16LE(i+2)/32768;peak=Math.max(peak,Math.abs(l),Math.abs(r));stereo+=(l-r)**2;}
  assert(peak>.25&&peak<.73,kind);assert(stereo>0,kind);assert.equal(wav.readInt16LE(44),0);assert.equal(wav.readInt16LE(wav.length-2),0);
 }
});
test('the actual GLB keeps its sword clear of the torso through every ascent pose, with continuous stage joins',async()=>{
 const bytes=await readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url)),asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const c=new CharacterController(asset.scene,asset.animations),motion=new MetaKnightBattleMotion(c.actor),s=battle();c.actor.scale.setScalar(KNIGHT.modelScale);s.phase=4;
 const blade=c.actor.getObjectByName('Galaxia')!,body=c.actor.getObjectByName('Body_motion')!,hand=c.actor.getObjectByName('Left_gauntlet')!,point=new T.Vector3();let since=5000,lastTip:T.Vector3|undefined;
 for(const [stage,duration] of COSMIC_SEQUENCE){
  for(let frame=0;frame<=60;frame++){
   const elapsed=stage==='cosmic-flight'?1600*frame/60:duration*frame/60;
   motion.clear();c.setActivity(cosmicAirborne({phase:4,stage,since,until:since+duration})?'Fly':'Idle');c.updateActivity(0);
   Object.assign(s,{stage,since,until:since+duration});c.actor.position.y=cosmicHeight(s,since+elapsed);motion.apply(s,elapsed/duration);c.actor.updateMatrixWorld(true);
   let closest=Infinity;
   blade.traverse(o=>{if(o instanceof T.Mesh){const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i+=3){point.fromBufferAttribute(p,i);o.localToWorld(point);body.worldToLocal(point);closest=Math.min(closest,(point.x/.91)**2+(point.y/.91)**2+(point.z/.79)**2);}}});
   assert(closest>1.035,`${stage} ${frame}: blade enters torso (${closest})`);
   const tip=blade.localToWorld(new T.Vector3(-.315,2.05,0));
   if(frame===0&&lastTip)assert(tip.distanceTo(lastTip)<.14,`${stage}: discontinuous sword position (${tip.distanceTo(lastTip)})`);
   if(frame===60)lastTip=tip;
   if(stage==='cosmic-surge'||stage==='cosmic-strike'&&frame===60)assert(tip.y<0&&tip.y>-.25,'only the planted tip goes into the arena floor');
   if(stage==='cosmic-strike'&&frame===28)assert(body.getWorldPosition(new T.Vector3()).y>6,'the whole body jumps before the sword lands');
   if(stage==='cosmic-strike'&&frame<55)assert(tip.y>0,'the sword does not touch the floor before the landing');
   if(stage!=='cosmic-charge'&&stage!=='cosmic-flight')assert(hand.getWorldPosition(new T.Vector3()).distanceTo(blade.localToWorld(new T.Vector3(0,-.23,.025)))<.001,'support hand remains attached');
  }
  since+=duration;
 }
 motion.clear();c.disposeEffects();
});
test('ascent effects have distinct stereo energy, finite samples, headroom and silent edges',()=>{
 const fingerprints=new Set<string>();
 for(const kind of COSMIC_SOUNDS){const {left,right}=knightSound(kind,22050);let energy=0,stereo=0,peak=0;
  for(let i=0;i<left.length;i++){assert(Number.isFinite(left[i])&&Number.isFinite(right[i]));energy+=left[i]**2+right[i]**2;stereo+=(left[i]-right[i])**2;peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}
  assert(peak<.681&&peak>.1,kind);assert(energy/left.length>.0001,kind);assert(stereo>0,kind);assert.equal(Math.abs(left[0]),0);assert.equal(Math.abs(right.at(-1)!),0);fingerprints.add(left.length+':'+energy.toFixed(3));
 }assert.equal(fingerprints.size,COSMIC_SOUNDS.length);
});
