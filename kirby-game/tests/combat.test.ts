import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Mesh, MeshStandardMaterial, Quaternion } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../src/controller';
import { createNpcs } from '../src/npcs';
import { resolveAttack } from '../src/combat';
const idle = { forward: false, left: false, right: false };
async function setup() {
  const bytes = await readFile(new URL('../public/models/kirby-animated.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const npcs = createNpcs(gltf.scene, gltf.animations);
  return { player: new CharacterController(gltf.scene, gltf.animations), npcs };
}
test('a held push yields one impulse, both arms reach forward, and nobody loses health',async()=>{
 const {player,npcs}=await setup(),npc=npcs[0];npc.actor.position.set(0,0,2.4);let hits=0,armMotion=false;
 const arm=player.actor.getObjectByName('Right_shoulder')!,initial=arm.quaternion.clone();
 for(let i=0;i<180;i++){player.update(1/60,{...idle,attack:true});if(player.state==='Push'&&arm.quaternion.angleTo(initial)>.5)armMotion=true;if(resolveAttack(player,[npc]))hits++;npc.update(1/60,[]);}
 assert.equal(hits,1);assert(armMotion);assert.equal(npc.health,3);assert(!npc.isDown);assert(npc.actor.position.z>5);assert.equal(player.state,'Idle');
});
test('only the nearest target in front rolls, in the direction of the push',async()=>{
 const {player,npcs}=await setup(),[front,behind,far,side]=npcs;front.actor.position.set(0,0,2.4);behind.actor.position.set(0,0,-2);far.actor.position.set(0,0,4);side.actor.position.set(2.5,0,0);
 player.attackHit=true;assert.equal(resolveAttack(player,[behind,far,side,front]),front);assert.equal(resolveAttack(player,npcs),undefined);
 assert.deepEqual([front.state,behind.state==='Roll',far.state==='Roll',side.state==='Roll'],['Roll',false,false,false]);const initial=front.actor.position.clone();
 front.update(.3,[]);assert(front.animationRoot.quaternion.angleTo(new Quaternion())>1);assert(front.actor.position.z>initial.z);assert.equal(front.actor.position.x,initial.x);
});
test('repeated pushes never flash red or cause sleep, and roll restores the model',async()=>{
 const {npcs}=await setup(),n=npcs[0];n.actor.position.set(0,0,0);let skin:MeshStandardMaterial|undefined;n.model.traverse(o=>{if(o instanceof Mesh&&o.name.startsWith('Body'))skin=o.material as MeshStandardMaterial;});const color=skin!.color.clone();
 for(let i=0;i<5;i++){assert(n.takePush(1,0));assert(!n.takePush(1,0));for(let j=0;j<20;j++)n.update(.05,[]);assert.equal(n.health,3);assert(!n.isDown);assert(!n.roll.active);assert(skin!.color.equals(color));assert.equal(n.actor.position.y,0);assert(n.animationRoot.quaternion.angleTo(new Quaternion())<.01);}
 assert(n.actor.position.x>20);
});
test('push has one contact at .23 seconds and recovers in .62 seconds',async()=>{
 const {player}=await setup();let time=0,hitTime=0;do{player.update(.01,{...idle,attack:true});time+=.01;if(player.attackHit)hitTime=time;}while(player.state==='Push'&&time<4);assert(Math.abs(hitTime-.23)<.02);assert(Math.abs(time-.62)<.02);
});
test('one push rolls a firefly rider off without teleporting to the ground or sleeping',async()=>{
 const {player,npcs}=await setup(),n=npcs[0];n.beginFirefly(0);n.actor.position.set(0,6,2);player.attackHit=true;assert.equal(resolveAttack(player,[n]),n);assert.equal(n.state,'Roll');assert.equal(n.fireflyIndex,undefined);assert.equal(n.actor.position.y,6);
 n.update(.2,[]);assert(n.actor.position.y>0&&n.actor.position.y<6);for(let i=0;i<60&&n.roll.active;i++)n.update(.05,[]);assert(!n.roll.active);assert(!n.isDown);assert.equal(n.actor.position.y,0);assert(n.actor.position.z>5);
});
test('players tumble and regain controls with their size and points intact',async()=>{
 const {player}=await setup();player.fruitsEaten=4;player.actor.scale.setScalar(1.4);player.setActivity('FireflyRide');player.actor.position.set(0,6,0);assert(player.takePush(1,0));
 for(let i=0;i<80&&player.roll.active;i++)player.update(.025,idle);assert(!player.roll.active);assert.equal(player.state,'Idle');assert.equal(player.actor.position.y,0);assert(player.actor.position.x>5);assert.equal(player.fruitsEaten,4);assert.equal(player.actor.scale.x,1.4);
 const z=player.actor.position.z;player.update(.1,{...idle,forward:true});assert(player.actor.position.z>z);
});
