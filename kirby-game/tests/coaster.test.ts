import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, AnimationMixer, Vector3 } from 'three';
import { Coaster, STATION } from '../src/coaster';
import type { CharacterController } from '../src/controller';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KIRBY_VARIANTS } from '../src/variants';

test('short station stops keep all twelve carts circulating without overlap',()=>{
  const c=new Coaster();
  const carts=(c as unknown as {carts:{distance:number;wait:number;occupied:boolean}[]}).carts;
  const laps=carts.map(()=>0);
  for(let frame=0;frame<60*180;frame++){
    const before=carts.map(cart=>cart.distance);c.update(1/60);
    carts.forEach((cart,i)=>{
      if(cart.distance<before[i]){
        laps[i]++;assert(cart.wait<=(cart.occupied?.4:2.5));
      }
    });
    const positions=carts.map(cart=>cart.distance).sort((a,b)=>a-b);
    for(let i=0;i<positions.length;i++)assert((positions[(i+1)%12]-positions[i]+c.length)%c.length>4.9);
  }
  assert(laps.every(n=>n>=3),'No cart gets stuck in the station queue');
});

test('twelve carts retain six Kirby passengers and Luigi, occupied carts reject boarding',async()=>{
  const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));
  const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const c=new Coaster();c.addKirbyPassengers(model.scene,model.animations,KIRBY_VARIANTS[0]);
  const carts=(c as unknown as {carts:{group:Group;wait:number;occupied:boolean}[]}).carts;
  assert.equal(carts.length,12);assert.equal(carts.filter(c=>c.occupied).length,7);
  const passengers=carts.flatMap(c=>c.group.children.filter(o=>o.name.startsWith('Permanent Kirby') || o.name==='Luigi · permanent passenger'));
  assert.equal(passengers.length,7);
  const parents=passengers.map(p=>p.parent);
  const actor=new Group(),scene=new Group();scene.add(actor);actor.position.copy(STATION);
  const player={actor,state:'Idle',yaw:0,mixer:new AnimationMixer(actor),update:()=>{}} as unknown as CharacterController;
  carts.forEach(c=>c.wait=c.occupied?1:0);
  assert.equal(c.board(player),false);
  for(let i=0;i<7200;i++)c.update(1/60);
  passengers.forEach((p,i)=>assert.equal(p.parent,parents[i]));
});

test('departure accelerates gradually; returning rider exits a stopped station queue',()=>{
  const coaster=new Coaster(),actor=new Group(),scene=new Group();scene.add(actor);actor.position.copy(STATION);
  const player={actor,state:'Idle',yaw:0,mixer:new AnimationMixer(actor),update:()=>{}} as unknown as CharacterController;
  assert(coaster.board(player));
  let previous=0,max=0;
  for(let i=0;i<240;i++) {
    coaster.update(1/60);
    const speed=coaster.rideMotion.speed;
    assert(speed-previous<=12/60+.001,'Acceleration is bounded');
    previous=speed;max=Math.max(max,speed);
  }
  assert(max>20 && max<40);
  // Reproduce a returning cart queued behind a long station stop.
  const carts=(coaster as unknown as {carts:{distance:number;wait:number;speed:number}[]}).carts;
  carts[0].distance=coaster.length-20;carts[0].speed=8;carts[0].wait=0;
  carts[1].distance=0;carts[1].wait=100;
  for(let i=0;i<600 && coaster.riding;i++)coaster.update(1/60);
  assert(!coaster.riding,'Queue arrival must disembark without crossing the lap seam');
  assert(carts[0].distance<coaster.length && carts[0].distance>coaster.length-22);
  assert.equal(actor.position.y,0);assert.equal(actor.position.z,214);
});

test('loop rails and cross ties leave clearance around rider head, including growth',()=>{
  const c=new Coaster();
  const rails:Vector3[]=[];
  const poses=Array.from({length:3600},(_,i)=>c.pose(c.length*i/3600));
  for(const p of poses)for(const x of [-1.5,-1.2,0,1.2,1.5])rails.push(new Vector3(x,0,0).applyQuaternion(p.q).add(p.p));
  for(const scale of [1,2,3]) {
    let clearance=Infinity;
    for(const p of poses) {
      if(p.p.x<210 || p.p.z<25 || p.p.z>120)continue;
      const head=new Vector3(0,2.47*scale,0).applyQuaternion(p.q).add(p.p);
      for(const rail of rails)clearance=Math.min(clearance,head.distanceToSquared(rail));
    }
    assert(Math.sqrt(clearance)>scale+ .2,`head clearance at scale ${scale}: ${Math.sqrt(clearance)}`);
  }
});

test('closed mountain circuit has height changes, inverted loop and continuous frames',()=>{
  const c=new Coaster();let min=Infinity,max=0,inverted=false;
  for(let i=0;i<2400;i++) {
    const pose=c.pose(c.length*i/2400);
    assert(Math.abs(pose.p.x)<250 && Math.abs(pose.p.z)<250);
    min=Math.min(min,pose.p.y);max=Math.max(max,pose.p.y);
    if(new Vector3(0,1,0).applyQuaternion(pose.q).y<-.8)inverted=true;
  }
  assert(max-min>35);assert(inverted);
  assert(c.pose(0).q.angleTo(c.pose(c.length-.001).q)<.01);
});

test('station boarding completes a full circuit and restores player to ground',()=>{
  const coaster=new Coaster(),actor=new Group(),scene=new Group();scene.add(actor);
  const player={actor,state:'Idle',yaw:0,mixer:new AnimationMixer(actor),update:()=>{}} as unknown as CharacterController;
  assert.equal(coaster.board(player),false);
  actor.position.copy(STATION);
  assert(coaster.board(player));assert(coaster.riding);
  let high=0,inverted=false;
  for(let frame=0;frame<60*240 && coaster.riding;frame++) {
    coaster.update(1/60);high=Math.max(high,actor.position.y);
    inverted ||= new Vector3(0,1,0).applyQuaternion(actor.quaternion).y<-.8;
  }
  assert(high>35);assert(inverted);assert(!coaster.riding);
  assert.equal(actor.position.y,0);assert.equal(actor.parent,scene);
  assert(actor.quaternion.angleTo(new Group().quaternion)<1e-8);
});
