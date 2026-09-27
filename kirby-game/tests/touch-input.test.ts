import assert from 'node:assert/strict';
import {test} from 'node:test';
import {touchMotion,wantsTouchControls} from '../src/touch-input';
import {FollowCamera} from '../src/follow-camera';

test('touch UI does not replace mouse-first desktop or touchscreen laptop controls',()=>{
 assert.equal(wantsTouchControls(0,false,false),false);
 assert.equal(wantsTouchControls(10,false,false),false);
 assert.equal(wantsTouchControls(5,true,false),false);
 assert.equal(wantsTouchControls(5,true,true),true);
});
test('joystick dead zone, sprint and camera-relative direction',()=>{
 assert.deepEqual(touchMotion(.08,-.1,Math.PI,0,1/60),{forward:false,sprint:false,steer:0});
 const walk=touchMotion(0,-.5,Math.PI,0,1/60);assert(walk.forward);assert(!walk.sprint);assert(Math.abs(walk.steer)<1e-10);
 assert(touchMotion(0,-1,Math.PI,0,1/60).sprint);
 assert(touchMotion(1,0,Math.PI,0,1/60).steer<0);
 assert(touchMotion(-1,0,Math.PI,0,1/60).steer>0);
 assert(!touchMotion(0,1,Math.PI,0,1/60).forward);
 assert(touchMotion(0,-1,0,Math.PI,1/60).forward);
});
test('holding a direction settles without chasing the follow camera or overshooting',()=>{
 const camera=new FollowCamera();let yaw=0;
 for(let i=0;i<240;i++){
  const motion=touchMotion(1,0,camera.azimuth,yaw,1/60);
  yaw+=motion.steer*Math.PI*.55/60;
  camera.update(1/60,yaw,true,0,0,true);
 }
 assert(Math.abs(yaw+Math.PI/2)<1e-8);assert(Math.abs(camera.azimuth-Math.PI)<1e-8);
 assert(Math.abs(touchMotion(1,0,camera.azimuth,yaw,1/60).steer)<1e-8);
});
