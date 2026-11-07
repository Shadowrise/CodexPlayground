import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {AnimationClip,VectorKeyframeTrack,QuaternionKeyframeTrack,NumberKeyframeTrack,PropertyBinding,InterpolateDiscrete,InterpolateLinear} from 'three';
/** Ship only the finished boss tracks; geometry/paint/rig come from the player asset. */
const source=process.argv[2];assert(source,'Pass the approved phase-one workshop GLB');
const bytes=await readFile(source),size=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+size).toString()),bin=bytes.subarray(28+size);
function values(id:number){const a=j.accessors[id],v=j.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert(!a.sparse&&!v.byteStride);const length=a.count*({SCALAR:1,VEC3:3,VEC4:4} as Record<string,number>)[a.type];return Array.from({length},(_,i)=>bin.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*4));}
const clips=j.animations.filter((a:any)=>new Set(['intro','approach','slash-warn','slash','slash-warn-backhand','slash-backhand','jump-warn','jump','slam','wave','shot-warn','shot-recharge','shot','return','open','open-melee','open-land','rest','stunned','get-up','transition','won','lost'].map(n=>'Boss_'+n)).has(a.name)).map((a:any)=>{
 const tracks=a.channels.flatMap((c:any)=>{
  const node=j.nodes[c.target.node],path=c.target.path;
  // Workshop preview effects are replaced by deterministic runtime mist and stars.
  if(node.name.startsWith('Phase1_'))return [];
  const sampler=a.samplers[c.sampler];assert(['LINEAR','STEP',undefined].includes(sampler.interpolation));
  const times=values(sampler.input),data=values(sampler.output),name=PropertyBinding.sanitizeNodeName(node.name)+'.'+({translation:'position',rotation:'quaternion',scale:'scale',weights:'morphTargetInfluences'} as Record<string,string>)[path];
  const Track=path==='rotation'?QuaternionKeyframeTrack:path==='weights'?NumberKeyframeTrack:VectorKeyframeTrack;
  return [new Track(name,times,data,sampler.interpolation==='STEP'?InterpolateDiscrete:InterpolateLinear)];
 });return AnimationClip.toJSON(new AnimationClip(a.name,-1,tracks));
});
assert(clips.length>=23);
const result={version:1,sourceSha256:createHash('sha256').update(bytes).digest('hex'),clips};
await writeFile(new URL('../public/models/metapidgie-boss-phase1.json',import.meta.url),JSON.stringify(result));
console.log({clips:clips.length,bytes:JSON.stringify(result).length});
