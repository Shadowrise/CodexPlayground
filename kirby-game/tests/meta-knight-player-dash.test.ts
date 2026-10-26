import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from 'three';
import {CharacterController,type Input} from '../src/controller';
import {createMetaKnight} from '../src/meta-knight-model';
import {MetaKnightPlayerDash,PLAYER_KNIGHT_DASH as DASH} from '../src/meta-knight-player-dash';
import {actorState,applyActor} from '../src/network-actors';
import {validActor} from '../src/network-protocol';
import {KIRBY_VARIANTS} from '../src/variants';
import {disposeActor} from '../src/actor-lifecycle';

const asset=createMetaKnight(),idle:Input={forward:false,left:false,right:false},held={...idle,dashPressed:true};
function create(){const model=new Group();model.add(asset.root.clone(true));return new CharacterController(model,asset.clips);}
function advance(c:CharacterController,seconds:number,input=idle,fps=100){if(input.dashPressed)c.update(0,input);for(let i=0;i<Math.round(seconds*fps);i++)c.update(1/fps,{...input,dashPressed:false});}
function bladeDirection(c:CharacterController){const blade=c.actor.getObjectByName('Galaxia')!;c.actor.updateMatrixWorld(true);return blade.localToWorld(new Vector3(-.315,2.05,0)).sub(blade.getWorldPosition(new Vector3())).normalize();}

test('a press starts immediately and cooldown presses are discarded',()=>{
 const dash=new MetaKnightPlayerDash();assert(!dash.press(false));assert(!dash.active);
 assert(dash.press(true));assert(dash.active);assert.equal(dash.cooldown,6);assert.equal(dash.charge,0);
 dash.step(1);assert(!dash.press(true));dash.tick(7);assert(!dash.active,'cooldown presses cannot queue another dash');
 assert(dash.press(true));assert(dash.active);
});

test('Space only jumps while a separate press starts a dash on the first frame',()=>{
 const c=create();advance(c,1,{...idle,jump:true});assert.equal(c.knightDash.cooldown,0);assert.notEqual(c.state,'Dash');assert.equal(c.actor.position.z,0);
 c.update(.01,held);assert.equal(c.state,'Dash');assert.equal(c.knightDash.cooldown,6);assert(c.knightDash.active);assert(!c.cloud.visible);assert(c.actor.position.z>0);
});

test('the sword thrust covers twelve metres in 0.7s at different frame rates and locks the heading',()=>{
 for(const fps of [30,60,120])for(const yaw of [0,.7,Math.PI]){
  const c=create();c.yaw=yaw;c.actor.rotation.y=yaw;advance(c,0,held,fps);assert.equal(c.state,'Dash');const origin=c.actor.position.clone();
  const direction=bladeDirection(c),forward=new Vector3(Math.sin(yaw),0,Math.cos(yaw));assert(direction.dot(forward)>.995,'the actual held blade points along the dash');assert(Math.abs(direction.y)<.06);
  assert(c.actor.getObjectByName('Meta Knight flying sword sparks')!.visible);
  advance(c,.7,{...held,forward:true,left:true},fps);
  assert(Math.abs(c.actor.position.clone().sub(origin).dot(forward)-DASH.distance)<1e-6);assert.equal(c.yaw,yaw);assert.equal(c.state,'Fly');assert(c.flight.active);
  assert(!c.actor.getObjectByName('Meta Knight flying sword sparks')!.visible);
 }
});

test('a press never repeats or queues a dash, and a fresh press starts again when ready',()=>{
 const c=create();advance(c,7.2,held);assert.equal(c.knightDash.cooldown,0);assert(Math.abs(c.actor.position.z-DASH.distance)<1e-6);assert(!c.knightDash.active);
 c.update(.01,idle);advance(c,0,held);assert.equal(c.state,'Dash');assert.equal(c.knightDash.cooldown,6);
 c.update(.01,idle);advance(c,6,held);assert(!c.knightDash.active);assert(Math.abs(c.actor.position.z-2*DASH.distance)<1e-6,'a press during cooldown is discarded');
 c.update(.01,idle);advance(c,0,held);assert(c.knightDash.active);
});

test('activity interruption cancels thrust without resetting cooldown or queuing a press',()=>{
 const c=create();c.update(0,held);c.update(.1,idle);const z=c.actor.position.z;
 c.setActivity('Boat');assert(!c.knightDash.active);assert(!c.actor.getObjectByName('Meta Knight flying sword sparks')!.visible);
 c.updateActivity(2);assert(Math.abs(c.knightDash.cooldown-3.9)<1e-6);assert.equal(c.actor.position.z,z);assert.equal(c.state,'Boat');
 c.setActivity('Idle');advance(c,4,idle);assert(!c.knightDash.active);assert.equal(c.actor.position.z,z,'returning from a ride cannot arm a delayed dash');
});

test('an air attack pressed during a dash cannot leave a queued sword hit',()=>{
 const c=create();advance(c,0,held);c.update(.1,{...held,attack:true});
 let hits=Number(c.attackHit);for(let i=0;i<100;i++){c.update(.01,{...idle});hits+=Number(c.attackHit);}
 assert.equal(hits,0);assert.equal(c.state,'Fly');
});

test('swimming and eating block the dash, and normal position constraints stop the thrust',()=>{
 const swimmer=create();swimmer.swimming=true;advance(swimmer,1,{...idle,dashPressed:true});assert.equal(swimmer.knightDash.cooldown,0);
 const eating=create();advance(eating,1,{...held,eat:true});assert.equal(eating.knightDash.cooldown,0);assert.equal(eating.state,'Eat');
 const c=create();c.yaw=Math.PI/2;c.actor.rotation.y=c.yaw;c.positionConstraint=p=>{p.x=Math.min(2,p.x);};advance(c,1.2,held);
 assert.equal(c.actor.position.x,2);assert(Math.abs(c.actor.position.z)<1e-6);assert(!c.knightDash.active);
});

test('jumping out of water allows a dash press despite the previous swimming flag',()=>{
 const c=create();c.swimming=true;c.update(.01,{...idle,jump:true});assert(c.flight.active);c.update(.01,held);assert.equal(c.state,'Dash');
});

test('flight mist stays attached to the sword and ends with the dash, without a wake through the body',()=>{
 const c=create();advance(c,.5,held);const effect=c.actor.getObjectByName('Meta Knight flying sword sparks')!,mist=c.actor.getObjectByName('Galaxia soft flying mist')!;assert(effect.visible);assert.equal(mist.parent,effect);assert.equal(effect.parent,c.actor.getObjectByName('Galaxia'));
 assert(!c.actor.getObjectByName('Meta Knight golden violet dash wake'));advance(c,.4,idle);assert.equal(c.state,'Fly');assert(!effect.visible);
});

test('network peers reconstruct the full sword pose and sparks using the existing actor contract',()=>{
 const c=create(),remote=create();c.yaw=.7;c.actor.rotation.y=c.yaw;advance(c,.6,held);
 const variant=KIRBY_VARIANTS.findIndex(v=>v[0]==='Meta Knight'),state=actorState(c,'Knight',variant);assert(validActor(state));assert.equal(state.state,'Dash');
 applyActor(remote,state,.016,true);assert.equal(remote.state,'Dash');assert(remote.flight.active);assert(bladeDirection(remote).dot(bladeDirection(c))>.999);
 applyActor(remote,{...state,state:'Idle',p:[0,0,0],pose:[]},.2,true);assert.equal(remote.state,'Idle');assert(!remote.actor.getObjectByName('Meta Knight flying sword sparks')!.visible);assert(bladeDirection(remote).y>.6,'the sword returns to its normal pose');
 const spark=remote.actor.getObjectByName('Meta Knight flying sword sparks')!;disposeActor(remote);assert(!spark.parent,'owned spark resources are removed on disposal');
});
