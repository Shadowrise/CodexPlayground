import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {startKnightBattle,setKnightPhase,advanceKnightBattle,knightPosition,knightImpactProgress,knightPressureWave,type KnightBattle} from '../src/meta-knight-battle';
import {pidgeyAirHeight} from '../src/knight-boss';
import {MetapidgieFlightTrail,PIDGEY_FLIGHT_TRAIL} from '../src/metapidgie-flight-trail';
import {PHASE_TWO_CLIPS} from '../scripts/metapidgie-phase2-authoring';
import {requestKnightDuet} from '../src/meta-knight-duet';
import {MetaKnightDuetView} from '../src/meta-knight-duet-view';
import {CharacterController} from '../src/controller';
import {clonePigeon} from '../src/pigeon-appearance';
import {pidgeyCameraPoints} from '../src/metapidgie-camera';
import {fitKnightArenaCamera} from '../src/meta-knight-camera-fit';
const actor={id:'a',p:[0,0,-2] as [number,number,number],yaw:0,available:true};
function make(){const s=startKnightBattle([actor],'a',1000,'metapidgie')!;assert(setKnightPhase(s,2,[actor],2000));s.players.a.invulnerable=1e12;return s;}
test('phase two runs both aimed passes, dive/wave, all three crescents and recovery',()=>{
 const s=make(),a={...actor,p:[20,0,15] as typeof actor.p},stages:string[]=[];let sawWave=false;
 for(let i=0;i<40;i++){
  advanceKnightBattle(s,[a],s.until);stages.push(s.pattern+':'+s.stage);
  if(s.stage==='dash')assert(s.until-s.since>=700);
  if(s.stage==='dive-warn'){assert.equal(s.until-s.since,1920);assert.equal(knightPosition(s,s.since)[1],0);assert.equal(knightPosition(s,s.until)[1],10);}
  if(s.stage==='dive'){assert.equal(s.until-s.since,450);assert.equal(knightPosition(s,s.since)[1],10);assert.equal(knightPosition(s,s.until)[1],0);assert.equal(knightImpactProgress(s,s.until),1);}
  if(s.stage==='open'&&s.pattern==='dive'){sawWave=true;assert(s.impactWave);assert(knightPressureWave(s,s.since+100));}
  if(s.stage==='rest'&&s.pattern==='crescent')break;
 }
 assert.equal(stages.filter(s=>s==='flight:dash').length,2);assert.equal(stages.filter(s=>s==='crescent:shot').length,3);assert(sawWave);assert(stages.includes('flight:open'));assert(stages.includes('crescent:rest'));assert.equal(s.phase,2);
});
test('the flight opening settles continuously from its previous height',()=>{
 const s=make();Object.assign(s,{stage:'dash',pattern:'flight',step:3,since:1000,until:1700,checked:1000,from:[-10,0,0],to:[10,0,0],height:2});
 advanceKnightBattle(s,[{...actor,p:[25,0,0]}],1700);assert.equal(s.stage,'open');assert.equal(s.pidgeySettleHeight,2);assert.equal(knightPosition(s,1700)[1],2);assert.equal(knightPosition(s,s.until)[1],0);
});
test('all second-phase clips bind, retain finite unit rotations and use native flight wing articulation',async()=>{
 const bytes=await readFile(new URL('../public/models/metapidgie-animated.glb',import.meta.url)),loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const model=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),data=JSON.parse(await readFile(new URL('../public/models/metapidgie-boss-phase2.json',import.meta.url),'utf8'));
 assert.equal(data.sourceSha256,(model.asset as any).extras.workshopSha256);const clips=data.clips.map((c:any)=>T.AnimationClip.parse(c)) as T.AnimationClip[];
 assert.deepEqual(clips.map(c=>c.name),PHASE_TWO_CLIPS.map(c=>c[0]));const mixer=new T.AnimationMixer(model.scene);
 for(const clip of clips){
  for(const track of clip.tracks){const binding=T.PropertyBinding.parseTrackName(track.name),node=T.PropertyBinding.findNode(model.scene,binding.nodeName);assert(node,track.name);if(binding.propertyName==='morphTargetInfluences')assert.equal(track.getValueSize(),(node as T.Mesh).morphTargetInfluences!.length);}
  mixer.stopAllAction();const action=mixer.clipAction(clip).play();action.paused=true;
  for(let i=0;i<=36;i++){action.time=clip.duration*i/36;mixer.update(0);model.scene.updateMatrixWorld(true);model.scene.traverse(node=>{assert(node.matrixWorld.elements.every(Number.isFinite),`${clip.name}: ${node.name}`);if(node.type==='Bone')assert(Math.abs(node.quaternion.length()-1)<1e-4);});}
 }
 const dash=clips.find(c=>c.name==='Boss_dash')!,fly=model.animations.find(c=>c.name==='Fly')!;
 for(const name of ['Left_wing','Right_wing','Left_wing_vane','Right_wing_vane'])for(let i=0;i<=21;i++){
  const node=model.scene.getObjectByName(name)!;mixer.stopAllAction();const a=mixer.clipAction(dash).play();a.paused=true;a.time=dash.duration*i/21;mixer.update(0);const actual=node.quaternion.clone();
  mixer.stopAllAction();const b=mixer.clipAction(fly).play();b.paused=true;b.time=((.125+i/21)%1)*fly.duration;mixer.update(0);assert(actual.angleTo(node.quaternion)<.002,`${name}: preserve native articulation`);
 }
 const dive=clips.find(c=>c.name==='Boss_dive')!;mixer.stopAllAction();const a=mixer.clipAction(dive).play();a.paused=true;
 for(const u of [0,.25,.5,.75,1]){a.time=u*dive.duration;mixer.update(0);const motion=model.scene.getObjectByName('Motion')!;assert(motion.position.y>=pidgeyAirHeight('dive',u)-.01);}
});
test('mist stays in world space, fades through recovery, is bounded, and never joins teleports',()=>{
 const trail=new MetapidgieFlightTrail(),s=make(),camera=new T.PerspectiveCamera();camera.position.set(0,15,30);Object.assign(s,{stage:'dash'});
 for(let i=0;i<60;i++)trail.update(s,3000+i*20,new T.Vector3(i*.9,6,0),camera);
 assert(trail.sampleCount>20);assert(trail.sampleCount<=PIDGEY_FLIGHT_TRAIL.capacity);const recorded=trail.samples,first=recorded[Math.floor(recorded.length/2)];
 s.stage='open';trail.update(s,4200,new T.Vector3(100,0,0),camera);assert(trail.group.visible);assert(trail.samples.some(p=>p.at===first.at&&p.p[0]===first.p[0]));
 const paused=JSON.stringify(trail.samples);trail.update(s,4200,new T.Vector3(200,0,0),camera);assert.equal(JSON.stringify(trail.samples),paused);
 trail.update(s,6000,new T.Vector3(200,0,0),camera);assert.equal(trail.sampleCount,0);assert(!trail.group.visible);
 s.stage='dash';trail.update(s,6100,new T.Vector3(0,5,0),camera);trail.update(s,6120,new T.Vector3(1,5,0),camera);trail.update(s,6140,new T.Vector3(100,5,0),camera);assert.equal(trail.sampleCount,1);
 trail.update({...s,id:s.id+1},6160,new T.Vector3(20,5,0),camera);assert.equal(trail.sampleCount,1);trail.dispose();assert.equal(trail.group.parent,null);
});
test('the shared thunderstorm uses the actual beak and never applies sword poses to the bird',async()=>{
 const helper={...actor,id:'helper',p:[3,0,-3] as typeof actor.p,metaKnight:true,side:'boss' as const},heroes=[actor,helper],s=startKnightBattle(heroes,'a',1000,'metapidgie')!;
 assert(setKnightPhase(s,2,heroes,2000));Object.assign(s,{stage:'rest',since:3000,until:3100,checked:3000});assert(requestKnightDuet(s,helper,3000));advanceKnightBattle(s,heroes,3100);assert.equal(s.stage,'duet-gather');advanceKnightBattle(s,heroes,s.until);assert.equal(s.stage,'duet-charge');
 const bytes=await readFile(new URL('../public/models/metapidgie-animated.glb',import.meta.url)),loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const model=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),bird=new CharacterController(clonePigeon(model.scene),model.animations),scene=new T.Scene();scene.add(bird.actor);bird.actor.scale.setScalar(3.3);
 const head=bird.actor.getObjectByName('Head')!,before=head.quaternion.clone(),view=new MetaKnightDuetView(scene,()=>{});view.update(s,s.since+2400,bird,undefined);
 assert(view.group.visible);assert(bird.actor.getObjectByName('Metapidgie_beak_tip'));assert.equal(bird.actor.getObjectByName('Galaxia'),undefined);assert(head.quaternion.angleTo(before)<1e-6);assert(view.bolts.group.children.length>0);view.dispose();bird.disposeEffects();
});
test('flight warning frames both ends before a fast pass reaches the arena edge',()=>{
 const s=make();Object.assign(s,{stage:'dash-warn',pattern:'flight',from:[-40,0,-9],to:[52,0,12]});const points=pidgeyCameraPoints(s,[-40,0,-9],[20,0,5]);assert(points.some(p=>p[0]===59));
 for(const [w,h] of [[1280,900],[390,844]]){const fit=fitKnightArenaCamera(w,h,points,100,80,false),camera=new T.PerspectiveCamera(fit.fov,w/h,.1,1000),focus=new T.Vector3().fromArray(fit.focus);camera.position.copy(focus).add(new T.Vector3(0,.68,.82).multiplyScalar(fit.distance));camera.lookAt(focus);camera.updateMatrixWorld();for(const p of points){const q=new T.Vector3().fromArray(p).project(camera);assert(Math.abs(q.x)<1&&Math.abs(q.y)<1);}}
});
