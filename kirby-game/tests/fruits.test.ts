import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController,type Input } from '../src/controller';
import { createNpcs } from '../src/npcs';
import { FruitWorld, FRUIT_TYPES } from '../src/fruits';
import {createPigeon} from '../src/pigeon-model';
const idle = { forward: false, left: false, right: false };

async function setup() {
  const bytes = await readFile(new URL('../public/models/kirby-animated.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return { player: new CharacterController(gltf.scene.clone(true), gltf.animations), npcs: createNpcs(gltf.scene, gltf.animations), world: new FruitWorld() };
}

function isolate(world: FruitWorld) { world.fruits.forEach((f,i)=>f.object.position.set(100+i,0,100)); }
function advance(world:FruitWorld,player:CharacterController,seconds:number,input:Input=idle){
  for(let elapsed=0;elapsed<seconds-1e-8;){const dt=Math.min(1/60,seconds-elapsed);player.update(dt,input);world.update(dt,player,[]);elapsed+=dt;}
}
test('close fruit from behind visibly inhales before swallowing and boosts speed once without growth',async()=>{
  const {player,world}=await setup();isolate(world);
  assert.equal(FRUIT_TYPES.length,10);
  const fruit=world.fruits[0];fruit.object.position.set(0,0,-1);
  assert.equal(world.update(.016,player,[]),undefined);
  assert.equal(player.fruitsEaten,0);assert(fruit.object.visible);
  advance(world,player,.5);assert(fruit.object.visible);assert(!fruit.eaten);
  assert(fruit.object.scale.x<2.5);assert(fruit.object.position.y>0);
  advance(world,player,.4);
  assert.equal(player.fruitsEaten,1);assert.equal(world.onMap,69);
  assert(!fruit.object.visible);assert.equal(player.actor.scale.x,1);
  assert.equal(player.savedSize,1);assert.equal(player.fruitBoost.multiplier,1.2);assert.equal(player.fruitBoost.remaining,20);
  player.update(.2,{...idle,forward:true});
  assert.equal(player.actor.scale.x,1);
  assert(Math.abs(player.actor.position.z-6.8*1.2*.2)<1e-8,'fruit pickup does not lock movement');
  player.update(.3,idle);assert.equal(player.actor.scale.x,1);
  world.update(1,player,[]);assert.equal(player.fruitsEaten,1);
});
test('distant fruit and fruit beside a riding player are not collected',async()=>{
  const {player,world}=await setup();isolate(world);
  const fruit=world.fruits[0];fruit.object.position.set(0,0,5);
  world.update(1,player,[]);assert(!fruit.eaten);
  fruit.object.position.z=1;
  world.update(1,player,[],true);assert(!fruit.eaten);
  world.update(.016,player,[],false);assert(!fruit.eaten);advance(world,player,.9);assert(fruit.eaten);
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
  const collect=(index:number)=>{world.fruits[index].object.position.copy(player.actor.position);world.update(0,player,[]);advance(world,player,1.3);};
  collect(0);player.fruitBoost.update(10);
  assert.equal(player.fruitBoost.remaining,10);assert.equal(player.fruitBoost.multiplier,1.2);
  collect(1);assert.equal(player.fruitBoost.multiplier,1.4);assert.equal(player.fruitBoost.remaining,20);
  for(let i=2;i<10;i++)collect(i);
  assert.equal(player.fruitBoost.multiplier,3);player.fruitBoost.update(19);
  collect(10);assert.equal(player.fruitBoost.multiplier,3);assert.equal(player.fruitBoost.remaining,20);
  assert.equal(player.fruitsEaten,11);assert.equal(player.savedSize,1);
  player.fruitBoost.update(19.99);assert.equal(player.fruitBoost.multiplier,3);
  player.fruitBoost.update(.01);assert.equal(player.fruitBoost.multiplier,1);assert.equal(player.fruitBoost.remaining,0);
  assert.equal(player.speed,6.8);assert.equal(player.backwardSpeed,1.65);
  collect(11);assert.equal(player.fruitBoost.multiplier,1.2);assert.equal(player.fruitsEaten,12);
});
test('player and NPC cannot both collect the same fruit',async()=>{
  const {player,npcs,world}=await setup();isolate(world);
  npcs[1].actor.position.copy(player.actor.position);
  world.fruits[0].object.position.set(0,0,1);
  world.update(.016,player,[npcs[1]]);
  assert.equal(npcs[1].fruitsEaten,0,'the player reserves fruit throughout the inhale');
  advance(world,player,.9);
  assert.equal(player.fruitsEaten,1);assert.equal(npcs[1].fruitsEaten,0);
  assert.equal(world.onMap,69);
});

test('inhale starts well before contact, follows a turning runner, and leaves feet and controls free',async()=>{
 const {player,world}=await setup();isolate(world);
 const fruit=world.fruits[0];fruit.object.position.set(0,0,3.8);
 world.update(0,player,[]);advance(world,player,.20);
 assert(fruit.object.position.z<3.8,'fruit starts moving while the actor is still at the origin');
 assert.equal(player.actor.position.z,0);assert.equal(player.fruitsEaten,0);
 const mouth=player.actor.getObjectByName('Open_smiling_mouth') as Mesh;
 assert(mouth.morphTargetInfluences!.some(v=>v>.9),'the round mouth opens during the approach');
 advance(world,player,.45,{...idle,forward:true,right:true});
 assert(player.actor.position.length()>.8);assert(player.yaw<-.5);assert.equal(player.state,'Run');
 const center=new Vector3(0,.4,0);fruit.object.localToWorld(center);
 assert(center.distanceTo(player.fruitEating.mouthPosition(new Vector3()))<.6,'the last approach follows the current face position');
 advance(world,player,.3,{...idle,forward:true});assert.equal(player.fruitsEaten,1);
 advance(world,player,.5);
 assert(mouth.morphTargetInfluences!.every(v=>v===0),'the overlay releases the face after the swallow');
});

test('jumping cancels the inhale, restores the instanced fruit and awards no points',async()=>{
 const {player,world}=await setup();isolate(world);const fruit=world.fruits[0];fruit.object.position.set(0,0,3);
 world.syncInstances();const meshes=world.group.children.filter(o=>o instanceof InstancedMesh) as InstancedMesh[];
 world.update(0,player,[]);advance(world,player,.4);world.syncInstances();
 player.update(.02,{...idle,jump:true});world.update(.02,player,[]);world.syncInstances();
 assert(!fruit.eaten);assert(fruit.object.visible);assert.equal(player.fruitsEaten,0);
 assert.deepEqual(fruit.object.position.toArray(),[0,0,3]);assert.equal(fruit.object.scale.x,2.5);
 const matrix=new Matrix4();let restored=false;
 for(const mesh of meshes)for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);if(Math.abs(matrix.elements[14]-3)<.001)restored=true;}
 assert(restored,'render matrices return to the fruit origin even if visibility did not change');
});

test('pigeon opens its articulated beak, reaches with its neck and swallows at the beak',async()=>{
 const {world}=await setup();isolate(world);const {root,clips}=createPigeon(),wrapper=new Group();wrapper.add(root);
 const player=new CharacterController(wrapper,clips),jaw=player.actor.getObjectByName('Lower_beak')!,neck=player.actor.getObjectByName('Neck')!;
 world.fruits[0].object.position.set(0,0,3.4);world.update(0,player,[]);advance(world,player,.42);
 assert(jaw.rotation.x>.5);assert(neck.position.z>.50);assert.equal(player.fruitsEaten,0);
 advance(world,player,.4);assert(world.fruits[0].object.visible);
 const position=world.fruits[0].object.position;assert(position.y>2,'the fruit travels to the high beak instead of the torso');
 advance(world,player,.1);assert.equal(player.fruitsEaten,1);assert(!world.fruits[0].object.visible);
 advance(world,player,.5);assert(Math.abs(jaw.rotation.x)<.01);assert(Math.abs(neck.scale.z-1)<.001);
});

test('online pickup waits for the swallow and server confirmation, without duplicate claims',async()=>{
 const {player,world}=await setup();isolate(world);const fruit=world.fruits[0];fruit.object.position.set(0,0,3.4);
 const claims:number[]=[];world.claim=index=>claims.push(index);
 world.update(0,player,[]);advance(world,player,.7);assert.deepEqual(claims,[]);
 advance(world,player,.2);assert.deepEqual(claims,[0]);assert.equal(player.fruitsEaten,0);assert(!world.isVisible(0));
 advance(world,player,.6);assert.deepEqual(claims,[0]);assert(!world.isVisible(0));
 world.confirm(0,player);assert(!world.isVisible(0),'a late acknowledgement must not replay the local inhale');player.eatFruit();advance(world,player,3.5);
 assert.equal(player.fruitsEaten,1);assert(fruit.eaten);assert(!world.isVisible(0));assert.deepEqual(claims,[0]);
});

test('restoring a save during inhale resets fruit transforms and the face',async()=>{
 const {player,world}=await setup();isolate(world);const fruit=world.fruits[0];fruit.object.position.set(0,0,3.4);
 world.update(0,player,[]);advance(world,player,.4);world.restore(world.fruits.map(()=>false),0);
 assert.deepEqual(fruit.object.position.toArray(),[0,0,3.4]);assert.equal(fruit.object.scale.x,2.5);assert(fruit.object.visible);
 const mouth=player.actor.getObjectByName('Open_smiling_mouth') as Mesh;assert(mouth.morphTargetInfluences!.every(v=>v===0));
 assert.equal(player.fruitsEaten,0);
});

test('boosted running starts sucking fruit earlier than a stationary pickup and still allows movement',async()=>{
 const {player,world}=await setup();isolate(world);const fruit=world.fruits[0];fruit.object.position.set(0,0,13);
 for(let i=0;i<10;i++)player.eatFruit();
 world.update(0,player,[]);assert.equal(player.fruitsEaten,10);assert.equal(fruit.object.position.z,13);
 advance(world,player,.2,{...idle,forward:true});
 assert(player.actor.position.z>4);assert(fruit.object.position.z!==13,'anticipation accounts for actual boosted running speed');
 advance(world,player,.75,{...idle,forward:true});
 assert(fruit.eaten);assert.equal(player.fruitsEaten,11);assert(player.actor.position.z>18);
});

test('a competing online collector cancels the local reservation and gets one visible remote inhale',async()=>{
 const {player,world}=await setup();isolate(world);const fruit=world.fruits[0];fruit.object.position.set(0,0,3.4);
 world.update(0,player,[]);advance(world,player,.35);
 const {root,clips}=createPigeon(),wrapper=new Group();wrapper.add(root);const remote=new CharacterController(wrapper,clips);remote.actor.position.x=1.5;
 world.confirm(0,remote);assert(fruit.eaten);assert(world.isVisible(0));
 advance(world,player,.45);assert(world.isVisible(0));assert.equal(player.fruitsEaten,0);
 advance(world,player,.6);assert(!world.isVisible(0));assert.equal(player.fruitsEaten,0);assert.equal(remote.fruitsEaten,0,'room accounting owns remote points');
});
