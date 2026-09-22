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
test('close fruit auto-picks from behind, grows smoothly and counts once',async()=>{
  const {player,world}=await setup();isolate(world);
  assert.equal(FRUIT_TYPES.length,10);
  const fruit=world.fruits[0];fruit.object.position.set(0,0,-1);
  assert.equal(world.update(.016,player,[]),fruit);
  assert.equal(player.fruitsEaten,1);assert.equal(world.onMap,69);
  assert(!fruit.object.visible);assert.equal(player.actor.scale.x,1);
  player.update(.2,{...idle,forward:true});
  assert(player.actor.scale.x>1 && player.actor.scale.x<1.1);
  assert(player.actor.position.z>0,'growth does not lock movement');
  player.update(.3,idle);assert.equal(player.actor.scale.x,1.1);
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
test('NPC auto-pickup grows smoothly; fallen NPCs cannot collect',async()=>{
  const {player,npcs,world}=await setup();isolate(world);
  player.actor.position.set(-100,0,-100);
  const npc=npcs[1];npc.actor.position.set(0,0,0);
  world.fruits[0].object.position.set(0,0,1);
  world.update(.016,player,[npc]);
  assert.equal(npc.fruitsEaten,1);assert.equal(world.eatenByNpcs,1);
  assert.equal(npc.actor.scale.x,1);
  npc.update(.2,[]);assert(npc.actor.scale.x>1 && npc.actor.scale.x<1.1);
  npc.update(.3,[]);assert.equal(npc.actor.scale.x,1.1);
  npc.grow();npc.update(.5,[]);
  assert(Math.abs(npc.actor.scale.x-1.2)<1e-9,'each fruit adds ten percent of the initial size');
  npc.takeHit();npc.takeHit();npc.takeHit();
  world.fruits[1].object.position.copy(npc.actor.position);
  world.update(4,player,[npc]);assert(!world.fruits[1].eaten);
});
test('player and NPC cannot both collect the same fruit',async()=>{
  const {player,npcs,world}=await setup();isolate(world);
  npcs[1].actor.position.copy(player.actor.position);
  world.fruits[0].object.position.set(0,0,1);
  world.update(.016,player,[npcs[1]]);
  assert.equal(player.fruitsEaten,1);assert.equal(npcs[1].fruitsEaten,0);
  assert.equal(world.onMap,69);
});
test('fallen head/body touches the ground at normal and enlarged sizes', async () => {
  const { npcs } = await setup();
  for (const scale of [1, 1.61]) {
    const npc = npcs[scale === 1 ? 0 : 1]; npc.actor.scale.setScalar(scale);
    npc.takeHit(); npc.takeHit(); npc.takeHit();
    npc.update(1.81, []);
    let body: Mesh | undefined;
    npc.model.traverse(o => { if (o instanceof Mesh && o.name.startsWith('Body')) body = o; });
    const positions = body!.geometry.getAttribute('position'), p = new Vector3();
    let minY = Infinity;
    for (let i = 0; i < positions.count; i++) { p.fromBufferAttribute(positions, i).applyMatrix4(body!.matrixWorld); minY = Math.min(minY, p.y); }
    assert(Math.abs(minY + .02) < .003, `Body should rest on the floor, got ${minY}`);
  }
});
