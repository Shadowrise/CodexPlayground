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
 w.bugs[0][9]=3.6;fireflies.networkApply(w.bugs);assert.equal(fireflies.networkState()[0][9],3.6);
});

test('malformed peer payloads fail validation without throwing',()=>{
 for(const value of [null,{},[],{ride:{key:7,data:[]}},{balloons:[null,null,null]}]){
  assert.equal(validActor(value),false);assert.equal(validWorld(value),false);
 }
});
