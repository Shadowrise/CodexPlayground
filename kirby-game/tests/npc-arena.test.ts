import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BOSS_ARENA as A,constrainArena,constrainNpcOutsideArena} from '../src/boss-arena-site';
import {createNpcs} from '../src/npcs';

const distance=(p:{x:number;z:number})=>Math.hypot(p.x-A.x,p.z-A.z);

test('NPC arena boundary recovers saved/spawned positions and respects size and airborne movement',()=>{
 for(const size of [1,4,7])for(const y of [0,8]){
  for(const offset of [0,20,45]){
   const p={x:A.x+offset,y,z:A.z};
   constrainNpcOutsideArena(p,size);assert(distance(p)>=A.radius+.6*size-1e-8);assert.equal(p.y,y);
   const safe={...p};constrainNpcOutsideArena(p,size);assert(Math.hypot(p.x-safe.x,p.z-safe.z)<1e-8);
  }
 }
 const p={x:A.x,y:0,z:A.z};constrainNpcOutsideArena(p,1,{x:A.x-60,z:A.z});assert(p.x<A.x);
 const outside={x:A.x+70,y:0,z:A.z},before={...outside};constrainNpcOutsideArena(outside,1);assert.deepEqual(outside,before);
 // The separate player constraint keeps the entrance and centre accessible.
 for(const z of [A.entry.z,A.z]){const player={x:A.x,y:0,z},before={...player};constrainArena(player,1);assert.deepEqual(player,before);}
});

test('walking and running NPCs turn before the arena and continue along a free direction',async()=>{
 const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 for(const size of [1,4])for(const state of ['Walk','Run']){
  const npc=createNpcs(gltf.scene,gltf.animations)[0];npc.actor.scale.setScalar(size);
  npc.actor.position.set(A.x-A.radius-.6*size-.15,0,A.z);npc.yaw=Math.PI/2;npc.actor.rotation.y=npc.yaw;npc.networkAnimate(state,0);
  const start=npc.actor.position.clone();let turned=false;
  for(let frame=0;frame<60;frame++){
   const previous=npc.actor.position.clone();npc.update(1/30,[],constrainNpcOutsideArena);
   turned ||= npc.state.startsWith('Rotate');
   assert(distance(npc.actor.position)>=A.radius+.6*size-1e-8,'never enters the arena');
   const checked=npc.actor.position.clone();constrainNpcOutsideArena(checked,size,previous);
   assert(checked.distanceTo(npc.actor.position)<1e-8,'avoidance prevents collision correction');
  }
  assert(turned);assert(Math.abs(npc.actor.position.z-start.z)>1,'resumes moving outside the arena');
 }
});
