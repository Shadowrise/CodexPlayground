import {readFile,writeFile} from 'node:fs/promises';
import {Color,MathUtils,Matrix4,Quaternion,Vector3} from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {RAINBOW_COLORS,rainbowCrown} from '../src/rainbow-kirby';

/** Native vertex paint: continuous seven-colour feather wash, original atlas and rig. */
const source=await readFile(new URL('../public/models/pigeon-animated.glb',import.meta.url));
const jsonLength=source.readUInt32LE(12),gltf=JSON.parse(source.subarray(20,20+jsonLength).toString());
let binary=Buffer.from(source.subarray(28+jsonLength));
const append=(data:Buffer)=>{
 const byteOffset=binary.length;
 binary=Buffer.concat([binary,data,Buffer.alloc((4-data.length%4)%4)]);
 return byteOffset;
};
const worlds=new Map<number,Matrix4>();
function visit(index:number,parent=new Matrix4()){
 const node=gltf.nodes[index],local=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(new Vector3().fromArray(node.translation??[0,0,0]),new Quaternion().fromArray(node.rotation??[0,0,0,1]),new Vector3().fromArray(node.scale??[1,1,1]));
 const world=parent.clone().multiply(local);worlds.set(index,world);
 for(const child of node.children??[])visit(child,world);
}
for(const index of gltf.scenes[gltf.scene??0].nodes)visit(index);
const palette=RAINBOW_COLORS.map(hex=>new Color(hex));
function rainbow(point:Vector3){
 // A gently curved wash wraps around the body with no angular UV seam.
 const wave=.055*Math.sin(Math.atan2(point.z-.35,point.x)*2)*Math.sin(Math.PI*MathUtils.clamp((point.y-.5)/2.3,0,1));
 const stop=MathUtils.clamp((2.73-point.y+wave)/2.19,0,1)*6,index=Math.min(5,Math.floor(stop));
 return palette[index].clone().lerp(palette[index+1],MathUtils.smoothstep(stop-index,0,1));
}
const feather=/^(Continuous[ _]pigeon[ _]body|(Left|Right)_wing_vane_sculpt_paint|Tail_sculpt_paint|Forehead_tuft_sculpt_paint|(Left|Right)_eyelid_sculpt_paint)$/;
const featherMaterials=new Map<number,number>();
for(const [index,node] of gltf.nodes.entries()){
 if(node.mesh===undefined||!feather.test(node.name))continue;
 for(const primitive of gltf.meshes[node.mesh].primitives){
  const accessor=gltf.accessors[primitive.attributes.POSITION],view=gltf.bufferViews[accessor.bufferView];
  if(accessor.componentType!==5126)throw Error('Unexpected pigeon position encoding');
  const start=(view.byteOffset??0)+(accessor.byteOffset??0),stride=view.byteStride??12,colors=Buffer.alloc(accessor.count*12),min=[1,1,1],max=[0,0,0];
  for(let vertex=0;vertex<accessor.count;vertex++){
   const offset=start+vertex*stride,point=new Vector3(binary.readFloatLE(offset),binary.readFloatLE(offset+4),binary.readFloatLE(offset+8)).applyMatrix4(worlds.get(index)!);
   rainbow(point).toArray().forEach((value,c)=>{colors.writeFloatLE(value,vertex*12+c*4);min[c]=Math.min(min[c],value);max[c]=Math.max(max[c],value);});
  }
  const bufferView=gltf.bufferViews.length;gltf.bufferViews.push({buffer:0,byteOffset:append(colors),byteLength:colors.length,target:34962});
  primitive.attributes.COLOR_0=gltf.accessors.length;gltf.accessors.push({bufferView,componentType:5126,count:accessor.count,type:'VEC3',min,max});
  let material=featherMaterials.get(primitive.material);
  if(material===undefined){
   const paint=structuredClone(gltf.materials[primitive.material]);paint.name='Kurlyk pearlescent feathers';
   paint.pbrMetallicRoughness.roughnessFactor=.62;paint.pbrMetallicRoughness.metallicFactor=.08;
   paint.extensions={...paint.extensions,KHR_materials_iridescence:{iridescenceFactor:.65,iridescenceIor:1.3,iridescenceThicknessMinimum:110,iridescenceThicknessMaximum:360}};
   material=gltf.materials.length;gltf.materials.push(paint);featherMaterials.set(primitive.material,material);
  }
  primitive.material=material;
 }
}

// Export the established seven-point gold crown, then attach it to the animated head.
if(!globalThis.FileReader)Object.assign(globalThis,{FileReader:class{
 result:ArrayBuffer|null=null;onloadend?:()=>void;
 readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();});}
}});
const crown=rainbowCrown();crown.name='Kurlyk crown';
// Fit the rounded, slightly oval head and seat the lower rim into its feathers.
crown.scale.set(.46,.54,.39);crown.position.set(0,.18,-.005);
crown.children[0].name='Kurlyk crown gold';crown.children[1].name='Kurlyk crown jewels';
const crownBytes=Buffer.from(await new GLTFExporter().parseAsync(crown,{binary:true,onlyVisible:false}) as ArrayBuffer);
const crownLength=crownBytes.readUInt32LE(12),royal=JSON.parse(crownBytes.subarray(20,20+crownLength).toString());
const binOffset=append(crownBytes.subarray(28+crownLength)),viewOffset=gltf.bufferViews.length,accessorOffset=gltf.accessors.length,materialOffset=gltf.materials.length,meshOffset=gltf.meshes.length,nodeOffset=gltf.nodes.length;
for(const view of royal.bufferViews)gltf.bufferViews.push({...view,buffer:0,byteOffset:binOffset+(view.byteOffset??0)});
for(const accessor of royal.accessors)gltf.accessors.push({...accessor,bufferView:viewOffset+accessor.bufferView});
gltf.materials.push(...royal.materials);
for(const mesh of royal.meshes)gltf.meshes.push({...mesh,primitives:mesh.primitives.map((p:any)=>({...p,attributes:Object.fromEntries(Object.entries(p.attributes).map(([key,value])=>[key,accessorOffset+(value as number)])),...(p.indices===undefined?{}:{indices:accessorOffset+p.indices}),material:materialOffset+p.material}))});
for(const node of royal.nodes)gltf.nodes.push({...node,...(node.mesh===undefined?{}:{mesh:meshOffset+node.mesh}),...(node.children?{children:node.children.map((i:number)=>nodeOffset+i)}:{})});
const head=gltf.nodes.find((node:{name:string})=>node.name==='Head');
head.children.push(...royal.scenes[royal.scene??0].nodes.map((i:number)=>nodeOffset+i));
gltf.extensionsUsed=[...new Set([...(gltf.extensionsUsed??[]),...(royal.extensionsUsed??[]),'KHR_materials_iridescence'])];
for(const material of gltf.materials)material.extras={...material.extras,characterTexture:'kurlyk'};
for(const scene of gltf.scenes)scene.extras={...scene.extras,plumage:'kurlyk',rainbowColours:7};
gltf.buffers[0].byteLength=binary.length;
let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);
jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
const output=Buffer.concat([header,jh,json,bh,binary]);
await writeFile(new URL('../public/models/kurlyk-animated.glb',import.meta.url),output);
console.log(JSON.stringify({id:'kurlyk',bytes:output.length,colours:7,animations:gltf.animations.length}));
