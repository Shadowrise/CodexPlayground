import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RiverBoats} from '../src/river-boats';
import {BOAT_OCCUPIED,META_KNIGHT_BOAT} from '../src/boat-route';
import {Coaster,META_KNIGHT_CART} from '../src/coaster';
import {metaKnightPaint,META_KNIGHT_BODY,META_KNIGHT_VIOLET} from '../src/meta-knight-passenger';
import {validResourceKey,validWorld} from '../src/network-protocol';

const asset=readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url)).then(bytes=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''));
const passengerName='Meta Knight · permanent passenger';

test('both rides share the real asset, keep separate sitting animations, and never duplicate passengers',async()=>{
 const gltf=await asset,boats=new RiverBoats(),coaster=new Coaster();
 for(let i=0;i<2;i++){
  boats.addMetaKnightPassenger(gltf.scene,gltf.animations);
  coaster.addMetaKnightPassenger(gltf.scene,gltf.animations);
 }
 const boat=boats.boats[META_KNIGHT_BOAT],cart=coaster.group.getObjectByName('Meta Knight coaster cart')!;
 const boatRider=boat.getObjectByName(passengerName)!,cartRider=cart.getObjectByName(passengerName)!;
 assert(boatRider&&cartRider);assert.notEqual(boatRider,cartRider);
 cartRider.updateWorldMatrix(true,true);
 for(const side of ['Left','Right'])assert(new T.Box3().setFromObject(cartRider.getObjectByName(`${side}_foot_pivot`)!,true).max.z<.6,'boots stay behind the cart safety bar');
 assert.equal(boat.children.filter(o=>o.name===passengerName).length,1);
 assert.equal(cart.children.filter(o=>o.name===passengerName).length,1);
 const body=boatRider.getObjectByName('Body_motion')!,foot=boatRider.getObjectByName('Left_foot_pivot')!;
 assert(Math.abs(body.position.y-.94)<.001);assert(foot.position.z>.4,'native Sitting moves the boots forward');
 const before=body.position.y;
 boats.update(.7,15);assert.notEqual(body.position.y,before,'seated breathing advances');
 assert(Math.abs(cartRider.getObjectByName('Body_motion')!.position.y-.94)<.001,'mixers are independent');
 const start=cart.position.clone();coaster.update(.7);assert(cart.position.distanceTo(start)>1);
 assert.equal(boatRider.parent,boat);assert.equal(cartRider.parent,cart);
 assert(BOAT_OCCUPIED.includes(META_KNIGHT_BOAT));
 assert(!validResourceKey(`boat:${META_KNIGHT_BOAT}`));assert(!validResourceKey(`cart:${META_KNIGHT_CART}`));
 const carts=(coaster as unknown as {carts:{occupied:boolean}[]}).carts;assert(carts[META_KNIGHT_CART].occupied);
});

test('indigo clearcoat matches the body and violet M emblems have white outlines on both vehicles',async()=>{
 const gltf=await asset,modelMaterials:T.MeshStandardMaterial[]=[];
 gltf.scene.traverse(o=>{if(o instanceof T.Mesh)modelMaterials.push(...(Array.isArray(o.material)?o.material:[o.material]) as T.MeshStandardMaterial[]);});
 assert.equal(modelMaterials.find(m=>m.name.startsWith('Body'))!.color.getHexString(),new T.Color(META_KNIGHT_BODY).getHexString());
 assert.equal(modelMaterials.find(m=>m.name.startsWith('Boots'))!.color.getHexString(),new T.Color(META_KNIGHT_VIOLET).getHexString());
 const boat=new RiverBoats().boats[META_KNIGHT_BOAT],cart=new Coaster().group.getObjectByName('Meta Knight coaster cart')!;
 assert.equal((boat.getObjectByName('Boat hull') as T.Mesh).material,metaKnightPaint);
 assert.equal(metaKnightPaint.color.getHexString(),new T.Color(META_KNIGHT_BODY).getHexString());
 assert(metaKnightPaint.clearcoat===1&&metaKnightPaint.roughness<=.2);
 for(const [vehicle,names] of [[boat,['Meta Knight boat M','Meta Knight boat M','Meta Knight bow M']],[cart,['Meta Knight door M','Meta Knight door M','Meta Knight hood M']]] as const){
  const emblems=vehicle.children.filter(o=>names.some(name=>name===o.name));assert.equal(emblems.length,names.length);
  for(const emblem of emblems){
   assert.equal(((emblem as T.Mesh).material as T.MeshStandardMaterial).color.getHexString(),new T.Color(META_KNIGHT_VIOLET).getHexString());
   const outline=emblem.getObjectByName('Meta Knight M white outline') as T.Mesh;
   assert(outline);assert.equal((outline.material as T.MeshStandardMaterial).color.getHexString(),'ffffff');
  }
 }
 const boats=new RiverBoats();boats.addMetaKnightPassenger(gltf.scene,gltf.animations);boats.update(.8,0);
 const model=boats.boats[META_KNIGHT_BOAT].getObjectByName(passengerName)!.clone(true);
 model.updateMatrixWorld(true);
 const head=new T.Box3().setFromObject(model.getObjectByName('Body_motion')!,true);
 assert(head.max.y<2.46,`folded wings, sword and helmet fit below the umbrella: ${head.max.y}`);
 assert(head.min.y>.5,'seated body stays above the boat bench');
});

test('network snapshots accept the extra permanent cart and retain older rooms',()=>{
 const actor={p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Kirby',variant:0,star:0};
 const coaster=new Coaster();
 const world={npcs:Array.from({length:14},()=>actor),npcLife:Array.from({length:14},()=>Array(15).fill(0)),carts:coaster.networkState(),balloons:Array.from({length:3},()=>[0,'parked',...Array(14).fill(0)]),bugs:Array.from({length:40},()=>Array(10).fill(0))};
 assert.equal(world.carts.length,13);assert(validWorld(world));
 const remote=new Coaster();remote.networkApply(world.carts);assert.deepEqual(remote.networkState(),world.carts);
 assert(validWorld({...world,carts:world.carts.slice(0,12)}));
 assert(!validWorld({...world,carts:[...world.carts,world.carts[0]]}));
});
