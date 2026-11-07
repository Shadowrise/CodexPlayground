import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PIGEON_CLIPS} from '../src/pigeon-clips';
import {applyMetapidgiePlumage} from './metapidgie-plumage';

/** Import the workshop GLB, preserving its mesh, rig and animation values.
 * Feather paint follows Cinder; the gold beak and authored armor stay native.
 * Only player clips are shipped; the workshop retains all of its boss clips.
 * Usage: node --import tsx scripts/import-metapidgie.ts path/to/workshop.glb
 */
function unpack(bytes:Buffer){
 assert.equal(bytes.readUInt32LE(0),0x46546c67);
 const length=bytes.readUInt32LE(12);
 return {json:JSON.parse(bytes.subarray(20,20+length).toString()),bin:bytes.subarray(28+length)};
}
const source=process.argv[2];assert(source,'Pass the workshop GLB path');
const bytes=await readFile(source),{json:j,bin}=unpack(bytes);
let binary=applyMetapidgiePlumage(j,bin,await readFile(new URL('../design/ugolyok/ugolyok-paint-atlas.png',import.meta.url)));
const playerNames=new Set(PIGEON_CLIPS.map(c=>c.name));
j.animations=j.animations.filter((a:any)=>playerNames.has(a.name));

// Older workshop exports predate the ground-peck emote. Retarget the current
// native Pidgie clip by joint name, including matching body-driven armor morphs.
if(!j.animations.some((a:any)=>a.name==='Peck')){
 const base=unpack(await readFile(new URL('../public/models/pigeon-animated.glb',import.meta.url))),b=base.json;
 const clip=structuredClone(b.animations.find((a:any)=>a.name==='Peck'));assert(clip,'Pidgie has no Peck clip');
 const accessorOffset=j.accessors.length,viewOffset=j.bufferViews.length,offset=binary.length;
 j.accessors.push(...b.accessors.map((a:any)=>({...a,bufferView:a.bufferView+viewOffset})));
 j.bufferViews.push(...b.bufferViews.map((v:any)=>({...v,buffer:0,byteOffset:(v.byteOffset??0)+offset})));
 binary=Buffer.concat([binary,base.bin]);
 for(const s of clip.samplers){s.input+=accessorOffset;s.output+=accessorOffset;}
 const key=(name:string)=>name.replaceAll(' ','_');
 const nodes=new Map(j.nodes.map((n:any,i:number)=>[key(n.name??''),i]));
 clip.channels=clip.channels.flatMap((c:any)=>{
  const name=b.nodes[c.target.node].name,node=nodes.get(key(name));
  if(node===undefined)return [];
  const channel={...c,target:{...c.target,node}};
  if(c.target.path!=='weights')return [channel];
  const before=b.meshes[b.nodes[c.target.node].mesh],after=j.meshes[j.nodes[node as number].mesh];
  assert.deepEqual(after.extras?.targetNames,before.extras?.targetNames,'Peck morph identities changed');
  const armor=j.nodes.flatMap((n:any,i:number)=>{
   if(i===node||n.skin===undefined||n.mesh===undefined)return [];
   const mesh=j.meshes[n.mesh];
   return JSON.stringify(mesh.extras?.targetNames)===JSON.stringify(after.extras?.targetNames)
    ?[{...channel,target:{path:'weights',node:i}}]:[];
  });
  return [channel,...armor];
 });
 j.animations.push(clip);
}
assert.deepEqual(new Set(j.animations.map((a:any)=>a.name)),playerNames);

// Compact the binary after removing boss-only accessors. Values stay byte exact.
const used=new Set<number>();
const refs:(()=>void)[]=[];
const remap=(owner:any,key:string)=>{const old=owner[key];used.add(old);refs.push(()=>{owner[key]=accessorMap.get(old);});};
for(const mesh of j.meshes)for(const p of mesh.primitives){
 if(p.indices!==undefined)remap(p,'indices');
 for(const key of Object.keys(p.attributes))remap(p.attributes,key);
 for(const target of p.targets??[])for(const key of Object.keys(target))remap(target,key);
}
for(const skin of j.skins??[])if(skin.inverseBindMatrices!==undefined)remap(skin,'inverseBindMatrices');
for(const a of j.animations)for(const s of a.samplers){remap(s,'input');remap(s,'output');}
const accessorMap=new Map([...used].map((id,i)=>[id,i]));refs.forEach(f=>f());
j.accessors=[...used].map(id=>j.accessors[id]);
const views=new Set<number>();
for(const a of j.accessors){assert(!a.sparse,'Sparse accessors require explicit remapping');views.add(a.bufferView);}
for(const image of j.images??[])if(image.bufferView!==undefined)views.add(image.bufferView);
const viewMap=new Map([...views].map((id,i)=>[id,i])),chunks:Buffer[]=[];
let size=0;
const compactViews=[...views].map(id=>{
 const v=j.bufferViews[id],data=binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength),start=size;
 chunks.push(data);size+=data.length;
 const pad=(4-size%4)%4;if(pad){chunks.push(Buffer.alloc(pad));size+=pad;}
 return {...v,buffer:0,byteOffset:start};
});
for(const a of j.accessors)a.bufferView=viewMap.get(a.bufferView);
for(const image of j.images??[])if(image.bufferView!==undefined)image.bufferView=viewMap.get(image.bufferView);
j.bufferViews=compactViews;j.buffers=[{byteLength:size}];
for(const n of j.nodes)if(n.extras?.previewOnly)n.extras.previewOnly=false;
j.asset.extras={...j.asset.extras,workshopSha256:createHash('sha256').update(bytes).digest('hex')};
const json=Buffer.from(JSON.stringify(j)),jsonPad=(4-json.length%4)%4,content=Buffer.concat([json,Buffer.alloc(jsonPad,32)]),data=Buffer.concat(chunks);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+content.length+data.length,8);header.writeUInt32LE(content.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(data.length);binHeader.writeUInt32LE(0x004e4942,4);
const result=Buffer.concat([header,content,binHeader,data]);
await writeFile(new URL('../public/models/metapidgie-animated.glb',import.meta.url),result);
console.log(JSON.stringify({source,sourceBytes:bytes.length,playerBytes:result.length,clips:j.animations.length,sourceSha256:j.asset.extras.workshopSha256}));
