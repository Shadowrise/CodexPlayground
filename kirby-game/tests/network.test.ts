import {Object3D} from 'three';
import {NetworkSession} from '../src/network';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createNpcs} from '../src/npcs';
import {KIRBY_VARIANTS} from '../src/variants';
import {Coaster} from '../src/coaster';
import {Balloons} from '../src/balloons';
import {NightFireflies} from '../src/night-fireflies';
import {actorState} from '../src/network-actors';
import {validActor,validWorld} from '../src/network-protocol';
async function model(name:string){const data=await readFile(new URL('../public/models/'+name,import.meta.url));return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');}
test('actual world fits the shared wire contract and attachment budget',async()=>{
 const [gltf,bugs]=await Promise.all([model('kirby-animated.glb'),model('firefly-animated.glb')]);
 const npcs=createNpcs(gltf.scene,gltf.animations,KIRBY_VARIANTS[0]),coaster=new Coaster(),balloons=new Balloons(),fireflies=new NightFireflies(bugs);
 const round=(rows:number[][])=>rows.map(row=>row.map(x=>Math.round(x*1000)/1000));
 const w={npcs:npcs.map(n=>actorState(n,n.variant[0],KIRBY_VARIANTS.indexOf(n.variant))),npcLife:round(npcs.map(n=>n.networkLife())),carts:round(coaster.networkState()),balloons:balloons.networkState().map(r=>r.map(x=>typeof x==='number'?Math.round(x*1000)/1000:x)),bugs:round(fireflies.networkState())};
 assert(validWorld(w));assert(new TextEncoder().encode(JSON.stringify(w)).length<11000);
 await writeFile(tmpdir()+'/kirby-network-world.json',JSON.stringify(w));
 assert(!validWorld({...w,npcLife:[[]]}));assert(!validActor({...w.npcs[0],p:[Infinity,0,0]}));
 coaster.networkApply(w.carts);balloons.networkApply(w.balloons,npcs);fireflies.networkApply(w.bugs);
 assert.deepEqual(round(coaster.networkState()),w.carts);
 assert(validActor({...w.npcs[0],ride:{key:'bug:0',data:w.bugs[0]}}));
 w.bugs[0][9]=3.6;fireflies.networkApply(w.bugs);assert.equal(fireflies.networkState()[0][9],3.6);
});

test('malformed peer payloads fail validation without throwing',()=>{
 for(const value of [null,{},[],{ride:{key:7,data:[]}},{balloons:[null,null,null]}]){
  assert.equal(validActor(value),false);assert.equal(validWorld(value),false);
 }
});

test('solo checkpoints reduce messages while multiplayer keeps its update cadence',()=>{
 const actor={p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Test',variant:0,star:0};
 const count=(peers:number)=>{
  const session=new NetworkSession();session.id='host';session.room={id:'test',host:'host',epoch:0,fruits:[],starAt:0,mill:false,locks:{}};session.peerCount=peers;
  const messages:any[]=[];(session as any).socket={readyState:1,bufferedAmount:0,send:(s:string)=>messages.push(JSON.parse(s))};
  for(let i=0;i<3000;i++){actor.p[0]=i/10;session.tick(.1,actor,()=>({} as any));}
  session.event({type:'mill'});session.tick(.1,actor,()=>({} as any));assert(messages.at(-1).events.some((e:any)=>e.type==='mill'));
  return messages.length;
 };
 assert(count(1)<=151);assert.equal(count(2),3001);
});

test('remote firefly follows interpolated rider and ignores conflicting world snapshots',async()=>{
 const fireflies=new NightFireflies(await model('firefly-animated.glb'));
 const actor=new Object3D();actor.position.set(5,4,0);
 const state={p:[10,4,0],ride:{key:'bug:0',data:[0,0,0,0,10,2,0,0,0,2]}} as any;
 fireflies.networkBlocked.add(0);fireflies.syncRemoteRider(0,{actor} as any,state,.016);
 const bug=fireflies.bugs[0];assert.equal(bug.carrier.position.x,5);assert.equal(bug.carrier.position.y,2);
 const snapshot=fireflies.networkState();snapshot[0][4]=100;fireflies.networkApply(snapshot);assert.equal(bug.carrier.position.x,5);
 actor.position.x=6;fireflies.syncRemoteRider(0,{actor} as any,state,.016);assert.equal(bug.carrier.position.x,6);
 assert(bug.firefly.object.scale.x>.65&&bug.firefly.object.scale.x<2);
});
