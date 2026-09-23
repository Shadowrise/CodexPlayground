import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Scene,PerspectiveCamera,Vector3 } from 'three';
import { CharacterController } from '../src/controller';
import { KirbyHome } from '../src/kirby-home';
import { NightFireflies } from '../src/night-fireflies';
import { createSky } from '../src/sky';
import { sceneryClearance } from '../src/landmarks';
async function model(name:string){const bytes=await readFile(new URL(`../public/models/${name}-animated.glb`,import.meta.url));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
test('bed rests indefinitely without changing map mode; action wakes and first rest earns three points',async()=>{
 const gltf=await model('kirby'),c=new CharacterController(gltf.scene,gltf.animations),home=new KirbyHome();c.actor.position.copy(home.entrance);c.actor.scale.setScalar(2);
 for(const night of [false,true]){
  home.night=night;assert(home.start(c));assert(!home.start(c));assert(home.savePosition(c));
  for(let i=0;i<600;i++)home.update(1/60);
  assert.equal(home.night,night);assert(home.active);assert.equal(c.state,'Sleep');assert.deepEqual([...c.achievements],['sleep']);
  const bed=c.actor.position.clone();home.update(20);assert(c.actor.position.distanceTo(bed)<1e-8);assert(home.active);
  home.wake();home.wake();for(let i=0;i<60;i++)home.update(1/60);
  assert(!home.active);assert.equal(home.night,night);assert.equal(c.state,'Idle');assert.equal(c.actor.position.y,0);assert.equal(c.actor.scale.x,2);assert.equal(c.actor.rotation.x,0);assert.equal(c.achievements.size*3,3);
 }
 const z=c.actor.position.z;c.update(.1,{forward:true,left:false,right:false});assert(c.actor.position.z>z);
});
test('waking during the bed approach returns control without granting an unfinished rest',async()=>{
 const gltf=await model('kirby'),c=new CharacterController(gltf.scene,gltf.animations),home=new KirbyHome();c.actor.position.copy(home.entrance);
 assert(home.start(c));home.update(.1);home.wake();home.update(1);assert(!home.active);assert.equal(c.state,'Idle');assert.equal(c.achievements.size,0);
});

test('forty fireflies alternate flight and rest, have coloured light, and remain active by day',async()=>{
 const world=new NightFireflies(await model('firefly')),camera=new Vector3(0,5,0);assert.equal(world.bugs.length,40);assert.equal(new Set(world.bugs.map(b=>b.color.getHexString())).size,40);
 assert(world.bugs.every(b=>Math.min(b.color.r,b.color.g,b.color.b)<.001));
 assert(world.bugs.every(b=>sceneryClearance(b.home.x,b.home.z)));
 world.update(.1,false,camera);assert(world.group.visible);assert(world.bugs.some(b=>!b.land));
 world.update(.1,true,camera);assert(world.group.visible);const bug=world.bugs[0];let flying=false,resting=false;
 for(let i=0;i<660;i++){world.update(.05,true,bug.home.clone().add(new Vector3(0,3,4)));flying ||= !bug.land;resting ||= bug.land;}
 assert(flying&&resting);
 world.bugs.forEach(b=>b.land=true);assert.equal(world.buzzLevel(bug.carrier.position),0);bug.land=false;assert.equal(world.buzzLevel(bug.carrier.position),1);assert.equal(world.buzzLevel(new Vector3(10000,0,10000)),0);assert(world.lights.some(l=>l.intensity>0));assert(world.lights.length<=4);
 assert(world.bugs.filter(b=>b.firefly.object.visible).length<=5);
 world.update(.1,false,camera);assert(world.group.visible);assert(world.bugs.some(b=>!b.land));
});
test('sky replaces sun with moon and stars at night',()=>{
 const scene=new Scene(),camera=new PerspectiveCamera(),update=createSky(scene);update(.1,camera,false);assert(scene.getObjectByName('Sun disc')!.visible);assert(!scene.getObjectByName('Moon')!.visible);
 update(.1,camera,true);assert(!scene.getObjectByName('Sun disc')!.visible);assert(scene.getObjectByName('Moon')!.visible);assert(scene.getObjectByName('Night stars')!.visible);
 update(.1,camera,false);assert(!scene.getObjectByName('Night stars')!.visible);
});

test('Kirby rides a nearby firefly at double speed, lands on stopping and keeps flight buzz',async()=>{
 const world=new NightFireflies(await model('firefly')),gltf=await model('kirby'),c=new CharacterController(gltf.scene,gltf.animations),bug=world.bugs[0];
 c.actor.position.copy(bug.home);assert(!world.board(c),'No mounts before initial positioning');
 world.update(.01,true,c.actor.position);c.actor.position.copy(bug.carrier.position).setY(0);
 assert(world.prompt(c));assert(world.board(c));assert(!world.board(c));assert(world.riding);
 const start=c.actor.position.clone(),speed=c.speed;
 for(let i=0;i<60;i++){world.moveRider(1/60,{forward:true,left:false,right:false});world.syncRider(1/60);world.update(1/60,true,c.actor.position);}
 assert(Math.abs(c.actor.position.z-start.z-speed*2)<1e-6);assert(!bug.land);assert(bug.carrier.position.y>2);assert(world.buzzLevel(c.actor.position)>=.7);assert(bug.firefly.object.visible);assert.equal(c.state,'FireflyRide');
 const stop=c.actor.position.clone();for(let i=0;i<150;i++){world.moveRider(.02,{forward:false,left:false,right:false});world.syncRider(.02);world.update(.02,true,c.actor.position);}
 assert.equal(c.actor.position.z,stop.z);assert(bug.land);assert.equal(bug.carrier.position.y,0);assert(world.savePosition(c));
 world.disembark();assert(!world.riding);assert.equal(c.state,'Idle');assert.equal(c.actor.position.y,0);assert.equal(world.savePosition(c),undefined);
 c.update(.1,{forward:true,left:false,right:false});assert(c.actor.position.z>stop.z);
});
test('mounted turning, growth and day transition preserve valid state',async()=>{
 const world=new NightFireflies(await model('firefly')),gltf=await model('kirby'),c=new CharacterController(gltf.scene,gltf.animations);
 world.update(.01,true,world.bugs[0].home);c.actor.position.copy(world.bugs[0].carrier.position).setY(0);assert(world.board(c));c.grow();
 for(let i=0;i<60;i++){world.moveRider(1/60,{forward:true,left:false,right:false,steer:.6});world.syncRider(1/60);world.update(1/60,true,c.actor.position);}
 assert(c.yaw>.9);assert(Math.abs(c.actor.scale.x-1.1)<1e-6);assert(!c.flight.active);assert(!c.swimming);
 world.update(.01,false,c.actor.position);assert(world.riding);assert(c.actor.position.y>0);assert(world.buzzLevel(c.actor.position)>=.7);world.disembark();assert(!world.riding);
});

test('daytime fireflies can be mounted and alternate flight with rest',async()=>{
 const world=new NightFireflies(await model('firefly')),gltf=await model('kirby'),c=new CharacterController(gltf.scene,gltf.animations),bug=world.bugs[0];
 let flies=false,rests=false;for(let i=0;i<700;i++){world.update(.05,false,bug.home);flies ||= !bug.land;rests ||= bug.land;}assert(flies&&rests);
 c.actor.position.copy(bug.carrier.position).setY(0);assert(world.board(c));world.moveRider(.1,{forward:true,left:false,right:false});world.syncRider(.1);world.update(.1,false,c.actor.position);assert(world.buzzLevel(c.actor.position)>=.7);assert(bug.firefly.object.visible);
});
