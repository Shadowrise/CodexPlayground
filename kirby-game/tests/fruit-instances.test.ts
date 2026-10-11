import assert from 'node:assert/strict';
import {test} from 'node:test';
import {InstancedMesh,Matrix4} from 'three';
import {FruitWorld} from '../src/fruits';

test('hidden/eaten fruit uses no submitted instances; restoring repacks the same transforms without idle uploads',()=>{
 const world=new FruitWorld(),meshes=world.group.children.filter(o=>o instanceof InstancedMesh) as InstancedMesh[];
 const capacity=meshes.reduce((sum,m)=>sum+m.count,0),allMatrices=meshes.map(m=>Array.from(m.instanceMatrix.array));assert(capacity>70);
 world.fruits.forEach(f=>f.object.visible=false);world.syncInstances();assert(meshes.every(m=>m.count===0&&!m.visible));
 world.fruits[0].object.visible=true;world.syncInstances();const active=meshes.reduce((sum,m)=>sum+m.count,0);assert(active>0&&active<capacity/10);
 const matrix=new Matrix4();for(const m of meshes)for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);assert(Math.abs(matrix.determinant())>1e-8,'no zero-scale placeholders are submitted');}
 const versions=meshes.map(m=>m.instanceMatrix.version);world.syncInstances();assert.deepEqual(meshes.map(m=>m.instanceMatrix.version),versions);
 world.fruits[0].eaten=true;world.syncInstances();assert(meshes.every(m=>m.count===0));
 world.restore(world.fruits.map(()=>false),0);assert.equal(meshes.reduce((sum,m)=>sum+m.count,0),capacity);assert(meshes.every(m=>m.visible));
 assert.deepEqual(meshes.map(m=>Array.from(m.instanceMatrix.array)),allMatrices);
});
