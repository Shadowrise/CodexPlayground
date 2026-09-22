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
test('sleep switches time only under blackout, then restores movement; second sleep restores day',async()=>{
 const gltf=await model('kirby'),c=new CharacterController(gltf.scene,gltf.animations),home=new KirbyHome();c.actor.position.copy(home.entrance);c.actor.scale.setScalar(2);
 for(const expected of [true,false]){
  assert(home.start(c));assert(!home.start(c));assert(home.savePosition(c));let flips=0;
  for(let i=0;i<330;i++){const night=home.night;home.update(1/60);if(night!==home.night){flips++;assert.equal(home.blackout,1);}}
  assert.equal(flips,1);assert.equal(home.night,expected);assert(!home.active);assert.equal(home.blackout,0);assert.equal(c.state,'Idle');assert.equal(c.actor.position.y,0);assert.equal(c.actor.scale.x,2);assert.equal(c.actor.rotation.x,0);
 }
 const z=c.actor.position.z;c.update(.1,{forward:true,left:false,right:false});assert(c.actor.position.z>z);
});
test('twenty fireflies alternate flight and rest, have coloured light, and disappear by day',async()=>{
 const world=new NightFireflies(await model('firefly')),camera=new Vector3(0,5,0);assert.equal(world.bugs.length,20);assert.equal(new Set(world.bugs.map(b=>b.color.getHexString())).size,20);
 assert(world.bugs.every(b=>sceneryClearance(b.home.x,b.home.z)));
 world.update(.1,false,camera);assert(!world.group.visible);assert(world.lights.every(l=>l.intensity===0));
 world.update(.1,true,camera);assert(world.group.visible);const bug=world.bugs[0];let flying=false,resting=false;
 for(let i=0;i<660;i++){world.update(.05,true,bug.home.clone().add(new Vector3(0,3,4)));flying ||= !bug.land;resting ||= bug.land;}
 assert(flying&&resting);assert(world.lights.some(l=>l.intensity>0));assert(world.lights.length<=4);
 assert(world.bugs.filter(b=>b.firefly.object.visible).length<=5);
 world.update(.1,false,camera);assert(!world.group.visible);assert(world.lights.every(l=>l.intensity===0));
});
test('sky replaces sun with moon and stars at night',()=>{
 const scene=new Scene(),camera=new PerspectiveCamera(),update=createSky(scene);update(.1,camera,false);assert(scene.getObjectByName('Sun disc')!.visible);assert(!scene.getObjectByName('Moon')!.visible);
 update(.1,camera,true);assert(!scene.getObjectByName('Sun disc')!.visible);assert(scene.getObjectByName('Moon')!.visible);assert(scene.getObjectByName('Night stars')!.visible);
 update(.1,camera,false);assert(!scene.getObjectByName('Night stars')!.visible);
});
