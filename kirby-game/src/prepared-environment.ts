import * as T from 'three';
import {type EnvironmentDocument} from './environment-format';
import {createGroundMaterial} from './ground-texture';
import {createGrassMaterial} from './grass-model';
import {createShrubMaterial} from './shrub-model';
import {restoreTreeShadowMaterial} from './tree-shadows';
import {restoreBoundsLod} from './instanced-lod';
import {batchSceneryAsync} from './scenery-batch';
import {startupTask,startupBudget} from './startup-tasks';

export function unpackEnvironment(buffer:ArrayBuffer){
 return new Promise<EnvironmentDocument>((resolve,reject)=>{
  const worker=new Worker(new URL('./environment-worker.ts',import.meta.url),{type:'module'});
  const finish=()=>worker.terminate();
  worker.onmessage=(event:MessageEvent<{doc?:EnvironmentDocument;error?:string}>)=>{finish();if(event.data.doc)resolve(event.data.doc);else reject(new Error(event.data.error??'Invalid meadow data'));};
  worker.onerror=event=>{finish();reject(new Error(event.message||'Unable to prepare meadow'));};
  worker.postMessage(buffer,[buffer]);
 });
}

/** Geometry, placement, maps and bounds are identical to the procedural build. */
export async function restoreEnvironment(doc:EnvironmentDocument){
 const loader=new T.ObjectLoader(),budget=startupBudget();
 // ObjectLoader.parse/parseAsync both construct the whole scene synchronously.
 // Restore shared resources once, then build nodes from the leaves upward so
 // even a large forest cannot hold input behind one recursive parse.
 const geometries:Record<string,T.BufferGeometry>={},images:Record<string,T.Source>={},textures:Record<string,T.Texture>={},materials:Record<string,T.Material>={};
 for(const data of doc.scene.geometries??[]){Object.assign(geometries,loader.parseGeometries([data]));const pause=budget();if(pause)await pause;}
 for(const data of doc.scene.images??[]){Object.assign(images,loader.parseImages([data]));const pause=budget();if(pause)await pause;}
 for(const data of doc.scene.textures??[]){Object.assign(textures,loader.parseTextures([data],images));const pause=budget();if(pause)await pause;}
 for(const data of doc.scene.materials??[]){Object.assign(materials,loader.parseMaterials([data],textures));const pause=budget();if(pause)await pause;}
 const animations=loader.parseAnimations(doc.scene.animations);
 // The upstream declaration omits the textures argument used by Three r180.
 const parse=loader.parseObject.bind(loader) as unknown as (data:unknown,geometries:unknown,materials:unknown,textures:unknown,animations:unknown)=>T.Object3D;
 const parseObject=async(data:Record<string,any>):Promise<T.Object3D>=>{
  const children:T.Object3D[]=[];
  for(const child of data.children??[])children.push(await parseObject(child));
  const object=parse({...data,children:undefined,levels:data.type==='LOD'?[]:data.levels},geometries,materials,textures,animations);
  if(children.length)object.add(...children);
  if(object instanceof T.LOD)for(const level of data.levels??[]){const child=object.getObjectByProperty('uuid',level.object);if(child)object.addLevel(child,level.distance,level.hysteresis);}
  const pause=budget();if(pause)await pause;
  return object;
 };
 const world=await parseObject(doc.scene.object);
 const materialMap=new Map<string,T.Material>();
 const wind=world.getObjectByName('Biome meadow details')!.userData.windTime as {value:number};
 const bound=(object:{boundingSphere:T.Sphere|null;boundingBox:T.Box3|null},id:string)=>{
  const data=doc.bounds[id];if(!data)return;
  if(data.sphere)object.boundingSphere=new T.Sphere(new T.Vector3().fromArray(data.sphere),data.sphere[3]);
  if(data.box)object.boundingBox=new T.Box3(new T.Vector3().fromArray(data.box),new T.Vector3().fromArray(data.box,3));
 };
 world.traverse(object=>{
  if(object instanceof T.LOD&&typeof object.userData.boundsLodRadius==='number')restoreBoundsLod(object,object.userData.boundsLodRadius);
  if(!(object instanceof T.Mesh))return;
  bound(object.geometry,object.geometry.uuid);
  const range=doc.bounds[object.geometry.uuid]?.draw;if(range)object.geometry.setDrawRange(range[0],range[1]);
  if(object instanceof T.InstancedMesh)bound(object,object.uuid);
  for(const material of Array.isArray(object.material)?object.material:[object.material])materialMap.set(material.uuid,material);
 });
 await startupTask();
 const detailIds=new Set(Object.values(doc.shaders).flatMap(shader=>shader.detail?[shader.detail]:[]));
 const detailJson=doc.scene.textures.filter((texture:{uuid:string})=>detailIds.has(texture.uuid));
 const imageIds=new Set(detailJson.map((texture:{image:string})=>texture.image));
 const detailTextures=loader.parseTextures(detailJson,loader.parseImages(doc.scene.images.filter((image:{uuid:string})=>imageIds.has(image.uuid))));
 for(const [id,shader] of Object.entries(doc.shaders)){
  const material=materialMap.get(id);if(!(material instanceof T.MeshLambertMaterial||material instanceof T.MeshBasicMaterial))throw new Error('Unsupported scenery material');
  let source:T.Material;
  switch(shader.key){
   case 'painted-tree-shadows-atlas-v3':restoreTreeShadowMaterial(material as T.MeshBasicMaterial);continue;
   case 'biome-ground-matte-v6':source=createGroundMaterial(1,undefined,{map:material.map!,detail:detailTextures[shader.detail!]});break;
   case 'meadow-grass-distance-veins-v2':source=createGrassMaterial(material.map!);break;
   case 'attached-shrub-wind-v1':source=createShrubMaterial(wind,material.map!);break;
   default:throw new Error('Unsupported scenery shader');
  }
  material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;
 }
 const roots=[...world.children];
 for(const root of roots){await batchSceneryAsync(root);await startupTask();}
 return roots;
}
