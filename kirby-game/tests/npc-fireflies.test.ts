import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3} from 'three';
import {CharacterController} from '../src/controller';
import {NightFireflies} from '../src/night-fireflies';
import {KirbyNpc,createNpcs} from '../src/npcs';
import {KIRBY_VARIANTS} from '../src/variants';
import {actorState,applyActor} from '../src/network-actors';
import {validActor} from '../src/network-protocol';
async function model(name:string){const b=await readFile(new URL(`../public/models/${name}-animated.glb`,import.meta.url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
async function setup(){const [k,b]=await Promise.all([model('kirby'),model('firefly')]);const n=new KirbyNpc(k.scene,k.animations,0,KIRBY_VARIANTS[1]),world=new NightFireflies(b);world.update(0,false,new Vector3());const bug=world.bugs[0];bug.phase=25;world.update(0,false,new Vector3());n.actor.position.copy(bug.home);n.networkAnimate('Idle',0);return {n,world,k,b};}
test('NPC occasionally boards, flies, earns first-ride points and returns to walking',async()=>{
 const {n,world}=await setup();world.prepareNpcs([n],true,2);assert.equal(n.fireflyIndex,undefined);world.prepareNpcs([n],true,1);assert.equal(n.fireflyIndex,0);assert(!n.canEat);assert(!n.canBoardBalloon);assert(!n.takeHit());assert.equal(world.savePosition(n)!.y,0);
 let airborne=false;for(let i=0;i<900;i++){world.prepareNpcs([n],true,0);n.update(.05,[]);world.update(.05,false,n.actor.position);world.syncNpcRiders([n],true,.05);airborne ||= n.actor.position.y>4;if(n.fireflyIndex===undefined)break;}
 assert(airborne);assert.equal(n.fireflyIndex,undefined);assert.equal(n.actor.position.y,0);assert(n.achievements.has('firefly'));
});
test('guests do not start rides, preserve seated pose and align firefly with interpolated NPC',async()=>{
 const {n,world,k}=await setup();world.prepareNpcs([n],false,100);assert.equal(n.fireflyIndex,undefined);n.beginFirefly(0);n.actor.position.set(30,7,40);n.actor.scale.setScalar(2);const state=actorState(n,n.variant[0],1);assert(validActor(state));const peer=new KirbyNpc(k.scene,k.animations,1,KIRBY_VARIANTS[2]);applyActor(peer,state,.016,true);world.prepareNpcs([peer],false,0);world.syncNpcRiders([peer],false,.016);
 assert(Math.abs(world.bugs[0].carrier.position.x-30)<1e-8);assert(Math.abs(world.bugs[0].carrier.position.z-40)<1e-8);assert(Math.abs(world.bugs[0].firefly.object.scale.x-3.6)<1e-8);assert(Math.abs(world.bugs[0].carrier.position.y+3.6*.95-peer.actor.position.y)<1e-8);
});
test('player reservation takes priority over an NPC ride',async()=>{const {n,world}=await setup();world.bugs.forEach((_,i)=>world.networkBlocked.add(i));world.prepareNpcs([n],true,3);assert.equal(n.fireflyIndex,undefined);world.networkBlocked.clear();n.beginFirefly(0);world.prepareNpcs([n],true,0);world.networkBlocked.add(0);world.syncNpcRiders([n],true,.016);assert.equal(n.fireflyIndex,undefined);assert.equal(n.actor.position.y,0);});

test('NPC seeks a firefly beyond the former eight-metre boarding radius',async()=>{
 const {n,world}=await setup();const b=world.bugs[0];n.actor.position.copy(b.home).add(new Vector3(15,0,0));world.bugs.forEach((_,i)=>{if(i!==0)world.networkBlocked.add(i);});world.prepareNpcs([n],true,3);assert(n.approachingFirefly);
 let flew=false;for(let i=0;i<700;i++){world.prepareNpcs([n],true,.05);n.update(.05,[]);world.update(.05,false,n.actor.position);world.syncNpcRiders([n],true,.05);if(n.fireflyIndex===0&&!n.approachingFirefly&&n.actor.position.y>4){flew=true;break;}}
 assert(flew,'walks to the waiting point and flies after boarding');
});
test('normal meadow NPC population starts flights during the first minute and a half',async()=>{
 const {world,k}=await setup();const npcs=createNpcs(k.scene,k.animations,KIRBY_VARIANTS[0]);let flew=false;
 for(let i=0;i<900;i++){world.prepareNpcs(npcs,true,.1,new Vector3());for(const n of npcs)n.update(.1,npcs.map(p=>p.actor.position));world.update(.1,false,new Vector3());world.syncNpcRiders(npcs,true,.1);if(npcs.some(n=>n.fireflyIndex!==undefined&&!n.approachingFirefly&&n.actor.position.y>4)){flew=true;break;}}
 assert(flew,'ordinary starting distribution produces an airborne passenger');
});

test('finished ride enforces a 30 second personal cooldown before another approach',async()=>{
 const {n,world}=await setup();n.beginFirefly(0);n.update(13,[]);world.prepareNpcs([n],true,0);world.syncNpcRiders([n],true,.01);assert.equal(n.fireflyIndex,undefined);
 for(let i=0;i<29;i++){n.networkAnimate('Idle',0);world.prepareNpcs([n],true,1);assert.equal(n.fireflyIndex,undefined);}
 // After the cooldown the regular search cadence is allowed to choose a ride again.
 n.networkAnimate('Idle',0);world.prepareNpcs([n],true,9);assert.notEqual(n.fireflyIndex,undefined);
});
test('player can take a bug targeted by an approaching NPC, and stale occupant records do not block boarding',async()=>{
 const {n,world,k}=await setup(),c=new CharacterController(k.scene,k.animations);c.actor.position.copy(world.bugs[0].home);
 n.beginFireflyApproach(0);world.prepareNpcs([n],false,0);assert.equal(world.networkKey(c),'bug:0');assert(world.board(c));world.prepareNpcs([n],true,.01);assert.equal(n.fireflyIndex,undefined);world.disembark();
 n.beginFirefly(0);world.prepareNpcs([n],false,0);assert.equal(world.networkKey(c),undefined);n.endBalloon();assert.equal(world.networkKey(c),'bug:0');assert(world.board(c));
});
