import {readFile,writeFile} from 'node:fs/promises';
import {Color} from 'three';

/** Keep Pidgie's authored geometry/rig/clips; bake Snowball's paint into a native GLB. */
const source=await readFile(new URL('../public/models/pigeon-animated.glb',import.meta.url));
const jsonLength=source.readUInt32LE(12),gltf=JSON.parse(source.subarray(20,20+jsonLength).toString());
const imageView=gltf.bufferViews[gltf.images[0].bufferView];
const binary=Buffer.from(source.subarray(28+jsonLength,28+jsonLength+imageView.byteOffset));
const colors=new Map([
 ['#767c84','#e9a0b4'],['#646c78','#d685a1'],['#b9b8ac','#f3bdc7'],
].map(([from,to])=>[new Color(from).toArray().join(','),new Color(to).toArray()]));
for(const node of gltf.nodes){
 if(node.mesh===undefined||!/^(Beak|Lower_beak|Forehead_tuft|Left_eyelid|Right_eyelid)_sculpt_paint$/.test(node.name))continue;
 for(const primitive of gltf.meshes[node.mesh].primitives){
  const accessor=gltf.accessors[primitive.attributes.COLOR_0],view=gltf.bufferViews[accessor.bufferView];
  if(accessor.componentType!==5126||accessor.type!=='VEC3')throw Error('Unexpected pigeon colour encoding');
  const start=(view.byteOffset??0)+(accessor.byteOffset??0),stride=view.byteStride??12,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let vertex=0;vertex<accessor.count;vertex++){
   const offset=start+vertex*stride,current=[0,1,2].map(c=>binary.readFloatLE(offset+c*4));
   let target=current;
   if(/eyelid|tuft/.test(node.name))target=[1,1,1];
   else for(const [from,to] of colors)if(from.split(',').every((v,c)=>Math.abs(Number(v)-current[c])<1e-6)){target=to;break;}
   target.forEach((value,c)=>{binary.writeFloatLE(value,offset+c*4);min[c]=Math.min(min[c],value);max[c]=Math.max(max[c],value);});
  }
  accessor.min=min;accessor.max=max;
 }
}
for(const material of gltf.materials){
 material.extras={...material.extras,characterTexture:'snowball',sourceAtlas:'snowball-paint-atlas.png'};
 if(material.name!=='Warm ivory eyes')material.pbrMetallicRoughness.roughnessFactor=.97;
}
for(const scene of gltf.scenes)scene.extras={...scene.extras,plumage:'snowball'};
const atlas=await readFile(new URL('../design/snowball/snowball-paint-atlas.png',import.meta.url));
if(atlas.readUInt32BE(16)!==atlas.readUInt32BE(20))throw Error('Snowball atlas must be square');
imageView.byteLength=atlas.length;gltf.images[0].name='Snowball matte white feathers and pastel iridescent collar';
const bin=Buffer.concat([binary,atlas,Buffer.alloc((4-atlas.length%4)%4)]);gltf.buffers[0].byteLength=bin.length;
let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);
jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
const output=Buffer.concat([header,jh,json,bh,bin]);
await writeFile(new URL('../public/models/snowball-animated.glb',import.meta.url),output);
console.log(JSON.stringify({bytes:output.length,texture:[atlas.readUInt32BE(16),atlas.readUInt32BE(20)],animations:gltf.animations.length}));
