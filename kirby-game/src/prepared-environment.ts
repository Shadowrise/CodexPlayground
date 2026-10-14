import * as T from 'three';
import {type EnvironmentDocument} from './environment-format';
import {createGroundMaterial} from './ground-texture';
import {createGrassMaterial} from './grass-model';
import {createShrubMaterial} from './shrub-model';
import {restoreTreeShadowMaterial} from './tree-shadows';
import {restoreBoundsLod} from './instanced-lod';
import {batchScenery} from './scenery-batch';
import {startupTask} from './startup-tasks';

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
 const loader=new T.ObjectLoader(),world=loader.parse(doc.scene);
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
 for(const root of roots){batchScenery(root);await startupTask();}
 return roots;
}
