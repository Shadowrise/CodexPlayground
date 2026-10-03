import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Mesh} from 'three';
import {createNpcs} from '../src/npcs';
import {Ponds} from '../src/ponds';
import {PONDS,RIVERS,WATER_Y,BRIDGES,deckHeight} from '../src/pond-layout';
import {POND_SCALE} from '../src/landmark-sites';
import {FOUNTAIN_SITE,FOUNTAIN_WATER_Y} from '../src/fountain-site';
import {NpcSwimming} from '../src/npc-swimming';
import {actorState,applyActor} from '../src/network-actors';
import {validActor} from '../src/network-protocol';

async function npcs(){const b=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url)),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');return createNpcs(g.scene,g.animations);}
test('NPCs float on rings in lakes, rivers and fountain, with size-aware water height and dry-land exit',async()=>{
 const [npc]=await npcs(),ponds=new Ponds(),river=RIVERS[0][Math.floor(RIVERS[0].length*.5)];
 for(const [x,z,y] of [[PONDS[0].x,PONDS[0].z,WATER_Y],[river.x,river.z,WATER_Y],[FOUNTAIN_SITE.x+7,FOUNTAIN_SITE.z,FOUNTAIN_WATER_Y]])for(const size of [1,4]){
  npc.actor.position.set(x,0,z);npc.actor.scale.setScalar(size);const old=npc.actor.position.clone();ponds.apply(npc,old);npc.syncSwimming();
  assert(npc.swimming);assert.equal(npc.state,'Swim');assert(npc.actor.getObjectByName('Rainbow swim ring')!.visible);
  assert(Math.abs(npc.actor.position.y+.63*size-y)<.06);assert(!npc.canBoardBalloon);
  const before=npc.actor.position.clone();npc.update(.1,[]);ponds.apply(npc,before);npc.syncSwimming();assert.equal(npc.state,'Swim');assert(npc.actor.position.distanceTo(before)>0);
 }
 npc.actor.position.set(0,0,0);ponds.apply(npc,npc.actor.position.clone());npc.syncSwimming();assert(!npc.swimming);assert.equal(npc.state,'Walk');assert(!npc.actor.getObjectByName('Rainbow swim ring')!.visible);
});

test('NPC bridge support is independent for each swimmer and rides hide their rings',async()=>{
 const [walking,swimming]=await npcs(),ponds=new Ponds(),bridge=BRIDGES[0];
 const cos=Math.cos(bridge.yaw),sin=Math.sin(bridge.yaw);
 walking.actor.position.set(bridge.x+5.1*cos*POND_SCALE,0,bridge.z-5.1*sin*POND_SCALE);
 swimming.actor.position.set(PONDS[1].x,0,PONDS[1].z);
 for(let i=1;i<=51;i++){
  const old=walking.actor.position.clone(),x=5.1-i*.1;walking.actor.position.x=bridge.x+x*cos*POND_SCALE;walking.actor.position.z=bridge.z-x*sin*POND_SCALE;ponds.apply(walking,old);walking.syncSwimming();
  ponds.apply(swimming,swimming.actor.position.clone());swimming.syncSwimming();
  assert(!walking.swimming);assert(swimming.swimming);assert(Math.abs(walking.actor.position.y-deckHeight(5.1-i*.1))<.0001);
 }
 swimming.beginFirefly(0);ponds.apply(swimming,swimming.actor.position.clone(),false);swimming.syncSwimming();assert(!swimming.actor.getObjectByName('Rainbow swim ring')!.visible);assert.equal(swimming.state,'FireflyRide:0');
});

test('an occasional planned swim enters water, rests, returns ashore and respects its personal cooldown',async()=>{
 const [npc]=await npcs(),planner=new NpcSwimming(),ponds=new Ponds(),site=PONDS[0];npc.actor.position.set(site.x+25,0,site.z);npc.networkAnimate('Idle',0);
 let planned=false,swam=false,finished=false;
 for(let i=0;i<2000;i++){
  planner.update(.05,[npc],()=>{});planned ||= !!npc.waterDestination;
  const old=npc.actor.position.clone();npc.update(.05,[]);ponds.apply(npc,old);npc.syncSwimming();swam ||= npc.swimming;ponds.update(.05);
  if(swam&&!npc.swimming&&!npc.waterDestination){finished=true;break;}
 }
 assert(planned);assert(swam);assert(finished,'finishes a bath and walks back onto land');
 for(let i=0;i<60;i++){planner.update(1,[npc],()=>{});assert(!npc.waterDestination);}
});

test('guest gets swimming animation, matching waterline and one batched ring, then hides it on exit',async()=>{
 const [host,peer]=await npcs(),ponds=new Ponds();host.actor.position.set(PONDS[0].x,0,PONDS[0].z);host.actor.scale.setScalar(3);ponds.apply(host,host.actor.position.clone());host.syncSwimming();
 const frame=actorState(host,'NPC',1);assert(validActor(frame));applyActor(peer,frame,.016,true);
 assert(peer.swimming);assert.equal(peer.state,'Swim');assert(Math.abs(peer.actor.position.y+.63*3-WATER_Y)<.06);
 const ring=peer.actor.getObjectByName('Rainbow swim ring')!;assert(ring.visible);assert.equal(ring.children.filter(o=>o instanceof Mesh).length,1);assert(peer.actions.get('Swim')!.isRunning());
 host.actor.position.set(0,0,0);ponds.apply(host,new Vector3());host.syncSwimming();applyActor(peer,actorState(host,'NPC',1),.016,true);assert(!peer.swimming);assert(!ring.visible);
});
