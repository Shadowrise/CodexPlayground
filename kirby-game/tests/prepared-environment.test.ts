import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {decodeEnvironment} from '../src/environment-format';
import {restoreEnvironment} from '../src/prepared-environment';
import {configureSceneryBatching} from '../src/scenery-batch';

test('prepared scenery restores placement, raw geometry, culling bounds, LOD and live shader uniforms',async()=>{
 const bytes=await readFile(new URL('../public/world/environment.bin.gz',import.meta.url));
 const {doc}=await decodeEnvironment(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const {raw}=await decodeEnvironment(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 assert.equal((await decodeEnvironment(raw)).doc.scene.object.name,'Prepared meadow','HTTP-decoded responses load without decompressing twice');
 configureSceneryBatching(false);
 const roots=await restoreEnvironment(doc),world=new T.Group();world.add(...roots);world.updateMatrixWorld(true);
 assert.deepEqual(roots.map(root=>root.name),['Four woodland biomes','Biome meadow details','Ponds, flowers, mushrooms, rocks, picnics and ruins','Continuous square mountain range']);
 const forest=roots[0],decor=roots[1];assert(forest.userData.treePositions.length>500);assert(forest.userData.meadowLayout.paths.length>10);
 assert(decor.userData.sites.length>100);assert(decor.userData.grassBlades>10000);
 const materials=new Set<T.Material>();let instances=0,lods=0;
 world.traverse(object=>{
  if(object instanceof T.Mesh){assert(object.geometry.attributes.position.count>0);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}
  if(object instanceof T.InstancedMesh){instances++;assert(object.boundingSphere);assert.equal(object.boundingSphere.radius,doc.bounds[object.uuid].sphere![3]);}
  if(object instanceof T.LOD&&typeof object.userData.boundsLodRadius==='number'){
   lods++;const camera=new T.PerspectiveCamera(),centre=object.getWorldPosition(new T.Vector3());
   camera.position.copy(centre).setX(centre.x+1000);camera.updateMatrixWorld();object.update(camera);assert(object.getCurrentLevel()>0);
   camera.position.copy(centre);camera.updateMatrixWorld();object.update(camera);assert.equal(object.getCurrentLevel(),0);assert(object.levels[0].object.visible);
  }
 });assert(instances>500);assert(lods>100);
 let grassCells=0,plantCells=0;
 decor.traverse(object=>{
  if(!(object instanceof T.LOD)||object.userData.boundsLodRadius!==undefined)return;
  const mesh=object.levels[0].object;if(!(mesh instanceof T.Mesh))return;
  const sphere=mesh instanceof T.InstancedMesh?mesh.boundingSphere:mesh.geometry.boundingSphere;
  assert(sphere,'prepared undergrowth keeps its culling bounds');
  const centre=sphere.center.clone().applyMatrix4(mesh.matrixWorld),camera=new T.PerspectiveCamera();
  camera.position.copy(centre).add(new T.Vector3(0,2,0));camera.updateMatrixWorld();object.update(camera);
  assert(mesh.visible,`undergrowth beside the camera must remain visible at ${centre.x},${centre.z}`);
  camera.position.copy(centre).setX(centre.x+1000);camera.updateMatrixWorld();object.update(camera);
  assert(!mesh.visible,'distant undergrowth still gets culled');
  camera.position.copy(centre);camera.updateMatrixWorld();object.update(camera);
  assert(mesh.visible,'approaching restores the nearby undergrowth');
  if(mesh instanceof T.InstancedMesh)grassCells++;else plantCells++;
 });
 assert(grassCells>100);assert(plantCells>10);
 const grass=[...materials].find(m=>m.customProgramCacheKey()==='meadow-grass-distance-veins-v2');assert(grass);
 const shrub=[...materials].find(m=>m.customProgramCacheKey()==='attached-shrub-wind-v1');assert(shrub);
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',fragmentShader:''} as unknown as T.WebGLProgramParametersWithUniforms;
 shrub.onBeforeCompile(shader,{} as T.WebGLRenderer);assert.equal(shader.uniforms.shrubTime,decor.userData.windTime);
 decor.userData.windTime.value=12;assert.equal(shader.uniforms.shrubTime.value,12);
 const ground=world.getObjectByName('Biome ground') as T.Mesh;assert.equal((ground.material as T.Material).customProgramCacheKey(),'biome-ground-matte-v6');
 const groundShader={uniforms:{},vertexShader:'#include <uv_vertex>',fragmentShader:'#include <map_fragment>'} as unknown as T.WebGLProgramParametersWithUniforms;
 (ground.material as T.Material).onBeforeCompile(groundShader,{} as T.WebGLRenderer);assert(groundShader.uniforms.groundDetail.value instanceof T.DataTexture);
 assert(roots[3] instanceof T.Mesh);assert((roots[3] as T.Mesh).geometry.attributes.position.count>1000);
 const mountainCrowns=world.getObjectByName('Mountain evergreen crowns')!;
 assert(mountainCrowns.children.length>0);
 for(const cell of mountainCrowns.children){
  const lod=cell as T.LOD,near=lod.levels[0].object as T.InstancedMesh<T.BufferGeometry,T.MeshStandardMaterial>;
  assert(near.material.map instanceof T.DataTexture,'baked mountain trees retain their needle texture');
  assert.equal(near.material.map.name,'Detailed spruce foliage');
  assert(near.geometry.attributes.position.count>(lod.levels[2].object as T.InstancedMesh).geometry.attributes.position.count*10);
 }
});
