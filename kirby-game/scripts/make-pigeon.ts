import {readFile,writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {Mesh} from 'three';
import {createPigeon} from '../src/pigeon-model';

Object.assign(globalThis,{FileReader:class{
  result:unknown;onloadend?:()=>void;
  readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob:Blob){void blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}
}});
// Enable texture-backed vertex colours without decoding the authored PNG in Node.
// UVs are normalized; this placeholder is removed before exporting the geometry.
const {root,clips,paintMaterials}=createPigeon({width:1,height:1,pixels:new Uint8Array([255,255,255,255])});
// The offline exporter has no browser canvas. Export UVs, then embed the exact
// authored feather PNG using the same GLB buffer, without external files.
const maps=paintMaterials.map(m=>m.map);paintMaterials.forEach(m=>{m.map=null;});
const raw=Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,animations:clips,onlyVisible:false}) as ArrayBuffer);paintMaterials.forEach((m,i)=>{m.map=maps[i];});
const jsonLength=raw.readUInt32LE(12),gltf=JSON.parse(raw.subarray(20,20+jsonLength).toString()),oldBin=raw.subarray(28+jsonLength);
const png=await readFile(new URL('../design/pigeon/pigeon-feather-atlas.png',import.meta.url));
const view=gltf.bufferViews.length;gltf.bufferViews.push({buffer:0,byteOffset:oldBin.length,byteLength:png.length});
gltf.images=[{bufferView:view,mimeType:'image/png',name:'Pidgie layered grey-blue feathers and green-lilac collar'}];gltf.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];gltf.textures=[{sampler:0,source:0}];
for(const material of paintMaterials){const mat=gltf.materials.find((m:{name:string})=>m.name===material.name);if(!mat)throw Error('Paint material missing');mat.pbrMetallicRoughness.baseColorTexture={index:0};}
const binary=Buffer.concat([oldBin,png,Buffer.alloc((4-png.length%4)%4)]);gltf.buffers[0].byteLength=binary.length;
let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
const data=Buffer.concat([header,jh,json,bh,binary]);
await writeFile(new URL('../public/models/pigeon-animated.glb',import.meta.url),data);
let meshes=0,triangles=0;root.traverse(o=>{if(o instanceof Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});
console.log(JSON.stringify({bytes:data.byteLength,meshes,triangles,clips:clips.map(c=>({name:c.name,duration:c.duration}))},null,2));
