import { depotFloorHeight } from '../src/depot-floor';
import {POND_SCALE} from '../src/landmark-sites';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as T from 'three';
import {CharacterController} from '../src/controller';
import {Ponds,makeSwimRing} from '../src/ponds';
import {PONDS,WATER_Y,deckHeight,meadowGeometry,inPond,inWater,WATER_REGIONS,RIVERS,BRIDGES,pondOutline,RIVER_CLOSING_ROUTE,dryGround} from '../src/pond-layout';
async function player(){const b=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url)),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');return new CharacterController(g.scene,g.animations);}
const input={forward:true,left:false,right:false};
test('swimming automatically equips a colourful ring, supports growth and exits cleanly',async()=>{
 const c=await player(),ponds=new Ponds(),s=PONDS[0];c.actor.position.set(s.x,0,s.z);ponds.apply(c,c.actor.position.clone());
 assert(c.swimming);assert(c.actor.position.y<WATER_Y);assert(c.actor.getObjectByName('Rainbow swim ring')!.visible);
 c.update(.1,input);ponds.apply(c,c.actor.position.clone());assert.equal(c.state,'Swim');
 c.actor.scale.setScalar(4);ponds.apply(c,c.actor.position.clone());assert(Math.abs(c.actor.position.y+.63*4-WATER_Y)<.06);
 c.actor.position.set(s.x+20,0,s.z);ponds.apply(c,c.actor.position.clone());assert(!c.swimming);assert.equal(c.actor.position.y,0);assert(!c.actor.getObjectByName('Rainbow swim ring')!.visible);
 c.update(.1,input);assert.equal(c.state,'Run');
 const ring=makeSwimRing(),colors=new Set<string>();let meshes=0;ring.traverse(o=>{if(o instanceof T.Mesh){meshes++;const attr=o.geometry.getAttribute('color');for(let i=0;i<attr.count;i++)colors.add(new T.Color().fromBufferAttribute(attr,i).getHexString());}});assert(colors.size>=8);assert.equal(meshes,1);
});
test('both bridge ramps support walking and rails block sideways movement',async()=>{
 for(const side of [-1,1]){
  const c=await player(),ponds=new Ponds(),s=BRIDGES[0],cos=Math.cos(s.yaw),sin=Math.sin(s.yaw);
  const place=(x:number,z=0)=>c.actor.position.set(s.x+(x*cos+z*sin)*POND_SCALE,c.actor.position.y,s.z+(-x*sin+z*cos)*POND_SCALE);
  place(side*5.1);
  for(let i=1;i<=102;i++){
   const old=c.actor.position.clone(),x=side*(5.1-i*.1);place(x);ponds.apply(c,old);
   assert(!c.swimming);assert(Math.abs(c.actor.position.y-deckHeight(x))<1e-6);
   if(i===51){const prev=c.actor.position.clone();place(x,1);ponds.apply(c,prev);const z=((c.actor.position.x-s.x)*sin+(c.actor.position.z-s.z)*cos)/POND_SCALE;assert(z<1);place(x);}
  }
 }
});
test('jumping out of water hides ring until landing and other activities hide it',async()=>{
 const c=await player(),ponds=new Ponds(),s=PONDS[0];c.actor.position.set(s.x,0,s.z);ponds.apply(c,c.actor.position.clone());
 c.update(.1,{...input,forward:false,jump:true});ponds.apply(c,c.actor.position.clone());assert(c.flight.active);assert(!c.swimming);assert(!c.actor.getObjectByName('Rainbow swim ring')!.visible);
 for(let i=0;i<300;i++){c.update(.02,{...input,forward:false});ponds.apply(c,c.actor.position.clone());}
 assert(c.swimming);assert(c.actor.position.y<WATER_Y);
 ponds.apply(c,c.actor.position.clone(),false);assert(!c.swimming);assert(!c.actor.getObjectByName('Rainbow swim ring')!.visible);
});
test('terrain leaves real holes over lakes and streams, with water below the bank',()=>{
 const geometry=meadowGeometry(330);geometry.rotateX(-Math.PI/2);const ground=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));ground.updateMatrixWorld();
 for(const s of PONDS)for(const [x,z] of [[0,0],[0,12]]){
  assert(inPond(x,z));const ray=new T.Raycaster(new T.Vector3(s.x+x,10,s.z+z),new T.Vector3(0,-1,0));assert.equal(ray.intersectObject(ground).length,0);
 }
 assert(WATER_Y<-.2);assert(!inPond(20,0));
});

test('lakes remain swimmable without awarding a retired task',async()=>{
 const c=await player(),ponds=new Ponds();
 for(const site of PONDS){
  c.achievements.clear();c.actor.position.set(site.x,0,site.z);ponds.apply(c,c.actor.position.clone());
  assert(c.swimming);assert.deepEqual([...c.achievements],[]);
 }
 for(const site of PONDS){c.actor.position.set(site.x,0,site.z);ponds.apply(c,c.actor.position.clone());assert.equal(c.achievements.size,0);}
});

test('expanded shores support swimming outside the previous lake boundary',async()=>{
 const c=await player(),ponds=new Ponds();assert(POND_SCALE**2>=2 && POND_SCALE**2<=3);
 for(const site of PONDS){c.actor.position.set(site.x+15,0,site.z);ponds.apply(c,c.actor.position.clone());assert(c.swimming);assert(inPond(15,0));}
});


test('distinct lakes and all river centres form one connected, recessed water surface',()=>{
 assert.equal(WATER_REGIONS.length,1);assert.equal(RIVERS.length,PONDS.length);assert.equal(BRIDGES.length,3);
 assert.equal(new Set(PONDS.map((_,i)=>JSON.stringify(pondOutline(i)))).size,PONDS.length);
 const geometry=meadowGeometry(255);geometry.rotateX(-Math.PI/2);const ground=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));ground.updateMatrixWorld();
 for(const river of RIVERS)for(const p of river){assert(inWater(p.x,p.z));const ray=new T.Raycaster(new T.Vector3(p.x,10,p.z),new T.Vector3(0,-1,0));assert.equal(ray.intersectObject(ground).length,0);}
 assert(geometry.index!.count/3<2000,'Keep terrain affordable');
});
test('every additional rotated bridge supports crossing in both directions',async()=>{
 for(const site of BRIDGES)for(const side of [-1,1]){
  const c=await player(),ponds=new Ponds(),cos=Math.cos(site.yaw),sin=Math.sin(site.yaw);
  const position=(x:number)=>{c.actor.position.x=site.x+x*cos*POND_SCALE;c.actor.position.z=site.z-x*sin*POND_SCALE;};
  position(side*5.1);
  for(let i=1;i<=102;i++){const old=c.actor.position.clone(),x=side*(5.1-i*.1);position(x);ponds.apply(c,old);assert(!c.swimming);assert(Math.abs(c.actor.position.y-deckHeight(x))<1e-6);}
 }
});

test('three separated bridges have dry full-width landings, with one beside the mill',()=>{
 assert.equal(BRIDGES.length,3);assert(BRIDGES.some(s=>Math.hypot(s.x-32,s.z-34)<25));assert(deckHeight(0)>3.4);
 for(const [i,s] of BRIDGES.entries()){
  assert(inWater(s.x,s.z));for(const other of BRIDGES.slice(i+1))assert(Math.hypot(s.x-other.x,s.z-other.z)>110);
  const cos=Math.cos(s.yaw),sin=Math.sin(s.yaw);
  for(const side of [-1,1])for(let x=4.6;x<=6.2;x+=.2)for(let z=-1.6;z<=1.6;z+=.2)assert(dryGround(s.x+(side*x*cos+z*sin)*POND_SCALE,s.z+(-side*x*sin+z*cos)*POND_SCALE,.3));
 }
});

test('depot stairs and platform support walking, growth and jumping without floor penetration',async()=>{
 for(const size of [1,3]){
  const c=await player(),ponds=new Ponds();c.actor.scale.setScalar(size);c.actor.position.set(0,0,216);
  let previousHeight=0;
  for(let z=216;z<228;z+=.05){const previous=c.actor.position.clone();c.actor.position.z=z;ponds.apply(c,previous);assert.equal(c.actor.position.y,depotFloorHeight(0,z));assert(c.actor.position.y>=previousHeight);assert(c.actor.position.y-previousHeight<=.241);previousHeight=c.actor.position.y;assert(!c.swimming);}
  assert.equal(c.actor.position.y,.7);assert.equal(c.surfaceY,.7);
  c.update(.1,{...input,forward:false,jump:true});ponds.apply(c,c.actor.position.clone());assert(c.actor.position.y>.7);
  for(let i=0;i<400;i++){c.update(.02,{...input,forward:false});ponds.apply(c,c.actor.position.clone());assert(c.actor.position.y>=.7);}
  assert.equal(c.actor.position.y,.7);
  for(let z=228;z>216;z-=.05){const previous=c.actor.position.clone();c.actor.position.z=z;ponds.apply(c,previous);assert.equal(c.actor.position.y,depotFloorHeight(0,z));}
  assert.equal(c.actor.position.y,0);
 }
});


test('river closes the lake chain around a substantial dry island without gaps',()=>{
 const first=PONDS[0],last=PONDS.at(-1)!;
 assert(RIVER_CLOSING_ROUTE[0].distanceTo(new T.Vector3(last.x,0,last.z))<40);
 assert(RIVER_CLOSING_ROUTE.at(-1)!.distanceTo(new T.Vector3(first.x,0,first.z))<.001);
 for(let i=1;i<RIVER_CLOSING_ROUTE.length;i++){
  const a=RIVER_CLOSING_ROUTE[i-1],b=RIVER_CLOSING_ROUTE[i];
  assert(a.distanceTo(b)<6);
  for(let j=0;j<=4;j++)assert(inWater(T.MathUtils.lerp(a.x,b.x,j/4),T.MathUtils.lerp(a.z,b.z,j/4)));
 }
 const area=(r:number[][])=>Math.abs(r.slice(1).reduce((sum,p,i)=>sum+r[i][0]*p[1]-p[0]*r[i][1],0))/2;
 assert(WATER_REGIONS[0].slice(1).some(r=>area(r)>10000),'A real loop must enclose a large island');
 for(const river of RIVERS)for(const p of river)assert(!dryGround(p.x,p.z,.2));
});
