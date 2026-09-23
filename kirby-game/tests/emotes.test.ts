import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {EMOTES,emoteSector} from '../src/emotes';
async function create(){const b=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');return new CharacterController(g.scene,g.animations);}
const idle={forward:false,left:false,right:false};
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
