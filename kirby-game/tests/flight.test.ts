import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController } from '../src/controller';
import { createNpcs } from '../src/npcs';
import { Flight, FLIGHT_HEIGHT, JUMP_SECONDS } from '../src/flight';
const idle={forward:false,left:false,right:false};
test('one press follows a ballistic arc with no hover and accelerates down from its apex',()=>{
  const flight=new Flight();flight.press();assert(!flight.levitating);
  const apex=JUMP_SECONDS/2;
  flight.update(.1);const firstRise=flight.height;
  flight.update(.1);assert(firstRise>flight.height-firstRise);
  flight.update(apex-.2);assert.equal(flight.height,FLIGHT_HEIGHT/2);
  flight.update(.1);const fallStart=flight.height;
  assert(Math.abs(FLIGHT_HEIGHT/2-fallStart-.5*24*.1**2)<1e-9);
  flight.update(.1);assert(fallStart-flight.height>.5*24*.1**2);
  flight.update(.2);assert(!flight.active);assert.equal(flight.height,0);
});
async function model(){const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
test('a second press during ascent or exactly at the apex enables the existing two-second hover',()=>{
  for(const pressedAt of [.01,.2,JUMP_SECONDS/2]){
    const flight=new Flight();flight.press();flight.update(pressedAt);
    const start=flight.height;flight.press();assert.equal(flight.height,start);assert(flight.levitating);assert.equal(flight.hoverRemaining,2);
    const rise=Math.sqrt(2*(FLIGHT_HEIGHT-start)/24);
    flight.update(rise);assert.equal(flight.height,FLIGHT_HEIGHT);assert(flight.atTop);
    flight.update(1.99);assert.equal(flight.height,FLIGHT_HEIGHT);assert(Math.abs(flight.hoverRemaining-.01)<1e-8);
    flight.update(.11);assert(!flight.levitating);assert.equal(flight.hoverRemaining,0);assert(!flight.canPress);
    assert(Math.abs(flight.height-(FLIGHT_HEIGHT-.5*24*.1**2))<1e-8);
    const before=flight.height;flight.update(.1);assert(before-flight.height>.5*24*.1**2);
    flight.update(1);assert(!flight.active);assert.equal(flight.height,0);
  }
});

test('presses during descent cannot cancel gravity, including after hover expires',()=>{
  for(const hover of [false,true]){
    const flight=new Flight();flight.press();flight.update(.2);
    if(hover){flight.press();flight.update(2.5);}else flight.update(.2);
    assert(flight.active);const before=flight.networkState();flight.press();assert.deepEqual(flight.networkState(),before);
    flight.update(.05);assert(flight.height<before[0]);
    flight.update(2);assert(!flight.active);
    flight.press();flight.update(.1);assert(flight.active&&flight.height>0);assert(!flight.levitating);
  }
});

test('repeated hover presses glide without climbing or renewing the hover timer',()=>{
  const flight=new Flight();flight.press();flight.update(.2);flight.press();flight.update(.5);
  assert(flight.atTop);
  for(let i=0;i<220&&flight.active;i++){flight.press();flight.update(.01);assert(flight.height<=FLIGHT_HEIGHT);}
  assert(flight.height<FLIGHT_HEIGHT);assert(!flight.levitating);
  flight.update(1);assert(!flight.active);
});

test('jump and levitation are independent of frame rate and round-trip through NPC snapshots',()=>{
  for(const hover of [false,true])for(const fps of [30,60,144]){
    const flight=new Flight();flight.press();flight.update(.2);if(hover)flight.press();
    const state=flight.networkState();
    for(const elapsed of [.1,.4,1.5,2.2,2.6,4]){
      const stepped=new Flight(),single=new Flight();stepped.networkApply(state);single.networkApply(state);
      const frames=Math.floor(elapsed*fps);for(let i=0;i<frames;i++)stepped.update(1/fps);
      stepped.update(elapsed-frames/fps);single.update(elapsed);
      assert(Math.abs(stepped.height-single.height)<1e-8,`hover=${hover}, FPS=${fps}, t=${elapsed}`);
      assert.equal(stepped.active,single.active);assert.equal(stepped.levitating,single.levitating);
    }
  }
});

test('player jumps without a flight cloud, then flaps, levitates, glides and lands after a second press',async()=>{
  const gltf=await model(),c=new CharacterController(gltf.scene,gltf.animations);
  const tick=(count:number,jump=false)=>{for(let i=0;i<count;i++)c.update(1/60,{...idle,jump});};
  tick(1,true);assert(!c.cloud.visible);assert.equal(c.state,'Jump');
  tick(10);tick(1,true);assert(c.cloud.visible);assert.equal(c.state,'Fly');
  const puff=c.cloud.children[0] as import('three').Sprite;
  const earlyOpacity=puff.material.opacity;assert(earlyOpacity>0 && earlyOpacity<.58);
  tick(30);assert(c.cloud.visible);assert(puff.material.opacity>earlyOpacity);
  const left=c.actor.getObjectByName('Left_shoulder')!,right=c.actor.getObjectByName('Right_shoulder')!;
  const before=left.quaternion.clone();tick(6);assert(left.quaternion.angleTo(before)>.01);
  assert(left.rotation.z<0 && right.rotation.z>0);
  assert(c.cloud.visible);assert(Math.abs(c.actor.position.y-FLIGHT_HEIGHT)<1e-6);
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
