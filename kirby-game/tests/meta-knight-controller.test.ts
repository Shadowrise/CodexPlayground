import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AnimationMixer,Group,LoopOnce,LoopRepeat,Quaternion,Vector3} from 'three';
import {CharacterController,type Input} from '../src/controller';
import {createMetaKnight} from '../src/meta-knight-model';
import {META_KNIGHT_CLIPS,META_KNIGHT_CLIP_BY_NAME} from '../src/meta-knight-clips';
import {PUSH_HIT} from '../src/push-motion';

const asset=createMetaKnight();
const idle:Input={forward:false,left:false,right:false};
function create(){const wrapper=new Group();wrapper.add(asset.root.clone(true));return new CharacterController(wrapper,asset.clips);}
function advance(c:CharacterController,seconds:number,input=idle){for(let i=0;i<Math.round(seconds*60);i++)c.update(1/60,input);}

test('Meta Knight retains every native gameplay clip and plays all ride poses',()=>{
 const c=create();assert(c.isMetaKnight);assert(c.hasNativeAnimations);assert(!c.isPigeon);
 assert.equal(c.animationRoot.name,'MetaKnight_root');
 assert.equal(c.actions.size,META_KNIGHT_CLIPS.length,'all native states, including the Attack alias, are callable');
 for(const definition of META_KNIGHT_CLIPS){
  const clip=c.actions.get(definition.name)!.getClip();
  assert.equal(clip.duration,definition.duration,`${definition.name} keeps its native duration`);
  const sourceTracks=asset.clips.find(source=>source.name===definition.name)!.tracks.filter(track=>track.name!=='MetaKnight_root.quaternion');
  assert.deepEqual(clip.tracks.map(track=>track.name),sourceTracks.map(track=>track.name),'native joint animation is retained');
 }
 for(const definition of META_KNIGHT_CLIPS.filter(clip=>clip.group==='rides')){
  c.setActivity(definition.name);c.updateActivity(.19);
  const action=c.actions.get(definition.name)!;
  assert.equal(c.state,definition.name);assert(action.isRunning(),`${definition.name} plays`);
  assert.equal(action.loop,definition.loop?LoopRepeat:LoopOnce);
 }
 assert(c.actor.getObjectByName('Left_hand_attachment'),'bread has a hand separate from the sword');
 c.setActivity('Attack');c.updateActivity(.2);assert.equal(c.state,'Attack');assert(c.actions.get('Attack')!.isRunning());
});

test('native movement preserves forward, sprint, reverse, steering and growth speed',()=>{
 const c=create();advance(c,1,{...idle,forward:true});assert.equal(c.state,'Run');assert(Math.abs(c.actor.position.z-3.4)<1e-6);
 let z=c.actor.position.z;advance(c,1,{...idle,forward:true,sprint:true});assert(Math.abs(c.actor.position.z-z-6.8)<1e-6);assert.equal(c.actions.get('Run')!.getEffectiveTimeScale(),2);
 z=c.actor.position.z;advance(c,1,{...idle,backward:true,sprint:true});assert.equal(c.state,'WalkBackward');assert(Math.abs(c.actor.position.z-z+1.65)<1e-6);
 advance(c,.2,{...idle,left:true});advance(c,.2);assert(Math.abs(c.yaw-Math.PI/9)<1e-6);
 const facing=new Vector3(0,0,1).applyQuaternion(c.animationRoot.getWorldQuaternion(new Quaternion()));
 assert(Math.abs(Math.atan2(facing.x,facing.z)-c.yaw)<1e-6,'the native root never doubles the game heading');
 c.resizeTo(1.5,true);c.eatFruit();z=c.actor.position.z;advance(c,1,{...idle,forward:true});assert(Math.abs(c.actor.position.z-z-c.speed*Math.cos(c.yaw))<1e-6);
});

test('jump and air push use wings and the sword while flight and swimming keep game movement',()=>{
 const c=create();c.update(1/60,{...idle,jump:true});assert.equal(c.state,'Jump');advance(c,.25);
 assert(c.flight.active);assert.equal(c.state,'Fly');assert(!c.cloud.visible);
 c.update(1/60,{...idle,jump:true});advance(c,.25);assert(c.actor.position.y>2.7);
 const height=c.actor.position.y,z=c.actor.position.z;
 c.update(1/60,{...idle,attack:true,forward:true,allowAirPush:true});assert(!c.attackHit);assert.equal(c.state,'Push');assert(c.flight.active);
 assert(c.actor.position.y>=height-.05);assert(c.actor.position.z>z);assert(!c.cloud.visible);
 advance(c,.76,{...idle,allowAirPush:true});assert.equal(c.state,'Fly');assert(!c.cloud.visible);
 advance(c,4);assert.equal(c.state,'Idle');assert.equal(c.actor.position.y,0);
 c.swimming=true;advance(c,.3,{...idle,forward:true});assert.equal(c.state,'Swim');assert(c.actions.get('Swim')!.isRunning());
});

test('moving sword push keeps its authored arm and grip instead of Kirby push overlays',()=>{
 const c=create();c.update(.01,{...idle,attack:true,forward:true});assert(!c.attackHit);advance(c,.25,{...idle,forward:true});
 assert.equal(c.state,'Push');assert(c.actions.get('Push')!.isRunning());assert(c.actor.position.z>.8);
 const reference=asset.root.clone(true),mixer=new AnimationMixer(reference);
 const push=asset.clips.find(clip=>clip.name==='Push')!;mixer.clipAction(push).play();mixer.update(c.actions.get('Push')!.time);
 for(const name of ['Left_shoulder','Right_shoulder','Right_grip']){
  const actual=c.actor.getObjectByName(name)!,expected=reference.getObjectByName(name)!;
  assert(actual.position.distanceTo(expected.position)<1e-6,`${name} keeps the native translation`);
  assert(actual.quaternion.clone().normalize().angleTo(expected.quaternion.clone().normalize())<1e-6,`${name} keeps the native sword pose`);
 }
 advance(c,META_KNIGHT_CLIP_BY_NAME.Push.duration);assert.equal(c.state,'Idle');
});

test('sword lunge emits exactly one hit at forward extension on the ground and in the air',()=>{
 for(const airborne of [false,true]){
  const c=create();if(airborne){c.update(.01,{...idle,jump:true});c.update(.01,idle);}
  const input={...idle,attack:true,allowAirPush:airborne};c.update(.01,input);assert.equal(c.state,'Push');assert(!c.attackHit);
  for(let frame=1;frame<23;frame++){c.update(.01,input);if(frame<22)assert(!c.attackHit,'windup must not push a target');}
  assert(c.attackHit,`strike at${PUSH_HIT}s, airborne=${airborne}`);assert(Math.abs(c.actions.get('Push')!.time-PUSH_HIT)<1e-6);
  let extraHits=0;for(let frame=0;frame<60;frame++){c.update(.01,input);extraHits+=Number(c.attackHit);}
  assert.equal(extraHits,0,'holding Q cannot apply a second hit');
 }
});

test('interrupted sword windup cancels the pending strike',()=>{
 const c=create();c.update(.01,{...idle,attack:true});advance(c,.1);assert(!c.attackHit);assert(c.takePush(1,0));
 let hits=0;for(let frame=0;frame<90;frame++){c.update(1/60,idle);hits+=Number(c.attackHit);}assert.equal(hits,0);assert.equal(c.state,'Idle');
});

test('eating emits the shared fruit timing and native rolling recovers without changing the root heading',()=>{
 const c=create();let pulls=0,bites=0;
 for(let frame=0;frame<Math.ceil((META_KNIGHT_CLIP_BY_NAME.Eat.duration+.2)*60);frame++){c.update(1/60,{...idle,eat:frame===0});pulls+=Number(c.eatPull);bites+=Number(c.eatBite);}
 assert.equal(pulls,1);assert.equal(bites,1);assert.equal(c.state,'Idle');
 assert(c.takePush(1,0));assert(!c.takePush(1,0));advance(c,.3);assert.equal(c.state,'Roll');
 assert(c.animationRoot.quaternion.angleTo(new Quaternion())<1e-6,'native roll is carried by its internal motion pivot');
 advance(c,1);assert.equal(c.state,'Idle');assert(!c.roll.active);assert(c.actor.position.x>3);
});

test('native mounted poses keep playing while growth and fruit speed advance',()=>{
 const c=create();c.setActivity('FireflyRide');c.resizeTo(1.1);c.eatFruit();
 for(let frame=0;frame<30;frame++)c.updateActivity(1/60);
 assert.equal(c.actor.scale.x,1.1);assert.equal(c.savedSize,1.1);assert.equal(c.fruitBoost.multiplier,1.2);
 assert.equal(c.state,'FireflyRide');assert(c.actions.get('FireflyRide')!.isRunning());assert(!c.actions.get('Idle')!.isRunning());
 c.setActivity('Sleep');c.updateActivity(.4);
 assert(c.actor.getObjectByName('MetaKnight_motion')!.rotation.x<-.5,'sleep reclines inside the rig');
 assert(c.animationRoot.quaternion.angleTo(new Quaternion())<1e-6,'sleep keeps game heading on the actor');
});

test('held keyboard turns keep native footwork cycling after the first one-shot turn duration',()=>{
 for(const direction of [-1,1]){
  const c=create(),input={...idle,left:direction===1,right:direction===-1};advance(c,1.1,input);
  const action=c.actions.get(direction===1?'RotateLeft':'RotateRight')!,before=action.time;
  const foot=c.actor.getObjectByName('Left_foot_pivot')!,rotation=foot.quaternion.clone();
  advance(c,.05,input);assert(action.isRunning());assert.equal(action.loop,LoopRepeat);
  assert.notEqual(action.time,before,'the repeated step still advances the mixer');
  assert(foot.quaternion.clone().normalize().angleTo(rotation.normalize())>.01,'native feet continue turning instead of freezing');
  assert(Math.abs(c.yaw-direction*115*Math.PI/180)<1e-6);advance(c,.3);assert.equal(c.state,'Idle');
 }
});
