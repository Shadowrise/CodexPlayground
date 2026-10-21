import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clonePigeon} from '../src/pigeon-appearance';
import {arenaMaterials} from '../src/meta-knight-arena-materials';

const bytes=await readFile(new URL('../public/models/snowball-animated.glb',import.meta.url)),loader=new GLTFLoader();
loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new T.Texture())}));
const pigeon=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
type Shader=Parameters<T.Material['onBeforeCompile']>[0];
function compile(material:T.Material){
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader} as Shader;
 material.onBeforeCompile(shader,{} as T.WebGLRenderer);return shader;
}

test('arena preserves Snowball native feather texture and matte materials while removing meadow lighting hooks',()=>{
 const actor=clonePigeon(pigeon.scene),originals=new Map<T.Mesh,T.Material|T.Material[]>(),sourceShaders=new Map<T.Material,Shader>();
 actor.traverse(o=>{
  if(!(o instanceof T.Mesh))return;originals.set(o,o.material);
  for(const material of Array.isArray(o.material)?o.material:[o.material]){
   if(sourceShaders.has(material))continue;
   sourceShaders.set(material,compile(material));
   const paint=material.onBeforeCompile;
   material.onBeforeCompile=(shader:Shader,renderer:T.WebGLRenderer)=>{paint.call(material,shader,renderer);shader.fragmentShader+='\n// meadow lighting only';};
  }
 });
 for(let trip=0;trip<2;trip++){
  const restore=arenaMaterials(actor),copies=new Set<T.Material>(),paints=new Set<string>();let disposed=0;
  for(const [mesh,original] of originals){
   const before=Array.isArray(original)?original:[original],after=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   after.forEach((material,i)=>{
    assert.notEqual(material,before[i]);copies.add(material);material.addEventListener('dispose',()=>disposed++);
    const actual=compile(material),expected=sourceShaders.get(before[i])!;
    assert.equal(actual.vertexShader,expected.vertexShader);
    assert.equal(actual.fragmentShader,expected.fragmentShader);assert(!actual.fragmentShader.includes('snowballInk'));
    if(material instanceof T.MeshStandardMaterial){
     assert.equal(material.map,(before[i] as T.MeshStandardMaterial).map,'arena retains the exact authored feather atlas');
     assert.equal(material.roughness,(before[i] as T.MeshStandardMaterial).roughness);
    }
    if(material.userData.characterTexture)paints.add(material.userData.characterTexture);
   });
  }
  assert.deepEqual(paints,new Set(['snowball']));restore();assert.equal(disposed,copies.size);
  for(const [mesh,original] of originals)assert.equal(mesh.material,original,'returning restores the exact meadow material');
 }
});

test('ordinary and multi-material actors keep their native paint and recover their materials after the arena',()=>{
 const actor=clonePigeon(pigeon.scene),plain=new T.MeshStandardMaterial({color:'#ff780a',envMap:new T.Texture()}),mesh=new T.Mesh(new T.BoxGeometry(),[plain,plain.clone()]);actor.add(mesh);
 const original=mesh.material,restore=arenaMaterials(actor);
 assert(Array.isArray(mesh.material));assert.notEqual(mesh.material,original);
 for(const material of mesh.material){assert(material instanceof T.MeshStandardMaterial);assert.equal(material.envMap,null);assert.equal(material.color.getHexString(),'ff780a');assert(!compile(material).fragmentShader.includes('snowballInk'));}
 restore();assert.equal(mesh.material,original);assert(plain.envMap);
});
