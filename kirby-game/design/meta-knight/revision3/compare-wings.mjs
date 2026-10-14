import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GLTFLoader} from '../../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';

const oldPath = new URL('../../../node_modules/.cache/meta-knight/revision2.glb',import.meta.url);
const newPath = new URL('../../../public/models/meta-knight-animated.glb',import.meta.url);
const load = async path => {
  const b=await readFile(path);
  return new Promise((resolve,reject)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',resolve,reject));
};
const hash = array => createHash('sha256').update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
const snapshot = asset => {
  const geometry = {};
  for (const side of ['Left','Right']) {
    const wing = asset.scene.getObjectByName(side+'_wing_pivot');
    if(!wing)throw Error(side+' wing missing');
    const meshes=[];
    wing.traverse(o=>{
      if(!o.isMesh)return;
      const attrs={};
      for(const [name,a] of Object.entries(o.geometry.attributes))attrs[name]={count:a.count,itemSize:a.itemSize,hash:hash(a.array)};
      meshes.push({material:o.material.name,attributes:attrs,index:o.geometry.index?hash(o.geometry.index.array):null,
        position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray()});
    });
    meshes.sort((a,b)=>a.material.localeCompare(b.material));
    geometry[side]=meshes;
  }
  const animations={};
  for(const clip of asset.animations)animations[clip.name]=clip.tracks.filter(t=>/^(Left|Right)_wing_pivot\./.test(t.name))
    .map(t=>({name:t.name,type:t.ValueTypeName,times:hash(t.times),values:hash(t.values)})).sort((a,b)=>a.name.localeCompare(b.name));
  return {geometry,animations};
};
const [oldAsset,newAsset]=await Promise.all([load(oldPath),load(newPath)]);
const old=snapshot(oldAsset),current=snapshot(newAsset);
const report={geometryUnchanged:JSON.stringify(old.geometry)===JSON.stringify(current.geometry),
  localAnimationTracksUnchanged:JSON.stringify(old.animations)===JSON.stringify(current.animations),old,current};
await writeFile(new URL('./wing-comparison.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({oldPath:fileURLToPath(oldPath),geometryUnchanged:report.geometryUnchanged,localAnimationTracksUnchanged:report.localAnimationTracksUnchanged}));
if(!report.geometryUnchanged||!report.localAnimationTracksUnchanged)process.exitCode=1;
