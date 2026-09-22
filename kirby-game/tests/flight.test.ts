import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../src/controller';
import { createNpcs } from '../src/npcs';
import { Flight, FLIGHT_HEIGHT } from '../src/flight';
const idle={forward:false,left:false,right:false};
test('flight rises sharply, hovers for two seconds and accelerates downward at any FPS',()=>{
  const flight=new Flight();flight.press();
  flight.update(.1);const firstRise=flight.height;
  flight.update(.1);assert(firstRise>flight.height-firstRise);
  flight.update(.15);assert.equal(flight.height,FLIGHT_HEIGHT/2);
  flight.update(1.98);assert.equal(flight.height,FLIGHT_HEIGHT/2);
  flight.update(.07);const fallStart=flight.height;
  flight.update(.1);const fallStep=fallStart-flight.height;
  const before=flight.height;flight.update(.1);assert(before-flight.height>fallStep);
  flight.update(.2);assert(!flight.active);assert.equal(flight.height,0);
  for(const fps of [30,60,144]){
    const stepped=new Flight(),single=new Flight();stepped.press();single.press();
    for(let i=0;i<fps*2.5;i++)stepped.update(1/fps);
    single.update(2.5);assert(Math.abs(stepped.height-single.height)<1e-8);
  }
});
async function model(){const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
test('flight has two height levels, repeated top presses glide without climbing, then lands',()=>{
  const flight=new Flight();flight.press();
  for(let i=0;i<30;i++)flight.update(1/60);
  assert.equal(flight.height,FLIGHT_HEIGHT/2);assert(!flight.atTop);
  flight.press();for(let i=0;i<30;i++)flight.update(1/60);
  assert.equal(flight.height,FLIGHT_HEIGHT);assert(flight.atTop);
  for(let i=0;i<300;i++){flight.press();flight.update(1/60);assert.equal(flight.height,FLIGHT_HEIGHT);assert(flight.gliding);}
  for(let i=0;i<240;i++)flight.update(1/60);
  assert(!flight.active);assert.equal(flight.height,0);
  flight.press();flight.update(.5);assert.equal(flight.height,FLIGHT_HEIGHT/2);
});
test('player flaps both arms, fades cloud in during ascent, glides forward and lands cleanly',async()=>{
  const gltf=await model(),c=new CharacterController(gltf.scene,gltf.animations);
  const tick=(count:number,jump=false)=>{for(let i=0;i<count;i++)c.update(1/60,{...idle,jump});};
  tick(1,true);assert(c.cloud.visible);
  const puff=c.cloud.children[0] as import('three').Sprite;
  const earlyOpacity=puff.material.opacity;assert(earlyOpacity>0 && earlyOpacity<.1);
  tick(30);assert(c.cloud.visible);assert(puff.material.opacity>earlyOpacity);
  const left=c.actor.getObjectByName('Left_shoulder')!,right=c.actor.getObjectByName('Right_shoulder')!;
  const before=left.quaternion.clone();tick(6);assert(left.quaternion.angleTo(before)>.01);
  assert(left.rotation.z<0 && right.rotation.z>0);
  tick(1,true);tick(30);assert(c.cloud.visible);assert(Math.abs(c.actor.position.y-FLIGHT_HEIGHT)<1e-6);
  const z=c.actor.position.z;tick(1,true);tick(15);assert(c.actor.position.z>z);
  assert(c.actor.position.y<=FLIGHT_HEIGHT);tick(240);
  assert.equal(c.actor.position.y,0);assert(!c.cloud.visible);assert.equal(c.state,'Idle');
});
test('NPC sometimes flies, displays cloud and returns to walking',async()=>{
  const gltf=await model(),npcs=createNpcs(gltf.scene,gltf.animations);
  let flew=false,cloud=false,landed=false;
  for(let frame=0;frame<180*30;frame++)for(const npc of npcs){
    const flying=npc.state==='Fly';npc.update(1/30,[]);
    flew ||= npc.state==='Fly';cloud ||= npc.cloud.visible;
    landed ||= flying && npc.state==='Walk' && npc.actor.position.y===0;
    assert(npc.actor.position.y<=FLIGHT_HEIGHT*npc.actor.scale.x+1e-6);
  }
  assert(flew && cloud && landed);
});
