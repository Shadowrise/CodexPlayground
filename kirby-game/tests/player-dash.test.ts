import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Quaternion,Texture,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {CharacterController,type Input} from '../src/controller';
import {PLAYER_KNIGHT_DASH as DASH} from '../src/meta-knight-player-dash';
import {actorState,applyActor} from '../src/network-actors';
import {validActor} from '../src/network-protocol';
import {PlayerSnapshots} from '../src/player-snapshots';
import {disposeActor} from '../src/actor-lifecycle';
import {createPlayerModel} from '../src/player-model';
import {KIRBY_VARIANTS,isPigeonVariant} from '../src/variants';

const assets=await Promise.all(['kirby','pigeon','snowball'].map(async name=>{
 const bytes=await readFile(new URL(`../public/models/${name}-animated.glb`,import.meta.url));
 const loader=new GLTFLoader();loader.register(()=>({name:'test-no-image-decoding',loadTexture:()=>Promise.resolve(new Texture())}));
 return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}));
const idle:Input={forward:false,left:false,right:false},held={...idle,jump:true};
function create(index=0){const asset=assets[index];return new CharacterController(clone(asset.scene),asset.animations);}
function advance(c:CharacterController,seconds:number,input=idle,fps=100){for(let i=0;i<Math.round(seconds*fps);i++)c.update(1/fps,input);}

test('every selectable Kirby skin, including the crown and bandana, uses the shared dash',()=>{
 for(const variant of KIRBY_VARIANTS.filter(v=>!isPigeonVariant(v[0])&&v[0]!=='Meta Knight')){
  const rig=createPlayerModel(assets[0],variant),c=new CharacterController(rig.model,rig.clips);
  advance(c,.3,held);advance(c,.3,held);assert.equal(c.state,'Dash',variant[0]);assert(c.animationRoot.rotation.x>.45,variant[0]);
  assert(c.actor.getObjectByName('Left_shoulder')!.rotation.z>0,variant[0]);disposeActor(c);
 }
});

test('every Kirby and both pigeon rigs charge after 0.3s, travel 12m with a locked heading and do not repeat a held press',()=>{
 for(const index of [0,1,2])for(const fps of [30,60,120])for(const yaw of [0,1.7,Math.PI]){
  const c=create(index);c.yaw=yaw;c.actor.rotation.y=yaw;
  advance(c,DASH.hold,held,fps);assert.equal(c.state,'Dash');assert.equal(c.playerDash.cooldown,6);
  const origin=c.actor.position.clone();advance(c,DASH.duration,{...held,left:true,forward:true,sprint:true},fps);
  const forward=new Vector3(Math.sin(yaw),0,Math.cos(yaw));assert(Math.abs(c.actor.position.clone().sub(origin).dot(forward)-12)<1e-7);
  assert.equal(c.yaw,yaw);assert.equal(c.state,'Fly');assert(c.flight.active);
  advance(c,6,held,fps);assert(!c.playerDash.active);assert.equal(c.playerDash.cooldown,0);
  assert(Math.abs(c.actor.position.clone().sub(origin).dot(forward)-12)<1e-7);
 }
});

test('short taps, interruption, swimming and eating cannot arm a delayed dash',()=>{
 for(const index of [0,1,2]){
  const c=create(index);advance(c,.29,held);assert.notEqual(c.state,'Dash');c.update(.01,idle);advance(c,.29,held);assert.notEqual(c.state,'Dash');
  c.updateActivity(0);advance(c,.2,held);assert.equal(c.playerDash.cooldown,0);
  c.setActivity('Idle');c.swimming=true;advance(c,1,{...idle,dashHeld:true});assert.equal(c.playerDash.cooldown,0);
  c.swimming=false;advance(c,1,{...held,eat:true});assert.equal(c.playerDash.cooldown,0);
 }
});

test('holding Space dashes in a locked flight plane, keeps altitude and cannot repeat until released',()=>{
 for(const index of [0,1,2])for(const fps of [30,60,120]){
  const c=create(index);c.actor.position.y=c.surfaceY=180;c.yaw=.7;c.actor.rotation.y=.7;c.setActivity('Fly');
  const origin=c.actor.position.clone(),input={...idle,jump:false,jumpPressed:false,dashHeld:true};
  const step=(frames:number,held:boolean)=>{for(let i=0;i<frames;i++){
   c.flight.holdPlane();c.surfaceY=c.actor.position.y=180;c.update(1/fps,{...input,dashHeld:held});
   c.flight.holdPlane();c.surfaceY=c.actor.position.y=180;assert(c.flight.active);assert.equal(c.actor.position.y,180);
  }};
  step(1,false);step(Math.round(.5*fps),true);assert.equal(c.state,'Dash');assert(c.actor.position.distanceTo(origin)>0);
  step(Math.round(.5*fps),true);assert(!c.playerDash.active);assert.equal(c.state,'Fly');assert(Math.abs(c.actor.position.distanceTo(origin)-12)<1e-7);
  step(6*fps,true);assert(!c.playerDash.active);assert.equal(c.playerDash.cooldown,0);assert(Math.abs(c.actor.position.distanceTo(origin)-12)<1e-7);
  step(1,false);step(Math.round(.5*fps),true);assert.equal(c.state,'Dash');disposeActor(c);
 }
});

test('the cosmic movement multiplier doubles planar flight for one input frame without changing world movement or the Space dash',()=>{
 for(const index of [0,1,2]){
  const c=create(index);c.beginDuel();c.actor.position.y=c.surfaceY=180;c.setActivity('Fly');
  const step=(frames:number,multiplier?:number)=>{for(let i=0;i<frames;i++){c.flight.holdPlane();c.update(1/60,{...idle,forward:true,movementMultiplier:multiplier});c.actor.position.y=180;}};
  step(60);const normal=c.actor.position.z;step(60,2);const cosmic=c.actor.position.z-normal;step(60);const restored=c.actor.position.z-normal-cosmic;
  assert(Math.abs(normal-2.72)<1e-7);assert(Math.abs(cosmic-normal*2)<1e-7);assert(Math.abs(restored-normal)<1e-7,'no persistent movement modifier leaks to the next scene');
  const before=c.actor.position.clone();c.update(1/60,{...idle,dashHeld:false,movementMultiplier:2});for(let i=0;i<60;i++){c.flight.holdPlane();c.update(1/60,{...idle,dashHeld:true,movementMultiplier:2});c.actor.position.y=180;}
  assert(Math.abs(c.actor.position.distanceTo(before)-12)<1e-7,'the existing twelve-metre Space dash stays intact');disposeActor(c);
 }
});

test('bird burst accelerates and brakes, keeps its beak aimed forward, folds wings and restores the full flight rig',()=>{
 const c=create(1);advance(c,DASH.hold,held);const displacements:number[]=[];
 for(let i=0;i<7;i++){const before=c.actor.position.z;advance(c,.1,held);displacements.push(c.actor.position.z-before);}
 assert(displacements[2]>displacements[0]*3);assert(displacements[3]>displacements[6]*3);
 c.setActivity('Idle');c.playerDash.tick(6);c.actor.position.y=0;c.update(.01,idle);advance(c,.3,held);advance(c,.32,held);
 assert(c.actor.getObjectByName('Motion')!.rotation.x>.8);const direction=new Vector3(0,0,1).applyQuaternion(c.actor.getObjectByName('Beak')!.getWorldQuaternion(new Quaternion()));
 assert(direction.z>.99);assert(Math.abs(direction.y)<.10,'the beak does not point into the ground');
 assert(c.actor.getObjectByName('Left_wing_vane')!.scale.x>.80,'feathers tuck against the body during the cruise');
 c.setActivity('Idle');advance(c,.25);assert(Math.abs(c.actor.getObjectByName('Motion')!.rotation.x)<1e-6);
 for(const side of ['Left','Right'])assert.equal(c.actor.getObjectByName(side+'_wing_vane')!.scale.x,1);
});

test('Kirby spreads both arms as an airplane without accumulating the tilt or leaking it into rides',()=>{
 const c=create();advance(c,.3,held);advance(c,.3,held);
 assert(c.animationRoot.rotation.x>.45);assert(!c.cloud.visible,'smoke must not obscure the airplane silhouette');
 for(const [side,sign] of [['Left',-1],['Right',1]] as const){const arm=c.actor.getObjectByName(side+'_shoulder')!;assert(Math.abs(arm.rotation.z+sign*.34)<1e-6);}
 const tilt=c.animationRoot.rotation.x;advance(c,.02,held);assert(Math.abs(c.animationRoot.rotation.x-tilt)<.03,'no cumulative lean');
 c.setActivity('Boat');advance(c,.01);assert(Math.abs(c.animationRoot.rotation.x)<1e-6);
});

test('network peers reconstruct the untransmitted bird head, torso, vane and tail phases',()=>{
 for(const index of [1,2]){
  const source=create(index),remote=create(index);advance(source,.24,held);
  for(const step of [.0,.06,.08,.22,.20,.17]){
   advance(source,step,held);const state=actorState(source,'Bird',17);assert(validActor(state));assert(state.dash);
   applyActor(remote,state,.016,true);
   for(const name of ['Motion','Body','Neck','Head','Tail','Left_wing_vane']){
    const a=source.actor.getObjectByName(name)!,b=remote.actor.getObjectByName(name)!;
    assert(a.quaternion.angleTo(b.quaternion)<.015,`${name}: identical dash phase`);assert(a.position.distanceTo(b.position)<.015,name);
   }
   assert.equal(remote.cloud.visible,false);
  }
  source.setActivity('Idle');applyActor(remote,actorState(source,'Bird',17),.02,true);assert.equal(remote.actor.getObjectByName('Left_wing_vane')!.scale.x,1);
  disposeActor(source);disposeActor(remote);
 }
});

test('buffered snapshots interpolate dash phase, and malformed optional phase data is rejected',()=>{
 const c=create(1);advance(c,.5,held);const state=actorState(c,'Bird',17),snapshots=new PlayerSnapshots(0);
 snapshots.push(0,{...state,dash:[0,.2]});snapshots.push(100,{...state,dash:[0,.6]});assert.deepEqual(snapshots.sample(50)?.dash,[0,.4]);
 for(const dash of [[0,2],[NaN,0],[0],null])assert(!validActor({...state,dash}));
 assert(validActor({...state,dash:undefined}),'old clients retain compatibility');
});
