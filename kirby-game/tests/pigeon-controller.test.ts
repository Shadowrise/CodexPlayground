import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,Quaternion,Vector3} from 'three';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController,type Input} from '../src/controller';
import {createPigeon} from '../src/pigeon-model';
import {PIGEON_CLIPS,PIGEON_CLIP_BY_NAME} from '../src/pigeon-clips';
import {EMOTES} from '../src/emotes';
import {actorState,applyActor} from '../src/network-actors';
import {PIGEON_GAITS,pigeonGaitRate} from '../src/pigeon-locomotion';
import {worldLimit} from '../src/world-bounds';

const idle:Input={forward:false,left:false,right:false};
function create(){const model=createPigeon(),wrapper=new Group();wrapper.add(model.root);return new CharacterController(wrapper,model.clips);}
function advance(c:CharacterController,seconds:number,input=idle){for(let i=0;i<Math.round(seconds*60);i++)c.update(1/60,input);}

test('pigeon retains native animations and selects every playable ride pose',()=>{
 const c=create();assert(c.isPigeon);assert.equal(c.animationRoot.name,'GoofyPigeon');
 assert.equal(c.actions.size,PIGEON_CLIPS.length-1,'Attack aliases native Push');
 for(const clip of PIGEON_CLIPS.filter(clip=>clip.group==='rides')){
  c.setActivity(clip.name);c.mixer.update(.19);
  assert.equal(c.state,clip.name);assert(c.actions.get(clip.name)!.isRunning(),`${clip.name} must play its native pose`);
 }
 assert.equal(c.actions.get('Jump')!.getClip().duration,PIGEON_CLIP_BY_NAME.Jump.duration,'jump is not replaced by Kirby flight');
 assert.equal(c.actions.get('Swim')!.getClip().duration,PIGEON_CLIP_BY_NAME.Swim.duration,'swim is not replaced by Kirby paddle');
});

test('fruit growth on a firefly continues without replacing the seated native pose',()=>{
 const c=create();c.setActivity('FireflyRide');c.grow();
 for(let i=0;i<30;i++)c.updateActivity(1/60);
 assert.equal(c.actor.scale.x,1.1);assert.equal(c.savedSize,1.1);
 assert.equal(c.state,'FireflyRide');assert(c.actions.get('FireflyRide')!.isRunning());
 assert(!c.actions.get('Idle')!.isRunning());
});

test('number-key emotions complete and interrupted emotions restore the native standing pose',()=>{
 for(const {id} of EMOTES){
  const c=create();assert(c.startEmote(id));assert.equal(c.state,id);assert(!c.startEmote(id),'an active emotion cannot restart every frame');
  advance(c,PIGEON_CLIP_BY_NAME[id].duration+.25);assert.equal(c.state,'Idle');
  assert(c.actions.get('Idle')!.isRunning());
  for(const side of ['Left','Right'])assert.equal(c.actor.getObjectByName(`${side}_eyelid`)!.scale.y,0,`${id}: eyelids must recover`);
  assert(c.startEmote(id));advance(c,.45);advance(c,.25,{...idle,forward:true});assert.equal(c.state,'Run');
  assert(c.actor.getObjectByName('Neck')!.scale.distanceTo(new Vector3(1,1,1))<1e-6,`${id}: coo throat must recover after interruption`);
 }
});

test('native flight, moving chest push, air push and swimming preserve game movement',()=>{
 const c=create();c.update(1/60,{...idle,jump:true});assert.equal(c.state,'Jump');advance(c,.22);
 assert(c.flight.active);assert.equal(c.state,'Fly');assert(c.actions.get('Fly')!.isRunning());
 c.update(1/60,idle);c.update(1/60,{...idle,jump:true});advance(c,.26);const height=c.actor.position.y;
 assert(height>2.7);c.update(1/60,{...idle,attack:true,forward:true,allowAirPush:true});
 assert(c.attackHit);assert(c.flight.active);assert.equal(c.state,'Push');assert(c.actions.get('Push')!.isRunning());
 assert(c.actor.position.y>=height-.05);advance(c,.76,{...idle,allowAirPush:true});assert.equal(c.state,'Fly');
 advance(c,4);assert.equal(c.state,'Idle');assert.equal(c.actor.position.y,0);
 c.update(1/60,{...idle,attack:true,forward:true});assert(c.attackHit);assert.equal(c.state,'Push');
 assert(c.actions.get('Push')!.isRunning());const position=c.actor.position.clone();advance(c,.2,{...idle,forward:true});assert(c.actor.position.distanceTo(position)>.6);
 advance(c,.6);assert.equal(c.state,'Idle');c.swimming=true;advance(c,.3,{...idle,forward:true});assert.equal(c.state,'Swim');assert(c.actions.get('Swim')!.isRunning());
});

test('pigeon turns never add exported root yaw to the controller heading',()=>{
 for(const direction of [-1,1]){
  const c=create();for(let frame=0;frame<35;frame++){
   c.update(1/60,{...idle,left:frame===0&&direction===1,right:frame===0&&direction===-1});
   const forward=new Vector3(0,0,1).applyQuaternion(c.animationRoot.getWorldQuaternion(new Quaternion()));
   assert(Math.abs(Math.atan2(forward.x,forward.z)-c.yaw)<1e-6,'root heading must be applied only once');
  }
  assert.equal(c.state,'Idle');assert(Math.abs(c.yaw-direction*Math.PI/18)<1e-6);
 }
});

test('five network pose nodes serialize and replay pigeon rides without Kirby joint names',()=>{
 const source=create(),remote=create();
 for(const state of ['Fly','Sitting','Sleep','Joy','Push']){
  source.setActivity(state);source.mixer.update(.25);
  const snapshot=actorState(source,'Голубь',0);assert.equal(snapshot.pose.length,5);
  assert(snapshot.pose.every(row=>row.length===10&&row.every(Number.isFinite)));
  applyActor(remote,snapshot,1/60,true);assert.equal(remote.state,state);
  assert.equal(actorState(remote,'Голубь',0).pose.length,5);
 }
});

test('Pidgie flight and remote jump/flight never show smoke while Kirby keeps his cloud',async()=>{
 const bird=create();bird.update(1/60,{...idle,jump:true});
 for(let frame=0;frame<150;frame++){bird.update(1/60,idle);assert(!bird.cloud.visible);}
 const remote=create();
 for(const state of ['Jump','Fly']){
  bird.setActivity(state);bird.actor.position.y=4;
  applyActor(remote,actorState(bird,'Пиджи',17),1/60,true);
  assert(remote.flight.active);assert(!remote.cloud.visible);
 }
 const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const kirby=new CharacterController(gltf.scene,gltf.animations);
 kirby.update(1/60,{...idle,jump:true});advance(kirby,.35);assert(kirby.cloud.visible,'existing Kirby flight cloud is preserved');
 applyActor(kirby,{...actorState(kirby,'Кирби',0),state:'Fly',p:[0,4,0]},1/60,true);assert(kirby.cloud.visible);
});

test('native cadence follows real movement for forward, backward, sprint, size and star boost without changing speed',()=>{
 for(const size of [.3,1,3])for(const backward of [false,true])for(const boosted of [false,true])for(const sprint of [false,true]){
  const bird=create();bird.actor.scale.setScalar(size);bird.starRemaining=boosted?30:0;
  const input={...idle,forward:!backward,backward,sprint},expected=(backward?1.65:3.4)*Math.max(1,size)*(boosted?2:1)*(!backward&&sprint?2:1);
  bird.update(.01,input);
  assert(Math.abs(Math.abs(bird.actor.position.z)-expected*.01)<1e-8,'gameplay speed must not change');
  const state=backward?'WalkBackward':'Run',rate=pigeonGaitRate(state,expected*.01,.01,size);
  assert(Math.abs(bird.actions.get(state)!.getEffectiveTimeScale()-rate)<1e-8,'cadence matches travelled distance and visual size');
 }
});

test('stance toe stays planted in world space at actual player speed in both directions',()=>{
 for(const state of ['Run','WalkBackward'] as const){
  const bird=create(),backward=state==='WalkBackward',input={...idle,forward:!backward,backward};advance(bird,.3,input);
  const action=bird.actions.get(state)!,duration=action.getClip().duration,strideDuration=duration/PIGEON_GAITS[state].cyclesPerClip;
  action.time=strideDuration*.06;bird.mixer.update(0);
  const foot=bird.actor.getObjectByName('Left_foot_sculpt_paint') as Mesh,vertices=foot.geometry.getAttribute('position');
  let toeIndex=0;for(let i=1;i<vertices.count;i++)if(vertices.getZ(i)>vertices.getZ(toeIndex))toeIndex=i;
  const toe=()=>{bird.actor.updateMatrixWorld(true);return foot.getVertexPosition(toeIndex,new Vector3()).applyMatrix4(foot.matrixWorld);};
  const planted=toe();let samples=0,maxSlip=0;
  for(let frame=0;frame<25;frame++){
   const phase=(action.time/strideDuration)%1,next=phase+(1/240)*action.getEffectiveTimeScale()/strideDuration;
   if(next>PIGEON_GAITS[state].stance-.03)break;
   bird.update(1/240,input);maxSlip=Math.max(maxSlip,planted.distanceTo(toe()));samples++;
  }
  assert(samples>=10,'sample the middle of an actual planted stance');
  assert(maxSlip<.012,`${state}: toe slides ${maxSlip}m while actor travels`);
 }
});

test('meadow and world obstacles stop native stepping and deck movement uses the same distance clock',()=>{
 const bird=create();advance(bird,.3,{...idle,forward:true});
 bird.actor.position.z=worldLimit(bird.actor.scale.x);bird.update(1/60,{...idle,forward:true});
 assert.equal(bird.actions.get('Run')!.getEffectiveTimeScale(),0,'no stepping through meadow boundary');
 bird.actor.position.set(0,0,0);const action=bird.actions.get('Run')!,before=action.time;
 bird.update(1/60,{...idle,forward:true});bird.actor.position.z=0;
 bird.finishPigeonGroundMovement(1/60,0,0);
 assert.equal(action.getEffectiveTimeScale(),0);assert(Math.abs(action.time-before)<1e-8,'resolved wall movement rewinds this frame’s gait');
 bird.setActivity('Walk');bird.mixer.update(1/60);bird.actor.position.z=.04;
 bird.finishPigeonGroundMovement(1/60,0,0);
 assert(Math.abs(bird.actions.get('Walk')!.getEffectiveTimeScale()-pigeonGaitRate('Walk',.04,1/60,1))<1e-8);
});

test('remote gait uses presentation displacement rather than stale five-node foot poses',()=>{
 const source=create(),remote=create();source.setActivity('Run');source.actor.position.z=.034;
 const snapshot=actorState(source,'Пиджи',17);snapshot.pose.forEach(p=>p[1]=50);
 applyActor(remote,snapshot,.01,true);
 assert(Math.abs(remote.actions.get('Run')!.getEffectiveTimeScale()-pigeonGaitRate('Run',.034,.01,1))<1e-8);
 assert(remote.actor.getObjectByName('Left_foot')!.position.y<1,'old grounded foot pose cannot undo calibrated native animation');
 const before=remote.actions.get('Run')!.time;applyActor(remote,snapshot,.01,true);
 assert.equal(remote.actions.get('Run')!.getEffectiveTimeScale(),0);assert.equal(remote.actions.get('Run')!.time,before);
});
