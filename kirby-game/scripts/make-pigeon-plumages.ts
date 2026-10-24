import {readFile,writeFile} from 'node:fs/promises';
import {Color} from 'three';

/** Bake alternate feather paint into the original rig, UVs, morphs and clips. */
const source=await readFile(new URL('../public/models/pigeon-animated.glb',import.meta.url));
for(const [id,paint] of [['ugolyok','#42464d'],['ryzhik','#c77942']] as const){
 const jsonLength=source.readUInt32LE(12),gltf=JSON.parse(source.subarray(20,20+jsonLength).toString());
 const imageView=gltf.bufferViews[gltf.images[0].bufferView];
 const binary=Buffer.from(source.subarray(28+jsonLength,28+jsonLength+imageView.byteOffset));
 for(const node of gltf.nodes){
  if(node.mesh===undefined||!/^(Forehead_tuft|Left_eyelid|Right_eyelid)_sculpt_paint$/.test(node.name))continue;
  for(const primitive of gltf.meshes[node.mesh].primitives){
   const accessor=gltf.accessors[primitive.attributes.COLOR_0],view=gltf.bufferViews[accessor.bufferView];
   if(accessor.componentType!==5126||accessor.type!=='VEC3')throw Error('Unexpected pigeon colour encoding');
   const start=(view.byteOffset??0)+(accessor.byteOffset??0),stride=view.byteStride??12,target=new Color(paint).toArray();
   for(let vertex=0;vertex<accessor.count;vertex++)target.forEach((value,c)=>binary.writeFloatLE(value,start+vertex*stride+c*4));
   accessor.min=target;accessor.max=target;
  }
 }
 for(const material of gltf.materials){
  material.extras={...material.extras,characterTexture:id,sourceAtlas:`${id}-paint-atlas.png`};
  if(material.name!=='Warm ivory eyes')material.pbrMetallicRoughness.roughnessFactor=.97;
 }
 for(const scene of gltf.scenes)scene.extras={...scene.extras,plumage:id};
 const atlas=await readFile(new URL(`../design/${id}/${id}-paint-atlas.png`,import.meta.url));
 if(atlas.readUInt32BE(16)!==atlas.readUInt32BE(20))throw Error('Pigeon atlas must be square');
 imageView.byteLength=atlas.length;gltf.images[0].name=`${id} layered feathers and iridescent collar`;
 const bin=Buffer.concat([binary,atlas,Buffer.alloc((4-atlas.length%4)%4)]);gltf.buffers[0].byteLength=bin.length;
 let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
 header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);
 jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
 const output=Buffer.concat([header,jh,json,bh,bin]);
 await writeFile(new URL(`../public/models/${id}-animated.glb`,import.meta.url),output);
 console.log(JSON.stringify({id,bytes:output.length,texture:[atlas.readUInt32BE(16),atlas.readUInt32BE(20)],animations:gltf.animations.length}));
}
