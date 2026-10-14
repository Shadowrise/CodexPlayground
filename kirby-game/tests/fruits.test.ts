import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../src/controller';
import { createNpcs } from '../src/npcs';
import { FruitWorld, FRUIT_TYPES } from '../src/fruits';
const idle = { forward: false, left: false, right: false };

async function setup() {
  const bytes = await readFile(new URL('../public/models/kirby-animated.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return { player: new CharacterController(gltf.scene.clone(true), gltf.animations), npcs: createNpcs(gltf.scene, gltf.animations), world: new FruitWorld() };
}

function isolate(world: FruitWorld) { world.fruits.forEach((f,i)=>f.object.position.set(100+i,0,100)); }
test('close fruit auto-picks from behind, boosts speed without growth and counts once',async()=>{
  const {player,world}=await setup();isolate(world);
  assert.equal(FRUIT_TYPES.length,10);
  const fruit=world.fruits[0];fruit.object.position.set(0,0,-1);
  assert.equal(world.update(.016,player,[]),fruit);
  assert.equal(player.fruitsEaten,1);assert.equal(world.onMap,69);
  assert(!fruit.object.visible);assert.equal(player.actor.scale.x,1);
  assert.equal(player.savedSize,1);assert.equal(player.fruitBoost.multiplier,1.2);assert.equal(player.fruitBoost.remaining,20);
  player.update(.2,{...idle,forward:true});
  assert.equal(player.actor.scale.x,1);
  assert(Math.abs(player.actor.position.z-3.4*1.2*.2)<1e-8,'fruit pickup does not lock movement');
  player.update(.3,idle);assert.equal(player.actor.scale.x,1);
  world.update(1,player,[]);assert.equal(player.fruitsEaten,1);
});
test('distant fruit and fruit beside a riding player are not collected',async()=>{
  const {player,world}=await setup();isolate(world);
  const fruit=world.fruits[0];fruit.object.position.set(0,0,5);
  world.update(1,player,[]);assert(!fruit.eaten);
  fruit.object.position.z=1;
  world.update(1,player,[],true);assert(!fruit.eaten);
  world.update(.016,player,[],false);assert(fruit.eaten);
});
test('NPC auto-pickup boosts speed without growth; rolling NPCs cannot collect',async()=>{
  const {player,npcs,world}=await setup();isolate(world);
  player.actor.position.set(-100,0,-100);
  const npc=npcs[1];npc.actor.position.set(0,0,0);
  world.fruits[0].object.position.set(0,0,1);
  world.update(.016,player,[npc]);
  assert.equal(npc.fruitsEaten,1);assert.equal(world.eatenByNpcs,1);
  assert.equal(npc.actor.scale.x,1);
  npc.update(.2,[]);assert.equal(npc.actor.scale.x,1);assert.equal(npc.fruitBoost.multiplier,1.2);
  npc.fruitBoost.update(10);npc.eatFruit();npc.update(.5,[]);
  assert.equal(npc.actor.scale.x,1);assert.equal(npc.fruitBoost.multiplier,1.4);assert.equal(npc.fruitBoost.remaining,20);
  npc.takeHit();npc.takeHit();npc.takeHit();
  world.fruits[1].object.position.copy(npc.actor.position);
  world.update(4,player,[npc]);assert(!world.fruits[1].eaten);
});
test('successive fruit pickups refresh all stacks, cap at 300%, then expire together',async()=>{
  const {player,world}=await setup();isolate(world);
  const collect=(index:number)=>{world.fruits[index].object.position.copy(player.actor.position);world.update(.5,player,[]);};
  collect(0);player.fruitBoost.update(10);
  assert.equal(player.fruitBoost.remaining,10);assert.equal(player.fruitBoost.multiplier,1.2);
  collect(1);assert.equal(player.fruitBoost.multiplier,1.4);assert.equal(player.fruitBoost.remaining,20);
  for(let i=2;i<10;i++)collect(i);
  assert.equal(player.fruitBoost.multiplier,3);player.fruitBoost.update(19);
  collect(10);assert.equal(player.fruitBoost.multiplier,3);assert.equal(player.fruitBoost.remaining,20);
  assert.equal(player.fruitsEaten,11);assert.equal(player.savedSize,1);
  player.fruitBoost.update(19.99);assert.equal(player.fruitBoost.multiplier,3);
  player.fruitBoost.update(.01);assert.equal(player.fruitBoost.multiplier,1);assert.equal(player.fruitBoost.remaining,0);
  assert.equal(player.speed,3.4);assert.equal(player.backwardSpeed,1.65);
  collect(11);assert.equal(player.fruitBoost.multiplier,1.2);assert.equal(player.fruitsEaten,12);
});
test('player and NPC cannot both collect the same fruit',async()=>{
  const {player,npcs,world}=await setup();isolate(world);
  npcs[1].actor.position.copy(player.actor.position);
  world.fruits[0].object.position.set(0,0,1);
  world.update(.016,player,[npcs[1]]);
  assert.equal(player.fruitsEaten,1);assert.equal(npcs[1].fruitsEaten,0);
  assert.equal(world.onMap,69);
});
