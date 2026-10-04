import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RiverBoats} from '../src/river-boats';
import {BOAT_ROUTE_LENGTH,BOAT_SPEED,boatPose,boatDistance} from '../src/boat-route';
import {BRIDGES,inWater,dryGround,deckHeight} from '../src/pond-layout';
import {POND_SCALE} from '../src/landmark-sites';
import {CharacterController} from '../src/controller';
import {cloneVariant,KIRBY_VARIANTS} from '../src/variants';
import {actorState} from '../src/network-actors';
import {validActor,validResourceKey} from '../src/network-protocol';
import {scoreOf} from '../src/score';
const model=readFile(new URL('../public/models/kirby-animated.glb',import.meta.url)).then(b=>new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));

test('closed boat circuit fits the water and clears all bridge decks at walking speed',()=>{
 assert.equal(BOAT_SPEED,3.4);const p=new T.Vector3(),end=new T.Vector3();boatPose(0,p);boatPose(BOAT_ROUTE_LENGTH,end);assert(p.distanceTo(end)<1e-8);
 const bridges=new Set<number>();let oldYaw=boatPose(0,p);
 for(let d=0;d<BOAT_ROUTE_LENGTH;d+=.5){
  const yaw=boatPose(d,p);assert(Math.abs(Math.atan2(Math.sin(yaw-oldYaw),Math.cos(yaw-oldYaw)))<.2,'heading changes smoothly');oldYaw=yaw;
  for(const x of [-.95,0,.95])for(const z of [-1.8,0,1.8])assert(inWater(p.x+x*Math.cos(yaw)+z*Math.sin(yaw),p.z-x*Math.sin(yaw)+z*Math.cos(yaw)),`hull stays in water at ${d}`);
  BRIDGES.forEach((b,i)=>{const x=((p.x-b.x)*Math.cos(b.yaw)-(p.z-b.z)*Math.sin(b.yaw))/POND_SCALE,z=((p.x-b.x)*Math.sin(b.yaw)+(p.z-b.z)*Math.cos(b.yaw))/POND_SCALE;if(Math.abs(z)<2.5&&Math.abs(x)<5){bridges.add(i);assert(deckHeight(Math.abs(x)+1.3/POND_SCALE)-.16>2.66,'umbrella clears bridge');}});
 }
 assert.equal(bridges.size,3);
});

test('eight boats have four seated passengers and a bounded rendering budget',async()=>{
 const g=await model,b=new RiverBoats();b.addPassengers(g.scene,g.animations);b.addPassengers(g.scene,g.animations);assert.equal(b.boats.length,8);
 let triangles=0,draws=0,passengers=0;
 b.group.traverse(o=>{if(o.name.startsWith('River Kirby passenger'))passengers++;if(o instanceof T.Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert(!o.castShadow);}});
 assert.equal(passengers,4);assert(triangles<90000,`all boat+passenger triangles ${triangles}`);assert(draws<=68);
 const colors=b.boats.map(boat=>((boat.children[0] as T.Mesh).material as T.MeshStandardMaterial).color.getHex());assert.equal(new Set(colors).size,8);
 assert.equal((b.boats[0].children[0] as T.Mesh).geometry,(b.boats[1].children[0] as T.Mesh).geometry);
 b.update(1,20,new T.Vector3(10000,0,10000));assert(b.boats.every(boat=>!boat.visible));
});

test('boarding, full-lap reward, safe exit, saved size and reboarding',async()=>{
 const g=await model,b=new RiverBoats(),c=new CharacterController(cloneVariant(g.scene,KIRBY_VARIANTS[15],false),g.animations);c.actor.scale.setScalar(7);
 b.update(0,90);c.actor.position.copy(b.boats[0].position);c.actor.position.x+=2;
 assert.equal(b.networkKey(c),'boat:0');assert(b.board(c));b.update(.6,90.6);assert(b.riding);assert.equal(c.savedSize,7);assert.equal(c.animationRoot.parent!.scale.x,.9/7);
 assert(!c.achievements.has('boat'));b.update(.02,90+BOAT_ROUTE_LENGTH/BOAT_SPEED-.1);assert(!c.achievements.has('boat'));
 b.update(.2,90+BOAT_ROUTE_LENGTH/BOAT_SPEED+.1);assert(c.achievements.has('boat'));assert.equal(scoreOf(c),3);
 b.update(1,90+BOAT_ROUTE_LENGTH/BOAT_SPEED*2);assert.equal(scoreOf(c),3);
 const shore=b.savePosition(c)!;assert(shore);assert(dryGround(shore.x,shore.z,2));assert(b.disembark());b.update(.8,90+BOAT_ROUTE_LENGTH/BOAT_SPEED*2+.8);
 assert(!b.riding);assert.equal(c.state,'Idle');assert.equal(c.savedSize,7);assert.equal(c.animationRoot.parent!.scale.x,1);assert(c.actor.position.distanceTo(shore)<1e-8);
 b.update(0,1);c.actor.position.copy(b.boats[0].position);assert(b.board(c));b.update(.6,1.6);assert.equal(scoreOf(c),3);
});

test('shared clock requires no world payload and network locks exclude occupied boats',async()=>{
 const g=await model,a=new RiverBoats(),b=new RiverBoats(),c=new CharacterController(cloneVariant(g.scene,KIRBY_VARIANTS[0],false),g.animations);
 a.update(.016,100);b.update(.04,100);a.boats.forEach((boat,i)=>assert(boat.position.distanceTo(b.boats[i].position)<1e-8));
 assert(Math.abs(boatDistance(0,101)-boatDistance(0,100)-BOAT_SPEED)<1e-8);
 for(let i=0;i<8;i++)assert.equal(validResourceKey(`boat:${i}`),i%2===0);assert(!validResourceKey('boat:8'));
 c.actor.position.copy(a.boats[0].position);a.networkBlocked.add(0);assert(!a.board(c));a.networkBlocked.clear();assert(a.board(c));
 assert(validActor({...actorState(c,'Boat',0),ride:{key:'boat:0',data:[0]}}));
 assert(!validActor({...actorState(c,'Boat',0),ride:{key:'boat:1',data:[0]}}));
 c.actor.scale.setScalar(4);b.syncRemoteRiders(new Map([[0,c]]));assert.equal(c.animationRoot.parent!.scale.x,.9/4);
 b.syncRemoteRiders(new Map());assert.equal(c.animationRoot.parent!.scale.x,1);
});
