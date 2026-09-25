import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3, Mesh, InstancedMesh } from 'three';
import { CharacterController } from '../src/controller';
import { createNpcs } from '../src/npcs';
import { Balloons, BALLOON_SITES, type BalloonSound } from '../src/balloons';
import { sceneryClearance } from '../src/landmarks';
async function model(){const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
test('player boards smoothly, travels above the trees, lands elsewhere and regains controls',async()=>{
  const gltf=await model(),c=new CharacterController(gltf.scene,gltf.animations),events:BalloonSound[]=[],world=new Balloons(k=>events.push(k),()=>.2);
  c.actor.scale.setScalar(2);c.actor.position.copy(world.balloons[0].group.position).add(new Vector3(0,-.28,4));
  const start=c.actor.position.clone();assert(world.board(c));world.update(.01,[],c);assert(c.actor.position.distanceTo(start)<.01);
  world.update(1,[],c);const saved=world.savePosition(c)!;assert.equal(saved.y,0);assert(saved.distanceTo(start)<3);
  for(let i=0;i<350;i++)world.update(.05,[],c);
  assert(world.riding);assert(!c.achievements.has('balloon'));assert(c.actor.position.y>60);assert.equal(c.state,'Balloon');assert(!world.board(c));
  for(let i=0;i<520;i++)world.update(.05,[],c);
  assert(!world.riding);assert(c.achievements.has('balloon'));assert.equal(c.actor.position.y,0);assert.equal(c.state,'Idle');assert.equal(c.actor.scale.x,2);
  assert(c.actor.position.distanceTo(start)>100);assert(events.includes('burner') && events.includes('departure') && events.includes('arrival'));
  const before=c.actor.position.clone();c.update(.1,{forward:true,left:false,right:false});assert(c.actor.position.distanceTo(before)>0);
});
test('NPC walks to a balloon, occasionally rides and returns to walking; two balloons remain available',async()=>{
  const gltf=await model(),npcs=createNpcs(gltf.scene,gltf.animations),npc=npcs[0],world=new Balloons(()=>{},()=>.1);
  npc.actor.position.copy(world.balloons[0].group.position).add(new Vector3(0,-.28,12));npc.endBalloon();
  let rode=false,landed=false;
  for(let i=0;i<1900;i++){
    world.update(.05,[npc]);if(npc.state==='Balloon'){rode=true;assert(!npc.takeHit());assert(world.savePosition(npc));}
    if(rode && !world.owns(npc)){landed=true;break;}
  }
  assert(rode && landed);assert(npc.achievements.has('balloon'));assert.equal(npc.state,'Walk');assert.equal(npc.actor.position.y,0);
  assert(world.balloons.filter(b=>b.phase==='parked').length>=2);
});
test('three ports are clear of trees and detailed balloons have distinct random colours',()=>{
  const world=new Balloons(()=>{},()=>.2);assert.equal(world.balloons.length,3);
  for(const p of BALLOON_SITES)assert(!sceneryClearance(p.x,p.z));
  const colors=world.balloons.map(b=>{const cloth=b.group.children.find(o=>o instanceof Mesh && o.geometry.getAttribute('color')) as Mesh;const c=cloth.geometry.getAttribute('color');return [c.getX(0),c.getY(0),c.getZ(0)].join(',');});
  assert.equal(new Set(colors).size,3);
  let batches=0,parts=0;world.group.traverse(o=>{if(o instanceof InstancedMesh){batches++;parts+=o.count;}});assert(parts>1000);assert(batches<100);
});
test('cruise takes twenty seconds while ascent and descent still take nine each',async()=>{
  const gltf=await model(),c=new CharacterController(gltf.scene,gltf.animations),world=new Balloons(()=>{},()=>.2);
  const balloon=world.balloons[0];c.actor.position.copy(balloon.group.position);assert(world.board(c));
  world.update(1,[],c);world.update(9,[],c);
  assert(Math.abs(balloon.group.position.y-64.28)<1e-8);
  assert.equal(balloon.group.position.x,balloon.start.x);
  world.update(10,[],c);
  assert(Math.abs(balloon.group.position.x-(balloon.start.x+balloon.end.x)/2)<1e-8);
  world.update(10,[],c);assert.equal(balloon.group.position.x,balloon.end.x);assert(balloon.group.position.y>64);
  world.update(9,[],c);assert.equal(balloon.phase,'exiting');assert.equal(balloon.group.position.y,.28);
});

test('an empty balloon stays at its arrival port instead of returning alone',async()=>{
 const gltf=await model(),c=new CharacterController(gltf.scene,gltf.animations),world=new Balloons(()=>{},()=>.2),balloon=world.balloons[0];c.actor.position.copy(balloon.group.position);assert(world.board(c));
 for(let i=0;i<850;i++)world.update(.05,[],c);assert(!world.riding);assert.equal(balloon.phase,'parked');assert.notEqual(balloon.station,0);const parked=balloon.group.position.clone();c.actor.position.set(0,0,0);
 for(let i=0;i<1800;i++)world.update(.05,[],c);assert.equal(balloon.phase,'parked');assert(balloon.group.position.equals(parked));
 c.actor.position.copy(parked);assert(world.board(c));world.update(1.1,[],c);assert.equal(balloon.phase,'flying');assert.equal(balloon.passenger,c);
});
