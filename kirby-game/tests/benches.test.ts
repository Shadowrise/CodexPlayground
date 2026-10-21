import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../src/controller';
import { Benches, BENCH_SEATS } from '../src/benches';
import {Vector3,Raycaster,Mesh} from 'three';
import {DEPOT_BENCHES,DEPOT_PLATFORM} from '../src/depot-floor';
import {makeCoasterDepot} from '../src/coaster-depot';
import {makeOakBench,OAK_BENCH_SEAT_HEIGHT} from '../src/bench-model';
import {LANDMARKS} from '../src/landmark-sites';

async function character(){const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return new CharacterController(gltf.scene,gltf.animations);}
test('every bench supports smooth sitting, standing and correct return height',async()=>{
  const c=await character();
  for(const seat of BENCH_SEATS){
    const benches=new Benches();c.actor.position.copy(seat.position);c.actor.position.y=seat.floor;c.actor.position.z+=1.7;
    c.setActivity(seat.kind==='treehouse'?'Lookout':'Idle');const start=c.actor.position.clone();
    assert(benches.prompt(start));benches.interact(c);assert(benches.active);
    benches.update(.01);assert(c.actor.position.distanceTo(start)<.01);
    benches.update(.6);assert.deepEqual([...c.achievements],['bench']);assert.equal(c.state,'Sitting');assert(Math.abs(c.actor.position.y-(seat.position.y-.18))<1e-8);
    benches.interact(c);benches.update(.4);assert(!benches.active);assert.equal(c.actor.position.y,seat.floor);
    assert.equal(c.state,seat.kind==='treehouse'?'Lookout':'Idle');assert(c.actor.position.equals(start));
  }
});
test('benches reject airborne and distant players; interrupted seating preserves size',async()=>{
  const c=await character(),benches=new Benches(),seat=BENCH_SEATS[0];
  c.actor.position.set(0,0,0);benches.interact(c);assert(!benches.active);
  c.actor.position.copy(seat.position);c.actor.position.y=seat.floor;c.flight.press();benches.interact(c);assert(!benches.active);c.flight.reset();
  c.actor.scale.setScalar(3);benches.interact(c);benches.update(.1);benches.interact(c);benches.update(.4);
  assert(!benches.active);assert.equal(c.actor.scale.x,3);assert.equal(c.actor.position.y,seat.floor);
});

test('depot seats face the rails, meet the actual slats and preserve earlier multiplayer seat IDs',()=>{
 const oldCount=LANDMARKS.filter(p=>p.kind===4).length*2+1;
 assert(BENCH_SEATS.slice(0,oldCount-1).every(s=>s.kind==='picnic'));
 assert.equal(BENCH_SEATS[oldCount-1].kind,'treehouse');
 const depot=makeCoasterDepot();depot.updateMatrixWorld(true);
 for(const [i,site] of DEPOT_BENCHES.entries()){
  const seat=BENCH_SEATS[oldCount+i],model=depot.getObjectByName(site.x<0?'West oak waiting bench':'East oak waiting bench')!;
  assert.equal(seat.kind,'depot');assert.equal(seat.floor,DEPOT_PLATFORM.height);assert.equal(seat.yaw,0);
  assert.equal(seat.position.x,site.x);assert.equal(seat.position.z,site.z);
  assert.equal(seat.position.y,DEPOT_PLATFORM.height+OAK_BENCH_SEAT_HEIGHT);
  const ray=new Raycaster(new Vector3(site.x,5,site.z+.18),new Vector3(0,-1,0));
  const surface=ray.intersectObject(model,true)[0];assert(surface);assert(Math.abs(surface.point.y-seat.position.y)<1e-5);
  ray.ray.origin.z=site.z-.6;const back=ray.intersectObject(model,true)[0];assert(back&&back.point.y>seat.position.y+.8,'backrest stays behind a rider facing the rails');
 }
});

test('bench variants share the same crafted geometry and maps while fitting existing seats',()=>{
 const full=makeOakBench(),picnic=makeOakBench(3,1.07),lookout=makeOakBench(2.5,.72);
 const parts=(root:ReturnType<typeof makeOakBench>)=>{const meshes:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});return meshes;};
 const standard=parts(full);
 for(const bench of [picnic,lookout])parts(bench).forEach((mesh,i)=>{assert.equal(mesh.geometry,standard[i].geometry);assert.equal(mesh.material,standard[i].material);});
 assert.equal(picnic.scale.x,3/4.65);assert.equal(lookout.scale.y,.72/.84);
});
