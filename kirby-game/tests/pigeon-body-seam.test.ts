import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Mesh,Texture,Vector3,type BufferAttribute} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createPigeon} from '../src/pigeon-model';

function validateBody(body:Mesh){
 const geometry=body.geometry,position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
 const rings=new Map<number,number[]>();
 for(let i=0;i<position.count;i++){
  const y=position.getY(i),ring=rings.get(y)??[];ring.push(i);rings.set(y,ring);
 }
 let seams=0;
 for(const vertices of rings.values()){
  const first=vertices[0],last=vertices.at(-1)!;
  if(Math.abs(position.getX(first))<1e-6)continue;
  assert(new Vector3().fromBufferAttribute(position,first).distanceTo(new Vector3().fromBufferAttribute(position,last))<1e-6);
  for(const attribute of [uv,geometry.getAttribute('normal'),...geometry.morphAttributes.normal??[]]){
   for(let c=0;c<attribute.itemSize;c++)assert(Math.abs(attribute.getComponent(first,c)-attribute.getComponent(last,c))<1e-6,'body paint and lighting must meet continuously at the side seam, including peck morphs');
  }
  for(const vertex of vertices){
   const mirror=vertices.find(other=>Math.abs(position.getX(other)+position.getX(vertex))<1e-6&&Math.abs(position.getZ(other)-position.getZ(vertex))<1e-6)!;
   assert.notEqual(mirror,undefined);
   assert(Math.abs(uv.getX(vertex)-uv.getX(mirror))<1e-6&&Math.abs(uv.getY(vertex)-uv.getY(mirror))<1e-6,'both flanks use the same continuous feather paint');
  }
  seams++;
 }
 assert(seams>50,'check the seam over the belly, neck and head');
 // Collapsed polar vertices also need one normal, otherwise the former seam
 // remains visible as a lighting wedge on the forehead or underneath the belly.
 for(const vertices of rings.values()){
  if(vertices.some(i=>Math.abs(position.getX(i))>1e-6))continue;
  for(const normal of [geometry.getAttribute('normal'),...geometry.morphAttributes.normal??[]])for(const vertex of vertices){
   const delta=new Vector3().fromBufferAttribute(normal as BufferAttribute,vertex).sub(new Vector3().fromBufferAttribute(normal as BufferAttribute,vertices[0]));
   assert(delta.length()<1e-6,'each smooth body pole shares its lighting through every morph');
  }
 }
}

test('authored pigeon body has continuous mirrored paint and smooth side-seam normals',()=>{
 const {root}=createPigeon({width:1,height:1,pixels:new Uint8Array([255,255,255,255])});
 validateBody(root.getObjectByName('Continuous pigeon body') as Mesh);
});

for(const id of ['pigeon','snowball','ugolyok','ryzhik','kurlyk'])test(`${id} GLB retains continuous flank paint and lighting`,async()=>{
 const bytes=await readFile(new URL(`../public/models/${id}-animated.glb`,import.meta.url));
 const loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));
 const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 validateBody(gltf.scene.getObjectByName('Continuous_pigeon_body') as Mesh);
});
