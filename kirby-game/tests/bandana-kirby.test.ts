import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,DataTexture,Mesh,MeshLambertMaterial,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {cloneVariant,KIRBY_VARIANTS,remainingVariants} from '../src/variants';
import {CharacterController} from '../src/controller';
import {actorState} from '../src/network-actors';
import {validActor} from '../src/network-protocol';
import {parseSave} from '../src/save-game';
import {EMOTES} from '../src/emotes';

async function template(){
 const b=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));
 return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
}
const idle={forward:false,left:false,right:false};

test('Bandana shares its lightweight details while leaving normal Kirby and other actors untouched',async()=>{
 const g=await template(),variant=KIRBY_VARIANTS.find(v=>v[0]==='Бандана')!;
 const model=cloneVariant(g.scene,variant,false),second=cloneVariant(g.scene,variant,false);
 const hat=model.getObjectByName('Bandana cloth') as Mesh,spear=model.getObjectByName('Bandana spear')!;
 assert(hat);assert(spear);assert.match(hat.parent!.name,/Body.?motion/);assert.match(spear.parent!.name,/Left.?shoulder/);
 let addedTriangles=0,addedMeshes=0;
 for(const root of [hat,spear])root.traverse(o=>{if(o instanceof Mesh){
  const other=second.getObjectByName(o.name) as Mesh;
  assert.equal(o.geometry,other.geometry);assert.notEqual(o.material,other.material);
  addedTriangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;addedMeshes++;
 }});
 assert.equal(addedMeshes,3);assert(addedTriangles<5000,'hat and spear must stay cheap');
 model.traverse(o=>{if(!(o instanceof Mesh))return;const m=o.material as MeshLambertMaterial;
  if(o.name.startsWith('Body')){assert(m.map instanceof DataTexture);assert.equal(m.color.getHexString(),'ffffff');}
  if(o.name.endsWith('_arm')){assert.equal(m.map,null);assert.equal(m.color.getHexString(),'f47a28');}
  if(o.name.endsWith('_foot'))assert.equal(m.color.getHexString(),'f6cf32');
 });
 assert(!g.scene.getObjectByName('Bandana cloth'));
 const ordinary=cloneVariant(g.scene,KIRBY_VARIANTS[0],false);
 ordinary.traverse(o=>{if(o instanceof Mesh&&o.name.startsWith('Body'))assert.equal((o.material as MeshLambertMaterial).map,null);});
});

test('Bandana keeps its spear in the animated hand and survives emotions, movement, saves and online validation',async()=>{
 const g=await template(),variant=KIRBY_VARIANTS.find(v=>v[0]==='Бандана')!;
 const model=cloneVariant(g.scene,variant,false),c=new CharacterController(model,g.animations);
 const spear=model.getObjectByName('Bandana spear')!,hand=model.getObjectByName('Left_arm')!;
 const checkGrip=()=>{model.updateMatrixWorld(true);assert(new Box3().setFromObject(hand).containsPoint(spear.localToWorld(new Vector3())));};
 for(const emote of EMOTES){
  c.setActivity('Idle');assert(c.startEmote(emote.id));
  for(let i=0;i<165;i++){c.update(1/60,idle);if(i%15===0)checkGrip();}
 }
 for(const input of [{...idle,forward:true},{...idle,attack:true},{...idle,jump:true}]){
  c.setActivity('Idle');for(let i=0;i<60;i++){c.update(1/60,input);checkGrip();}
 }
 assert(validActor(actorState(c,'Бандана',KIRBY_VARIANTS.indexOf(variant))));
 const actor=(name:string)=>({variant:name,x:0,z:0,yaw:0,size:1,fruitsEaten:0});
 const save=parseSave(JSON.stringify({version:1,savedAt:new Date().toISOString(),player:actor(variant[0]),npcs:remainingVariants(variant).map(v=>actor(v[0])),fruits:Array(70).fill(false)}));
 assert.equal(save.player.variant,'Бандана');assert.equal(save.npcs.length,14);
});
