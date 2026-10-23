import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KirbyNpc} from '../src/npcs';
import {KIRBY_VARIANTS} from '../src/variants';
import {actorState,applyActor} from '../src/network-actors';
import {FLIGHT_HEIGHT} from '../src/flight';

const asset=readFile(new URL('../public/models/kirby-animated.glb',import.meta.url)).then(bytes=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''));
async function npc(){const g=await asset;return new KirbyNpc(g.scene,g.animations,0,KIRBY_VARIANTS[1]);}
function transfer(from:KirbyNpc,to:KirbyNpc){applyActor(to,actorState(from,'NPC',1),0,true);to.networkApplyLife(from.networkLife());}

test('NPC handoff preserves forward travel through every heading, including the rear half of the circle',async()=>{
 for(let i=0;i<16;i++){
  const host=await npc(),peer=await npc(),yaw=i*Math.PI/8;
  host.actor.position.set(0,0,0);host.yaw=yaw;host.actor.rotation.set(0,yaw,0);host.networkAnimate('Walk',0);
  transfer(host,peer);const start=peer.actor.position.clone(),forward=new Vector3(0,0,1).applyQuaternion(peer.actor.quaternion);
  peer.update(.05,[]);const travel=peer.actor.position.clone().sub(start).normalize();
  assert(travel.dot(forward)>.99999,`walks facing forwards at heading ${yaw}`);
  assert.equal(peer.actor.rotation.x,0);assert.equal(peer.actor.rotation.z,0);
 }
});

test('guest animation changes do not overwrite the host checkpoint clock, random seed or turn',async()=>{
 const host=await npc(),peer=await npc();host.update(.35,[]);const life=host.networkLife();peer.networkApplyLife(life);
 for(const state of ['Run','Jump','Fly','Idle','RotateLeft','FireflyApproach:0']){
  peer.networkAnimate(state,.1);assert.deepEqual(peer.networkLife(),life,`${state} only advances presentation`);
 }
});

test('an airborne NPC resumes the same flight and lands after handoff at any flight phase',async()=>{
 for(const age of [.1,.3,1,1.4,2.8])for(const size of [.3,1,4]){
  const host=await npc(),peer=await npc(),ground=.4;
  host.actor.position.set(0,ground,0);host.surfaceY=ground;host.actor.scale.setScalar(size);host.networkAnimate('Fly',0);host.flight.press();
  for(let time=0;time<age-1e-6;time+=.05)host.update(.05,[]);
  assert(host.flight.active);transfer(host,peer);assert(Math.abs(peer.surfaceY-ground)<.0011);
  let landed=false;
  for(let frame=0;frame<220;frame++){
   host.update(.025,[]);peer.update(.025,[]);
   assert.deepEqual(peer.flight.networkState(),host.flight.networkState(),'the flight clock continues without repeating takeoff or hover');
   assert(Math.abs(peer.actor.position.y-host.actor.position.y)<.0011);
   assert(peer.actor.position.y<=ground+FLIGHT_HEIGHT*size+.0011,'does not add airborne Y to flight height');
   if(!peer.flight.active){landed=true;break;}
  }
  assert(landed);assert(Math.abs(peer.actor.position.y-ground)<.0011);
 }
});

test('host migration during obstacle avoidance completes the same turn before walking away',async()=>{
 const host=await npc(),peer=await npc();host.actor.position.set(0,0,0);host.yaw=0;host.actor.rotation.set(0,0,0);host.networkAnimate('Walk',0);
 const wall=(p:Vector3)=>{p.z=Math.min(p.z,1);};host.update(.05,[],wall);host.update(.05,[],wall);
 assert(host.state.startsWith('Rotate'));assert(host.networkLife()[0]<0);
 transfer(host,peer);
 for(let frame=0;frame<30;frame++){
  host.update(.025,[],wall);peer.update(.025,[],wall);
  assert(Math.abs(Math.sin(peer.yaw-host.yaw))<.0011);assert.equal(peer.state,host.state);
  if(host.state==='Walk')return;
 }
 assert.fail('resumes walking after the avoidance turn');
});

test('legacy room checkpoints remain readable and remote flight animation keeps looping',async()=>{
 const n=await npc(),life=n.networkLife();life[0]=3;n.networkApplyLife(life);assert.equal(n.networkLife()[0],Math.PI/2);
 n.networkAnimate('Fly',0);const fly=n.actions.get('Fly')!;
 for(let frame=0;frame<180;frame++)n.networkAnimate('Fly',1/60);
 assert(fly.isRunning());assert(!fly.paused);
});
