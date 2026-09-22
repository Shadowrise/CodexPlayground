import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3, InstancedMesh } from 'three';
import { CharacterController } from '../src/controller';
import { Treehouse, TREEHOUSE_SITE, type TreehouseSound } from '../src/treehouse';
import { sceneryClearance } from '../src/landmarks';
async function character(){const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return new CharacterController(gltf.scene,gltf.animations);}
const idle={forward:false,left:false,right:false};
test('climb, explore, leap into leaves and recover normal controls without losing size',async()=>{
  const sounds:TreehouseSound[]=[],house=new Treehouse(kind=>sounds.push(kind)),c=await character();
  c.actor.scale.setScalar(1.5);c.actor.position.copy(TREEHOUSE_SITE).add(new Vector3(-4,0,11));
  assert(house.prompt(c.actor.position));house.interact(c);assert(house.active);
  for(let i=0;i<220;i++)house.update(1/60);
  assert.equal(c.state,'Lookout');assert.equal(c.actor.position.y,9);
  for(let i=0;i<600;i++)house.update(1/60,{...idle,forward:true});
  assert(c.actor.position.z>=TREEHOUSE_SITE.z+2.5 && c.actor.position.z<=TREEHOUSE_SITE.z+7);
  house.update(1/60,idle,true);assert.equal(c.state,'LeafDive');
  for(let i=0;i<150;i++)house.update(1/60);
  assert(!house.active);assert.equal(c.actor.position.y,0);assert.equal(c.actor.scale.x,1.5);
  assert.equal(c.state,'Idle');assert.equal(c.animationRoot.scale.y,1);
  assert(sounds.includes('ladder') && sounds.includes('leaves') && sounds.includes('cheer'));
  const z=c.actor.position.z;c.update(.1,{...idle,forward:true});assert(c.actor.position.z>z);
});
test('swing mounts smoothly, moves with the ropes and can be left using interaction',async()=>{
  const sounds:TreehouseSound[]=[],house=new Treehouse(kind=>sounds.push(kind)),c=await character();
  c.actor.position.copy(TREEHOUSE_SITE).add(new Vector3(-11,0,3));house.interact(c);house.update(1/60);
  assert(c.actor.position.y<.05);for(let i=0;i<120;i++)house.update(1/60);
  assert.equal(c.state,'Swing');const position=c.actor.position.clone();house.update(.2);assert(position.distanceTo(c.actor.position)>.01);
  assert(sounds.includes('creak'));house.interact(c);assert(!house.active);assert.equal(c.actor.position.y,0);assert.equal(c.actor.rotation.x,0);
});
test('treehouse clearing and trunk collision keep scenery clear; detail is batched',()=>{
  const house=new Treehouse(),trunk=TREEHOUSE_SITE.clone().add(new Vector3(0,0,-6)),p=trunk.clone();house.constrain(p,1);
  assert(p.distanceTo(trunk)>=3);assert(!sceneryClearance(TREEHOUSE_SITE.x,TREEHOUSE_SITE.z));
  let batches=0,parts=0;house.group.traverse(node=>{if(node instanceof InstancedMesh){batches++;parts+=node.count;}});
  assert(parts>1000);assert(batches<85);
});
