import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {CentipedeCollision} from '../src/centipede-collision';
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
