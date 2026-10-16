import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PidgieNpc,PIDGIE_APPROACH_DISTANCE,PIDGIE_REFUGE_RADIUS,PIDGIE_FLIGHT_DISTANCE,type PidgieNpcOptions,type PidgiePlayer} from '../src/pidgie-npc';
import {PIDGIE_FOLLOW_DISTANCE,PIDGIE_FOLLOW_REACTION_SECONDS,PIDGIE_PECK_REACH,validPidgieState,type PidgieState} from '../src/pidgie-state';
import {worldLimit} from '../src/world-bounds';
import {applyBread,canPickBread,newBread} from '../src/bread-state';

// Exercise the same rig and beak trajectory as the game without rebuilding
// the authored sculpt and its paint atlas for every regression run.
const template=await (async()=>{
 const bytes=await readFile(new URL('../public/models/pigeon-animated.glb',import.meta.url)),loader=new GLTFLoader();
 loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new T.Texture())}));
 return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
})();
const create=(options:Partial<PidgieNpcOptions>={})=>new PidgieNpc(template,{seed:131,safeGround:()=>true,...options});
const bodyMesh=(root:T.Object3D)=>root.getObjectByProperty('type','SkinnedMesh') as T.SkinnedMesh;
const advance=(bird:PidgieNpc,seconds:number,people:readonly T.Vector3[]=[],players:readonly PidgiePlayer[]=[])=>{for(let i=0;i<Math.ceil(seconds*60);i++)bird.update(Math.min(1/60,seconds-i/60),people,undefined,players);};

test('dropping the carried bread ends interest with exactly one scare and flight',()=>{
 const scares:T.Vector3[]=[],bird=create({onScare:p=>scares.push(p)}),player:PidgiePlayer={id:'baker',hasBread:true,position:bird.actor.position.clone().add(new T.Vector3(0,0,4))};
 advance(bird,.2,[player.position],[player]);assert.equal(bird.phase,'follow');
 player.hasBread=false;bird.update(.05,[player.position],undefined,[player]);assert.equal(bird.phase,'fear');assert.equal(scares.length,1);assert.equal(scares[0],player.position);
 advance(bird,2,[player.position],[player]);assert(['takeoff','fly'].includes(bird.phase));assert.equal(scares.length,1);
});

test('offered bread becomes permanent: joy, a run to its midpoint, then repeated pecking and joy despite nearby players',()=>{
 const bird=create(),at=bird.actor.position.clone(),player={id:'baker',p:[at.x,0,at.z+4],yaw:Math.PI,size:1,available:true};
 const bread=applyBread({...newBread(),active:true,owner:player.id},{kind:'feed'},player,1000,undefined,bird.networkState());
 assert(bread.offering);assert.equal(bread.p[2],at.z+2);assert(!canPickBread(bread,{...player,p:bread.p},100000));
 assert(bird.acceptBread(bread.offering));assert(!bird.acceptBread(bread.offering));
 advance(bird,2.2,[at]);assert.equal(bird.phase,'joy');assert.equal(bird.state,'Joy');
 advance(bird,.3,[at]);assert.equal(bird.phase,'toBread');assert.equal(bird.state,'Run');
 advance(bird,2,[at]);assert.equal(bird.phase,'feast');
 const stop=bird.actor.position.clone(),seen=new Set<string>();
 for(let i=0;i<60*70;i++){bird.update(1/60,[stop]);seen.add(bird.state);assert.equal(bird.phase,'feast');assert.equal(bird.fearCount,0);}
 assert(seen.has('Joy')&&seen.has('Peck'));assert(bird.actor.position.distanceTo(stop)<1e-8);assert(validPidgieState(bird.networkState()));
 const next=create(),remote=create();next.applyNetworkState(bird.networkState(),true);remote.applyNetworkState(bird.networkState(),true);
 for(let i=0;i<90;i++){next.update(1/60,[stop]);remote.updateRemote(1/60);}
 assert.deepEqual(remote.networkState(),next.networkState(),'late joins and host changes keep the feeding cycle');
});

function approach(bird:PidgieNpc){const p=bird.actor.position.clone();p.x+=PIDGIE_APPROACH_DISTANCE-1;bird.update(.01,[p]);assert.equal(bird.phase,'fear');return p;}
function nearXZ(a:readonly number[],b:readonly number[]){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
function startPeck(bird:PidgieNpc){
 for(let frame=0;frame<60*90&&bird.state!=='Peck';frame++)bird.update(1/60,[]);
 assert.equal(bird.state,'Peck','wandering periodically chooses a ground-pecking bout');
}

test('a seeded independent pigeon spawns on safe ground away from players without joining gameplay rewards',()=>{
 const people=[new T.Vector3()],a=create({people}),b=create({people});
 assert.deepEqual(a.actor.position.toArray(),b.actor.position.toArray());assert(a.actor.visible);assert.equal(a.phase,'wander');
 assert(a.actor.position.distanceTo(people[0])>=12);assert(validPidgieState(a.networkState()));
 assert(!a.actor.getObjectByName('Flight cloud'));assert(!('fruitsEaten' in a));assert(!('achievements' in a));assert(!('takePush' in a));assert(!('canEat' in a));
 const source=bodyMesh(template.scene),clone=bodyMesh(a.model);
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

test('wild pigeon periodically stops for a complete three-peck bout before walking again',()=>{
 const bird=create();let bouts=0,frames=0,origin=new T.Vector3(),previous=bird.state;
 for(let frame=0;frame<60*90;frame++){
  bird.update(1/60,[]);
  if(bird.state==='Peck'){
   if(previous!=='Peck'){bouts++;frames=0;origin.copy(bird.actor.position);assert.equal(bird.actions.get('Peck')!.loop,T.LoopOnce);}
   frames++;assert(bird.actor.position.distanceTo(origin)<1e-8,'pecking cannot slide along the ground');
   assert.equal(bird.phase,'wander');assert.equal(bird.actor.position.y,0);assert(validPidgieState(bird.networkState()));
  }else if(previous==='Peck'){
   assert(frames>=180&&frames<=194,'the bird finishes the full 3.2-second bout');
   assert.equal(bird.state,'Walk','the completed bout returns to wandering');
  }
  previous=bird.state;
 }
 assert(bouts>=2,'ground pecking recurs among walking and idle pauses');
});

test('a pecking checkpoint survives late join and host handoff, and proximity interrupts the bout',()=>{
 const host=create();startPeck(host);advance(host,.85);
 const checkpoint=host.networkState();assert.equal(checkpoint.clip,'Peck');assert(checkpoint.pause>0&&checkpoint.clipTime>.8);
 const body=bodyMesh(host.model);
 const source=bodyMesh(template.scene);
 assert.notEqual(body.morphTargetInfluences,source.morphTargetInfluences,'each pigeon owns its belly animation weights');
 assert(body.morphTargetInfluences![0]>.99,'the wild pigeon tucks its belly during the pecking bout');
 assert.equal(source.morphTargetInfluences![0],0,'the wild bird cannot shrink the shared player template');
 const successor=create({seed:900}),remote=create({seed:400});
 assert(successor.applyNetworkState(checkpoint,true));assert(remote.applyNetworkState(checkpoint,true));
 const position=remote.actor.position.clone();remote.updateRemote(.2);
 assert.equal(remote.state,'Peck');assert(remote.actor.position.distanceTo(position)<1e-8);
 assert(remote.networkState().clipTime>checkpoint.clipTime,'late join continues the current peck instead of restarting it');
 for(let frame=0;frame<60*8;frame++){host.update(1/60,[]);successor.update(1/60,[]);}
 assert.deepEqual(successor.networkState(),host.networkState(),'the new host finishes the same bout and resumes the same seeded walk');
 startPeck(host);advance(host,.4);approach(host);
 assert.equal(host.state,'Idle','the facing/scare reaction immediately cancels ground pecking');
 advance(host,.3);assert.equal(host.state,'Fear');assert.equal(host.fearCount,1);
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

test('scare notification identifies the nearest player once and is not replayed by guests or a new host',()=>{
 const notices:T.Vector3[]=[],bird=create({onScare:person=>notices.push(person)}),origin=bird.actor.position.clone();
 const farther=origin.clone().add(new T.Vector3(8,0,0)),nearest=origin.clone().add(new T.Vector3(0,0,2)),airborne=origin.clone().add(new T.Vector3(0,20,0));
 bird.update(.05,[farther,airborne,nearest]);assert.equal(notices.length,1);assert.equal(notices[0],nearest);
 advance(bird,.4,[farther,nearest]);assert.equal(notices.length,1,'lingering near the frightened pigeon cannot repeat the hint');
 const checkpoint=bird.networkState(),replayed:T.Vector3[]=[],guest=create({onScare:person=>replayed.push(person)});
 guest.applyNetworkState(checkpoint,true);guest.updateRemote(.1);guest.update(.1,[nearest]);
 assert.equal(replayed.length,0,'joining and taking over an existing flight cannot announce an old scare');
 let safe=true;const blocked=create({safeGround:()=>safe,onScare:person=>replayed.push(person)});safe=false;
 const person=blocked.actor.position.clone();person.x+=2;blocked.update(.05,[person]);
 assert.equal(blocked.phase,'wander');assert.equal(replayed.length,0,'a failed flight plan is not a scare');
});

test('high-flying players do not scare a grounded bird and all players are considered in three dimensions',()=>{
 const bird=create(),overhead=bird.actor.position.clone();overhead.y=25;
 bird.update(.2,[overhead]);assert.equal(bird.phase,'wander');assert.equal(bird.fearCount,0);
 const far=new T.Vector3(300,0,300),close=bird.actor.position.clone();close.z-=3;
 bird.update(.01,[far,overhead,close]);assert.equal(bird.phase,'fear');assert.equal(bird.fearCount,1);
 advance(bird,.3,[close]);assert(Math.abs(Math.abs(bird.actor.rotation.y)-Math.PI)<1e-6,'the bird faces the actual nearby ground player');
});

test('bread in hand alone triggers interest; even a thousand points without bread still scares Pidgie',()=>{
 for(const hasBread of [false,true]){
  const interested:T.Vector3[]=[],scared:T.Vector3[]=[],bird=create({onInterest:p=>interested.push(p),onScare:p=>scared.push(p)});
  const player:PidgiePlayer={id:'player',position:bird.actor.position.clone().add(new T.Vector3(0,0,9)),points:hasBread?0:1000,hasBread};
  bird.update(.05,[player.position],undefined,[player]);
  assert.equal(bird.phase,hasBread?'follow':'fear');assert.equal(interested.length,hasBread?1:0);assert.equal(scared.length,hasBread?0:1);
  if(hasBread){
   advance(bird,5,[player.position],[player]);assert.equal(interested.length,1);assert.equal(bird.fearCount,0);
   assert(Math.abs(bird.actor.position.distanceTo(player.position)-PIDGIE_FOLLOW_DISTANCE)<.5);
  }
 }
});

test('interested Pidgie runs after the chosen player beyond its old refuge, retreats when approached, and rests close enough to offer bread',()=>{
 let notices=0;const bird=create({onInterest:()=>notices++}),start=bird.actor.position.clone();
 const player:PidgiePlayer={id:'leader',hasBread:true,position:start.clone().add(new T.Vector3(0,0,9))};
 const other:PidgiePlayer={id:'other',hasBread:false,position:start.clone().add(new T.Vector3(30,0,0))};
 const players=[player,other],people=players.map(p=>p.position);
 advance(bird,2,people,players);player.position.z+=55;
 advance(bird,1,people,players);assert.equal(bird.state,'Run');assert(bird.actions.get('Run')!.getEffectiveTimeScale()>0);assert.equal(bird.actor.position.y,0);
 advance(bird,7,people,players);assert(bird.actor.position.distanceTo(start)>PIDGIE_REFUGE_RADIUS+20);
 assert(Math.abs(bird.actor.position.distanceTo(player.position)-PIDGIE_FOLLOW_DISTANCE)<.5);assert.equal(bird.state,'Idle');
 const still=bird.actor.position.clone();advance(bird,2,people,players);assert(bird.actor.position.distanceTo(still)<1e-8,'the distance band prevents running back and forth while the player stands still');
 player.position.copy(bird.actor.position).add(new T.Vector3(0,0,2));advance(bird,.5,people,players);
 assert.equal(bird.phase,'follow');assert(bird.actor.position.z<player.position.z,'the bird turns and moves away from an approaching player');
 advance(bird,3.5,people,players);assert(Math.abs(bird.actor.position.distanceTo(player.position)-PIDGIE_FOLLOW_DISTANCE)<.5);
 assert.equal(notices,1);assert.equal(bird.fearCount,0);assert.equal(bird.networkState().followId,'leader');
 bird.update(.05,[other.position],undefined,[other]);assert.equal(bird.phase,'wander');assert.equal(bird.networkState().followId,undefined,'leaving the room releases the followed player');
});

test('a player without bread is not mistaken for a farther bread carrier, and airborne players cannot start interest',()=>{
 const bird=create(),poor:PidgiePlayer={id:'poor',hasBread:false,position:bird.actor.position.clone().add(new T.Vector3(0,0,2))};
 const rich:PidgiePlayer={id:'rich',hasBread:true,position:bird.actor.position.clone().add(new T.Vector3(0,0,8))};
 bird.update(.05,[poor.position,rich.position],undefined,[poor,rich]);assert.equal(bird.phase,'fear');
 const grounded=create(),airborne:PidgiePlayer={id:'air',hasBread:true,position:grounded.actor.position.clone().add(new T.Vector3(0,25,0))};
 grounded.update(.1,[airborne.position],undefined,[airborne]);assert.equal(grounded.phase,'wander');
});

test('following stops planted feet at a blocked route and never flies',()=>{
 let notices=0;const bird=create({onInterest:()=>notices++}),player:PidgiePlayer={id:'player',hasBread:true,position:bird.actor.position.clone().add(new T.Vector3(0,0,9))};
 advance(bird,1,[player.position],[player]);player.position.z+=40;const blocked=bird.actor.position.clone();
 for(let i=0;i<120;i++)bird.update(1/60,[player.position],(point,_size,previous)=>point.copy(previous),[player]);
 assert(bird.actor.position.distanceTo(blocked)<1e-8);assert.equal(bird.state,'Idle');assert.equal(bird.networkState().followSpeed,0);
 assert.equal(notices,1);assert.equal(bird.fearCount,0);assert.equal(bird.actor.position.y,0);
});

test('ground following and its remote presentation can run beneath a canopy that blocks takeoff',()=>{
 const bird=create({safeGround:(_x,z)=>z<3||z>20,walkGround:()=>true});
 const player:PidgiePlayer={id:'guest',hasBread:true,position:new T.Vector3(0,0,35)};
 bird.applyNetworkState({...bird.networkState(),phase:'follow',p:[0,0,0],yaw:0,elapsed:0,followId:player.id,followSpeed:0},true);
 const remote=create({safeGround:(_x,z)=>z<3||z>20,walkGround:()=>true});let beneath=false;
 for(let frame=0;frame<60*8;frame++){
  bird.update(1/60,[player.position],undefined,[player]);
  if(bird.actor.position.z>4&&bird.actor.position.z<18){
   beneath=true;remote.applyNetworkState(bird.networkState(),true);const before=remote.actor.position.clone();remote.updateRemote(.05);
   assert(remote.actor.position.distanceTo(before)>0,'a guest predicts the same legal ground route');
  }
 }
 assert(beneath);assert(Math.abs(bird.actor.position.distanceTo(player.position)-PIDGIE_FOLLOW_DISTANCE)<.5);
 assert.equal(bird.fearCount,0);assert.equal(bird.actor.position.y,0);
});

test('following detours around a broad obstacle instead of alternating side steps and stopping',()=>{
 const safe=(x:number,z:number)=>!(Math.abs(x)<8&&z>7&&z<17),bird=create({safeGround:safe});
 const player:PidgiePlayer={id:'guest',hasBread:true,position:new T.Vector3(0,0,35)};
 bird.applyNetworkState({...bird.networkState(),phase:'follow',p:[0,0,0],yaw:0,elapsed:0,followId:player.id,followSpeed:0},true);
 let detour=false;
 for(let frame=0;frame<60*12;frame++){
  bird.update(1/60,[player.position],undefined,[player]);
  assert(safe(bird.actor.position.x,bird.actor.position.z));detour||=Math.abs(bird.actor.position.x)>=8;
 }
 assert(detour);assert(Math.abs(bird.actor.position.distanceTo(player.position)-PIDGIE_FOLLOW_DISTANCE)<.5);
 assert.equal(bird.state,'Idle');assert.equal(bird.fearCount,0);
});

test('following leaves a concave grove even when the first steps must lead away from the bread carrier',()=>{
 const safe=(x:number,z:number)=>!(Math.abs(x)<6&&z>5&&z<7)&&!(Math.abs(x)>4&&Math.abs(x)<6&&z>-5&&z<7);
 const bird=create({safeGround:safe}),player:PidgiePlayer={id:'guest',hasBread:true,position:new T.Vector3(0,0,25)};
 bird.applyNetworkState({...bird.networkState(),phase:'follow',p:[0,0,0],yaw:0,elapsed:0,followId:player.id,followSpeed:0},true);
 let exited=false;
 for(let frame=0;frame<60*18;frame++){
  bird.update(1/60,[player.position],undefined,[player]);
  assert(safe(bird.actor.position.x,bird.actor.position.z));exited||=bird.actor.position.z<-5;
 }
 assert(exited,'the route can temporarily increase the following gap');
 assert(Math.abs(bird.actor.position.distanceTo(player.position)-PIDGIE_FOLLOW_DISTANCE)<.5);
});

test('running players remain within a bounded delayed following distance, and Pidgie settles eight metres away',()=>{
 const bird=create(),player:PidgiePlayer={id:'runner',hasBread:true,position:bird.actor.position.clone().add(new T.Vector3(0,0,9))};
 const lag=6.8*(PIDGIE_FOLLOW_REACTION_SECONDS+Math.PI/8)+1.2;
 advance(bird,1,[player.position],[player]);
 for(let i=0;i<360;i++){
  player.position.z+=6.8/60;bird.update(1/60,[player.position],undefined,[player]);
  if(i>60)assert(Math.abs(bird.actor.position.distanceTo(player.position)-PIDGIE_FOLLOW_DISTANCE)<lag);
 }
 for(let i=0;i<360;i++){
  const towards=bird.actor.position.clone().sub(player.position).normalize();player.position.addScaledVector(towards,6.8/60);bird.update(1/60,[player.position],undefined,[player]);
  if(i>60)assert(Math.abs(bird.actor.position.distanceTo(player.position)-PIDGIE_FOLLOW_DISTANCE)<lag);
 }
 advance(bird,3,[player.position],[player]);assert(Math.abs(bird.actor.position.distanceTo(player.position)-8)<.5);assert.equal(bird.state,'Idle');
});

test('following waits before starting, ignores small steps, and preserves a pending reaction across host handoff',()=>{
 const host=create(),player:PidgiePlayer={id:'leader',hasBread:true,position:new T.Vector3(0,0,8)};
 host.applyNetworkState({...host.networkState(),phase:'follow',p:[0,0,0],yaw:0,elapsed:0,followId:player.id,followSpeed:0},true);
 advance(host,.2,[player.position],[player]);const planted=host.actor.position.clone();
 player.position.z+=2;advance(host,.4,[player.position],[player]);
 assert(host.actor.position.equals(planted));assert.equal(host.state,'Idle');assert(host.networkState().elapsed>.39);
 const successor=create();successor.applyNetworkState(host.networkState(),true);
 for(let frame=0;frame<9;frame++){host.update(1/60,[player.position],undefined,[player]);successor.update(1/60,[player.position],undefined,[player]);}
 assert(host.actor.position.equals(planted),'no motion before the 0.6-second reaction');assert.deepEqual(successor.networkState(),host.networkState());
 for(let frame=0;frame<90;frame++){host.update(1/60,[player.position],undefined,[player]);successor.update(1/60,[player.position],undefined,[player]);}
 assert(host.actor.position.z>planted.z);assert.equal(host.state,'Idle');assert.deepEqual(successor.networkState(),host.networkState());
 const resting=host.actor.position.clone(),leader=player.position.clone();
 for(let frame=0;frame<180;frame++){player.position.z=leader.z+.15*Math.sin(frame);host.update(1/60,[player.position],undefined,[player]);assert.equal(host.state,'Idle');}
 assert(host.actor.position.equals(resting),'tiny movements cannot produce mincing Run/Idle bursts');
});

test('all three native beak contacts hit the bread centre from different approach angles, including a close toss',()=>{
 for(const angle of [-1.7,0,.9])for(const separation of [2,4,8]){
  const bird=create(),start=bird.actor.position.clone(),player={id:'baker',p:[start.x+Math.sin(angle)*separation,0,start.z+Math.cos(angle)*separation],yaw:angle+Math.PI,size:1,available:true};
  const bread=applyBread({...newBread(),active:true,owner:player.id},{kind:'feed'},player,1000,undefined,bird.networkState());assert(bread.offering);
  bird.acceptBread(bread.offering);advance(bird,6);assert.equal(bird.phase,'feast');
  const food=new T.Vector3().fromArray(bread.p);assert(Math.abs(bird.actor.position.distanceTo(food)-PIDGIE_PECK_REACH)<.011);
  const beak=bird.model.getObjectByName('Beak_sculpt_paint') as T.Mesh,positions=beak.geometry.attributes.position;let front=0;
  for(let vertex=1;vertex<positions.count;vertex++)if(positions.getZ(vertex)>positions.getZ(front))front=vertex;
  const action=bird.actions.get('Peck')!;bird.mixer.stopAllAction();action.reset().stopFading().setEffectiveWeight(1).play();
  for(const fraction of [.3,.5,.7]){
   bird.mixer.setTime(action.getClip().duration*fraction);bird.actor.updateMatrixWorld(true);
   const tip=new T.Vector3().fromBufferAttribute(positions,front).applyMatrix4(beak.matrixWorld);
   assert(Math.hypot(tip.x-food.x,tip.z-food.z)<.025,`beak centre at angle ${angle}, separation ${separation}, peck ${fraction}`);
  }
 }
});

test('Pidgie retreats along the world boundary and steers around an obstacle without entering it',()=>{
 const bird=create(),limit=worldLimit(),player:PidgiePlayer={id:'edge',hasBread:true,position:new T.Vector3(limit-2.3,0,0)};
 const state=bird.networkState();bird.applyNetworkState({...state,phase:'follow',p:[limit-.3,0,0],yaw:Math.PI/2,followId:player.id,followSpeed:0},true);
 for(let i=0;i<360;i++){bird.update(1/60,[player.position],undefined,[player]);assert(bird.actor.position.x<=limit);assert.equal(bird.actor.position.y,0);}
 assert(bird.actor.position.distanceTo(player.position)>PIDGIE_FOLLOW_DISTANCE-.6,'the edge leaves a grounded route around the player');
 const obstacle=create({safeGround:(x,z)=>Math.hypot(x,z-8)>2}),leader:PidgiePlayer={id:'leader',hasBread:true,position:new T.Vector3(0,0,25)};
 obstacle.applyNetworkState({...state,phase:'follow',p:[0,0,0],yaw:0,followId:leader.id,followSpeed:0},true);
 for(let i=0;i<600;i++){obstacle.update(1/60,[leader.position],undefined,[leader]);assert(Math.hypot(obstacle.actor.position.x,obstacle.actor.position.z-8)>2);}
 assert(Math.abs(obstacle.actor.position.distanceTo(leader.position)-PIDGIE_FOLLOW_DISTANCE)<.5,'the pigeon continues after getting around the obstruction');
});

test('following checkpoint keeps the target, run cadence and one-shot notification through late join and host handoff',()=>{
 const host=create(),player:PidgiePlayer={id:'guest',hasBread:true,position:host.actor.position.clone().add(new T.Vector3(0,0,9))};
 advance(host,1,[player.position],[player]);player.position.z+=35;advance(host,1,[player.position],[player]);
 const checkpoint=host.networkState();assert.equal(checkpoint.phase,'follow');assert.equal(checkpoint.clip,'Run');assert(validPidgieState(checkpoint));
 let notices=0;const successor=create({onInterest:()=>notices++}),remote=create({onInterest:()=>notices++});
 successor.applyNetworkState(checkpoint,true);remote.applyNetworkState(checkpoint,true);const before=remote.actor.position.clone();remote.updateRemote(.1);
 assert(remote.actor.position.distanceTo(before)>0);assert.equal(remote.networkState().followId,player.id);assert.equal(remote.actor.position.y,0);
 for(let i=0;i<90;i++){host.update(1/60,[player.position],undefined,[player]);successor.update(1/60,[player.position],undefined,[player]);}
 assert.deepEqual(successor.networkState(),host.networkState());assert.equal(notices,0);
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
