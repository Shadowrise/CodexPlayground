import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {orbitKnightCamera,knightJointCamera} from '../src/meta-knight-camera-orbit';
import {fitKnightFormationCamera} from '../src/meta-knight-formation-camera';
import {FollowCamera} from '../src/follow-camera';
import {startKnightBattle,setKnightPhase,advanceKnightBattle,type KnightActor} from '../src/meta-knight-battle';
import {startHelperAbility,helperLocked} from '../src/meta-knight-helper';
import {beginKnightDuet} from '../src/meta-knight-duet';
import {humanKnightFixture} from './knight-human-fixture';

function fixture(){const actors:KnightActor[]=[{id:'hero',p:[0,0,-2],yaw:0,available:true},{id:'helper',p:[12,0,0],yaw:0,available:true,metaKnight:true,side:'boss'},{id:'other',p:[-12,0,0],yaw:0,available:true,metaKnight:true,side:'boss'}],s=humanKnightFixture(startKnightBattle(actors,'hero',100000)!);s.stage='rest';s.until=1e9;return {s,actors};}

test('running, standing and individual ability locks never enable the new joint camera',()=>{
 const {s}=fixture();assert(!knightJointCamera(s,'helper',100000));assert(!knightJointCamera(s,'hero',100000));
 for(const ability of [1,2,3] as const){const {s,actors}=fixture();assert(startHelperAbility(s,actors[1],ability,100000));assert(helperLocked(s.players.helper.helper!,100100));assert(!knightJointCamera(s,'helper',100100));}
});

test('only the participating knight gets the joint camera throughout ascent and planet support',()=>{
 const {s,actors}=fixture();setKnightPhase(s,4,actors,100000);
 for(const stage of ['transition','cosmic-charge','cosmic-strike','cosmic-surge','cosmic-lift','cosmic-rise','cosmic-flight']){
  assert.equal(s.stage,stage);assert(knightJointCamera(s,'helper',s.since+1));assert(!knightJointCamera(s,'hero',s.since+1));advanceKnightBattle(s,actors,s.until,'hero');
 }
 assert(!knightJointCamera(s,'helper',s.since+1),'ordinary space combat returns to the existing camera');
 setKnightPhase(s,4,actors,s.until,3);assert(knightJointCamera(s,'helper',s.since+1));
 s.players.helper.withdrawn=true;assert(!knightJointCamera(s,'helper',s.since+1));delete s.players.helper.withdrawn;s.players.helper.hp=0;assert(!knightJointCamera(s,'helper',s.since+1));
});

test('a shared storm unlocks its owner camera while the other knight and heroes keep their previous camera',()=>{
 const {s,actors}=fixture();assert(startHelperAbility(s,actors[1],4,100000));assert(beginKnightDuet(s,actors,100000,[0,0,-9]));
 for(let i=0;i<4;i++){
  assert(knightJointCamera(s,'helper',s.since+1));assert(!knightJointCamera(s,'other',s.since+1));assert(!knightJointCamera(s,'hero',s.since+1));advanceKnightBattle(s,actors,s.until,'hero');
 }
 s.stage='lost';assert(!knightJointCamera(s,'helper',s.since+1));
});

test('the default formation composition is preserved and orbit, pitch and zoom work on desktop and phone',()=>{
 for(const [width,height] of [[1280,800],[390,844],[844,390]]){
  const frame={kind:'duet',yaw:1.2,anchor:[3.3,180,0] as [number,number,number],points:[],elevation:.3},pose=fitKnightFormationCamera(frame,width,height),follow=new FollowCamera();
  follow.reset(frame.yaw-Math.PI);
  const initial=orbitKnightCamera(pose,follow,180),focus=new Vector3().fromArray(pose.focus);
  assert(new Vector3().fromArray(initial.position).distanceTo(new Vector3().fromArray(pose.position))<1e-10);
  const radius=new Vector3().fromArray(initial.position).distanceTo(focus);
  follow.orbit(-160,60);follow.zoom(-600);for(let i=0;i<180;i++)follow.update(1/60,frame.yaw-Math.PI,false,0,0);
  const moved=orbitKnightCamera(pose,follow,180),point=new Vector3().fromArray(moved.position),delta=point.clone().sub(focus);
  assert.equal(moved.focus,pose.focus);assert.equal(moved.fov,pose.fov);assert(point.distanceTo(focus)<radius*.6);assert(moved.position[1]>pose.position[1]);
  assert(Math.abs(Math.atan2(Math.sin(Math.atan2(delta.x,delta.z)-follow.azimuth),Math.cos(Math.atan2(delta.x,delta.z)-follow.azimuth)))<1e-10);
 }
});

test('victorious knights can control the camera throughout the approach, hug and dance, including helpers with no hearts',()=>{
 const {s}=fixture();s.stage='lost';s.celebration={at:100000,boss:[0,0,-9],helpers:{helper:[30,0,9],other:[-20,0,10]}};
 for(const hp of [5,0])for(const now of [100000,101000,105000,109000,114000,140000]){
  s.players.helper.hp=hp;
  assert(knightJointCamera(s,'helper',now),'the victory scene must remain manually controllable');
  assert(knightJointCamera(s,'other',now));assert(!knightJointCamera(s,'hero',now));
 }
 s.players.helper.withdrawn=true;assert(!knightJointCamera(s,'helper',110000));delete s.players.helper.withdrawn;
 delete s.celebration;assert(!knightJointCamera(s,'helper',110000),'a result without the celebration does not open the shared camera');
});

test('ground and sky cameras stay above their local floor at every orbit and zoom limit',()=>{
 for(const floor of [0,180])for(const azimuth of [-Math.PI,-1,0,1,Math.PI])for(const elevation of [0,.25,1.25])for(const distance of [5,10,24]){
  const pose=orbitKnightCamera({position:[5,floor+10,32],focus:[5,floor+9.5,-7]},{azimuth,elevation,distance},floor);
  assert(pose.position.every(Number.isFinite));assert(pose.position[1]>=floor+.5-1e-10);
 }
});
