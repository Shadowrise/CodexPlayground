import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FireflyDrive} from '../src/firefly-drive';
import type {Input} from '../src/controller';

const idle:Input={forward:false,left:false,right:false};
const forward:Input={...idle,forward:true};
const backward:Input={...idle,backward:true};
const top=13.6,reverse=3.3;
function vehicle(fps=60){
  const drive=new FireflyDrive(),position={x:0,z:0};let yaw=0;drive.reset(yaw);
  return {drive,position,get yaw(){return yaw;},
    run(seconds:number,input:Input,cap=top){for(let i=0;i<Math.round(seconds*fps);i++)yaw=drive.move(position,yaw,1/fps,input,cap,reverse);},
    slip(input:Input){const before={...position};yaw=drive.move(position,yaw,1/fps,input,top,reverse);return Math.atan2(Math.sin(yaw-Math.atan2(position.x-before.x,position.z-before.z)),Math.cos(yaw-Math.atan2(position.x-before.x,position.z-before.z)));}};
}

test('firefly accelerates quickly and reaches the exact speed cap without overshooting',()=>{
  for(const fps of [30,60,120]){
    const car=vehicle(fps);car.run(.1,forward);
    assert(car.drive.speed>0&&car.drive.speed<top*.2,'first frames accelerate from rest');
    car.run(.4,forward);assert(car.drive.speed>top*.65&&car.drive.speed<top*.8);
    car.run(.2,forward);assert(Math.abs(car.drive.speed-top)<1e-9,'full speed after 0.7 seconds');
    const start=car.position.z;car.run(1,forward);assert.equal(car.drive.speed,top);assert(Math.abs(car.position.z-start-top)<1e-9);
  }
});

test('fast turns drift farther than slow turns, then recover grip on a straight',()=>{
  const turn={...forward,left:true},slow=vehicle(),fast=vehicle();
  slow.run(.1,turn);const slowSlip=slow.slip(turn);
  fast.run(1,forward);fast.run(.1,turn);const fastSlip=fast.slip(turn);
  assert(slowSlip>.02&&fastSlip>slowSlip*1.3,'higher speed produces a greater slip angle');
  fast.run(1,turn);const sustained=fast.slip(turn);
  assert(sustained>.2&&sustained<.4,'full-lock drift is noticeable but controlled');
  fast.run(.6,forward);assert(Math.abs(fast.slip(forward))<.02,'letting go of steering restores straight travel');
  assert.equal(fast.drive.speed,top,'turns cannot add speed beyond the cap');
});

test('releasing the throttle coasts to a complete stop and reverse brakes before backing up',()=>{
  const car=vehicle();car.run(1,forward);const released=car.position.z;
  car.run(.2,idle);assert(car.drive.speed>0&&car.drive.speed<top);assert(car.position.z>released);
  car.run(.4,idle);assert.equal(car.drive.speed,0);const stopped={...car.position};car.run(1,idle);assert.deepEqual(car.position,stopped);
  car.run(1,forward);car.run(.1,backward);assert(car.drive.speed>0,'reverse initially brakes forward momentum');
  car.run(.2,backward);assert(car.drive.speed<0&&car.drive.speed>-reverse,'backward movement accelerates from rest');
  car.run(1,backward);assert.equal(car.drive.speed,-reverse);
  car.run(.05,forward);assert(car.drive.speed<0,'changing from reverse also brakes first');
  car.run(1,forward);assert.equal(car.drive.speed,top);
});

test('arcade handling follows the same path at 30, 60 and 120 FPS and with analog steering',()=>{
  const paths=[30,60,120].map(fps=>{
    const car=vehicle(fps);car.run(1,forward);car.run(2,{...forward,steer:.65});car.run(.2,idle);car.run(1,{...backward,steer:-.4});car.run(.6,idle);
    return {position:car.position,yaw:car.yaw,speed:car.drive.speed};
  });
  for(const p of paths.slice(1)){
    assert(Math.hypot(p.position.x-paths[0].position.x,p.position.z-paths[0].position.z)<1e-8);
    assert(Math.abs(p.yaw-paths[0].yaw)<1e-8);assert.equal(p.speed,paths[0].speed);
  }
  const digital=vehicle(),analog=vehicle();digital.run(2,{...forward,left:true});analog.run(2,{...forward,steer:1});assert.deepEqual(digital.position,analog.position);
});

test('reset removes momentum and speed bonuses still use the current character cap',()=>{
  const car=vehicle();car.run(1,{...forward,left:true});car.drive.reset(Math.PI);
  const position={...car.position};car.drive.move(position,Math.PI,.1,idle,top,reverse);assert.deepEqual(position,car.position);assert.equal(car.drive.speed,0);
  car.run(1,forward,top*2);assert.equal(car.drive.speed,top*2);
  car.run(1,forward);assert.equal(car.drive.speed,top);
});
