import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MetaKnightReflections} from '../src/meta-knight-reflections';
import {makeSeatedMetaKnight} from '../src/meta-knight-passenger';
import {daylight} from '../src/day-cycle';

test('the real mask and blade share sky reflections without altering authored metal or nonmetal surfaces',async()=>{
 const bytes=await readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const originals=new Map<T.MeshStandardMaterial,{metalness:number;roughness:number;intensity:number}>();
 gltf.scene.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial)originals.set(m,{metalness:m.metalness,roughness:m.roughness,intensity:m.envMapIntensity});});
 const environment=new T.WebGLRenderTarget(16,16),lighting=new MetaKnightReflections(gltf.scene,environment);
 const mask=[...originals.keys()].find(m=>m.name.startsWith('Mask'))!,blade=[...originals.keys()].find(m=>m.name.startsWith('Galaxia')&&m.metalness>.9)!;
 assert(mask&&blade);assert.equal(mask.envMap,environment.texture);assert.equal(blade.envMap,environment.texture);
 const riders=[makeSeatedMetaKnight(gltf.scene,gltf.animations),makeSeatedMetaKnight(gltf.scene,gltf.animations)];
 for(const {model} of riders)model.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&m.metalness>=.5)assert.equal(m.envMap,environment.texture);});
 lighting.update(daylight(.25));
 for(const [m,original] of originals){
  assert.equal(m.metalness,original.metalness);assert.equal(m.roughness,original.roughness);
  assert.equal(m.envMapIntensity,original.intensity);
  if(m.metalness<.5)assert.equal(m.envMap,null,'body, boots, wings and eyes retain their existing lighting');
 }
 const noon=blade.envMapIntensity;lighting.update(daylight(.75));assert(blade.envMapIntensity<noon*.2);assert(blade.envMapIntensity>0);
 lighting.update(daylight(.25));assert.equal(blade.envMapIntensity,noon,'day-night changes never accumulate material brightness');
 lighting.dispose();
});
