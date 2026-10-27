import {Mesh} from 'three';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {EMOTES,PIGEON_EMOTES,emotesFor,emoteSector,EmoteWheelSelection} from '../src/emotes';
async function create(){const b=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');return new CharacterController(g.scene,g.animations);}
const idle={forward:false,left:false,right:false};

test('LB release confirms the last selected sector once, including a stick recentered before release',()=>{
 for(const count of [5,6])for(let i=0;i<count;i++)for(const recenter of [false,true]){
  const wheel=new EmoteWheelSelection(),angle=i*Math.PI*2/count,x=Math.sin(angle),y=-Math.cos(angle);
  assert.equal(wheel.update(true,0,0,false,count),undefined);
  wheel.update(true,x,y,false,count);assert.equal(wheel.selected,i);
  if(recenter){wheel.update(true,0,0,false,count);assert.equal(wheel.selected,i);}
  assert.equal(wheel.update(false,recenter?0:x,recenter?0:y,false,count),i);
  assert.equal(wheel.open,false);assert.equal(wheel.update(false,x,y,false,count),undefined);
 }
});

test('a stick held after LB release cannot interrupt the chosen emotion with movement',async()=>{
 const c=await create(),wheel=new EmoteWheelSelection();
 wheel.update(true,0,-1);const selected=wheel.update(false,0,-1);
 assert.equal(selected,0);assert(c.startEmote(EMOTES[selected!].id));
 const before=c.actor.position.clone();
 for(let frame=0;frame<60;frame++){
  assert.equal(wheel.update(false,0,-1),undefined);assert(wheel.blocksMovement);
  c.update(1/60,{...idle,forward:!wheel.blocksMovement});assert.equal(c.state,'Hello');
 }
 assert(c.actor.position.distanceTo(before)<1e-8);
 wheel.update(false,0,0);assert.equal(wheel.blocksMovement,false);
 c.update(.1,{...idle,forward:true});assert.equal(c.state,'Run');assert(c.actor.position.distanceTo(before)>0);
});

test('B cancels the wheel until LB is released, and never consumes an unrelated dash',()=>{
 const wheel=new EmoteWheelSelection();wheel.update(true,1,0);
 assert.equal(wheel.update(true,1,0,true),undefined);assert.equal(wheel.open,false);assert(wheel.blocksMovement);
 assert.equal(wheel.update(true,1,0),undefined);assert.equal(wheel.open,false);
 assert.equal(wheel.update(false,1,0),undefined);assert(wheel.blocksMovement);
 wheel.update(false,0,0);assert.equal(wheel.blocksMovement,false);
 wheel.update(false,0,0,true);assert.equal(wheel.blocksMovement,false);
 wheel.update(true,0,0);assert.equal(wheel.update(false,0,0),undefined);
 wheel.update(true,1,0);wheel.reset();assert.equal(wheel.blocksMovement,false);assert.equal(wheel.selected,undefined);
});
test('every emotion animates then restores movement and root orientation without accumulating offsets',async()=>{
 const c=await create();
 for(const emote of EMOTES){
  assert(c.startEmote(emote.id));assert(!c.startEmote(emote.id));assert.equal(c.state,emote.id);
  for(let i=0;i<180;i++)c.update(1/60,idle);
  assert.equal(c.state,'Idle');assert(Math.abs(c.animationRoot.rotation.x)<1e-6);assert(Math.abs(c.animationRoot.rotation.z)<1e-6);
  const z=c.actor.position.z;c.update(.1,{...idle,forward:true});assert(c.actor.position.z>z);
 }
});
test('fear recoils once, movement interrupts and activities or flight refuse emotions',async()=>{
 const c=await create();c.startEmote('Fear');for(let i=0;i<30;i++)c.update(1/60,idle);assert(Math.abs(c.actor.position.z+.6)<1e-6);
 c.update(.1,{...idle,forward:true});assert.equal(c.state,'Run');assert(Math.abs(c.animationRoot.rotation.x)<1e-6);
 c.setActivity('Balloon');assert(!c.startEmote('Joy'));c.setActivity('Idle');c.update(.1,{...idle,jump:true});assert(!c.startEmote('Hello'));
});
test('wheel maps five directions and central dead zone to predictable choices',()=>{
 assert.equal(emoteSector(0,0),undefined);assert.equal(emoteSector(.1,.1),undefined);
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;assert.equal(emoteSector(Math.sin(a),-Math.cos(a)),i);}
});

test('only Pidgie gets a sixth ground-peck choice and all six wheel sectors are reachable',async()=>{
 assert.equal(emotesFor(false),EMOTES);assert.equal(emotesFor(true),PIGEON_EMOTES);
 assert.equal(PIGEON_EMOTES[5].id,'Peck');assert.equal(emoteSector(0,0,6),undefined);
 for(let i=0;i<6;i++){const a=i*Math.PI*2/6;assert.equal(emoteSector(Math.sin(a),-Math.cos(a),6),i);}
 const kirby=await create();assert(!kirby.startEmote('Peck'));assert.equal(kirby.state,'Idle');
});

test('all five facial expressions affect eyes and mouth, restore on interruption, and preserve Eat bindings',async()=>{
 const c=await create();
 const mouth=c.animationRoot.getObjectByName('Open_smiling_mouth') as Mesh;
 assert(mouth);const original=mouth.geometry,weights=mouth.morphTargetInfluences;
 for(const emote of EMOTES){
  c.setActivity('Idle');assert(c.startEmote(emote.id));c.update(.25,idle);
  let eyes=0,mouths=0;
  c.animationRoot.traverse(n=>{if(n instanceof Mesh && n.morphTargetDictionary?.[`Emotion ${emote.id}`]!==undefined){
   const index=n.morphTargetDictionary[`Emotion ${emote.id}`];assert.equal(n.morphTargetInfluences![index],1);
   const delta=n.geometry.morphAttributes.position[index];assert(Array.from(delta.array).some(v=>Math.abs(Number(v))>.001));
   if(n.name.includes('eye'))eyes++;if(n===mouth)mouths++;
  }});
  assert.equal(eyes,8);assert.equal(mouths,1);
  c.update(.1,{...idle,forward:true});
  c.animationRoot.traverse(n=>{if(n instanceof Mesh && n.morphTargetDictionary)for(const [name,index] of Object.entries(n.morphTargetDictionary))if(name.startsWith('Emotion '))assert.equal(n.morphTargetInfluences![index],0);});
 }
 assert.notEqual(mouth.geometry,original);assert.equal(original.morphAttributes.position!.length,1);assert.equal(mouth.morphTargetInfluences,weights);
 c.setActivity('Idle');c.update(.1,{...idle,eat:true});for(let i=0;i<4;i++)c.update(.1,idle);assert(mouth.morphTargetInfluences![0]>.1);
});
