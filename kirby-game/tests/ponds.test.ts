import {POND_SCALE} from '../src/landmark-sites';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as T from 'three';
import {CharacterController} from '../src/controller';
import {Ponds,makeSwimRing} from '../src/ponds';
import {PONDS,WATER_Y,deckHeight,meadowGeometry,inPond,inWater,WATER_REGIONS,RIVERS,BRIDGES,pondOutline} from '../src/pond-layout';
async function player(){const b=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url)),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');return new CharacterController(g.scene,g.animations);}
const input={forward:true,left:false,right:false};
test('swimming automatically equips a colourful ring, supports growth and exits cleanly',async()=>{
 const c=await player(),ponds=new Ponds(),s=PONDS[0];c.actor.position.set(s.x,0,s.z);ponds.apply(c,c.actor.position.clone());
 assert(c.swimming);assert(c.actor.position.y<WATER_Y);assert(c.actor.getObjectByName('Rainbow swim ring')!.visible);
 c.update(.1,input);ponds.apply(c,c.actor.position.clone());assert.equal(c.state,'Swim');
 c.actor.scale.setScalar(4);ponds.apply(c,c.actor.position.clone());assert(Math.abs(c.actor.position.y+.63*4-WATER_Y)<.06);
 c.actor.position.set(s.x+20,0,s.z);ponds.apply(c,c.actor.position.clone());assert(!c.swimming);assert.equal(c.actor.position.y,0);assert(!c.actor.getObjectByName('Rainbow swim ring')!.visible);
 c.update(.1,input);assert.equal(c.state,'Run');
 const ring=makeSwimRing(),colors=new Set<string>();ring.traverse(o=>{if(o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial)colors.add(o.material.color.getHexString());});assert(colors.size>=8);
});
test('both bridge ramps support walking and rails block sideways movement',async()=>{
 for(const side of [-1,1]){
  const c=await player(),ponds=new Ponds(),s=PONDS[0];c.actor.position.set(s.x+side*5.1*POND_SCALE,0,s.z+12*POND_SCALE);
  for(let i=1;i<=102;i++){
   const old=c.actor.position.clone();c.actor.position.x=s.x+side*(5.1-i*.1)*POND_SCALE;ponds.apply(c,old);
   assert(!c.swimming);assert(Math.abs(c.actor.position.y-(Math.abs((c.actor.position.x-s.x)/POND_SCALE)<=5?deckHeight((c.actor.position.x-s.x)/POND_SCALE):0))<1e-6);
   if(i===51){const prev=c.actor.position.clone();c.actor.position.z+=POND_SCALE;ponds.apply(c,prev);assert(c.actor.position.z<s.z+13*POND_SCALE);c.actor.position.z=s.z+12*POND_SCALE;}
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

test('any lake completes the swimming task and other lakes do not award it again',async()=>{
 const c=await player(),ponds=new Ponds();
 for(const site of PONDS){
  c.achievements.clear();c.actor.position.set(site.x,0,site.z);ponds.apply(c,c.actor.position.clone());
  assert(c.swimming);assert.deepEqual([...c.achievements],['swim']);
 }
 for(const site of PONDS){c.actor.position.set(site.x,0,site.z);ponds.apply(c,c.actor.position.clone());assert.equal(c.achievements.size,1);}
});

test('expanded shores support swimming outside the previous lake boundary',async()=>{
 const c=await player(),ponds=new Ponds();assert(POND_SCALE**2>=2 && POND_SCALE**2<=3);
 for(const site of PONDS){c.actor.position.set(site.x+15,0,site.z);ponds.apply(c,c.actor.position.clone());assert(c.swimming);assert(inPond(15,0));}
});


test('distinct lakes and all river centres form one connected, recessed water surface',()=>{
 assert.equal(WATER_REGIONS.length,1);assert.equal(RIVERS.length,PONDS.length-1);assert.equal(BRIDGES.length,13);
 assert.equal(new Set(PONDS.map((_,i)=>JSON.stringify(pondOutline(i)))).size,PONDS.length);
 const geometry=meadowGeometry(255);geometry.rotateX(-Math.PI/2);const ground=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));ground.updateMatrixWorld();
 for(const river of RIVERS)for(const p of river){assert(inWater(p.x,p.z));const ray=new T.Raycaster(new T.Vector3(p.x,10,p.z),new T.Vector3(0,-1,0));assert.equal(ray.intersectObject(ground).length,0);}
 assert(geometry.index!.count/3<2000,'Keep terrain affordable');
});
test('every additional rotated bridge supports crossing in both directions',async()=>{
 for(const site of BRIDGES.slice(PONDS.length))for(const side of [-1,1]){
  const c=await player(),ponds=new Ponds(),cos=Math.cos(site.yaw),sin=Math.sin(site.yaw);
  const position=(x:number)=>{c.actor.position.x=site.x+x*cos*POND_SCALE;c.actor.position.z=site.z-x*sin*POND_SCALE;};
  position(side*5.1);
  for(let i=1;i<=102;i++){const old=c.actor.position.clone(),x=side*(5.1-i*.1);position(x);ponds.apply(c,old);assert(!c.swimming);assert(Math.abs(c.actor.position.y-deckHeight(x))<1e-6);}
 }
});
