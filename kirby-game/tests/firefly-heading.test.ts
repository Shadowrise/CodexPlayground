import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Quaternion,Vector3} from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {KirbyNpc} from '../src/npcs';
import {KIRBY_VARIANTS} from '../src/variants';
import {NightFireflies} from '../src/night-fireflies';
import {actorState,applyActor} from '../src/network-actors';
import {PlayerSnapshots} from '../src/player-snapshots';

async function load(name:string){const b=await readFile(new URL(`../public/models/${name}-animated.glb`,import.meta.url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const assets=Promise.all([load('kirby'),load('firefly')]);
const forward=(object:{quaternion:Quaternion})=>new Vector3(0,0,1).applyQuaternion(object.quaternion);

test('a former remote mount turns with its next local rider through full circles',async()=>{
 const [kirby,firefly]=await assets,world=new NightFireflies(firefly),remote=new CharacterController(clone(kirby.scene),kirby.animations),local=new CharacterController(clone(kirby.scene),kirby.animations),bug=world.bugs[0];
 world.update(0,false,bug.home);remote.yaw=Math.PI;remote.actor.rotation.set(0,Math.PI,0);remote.setActivity('FireflyRide');
 const state=actorState(remote,'Remote',0);state.ride={key:'bug:0',data:world.networkState()[0]};world.networkBlocked.add(0);world.syncRemoteRider(0,remote,state,.1);
 world.networkBlocked.clear();bug.phase=25;world.update(0,false,bug.home);local.actor.position.copy(bug.home);assert(world.board(local));
 for(let frame=0;frame<480;frame++){
  const previous=local.actor.position.clone();world.moveRider(1/60,{forward:true,left:true,right:false});world.syncRider(1/60);world.update(1/60,false,local.actor.position);world.syncInstances();
  assert(forward(bug.carrier).dot(forward(local.actor))>.99999,'the mount and rider share the same heading');
  assert(local.actor.position.clone().sub(previous).setY(0).normalize().dot(forward(bug.carrier))>.99999,'forward travel follows the firefly nose');
  assert.equal(bug.carrier.rotation.x,0);assert.equal(bug.carrier.rotation.z,0);
 }
});

test('remote firefly and buffered rider keep matching headings across the rear half and angle wrap',async()=>{
 const [kirby,firefly]=await assets,world=new NightFireflies(firefly),source=new CharacterController(clone(kirby.scene),kirby.animations),peer=new CharacterController(clone(kirby.scene),kirby.animations),buffer=new PlayerSnapshots();world.networkBlocked.add(0);source.setActivity('FireflyRide');
 for(let frame=0;frame<=50;frame++){
  source.yaw=frame*Math.PI/8;source.actor.rotation.set(0,source.yaw,0);const state=actorState(source,'Remote',0);state.ride={key:'bug:0',data:world.networkState()[0]};buffer.push(frame*100,state);
  for(let sub=0;sub<6;sub++){
   const sampled=buffer.sample(frame*100+sub*100/6)!;applyActor(peer,sampled,1/60,true);world.syncRemoteRider(0,peer,sampled,1/60);world.update(1/60,false,peer.actor.position);
   assert(forward(world.bugs[0].carrier).dot(forward(peer.actor))>.99999);
   assert(Math.abs(Math.sin(peer.yaw)-forward(peer.actor).x)<1e-8);assert(Math.abs(Math.cos(peer.yaw)-forward(peer.actor).z)<1e-8);
  }
 }
});

test('a guest NPC passenger faces the same direction as its firefly at every heading',async()=>{
 const [kirby,firefly]=await assets,world=new NightFireflies(firefly),host=new KirbyNpc(kirby.scene,kirby.animations,0,KIRBY_VARIANTS[1]),peer=new KirbyNpc(kirby.scene,kirby.animations,1,KIRBY_VARIANTS[2]);host.beginFirefly(0);host.actor.position.set(0,6,0);
 for(let i=0;i<16;i++){
  host.yaw=i*Math.PI/8;host.actor.rotation.set(0,host.yaw,0);applyActor(peer,actorState(host,'NPC',1),1/60,true);world.prepareNpcs([peer],false,0);world.syncNpcRiders([peer],false,1/60);
  assert(forward(world.bugs[0].carrier).dot(forward(peer.actor))>.99999);
 }
});
