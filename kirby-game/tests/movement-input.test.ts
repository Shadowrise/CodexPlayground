import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {cameraRelativeMotion,TURN_RATE} from '../src/movement-input';

const idle={forward:false,left:false,right:false};
async function create(){
 const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 return new CharacterController(gltf.scene,gltf.animations);
}

test('fixed-camera movement follows all eight screen directions regardless of initial facing',async()=>{
 for(const cameraYaw of [0,Math.PI/3,Math.PI])for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI*5]){
  const c=await create();
  for(const [x,y] of [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]]){
   c.setActivity('Idle');c.actor.position.set(0,0,0);c.yaw=yaw;c.actor.rotation.y=yaw;
   const motion=cameraRelativeMotion(x,y,cameraYaw,c.yaw,1/60);
   c.update(1/60,{...idle,...motion});
   const target=cameraYaw-Math.atan2(x,-y),distance=c.speed/60;
   assert(Math.abs(c.actor.position.x-Math.sin(target)*distance)<1e-8);
   assert(Math.abs(c.actor.position.z-Math.cos(target)*distance)<1e-8);
   assert(Math.abs(c.actor.position.length()-distance)<1e-8,'diagonal movement cannot add speed');
   assert(Math.abs(c.yaw-yaw)<=TURN_RATE/60+1e-8,'facing turns at the normal rate');
   assert.equal(c.state,'Run');
  }
 }
});

test('camera-relative facing takes the short path and settles without overshooting at any frame rate',()=>{
 for(const fps of [20,60,144]){
  let yaw=Math.PI-.01;
  for(let frame=0;frame<fps;frame++){
   const motion=cameraRelativeMotion(0,-1,-Math.PI+.01,yaw,1/fps);
   if(frame===0)assert(motion.steer>0,'cross the angle boundary by the shorter turn');
   yaw+=motion.steer*TURN_RATE/fps;
  }
  assert(Math.abs(yaw-(Math.PI+.01))<1e-8);
 }
});

test('screen-relative movement stays responsive during sprint, push, jump and levitation',async()=>{
 for(const mode of ['sprint','push','jump','levitation']){
  const c=await create();c.yaw=0;
  if(mode==='levitation'){
   c.update(.01,{...idle,jump:true});c.update(.01,idle);c.update(.01,{...idle,jump:true});
  }
  const before=c.actor.position.clone();
  const motion=cameraRelativeMotion(0,-1,Math.PI,c.yaw,1/60);
  c.update(1/60,{...idle,...motion,sprint:mode==='sprint',attack:mode==='push',jump:mode==='jump'});
  const distance=c.speed/60*(mode==='sprint'?2:mode==='jump'||mode==='levitation'?.8:1);
  assert(Math.abs(c.actor.position.x-before.x)<1e-8,mode);
  assert(Math.abs(c.actor.position.z-before.z+distance)<1e-8,mode);
  const stopped=c.actor.position.clone(),yaw=c.yaw;
  c.update(1/60,{...idle,...cameraRelativeMotion(0,0,Math.PI,c.yaw,1/60)});
  assert(Math.hypot(c.actor.position.x-stopped.x,c.actor.position.z-stopped.z)<1e-8,mode);
  assert.equal(c.yaw,yaw,'release stops both movement and facing');
 }
});

test('stick drift does not start fixed-camera movement or turn the character',()=>{
 const motion=cameraRelativeMotion(.02,-.03,Math.PI,0,1/60);
 assert.equal(motion.forward,false);assert.equal(motion.steer,0);assert.equal(motion.moveYaw,undefined);
});
