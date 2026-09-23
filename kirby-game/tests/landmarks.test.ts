import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Vector3, InstancedMesh, Group, Mesh } from 'three';
import { LANDMARKS, sceneryClearance, outsideLandmarks, createLandmarks } from '../src/landmarks';
import { createForest } from '../src/forest';
import { MEADOW_HALF_SIZE } from '../src/world-bounds';

test('landmarks cover all six themes without overlapping sites or world edges', () => {
  assert.equal(new Set(LANDMARKS.map(p=>p.kind)).size,6);
  for(const [i,p] of LANDMARKS.entries()) {
    assert(Math.abs(p.x)+p.radius<MEADOW_HALF_SIZE);
    assert(Math.abs(p.z)+p.radius<MEADOW_HALF_SIZE);
    for(const q of LANDMARKS.slice(i+1))assert(Math.hypot(p.x-q.x,p.z-q.z)>p.radius+q.radius+12);
    const moved=outsideLandmarks(p.x,p.z,6);
    assert(sceneryClearance(moved.x,moved.z,6));
  }
  assert.deepEqual(outsideLandmarks(0,0,6),{x:0,z:0});
});

test('forest canopy instances stay clear of landmarks and decor is instanced', () => {
  const forest=createForest(), matrix=new Matrix4(), position=new Vector3();
  forest.traverse(mesh=>{
    if(!(mesh instanceof InstancedMesh) || !['Decorative forest leaves','Decorative forest needles'].includes(mesh.name))return;
    for(let i=0;i<mesh.count;i++) {
      mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);
      assert(sceneryClearance(position.x,position.z,1),'Canopies need room around each composition');
    }
  });
  const floor=forest.getObjectByName('Biome ground') as Mesh;
  assert(floor.geometry.index!.count/3<2000,'Biome colour must not require subdividing shoreline triangles');
  const scenery=createLandmarks();
  assert(scenery.children.length>0 && scenery.children.length<100);
  assert(scenery.children.every(o=>o instanceof Group));
  scenery.traverse(o=>{if(o instanceof InstancedMesh){assert(o.boundingSphere);assert(o.boundingSphere!.radius<120,'Decor should be culled in local regions');}});
});
