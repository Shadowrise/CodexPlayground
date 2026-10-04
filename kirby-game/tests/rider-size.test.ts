import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {cloneVariant,KIRBY_VARIANTS} from '../src/variants';
import {createNpcs} from '../src/npcs';
import {Coaster,STATION} from '../src/coaster';
import {Balloons} from '../src/balloons';
import {KirbyHome} from '../src/kirby-home';
import {fitRider,restoreRider,riderFit} from '../src/rider-size';
import {actorState,applyActor} from '../src/network-actors';
import {PlayerSnapshots} from '../src/player-snapshots';
import {NpcSnapshots} from '../src/npc-snapshots';
import {validActor} from '../src/network-protocol';
const gltf=readFile(new URL('../public/models/kirby-animated.glb',import.meta.url)).then(b=>new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));
async function player(size=7){const g=await gltf,c=new CharacterController(cloneVariant(g.scene,KIRBY_VARIANTS[0],false),g.animations);c.actor.scale.setScalar(size);new Group().add(c.actor);return c;}
const close=(actual:number,expected:number)=>assert(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('cart remains fixed size, seats a large rider and restores visual size on exit',async()=>{
 const c=await player(),coaster=new Coaster();c.actor.position.copy(STATION);assert(coaster.board(c));coaster.update(.1);
 close(c.savedSize,7);close(c.actor.scale.x*riderFit(c),.9);assert(coaster.networkState().every(row=>row[3]===1));
 coaster.disembark();close(riderFit(c),1);close(c.savedSize,7);
 const old=coaster.networkState();old[1][3]=8;coaster.networkBlocked.add(1);coaster.networkApply(old);coaster.update(0);assert(coaster.networkState().every(row=>row[3]===1));
});

test('balloon fits both player and NPC, without growing, and restores them after landing',async()=>{
 for(const npc of [false,true]){const g=await gltf,c=npc?createNpcs(g.scene,g.animations)[0]:await player(),world=new Balloons(()=>{},()=>.1);c.actor.scale.setScalar(7);const b=world.balloons[0];c.actor.position.copy(b.group.position);
  if(c instanceof CharacterController)assert(world.board(c));else (world as any).boardPassenger(b,c);
  world.update(.5);assert(riderFit(c)<1&&riderFit(c)>1/7);world.update(.6);close(riderFit(c),1/7);close(b.group.scale.x,1);close(b.scale,1);
  for(let i=0;i<420;i++)world.update(.1);close(riderFit(c),1);close(c.actor.scale.x,7);close(b.group.scale.x,1);assert(c.achievements.has('balloon'));
 }
});

test('fixed home fits sleeping Kirby, including partial approach cancellation and large safe exit',async()=>{
 for(const size of [1,7,20]){const c=await player(size),home=new KirbyHome();c.actor.position.copy(home.entrance);home.constrain(c.actor.position,size);assert(home.start(c));home.update(1.1);
  close(home.group.scale.x,1);close(riderFit(c)*size,1);close(c.savedSize,size);const safe=home.savePosition(c)!;home.wake();home.update(1);close(riderFit(c),1);assert(c.actor.position.equals(safe));const before=c.actor.position.clone();home.constrain(c.actor.position,size);assert(c.actor.position.equals(before));
 }
 const c=await player(),home=new KirbyHome();c.actor.position.copy(home.entrance);assert(home.start(c));home.update(.1);const before=riderFit(c);home.wake();home.update(.001);assert(riderFit(c)>=before);home.update(1);close(riderFit(c),1);
});

test('visual fit is replicated/interpolated independently of saved size, then resets on remote exit',async()=>{
 const c=await player(),remote=await player();fitRider(c,.9);const small=actorState(c,'Test',0);assert(validActor(small));assert(!validActor({...small,fit:NaN}));assert(!validActor({...small,fit:0}));
 applyActor(remote,small,.1,true);close(riderFit(remote),small.fit!);close(remote.actor.scale.x,7);
 restoreRider(c);const big=actorState(c,'Test',0);assert.equal(big.fit,undefined);
 const samples=new PlayerSnapshots(0);samples.push(0,small);samples.push(100,big);const middle=samples.sample(50)!;close(middle.fit!,(small.fit!+1)/2);close(middle.s,7);
 const npcs=new NpcSnapshots(0);npcs.push(0,[small]);npcs.push(100,[big]);close(npcs.sample(50)![0].fit!,middle.fit!);
 applyActor(remote,big,.1,true);close(riderFit(remote),1);close(remote.savedSize,7);
});
