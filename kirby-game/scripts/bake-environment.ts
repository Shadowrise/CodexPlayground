import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import * as T from 'three';
import {environmentInputs} from './environment-inputs.mjs';
import {createForest} from '../src/forest';
import {createMeadowDecor} from '../src/meadow-decor';
import {createLandmarks} from '../src/landmarks';
import {createMountains} from '../src/mountains';
import {configureSceneryBatching} from '../src/scenery-batch';
import {groundDetailTexture} from '../src/ground-texture';
import {ENVIRONMENT_MAGIC,ENVIRONMENT_VERSION,type EnvironmentDocument,type BinaryArray} from '../src/environment-format';

const root=fileURLToPath(new URL('../',import.meta.url)),directory=resolve(root,'public/world');
const {hash}=await environmentInputs(root);
try{
 const manifest=JSON.parse(await readFile(resolve(directory,'environment.manifest.json'),'utf8'));
 if(manifest.hash===hash&&manifest.version===ENVIRONMENT_VERSION){await readFile(resolve(directory,'environment.bin.gz'));console.log('Prepared meadow is current ('+hash+').');process.exit(0);}
}catch{}
console.time('Prepare meadow');configureSceneryBatching(false);
const forest=createForest(),world=new T.Group();world.name='Prepared meadow';
world.add(forest,createMeadowDecor(forest.userData.treePositions,forest.userData.meadowLayout),createLandmarks(forest.userData.meadowLayout,forest.userData.treePositions),createMountains());
// Object3D.toJSON writes cached local matrices. Commit generated transforms
// before baking, including the cell centres used by grass and plant LODs.
world.updateMatrixWorld(true);
const geometries=new Map<string,T.BufferGeometry>(),textures=new Map<string,T.Texture>(),materials=new Map<string,T.Material>();
const bounds:EnvironmentDocument['bounds']={},shaders:EnvironmentDocument['shaders']={};
world.traverse(object=>{
 if(!(object instanceof T.Mesh))return;
 geometries.set(object.geometry.uuid,object.geometry);
 for(const material of Array.isArray(object.material)?object.material:[object.material]){
  materials.set(material.uuid,material);
  for(const value of Object.values(material))if(value instanceof T.Texture)textures.set(value.uuid,value);
  if(material.onBeforeCompile!==T.Material.prototype.onBeforeCompile){
   const key=material.customProgramCacheKey();
   if(!['biome-ground-matte-v6','painted-tree-shadows-atlas-v3','meadow-grass-distance-veins-v2','attached-shrub-wind-v1'].includes(key))throw Error('Unregistered scenery shader: '+key);
   const detail=groundDetailTexture(material);if(detail)textures.set(detail.uuid,detail);
   shaders[material.uuid]={key,...(detail?{detail:detail.uuid}:{})};
  }
 }
 if(object instanceof T.InstancedMesh)bounds[object.uuid]={...(object.boundingSphere?{sphere:[...object.boundingSphere.center.toArray(),object.boundingSphere.radius]}:{}),...(object.boundingBox?{box:[...object.boundingBox.min.toArray(),...object.boundingBox.max.toArray()]}:{})};
});
// Serialize the already-generated vertices, including deformed primitive shapes.
const originals=new Map<T.BufferGeometry,{type:string;parameters:unknown;toJSON:T.BufferGeometry['toJSON']}>();
for(const geometry of geometries.values()){
 originals.set(geometry,{type:geometry.type,parameters:(geometry as any).parameters,toJSON:geometry.toJSON});
 geometry.type='BufferGeometry';delete (geometry as any).parameters;
 geometry.toJSON=T.BufferGeometry.prototype.toJSON;
 bounds[geometry.uuid]={...(geometry.boundingSphere?{sphere:[...geometry.boundingSphere.center.toArray(),geometry.boundingSphere.radius]}:{}),...(geometry.boundingBox?{box:[...geometry.boundingBox.min.toArray(),...geometry.boundingBox.max.toArray()]}:{}),...(Number.isFinite(geometry.drawRange.count)?{draw:[geometry.drawRange.start,geometry.drawRange.count]}:{})};
}
const json=world.toJSON() as Record<string,any>;
for(const [geometry,original] of originals){geometry.type=original.type;geometry.toJSON=original.toJSON;if(original.parameters!==undefined)(geometry as any).parameters=original.parameters;}
const meta={textures:Object.fromEntries((json.textures??[]).map((v:any)=>[v.uuid,v])),images:Object.fromEntries((json.images??[]).map((v:any)=>[v.uuid,v]))};
for(const texture of textures.values())texture.toJSON(meta as any);
json.textures=Object.values(meta.textures);json.images=Object.values(meta.images);
const arrays:EnvironmentDocument['arrays']=[],chunks:Uint8Array[]=[],known=new Map<ArrayBufferView,BinaryArray>();let bytes=0;
const pack=(array:ArrayBufferView):BinaryArray=>{
 const old=known.get(array);if(old)return old;
 const offset=Math.ceil(bytes/8)*8,type=array.constructor.name,reference={binary:arrays.length,type};
 arrays.push({offset,bytes:array.byteLength,type});chunks.push(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));bytes=offset+array.byteLength;known.set(array,reference);return reference;
};
for(const geometry of json.geometries??[]){
 const original=geometries.get(geometry.uuid)!;
 for(const [name,attribute] of Object.entries(original.attributes))geometry.data.attributes[name].array=pack(attribute.array);
 if(original.index)geometry.data.index.array=pack(original.index.array);
 for(const [name,attributes] of Object.entries(original.morphAttributes))attributes?.forEach((attribute,i)=>geometry.data.morphAttributes[name][i].array=pack(attribute.array));
}
const sources=new Map([...textures.values()].map(texture=>[texture.source.uuid,texture.source.data]));
for(const image of json.images){const data=sources.get(image.uuid);if(!data?.data||!ArrayBuffer.isView(data.data))throw Error('Scenery texture is not binary');image.url.data=pack(data.data);}
const objects=new Map<string,T.Object3D>();world.traverse(object=>objects.set(object.uuid,object));
const packObjects=(object:any)=>{
 const original=objects.get(object.uuid);
 if(original instanceof T.InstancedMesh){object.instanceMatrix.array=pack(original.instanceMatrix.array);if(original.instanceColor)object.instanceColor.array=pack(original.instanceColor.array);}
 for(const child of object.children??[])packObjects(child);
};packObjects(json.object);
// Debug-only attachment graphs are not used by gameplay and would duplicate matrices.
for(const object of json.object.children??[])if(object.name==='Four woodland biomes')delete object.userData.broadleafTrees;
const doc:EnvironmentDocument={version:ENVIRONMENT_VERSION,scene:json,arrays,shaders,bounds};
const metadata=Buffer.from(JSON.stringify(doc)),start=Math.ceil((12+metadata.length)/8)*8,output=Buffer.alloc(start+bytes);
output.writeUInt32LE(ENVIRONMENT_MAGIC,0);output.writeUInt32LE(ENVIRONMENT_VERSION,4);output.writeUInt32LE(metadata.length,8);metadata.copy(output,12);
chunks.forEach((chunk,i)=>output.set(chunk,start+arrays[i].offset));
const compressed=gzipSync(output,{level:9});await mkdir(directory,{recursive:true});
await writeFile(resolve(directory,'environment.bin.gz'),compressed);
await writeFile(resolve(directory,'environment.manifest.json'),JSON.stringify({version:ENVIRONMENT_VERSION,hash,bytes:compressed.length})+'\n');
console.timeEnd('Prepare meadow');console.log(`Prepared scenery: ${(compressed.length/1048576).toFixed(2)} MiB compressed, ${(output.length/1048576).toFixed(2)} MiB decoded.`);
