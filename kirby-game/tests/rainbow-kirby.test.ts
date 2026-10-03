import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Mesh,MeshStandardMaterial,DataTexture} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {cloneVariant,KIRBY_VARIANTS,remainingVariants} from '../src/variants';
import {CharacterController} from '../src/controller';
import {actorState} from '../src/network-actors';
import {validActor} from '../src/network-protocol';
import {parseSave} from '../src/save-game';
import {RAINBOW_COLORS} from '../src/rainbow-kirby';

test('Rainbow has seven wrapped bands, an animated crown and shared lightweight assets',async()=>{
 const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const variant=KIRBY_VARIANTS.find(v=>v[0]==='Радуга')!,model=cloneVariant(gltf.scene,variant,false),second=cloneVariant(gltf.scene,variant,false);
 const crown=model.getObjectByName('Rainbow crown')!;assert(crown);assert.match(crown.parent!.name,/Body.?motion/);
 assert.equal(crown.children.length,2);assert.equal((crown.children[0] as Mesh).geometry,(second.getObjectByName('Rainbow crown')!.children[0] as Mesh).geometry);
 let skins=0;
 model.traverse(o=>{if(!(o instanceof Mesh))return;const mat=o.material as MeshStandardMaterial;if(!mat.name.startsWith('Kirby'))return;
  skins++;const map=mat.map as DataTexture;assert(map);assert.equal(mat.color.getHexString(),'ffffff');
  const data=map.image.data!;for(let i=0;i<7;i++){const start=(i*128+64)*4*4;const hex=Array.from(data.slice(start,start+3)).map(v=>Number(v).toString(16).padStart(2,'0')).join('');assert.equal('#'+hex,RAINBOW_COLORS[6-i]);}
  const p=o.geometry.getAttribute('position'),uv=o.geometry.getAttribute('uv');for(let i=0;i<p.count;i+=137)assert(Math.abs(uv.getY(i)-Math.min(1,Math.max(0,(p.getY(i)-.21)/1.92)))<1e-6);
 });assert.equal(skins,3);
 gltf.scene.traverse(o=>{if(o instanceof Mesh&&((o.material as MeshStandardMaterial).name.startsWith('Kirby')))assert.equal((o.material as MeshStandardMaterial).map,null);});
 const player=new CharacterController(model,gltf.animations);player.mixer.update(.2);assert.equal(crown.parent!.parent!==null,true);
 assert(validActor(actorState(player,'Радуга',KIRBY_VARIANTS.indexOf(variant))));
 assert(!validActor({...actorState(player,'Радуга',15),variant:16}));
 const savedActor=(name:string)=>({variant:name,x:0,z:0,yaw:0,size:1,fruitsEaten:0});
 const save=parseSave(JSON.stringify({version:1,savedAt:new Date().toISOString(),player:savedActor(variant[0]),npcs:remainingVariants(variant).map(v=>savedActor(v[0])),fruits:Array(70).fill(false)}));
 assert.equal(save.player.variant,'Радуга');assert.equal(save.npcs.length,14);
});
