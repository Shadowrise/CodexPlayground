import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {CentipedeCollision} from '../src/centipede-collision';
import {ArenaCentipede} from '../src/arena-centipede';
import {startCentipede,pushCentipede} from '../src/centipede-event';
import {BOSS_ARENA as A} from '../src/boss-arena-site';

async function setup(){
 const b=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const c=new CharacterController(gltf.scene,gltf.animations),collision=new CentipedeCollision();
 Object.assign(collision.bodies[0],{x:A.x,y:1.2,z:A.z,rx:1,ry:.8,rz:1});
 return {c,collision};
}
const idle={forward:false,left:false,right:false};
test('body blocks walking through it but a real flight can land on its back, ride its movement, jump again and fall off',async()=>{
 const {c,collision}=await setup(),previous=new Vector3(A.x+4,0,A.z);
 c.actor.position.set(A.x,0,A.z);collision.apply(c,previous,1/60);assert(c.actor.position.x>=A.x+1.59);
 c.actor.position.set(A.x+4,0,A.z);
 for(let frame=0;frame<220;frame++){
  previous.copy(c.actor.position);c.update(1/60,{...idle,jump:frame===0||frame===10});
  if(c.actor.position.y>2.2)c.actor.position.x=A.x;
  c.surfaceY=0;if(!c.flight.active)c.actor.position.y=0; // ordinary ground pass
  collision.apply(c,previous,1/60);
 }
 assert(Math.abs(c.actor.position.y-2)<.01);assert.equal(c.surfaceY,2);
 previous.copy(c.actor.position);collision.bodies[0].x+=.5;collision.bodies[0].y+=.3;c.actor.position.y=0;c.surfaceY=0;
 collision.apply(c,previous,1/60);assert(Math.abs(c.actor.position.x-A.x-.5)<.01);assert(Math.abs(c.actor.position.y-2.3)<.01);
 for(let frame=0;frame<12;frame++){previous.copy(c.actor.position);c.update(1/60,{...idle,jump:frame===0});c.surfaceY=0;collision.apply(c,previous,1/60);}
 assert(c.actor.position.y>3.3,'flight starts above the back rather than teleporting to ground');
 for(let frame=0;frame<220;frame++){previous.copy(c.actor.position);c.update(1/60,idle);c.surfaceY=0;if(!c.flight.active)c.actor.position.y=0;collision.apply(c,previous,1/60);}
 assert(Math.abs(c.actor.position.y-2.3)<.01);
 c.actor.position.x+=5;
 for(let frame=0;frame<120;frame++){previous.copy(c.actor.position);c.update(1/60,idle);c.actor.position.y=0;c.surfaceY=0;collision.apply(c,previous,1/60);}
 assert.equal(c.actor.position.y,0);assert.equal(c.surfaceY,0);
});
test('support grows with the kirby foot envelope and disabled attractions do not retain boss support',async()=>{
 const {c,collision}=await setup();c.actor.scale.setScalar(7);c.actor.position.set(A.x+3,1.99,A.z);
 collision.apply(c,new Vector3(A.x+3,2.1,A.z),1/60);assert.equal(c.actor.position.y,2);
 collision.apply(c,c.actor.position.clone(),1/60,false);
 c.actor.position.set(0,0,0);collision.apply(c,c.actor.position.clone(),1/60);assert.equal(c.actor.position.y,0);
});

test('walking up a rounded back keeps the supported feet clear of its side collision',async()=>{
 const {c,collision}=await setup(),b=collision.bodies[0];
 c.actor.position.set(b.x,2,b.z-1.15);
 const landing=c.actor.position.clone();c.actor.position.y=0;collision.apply(c,landing,1/60);
 const start=c.actor.position.clone();
 assert(Math.abs(start.z-(b.z-1.15))<1e-8,'landing on the curved back must not eject the player sideways');
 c.yaw=0;
 for(let frame=0;frame<10;frame++){
  const previous=c.actor.position.clone();c.update(1/60,{...idle,forward:true});
  c.surfaceY=0;c.actor.position.y=0;collision.apply(c,previous,1/60);
  assert(c.actor.position.z>previous.z+.1,'forward input must keep advancing along the curve');
  assert(c.actor.position.y>=previous.y-.001,'walking towards the crown must climb');
 }
 assert(c.actor.position.y>start.y+.1);
});

test('forward walking crosses the real animated back joints and reaches the drum without another jump',async()=>{
 const bytes=await readFile(new URL('../public/models/centipede-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const model=new ArenaCentipede(gltf),trail=model.startTrail(0),head=trail.at(-1)!;
 for(const fps of [30,60,120])for(const offset of [-.35,0,.35]){
  const {c}=await setup(),collision=model.collision;
  collision.apply(c,c.actor.position.clone(),1/fps,false);
  const actor={id:'a',p:[head[0],0,head[1]] as [number,number,number],yaw:0,size:1,available:true,done:false,points:0};
  const event=startCentipede(trail,actor,1000)!;event.phase=2;event.stage='back';event.stageAt=10000;
  model.update(10,undefined,event,10000);model.update(10.5,undefined,event,10500);
  const tail=collision.bodies[11],drum=collision.bodies[3];
  c.actor.position.set(tail.x+offset,tail.y+tail.ry+.02,tail.z);
  collision.apply(c,c.actor.position.clone(),1/fps);
  const start=c.actor.position.clone();
  let reached=false;
  for(let frame=0;frame<fps*4;frame++){
   const now=10500+frame/fps*1000;model.update(now/1000,undefined,event,now);
   const previous=c.actor.position.clone();c.yaw=Math.atan2(drum.x+offset-previous.x,drum.z-previous.z);
   c.update(1/fps,{...idle,forward:true});c.surfaceY=0;c.actor.position.y=0;
   collision.apply(c,previous,1/fps);
   assert(c.actor.position.y>1.5,`fell off a back joint at ${fps}fps, offset ${offset}, frame ${frame}`);
   assert(Math.abs(Math.hypot(c.actor.position.x-previous.x,c.actor.position.z-previous.z)-c.speed/fps)<.01,'back joints must preserve forward movement without stalling or ejecting the player');
   if(Math.hypot(c.actor.position.x-drum.x,c.actor.position.z-drum.z)<1){reached=true;break;}
  }
  assert(reached,`forward input got stuck before the drum at ${fps}fps, offset ${offset}`);
  assert(c.actor.position.y>start.y+1,'the walk must gain the staircase height');
  actor.p=c.actor.position.toArray();actor.yaw=c.yaw;
  assert(pushCentipede(event,actor,13000),'the drum must be reachable from the climbed back');
 }
});
