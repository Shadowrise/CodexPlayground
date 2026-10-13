import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createPigeon} from '../src/pigeon-model';
import {PidgieNpc,PIDGIE_APPROACH_DISTANCE,PIDGIE_REFUGE_RADIUS,PIDGIE_FLIGHT_DISTANCE,type PidgieNpcOptions} from '../src/pidgie-npc';
import {validPidgieState,type PidgieState} from '../src/pidgie-state';

const template=(()=>{const {root,clips}=createPigeon(),scene=new T.Group();scene.add(root);return {scene,animations:clips};})();
const create=(options:Partial<PidgieNpcOptions>={})=>new PidgieNpc(template,{seed:131,safeGround:()=>true,...options});
const advance=(bird:PidgieNpc,seconds:number,people:readonly T.Vector3[]=[])=>{for(let i=0;i<Math.ceil(seconds*60);i++)bird.update(Math.min(1/60,seconds-i/60),people);};
function approach(bird:PidgieNpc){const p=bird.actor.position.clone();p.x+=PIDGIE_APPROACH_DISTANCE-1;bird.update(.01,[p]);assert.equal(bird.phase,'fear');return p;}
function nearXZ(a:readonly number[],b:readonly number[]){return Math.hypot(a[0]-b[0],a[1]-b[1]);}

test('a seeded independent pigeon spawns on safe ground away from players without joining gameplay rewards',()=>{
 const people=[new T.Vector3()],a=create({people}),b=create({people});
 assert.deepEqual(a.actor.position.toArray(),b.actor.position.toArray());assert(a.actor.visible);assert.equal(a.phase,'wander');
 assert(a.actor.position.distanceTo(people[0])>=12);assert(validPidgieState(a.networkState()));
 assert(!a.actor.getObjectByName('Flight cloud'));assert(!('fruitsEaten' in a));assert(!('achievements' in a));assert(!('takePush' in a));assert(!('canEat' in a));
 const source=template.scene.getObjectByName('Continuous pigeon body') as T.SkinnedMesh,clone=a.model.getObjectByName('Continuous pigeon body') as T.SkinnedMesh;
 assert(clone instanceof T.SkinnedMesh);assert.notEqual(clone.skeleton.bones[0],source.skeleton.bones[0]);assert.notEqual(clone.material,source.material);assert.equal(clone.geometry,source.geometry);
 const original=source.skeleton.bones[0].quaternion.clone();approach(a);advance(a,.4);assert(source.skeleton.bones[0].quaternion.equals(original),'NPC animation cannot deform the player template');
});

test('wandering remains inside its local refuge, obeys constraints and uses both idle and planted-foot walking',()=>{
 const bird=create(),home=bird.networkState().refuge;let walking=0,idle=0;
 for(let frame=0;frame<60*65;frame++){
  bird.update(1/60,[]);const state=bird.networkState();
  assert(nearXZ([state.p[0],state.p[2]],home)<=PIDGIE_REFUGE_RADIUS+1e-6);assert.equal(state.p[1],0);
  if(bird.state==='Walk')walking++;else if(bird.state==='Idle')idle++;
 }
 assert(walking>300&&idle>300);
 const stopped=create(),origin=stopped.actor.position.clone();
 stopped.update(12,[],(point,_size,previous)=>point.copy(previous));assert(stopped.actor.position.distanceTo(origin)<1e-8,'a scenery collision cannot move the bird');
 if(stopped.state==='Walk')assert.equal(stopped.actions.get('Walk')!.getEffectiveTimeScale(),0,'blocked feet stop instead of sliding');
});

test('any nearby ground player triggers one facing reaction, vertical takeoff, a distant flight and vertical safe landing',()=>{
 const bird=create({flightHeight:()=>92}),start=bird.actor.position.clone(),person=approach(bird),plan=bird.networkState();
 assert.equal(bird.fearCount,1);assert.equal(bird.state,'Idle','the bird turns before showing fear');
 assert(nearXZ(plan.destination,[start.x,start.z])>=PIDGIE_FLIGHT_DISTANCE);assert(Math.hypot(plan.destination[0]-person.x,plan.destination[1]-person.z)>=18);assert.equal(plan.height,92);
 advance(bird,.3,[person]);assert.equal(bird.state,'Fear');assert(Math.abs(bird.actor.rotation.y-Math.PI/2)<1e-6);
 advance(bird,.59,[person]);assert.equal(bird.phase,'takeoff');
 for(let frame=0;frame<350&&bird.phase==='takeoff';frame++){
  bird.update(1/60,[bird.actor.position.clone()]);assert.equal(bird.fearCount,1,'an airborne approach cannot restart the reaction');
  assert(Math.hypot(bird.actor.position.x-start.x,bird.actor.position.z-start.z)<1e-6,'takeoff is vertical over its safe footprint');
 }
 assert.equal(bird.phase,'fly');assert(Math.abs(bird.actor.position.y-92)<1e-6);assert.equal(bird.state,'Fly');
 let flightHeading:number|undefined;
 for(let frame=0;frame<2400&&bird.phase!=='wander';frame++){
  bird.update(1/60,[]);assert.equal(bird.fearCount,1);assert(validPidgieState(bird.networkState()));
  if(bird.phase==='fly')flightHeading=bird.actor.rotation.y;
  if(bird.phase==='landing'){
   assert(Math.hypot(bird.actor.position.x-plan.destination[0],bird.actor.position.z-plan.destination[1])<1e-6);
   assert(Math.abs(Math.atan2(Math.sin(bird.actor.rotation.y-flightHeading!),Math.cos(bird.actor.rotation.y-flightHeading!)))<1e-6,'arrival must not snap its heading to zero');
  }
 }
 assert.equal(bird.phase,'wander');assert.equal(bird.actor.position.y,0);assert.deepEqual(bird.networkState().refuge,plan.destination);
 advance(bird,.4);approach(bird);assert.equal(bird.fearCount,2,'the next ground approach starts another flight');
});

test('high-flying players do not scare a grounded bird and all players are considered in three dimensions',()=>{
 const bird=create(),overhead=bird.actor.position.clone();overhead.y=25;
 bird.update(.2,[overhead]);assert.equal(bird.phase,'wander');assert.equal(bird.fearCount,0);
 const far=new T.Vector3(300,0,300),close=bird.actor.position.clone();close.z-=3;
 bird.update(.01,[far,overhead,close]);assert.equal(bird.phase,'fear');assert.equal(bird.fearCount,1);
 advance(bird,.3,[close]);assert(Math.abs(Math.abs(bird.actor.rotation.y)-Math.PI)<1e-6,'the bird faces the actual nearby ground player');
});

test('unsafe spawning stays hidden, and occupied landing ground redirects without another fear event',()=>{
 let allowed=false;const hidden=create({safeGround:()=>allowed});assert.equal(hidden.phase,'hidden');assert(!hidden.actor.visible);
 hidden.update(2.9,[]);assert(!hidden.actor.visible);allowed=true;hidden.update(.2,[]);assert.equal(hidden.phase,'wander');assert(hidden.actor.visible);
 const bird=create();approach(bird);advance(bird,3.3);assert.equal(bird.phase,'fly');
 const destination=bird.networkState().destination,occupant=new T.Vector3(destination[0],0,destination[1]);
 const duration=bird.networkState().flightDuration;advance(bird,duration+.1,[occupant]);
 assert(['fly','takeoff'].includes(bird.phase));assert.equal(bird.fearCount,1);
 assert(nearXZ(bird.networkState().destination,destination)>=PIDGIE_FLIGHT_DISTANCE,'blocked landing selects another part of the meadow');
 assert(bird.actor.position.y>0,'a waiting player cannot force a landing into them');
});

test('large finite updates consume phase boundaries and invalid delta values cannot corrupt the checkpoint',()=>{
 const large=create(),small=create();approach(large);approach(small);large.update(8,[]);advance(small,8);
 const a=large.networkState(),b=small.networkState();assert.equal(a.phase,b.phase);assert.equal(a.seed,b.seed);
 assert(new T.Vector3().fromArray(a.p).distanceTo(new T.Vector3().fromArray(b.p))<.03);assert.equal(a.fearCount,1);
 const before=large.networkState();for(const dt of [NaN,Infinity,-1,0])large.update(dt,[]);assert.deepEqual(large.networkState(),before);
});

test('a landing cannot enter newly unsafe ground when no alternative refuge is available',()=>{
 let ground=true;const bird=create({safeGround:()=>ground});approach(bird);
 for(let frame=0;frame<1800&&bird.phase!=='landing';frame++)bird.update(1/60,[]);
 assert.equal(bird.phase,'landing');bird.update(.4,[]);const height=bird.actor.position.y;assert(height>0);
 ground=false;bird.update(6,[]);assert.equal(bird.phase,'landing');assert(Math.abs(bird.actor.position.y-height)<1e-6,'no safe landing means hovering');assert.equal(bird.fearCount,1);
 ground=true;bird.update(4,[]);assert.equal(bird.phase,'wander');assert.equal(bird.actor.position.y,0);
});

test('a full mid-flight checkpoint hands off deterministically and remote smoothing never starts its own fear',()=>{
 const host=create(),successor=create({seed:900}),remote=create({seed:400});approach(host);advance(host,5);
 const checkpoint=host.networkState();assert.equal(checkpoint.phase,'fly');assert(successor.applyNetworkState(checkpoint,true));assert(remote.applyNetworkState(checkpoint,true));
 for(let frame=0;frame<80;frame++){host.update(1/60,[]);successor.update(1/60,[]);}
 const a=host.networkState(),b=successor.networkState();assert.deepEqual(a,b,'seed, path, timers and native clip time resume on the new host');
 const original=remote.actor.position.clone();remote.updateRemote(.1);const predicted=remote.networkState();
 assert(predicted.elapsed>checkpoint.elapsed);assert(remote.actor.position.distanceTo(original)>0);assert.equal(remote.fearCount,1);assert(validPidgieState(predicted));
 const promoted=create();promoted.applyNetworkState(predicted,true);assert(promoted.actor.position.distanceTo(new T.Vector3().fromArray(predicted.p))<1e-8);
 const continued=create();continued.applyNetworkState(predicted,true);continued.update(.05,[]);remote.update(.05,[]);
 assert.deepEqual(remote.networkState(),continued.networkState(),'the first authoritative update promotes the predicted checkpoint itself');
 const before=remote.networkState();assert(!remote.applyNetworkState({...checkpoint,p:[NaN,0,0]}));assert.deepEqual(remote.networkState(),before);
 const view=create(),facing:PidgieState={...predicted,phase:'fear',clip:'Idle',elapsed:0,yaw:0,turnStart:0,turnTarget:0};
 view.applyNetworkState(facing,true);
 view.applyNetworkState({...facing,elapsed:.04,yaw:1,turnStart:1,turnTarget:2});const previousYaw=view.actor.rotation.y;view.updateRemote(.01);
 assert(Math.abs(Math.atan2(Math.sin(view.actor.rotation.y-previousYaw),Math.cos(view.actor.rotation.y-previousYaw)))<.2,'network yaw interpolates from the displayed angle');
});
