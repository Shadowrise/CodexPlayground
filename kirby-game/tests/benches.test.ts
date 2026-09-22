import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../src/controller';
import { Benches, BENCH_SEATS } from '../src/benches';

async function character(){const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return new CharacterController(gltf.scene,gltf.animations);}
test('every bench supports smooth sitting, standing and correct return height',async()=>{
  const c=await character();
  for(const seat of BENCH_SEATS){
    const benches=new Benches();c.actor.position.copy(seat.position);c.actor.position.y=seat.floor;c.actor.position.z+=1.7;
    c.setActivity(seat.floor?'Lookout':'Idle');const start=c.actor.position.clone();
    assert(benches.prompt(start));benches.interact(c);assert(benches.active);
    benches.update(.01);assert(c.actor.position.distanceTo(start)<.01);
    benches.update(.6);assert.equal(c.state,'Sitting');assert(Math.abs(c.actor.position.y-(seat.position.y-.18))<1e-8);
    benches.interact(c);benches.update(.4);assert(!benches.active);assert.equal(c.actor.position.y,seat.floor);
    assert.equal(c.state,seat.floor?'Lookout':'Idle');assert(c.actor.position.equals(start));
  }
});
test('benches reject airborne and distant players; interrupted seating preserves size',async()=>{
  const c=await character(),benches=new Benches(),seat=BENCH_SEATS[0];
  c.actor.position.set(0,0,0);benches.interact(c);assert(!benches.active);
  c.actor.position.copy(seat.position);c.actor.position.y=seat.floor;c.flight.press();benches.interact(c);assert(!benches.active);c.flight.reset();
  c.actor.scale.setScalar(3);benches.interact(c);benches.update(.1);benches.interact(c);benches.update(.4);
  assert(!benches.active);assert.equal(c.actor.scale.x,3);assert.equal(c.actor.position.y,seat.floor);
});
