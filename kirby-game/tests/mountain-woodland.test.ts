import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {createMountainWoodland} from '../src/mountain-woodland';
import {createFoliageTexture} from '../src/foliage-texture';

test('mountain spruces share the meadow needle texture and retain every established planting',()=>{
 const woodland=createMountainWoodland(),sites=woodland.userData.treePositions;
 assert.equal(sites.length,5676);
 assert.equal(createHash('sha256').update(JSON.stringify(sites)).digest('hex'),'63ce5da37215ca8c6e9417aaddadfefec5d6bb072afb05af4bf23ae394433724');
 const crowns=woodland.getObjectByName('Mountain evergreen crowns')!;
 const reference=createFoliageTexture('spruce');
 const first=(crowns.children[0] as T.LOD).levels[0].object as T.InstancedMesh<T.BufferGeometry,T.MeshStandardMaterial>;
 const map=first.material.map!;
 assert(first.material instanceof T.MeshStandardMaterial);
 assert.deepEqual(map.image.data,reference.image.data);
 assert(map.repeat.equals(reference.repeat));assert(map.generateMipmaps);
 assert.equal(map.minFilter,T.LinearMipmapLinearFilter);
 for(const root of woodland.children){
  for(let level=0;level<3;level++)assert.equal(root.children.reduce((sum,cell)=>sum+((cell as T.LOD).levels[level].object as T.InstancedMesh).count,0),sites.length,'distant detail must retain all trees');
 }
 reference.dispose();
});

test('approaching slope trees from the meadow or above restores branches and detailed crowns',()=>{
 const woodland=createMountainWoodland(),camera=new T.PerspectiveCamera();woodland.updateMatrixWorld(true);
 const target=new T.Vector3(),vertex=new T.Vector3(),matrix=new T.Matrix4();
 for(const root of woodland.children)for(const object of root.children){
  const lod=object as T.LOD,near=lod.levels[0].object as T.InstancedMesh,far=lod.levels[2].object as T.InstancedMesh;
  assert(near.geometry.attributes.position.count>far.geometry.attributes.position.count*10,'only nearby trees use the detailed meadow shape');
  for(const direction of [new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,-1)]){
   camera.position.copy(lod.position).addScaledVector(direction,1000);camera.updateMatrixWorld();lod.update(camera);assert.equal(lod.getCurrentLevel(),2);
   near.getMatrixAt(0,matrix);target.setFromMatrixPosition(matrix).applyMatrix4(near.matrixWorld);
   camera.position.copy(target).addScaledVector(direction,5);camera.updateMatrixWorld();lod.update(camera);
   assert.equal(lod.getCurrentLevel(),0);assert(near.visible);assert(!far.visible);
  }
  // The richer outline must still fit the batch's camera-culling bounds.
  const positions=near.geometry.attributes.position;
  for(let instance=0;instance<near.count;instance++){
   near.getMatrixAt(instance,matrix);
   for(let i=0;i<positions.count;i+=31)assert(near.boundingSphere!.containsPoint(vertex.fromBufferAttribute(positions,i).applyMatrix4(matrix)));
  }
 }
});
