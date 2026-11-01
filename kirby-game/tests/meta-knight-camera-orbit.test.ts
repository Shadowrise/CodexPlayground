import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {orbitKnightCamera} from '../src/meta-knight-camera-orbit';
import {fitKnightFormationCamera} from '../src/meta-knight-formation-camera';
import {FollowCamera} from '../src/follow-camera';

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

test('ground and sky cameras stay above their local floor at every orbit and zoom limit',()=>{
 for(const floor of [0,180])for(const azimuth of [-Math.PI,-1,0,1,Math.PI])for(const elevation of [0,.25,1.25])for(const distance of [5,10,24]){
  const pose=orbitKnightCamera({position:[5,floor+10,32],focus:[5,floor+9.5,-7]},{azimuth,elevation,distance},floor);
  assert(pose.position.every(Number.isFinite));assert(pose.position[1]>=floor+.5-1e-10);
 }
});
