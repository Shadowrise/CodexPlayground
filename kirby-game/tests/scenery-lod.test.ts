import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {instancedLod} from '../src/instanced-lod';
import {HedgeMaze} from '../src/maze';
import {createLandmarks} from '../src/landmarks';

const triangles=(mesh:T.InstancedMesh)=>(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3*mesh.count;

test('spatial LOD preserves coloured world transforms under a transformed parent at every distance',()=>{
 const parts=[-47,1,47].map((x,i)=>({matrix:new T.Matrix4().compose(new T.Vector3(x,2+i,3),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),i*.4),new T.Vector3(2,3,1)),color:new T.Color(['red','green','blue'][i]),detail:0}));
 const near=new T.SphereGeometry(1,12,8),coarse=new T.OctahedronGeometry(1);
 const root=instancedLod('Test scenery',near,new T.MeshStandardMaterial(),parts,{middle:coarse,far:coarse,cellSize:48,middleDistance:60,farDistance:150},true);
 root.position.set(7,0,-20);root.rotation.y=.6;root.updateMatrixWorld(true);
 assert.equal(root.children.length,2,'separate regions can be culled independently');
 const matrix=new T.Matrix4(),colour=new T.Color(),point=new T.Vector3();
 for(let level=0;level<3;level++){
  const seen=new Set<number>();
  for(const cell of root.children as T.LOD[]){
   const mesh=cell.levels[level].object as T.InstancedMesh;
   const sphere=mesh.boundingSphere!.clone().applyMatrix4(mesh.matrixWorld);
   assert.equal(mesh.receiveShadow,true);assert.equal(mesh.castShadow,false);
   for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);matrix.premultiply(mesh.matrixWorld);mesh.getColorAt(i,colour);
    const part=parts.findIndex(p=>Math.hypot(p.color.r-colour.r,p.color.g-colour.g,p.color.b-colour.b)<1e-6);
    assert(part>=0 && !seen.has(part));seen.add(part);
    const expected=root.matrixWorld.clone().multiply(parts[part].matrix);
    matrix.elements.forEach((v,j)=>assert(Math.abs(v-expected.elements[j])<1e-5));
    const vertices=mesh.geometry.getAttribute('position');
    for(let j=0;j<vertices.count;j++)assert(sphere.containsPoint(point.fromBufferAttribute(vertices,j).applyMatrix4(matrix)),'coarse geometry must also fit its own culling bound');
   }
  }
  assert.equal(seen.size,parts.length,'no distant instance disappears or moves');
 }
});

test('distant rainbow hedges retain every clump, near density and independent continuous shadows',()=>{
 const maze=new HedgeMaze();maze.group.updateMatrixWorld(true);
 const foliage=maze.group.getObjectByName('Detailed maze foliage')!;
 let nearCount=0,nearTriangles=0,farTriangles=0;
 for(const cell of foliage.children as T.LOD[]){
  const near=cell.levels[0].object as T.InstancedMesh;
  nearCount+=near.count;nearTriangles+=triangles(near);
  for(const {object} of cell.levels){
   const mesh=object as T.InstancedMesh;
   assert.equal(mesh.count,near.count,'simplify each leaf rather than remove hedge coverage');
   assert.equal(mesh.instanceMatrix,near.instanceMatrix);assert.equal(mesh.instanceColor,near.instanceColor);
   assert.equal(mesh.castShadow,false);
  }
  farTriangles+=triangles(cell.levels[2].object as T.InstancedMesh);
  // Return from outside the map to a clump on the outer edge of its batch.
  const camera=new T.PerspectiveCamera(),m=new T.Matrix4();near.getMatrixAt(near.count-1,m);m.premultiply(near.matrixWorld);
  camera.position.set(1000,10,1000);camera.updateMatrixWorld();cell.update(camera);assert.equal(cell.getCurrentLevel(),2);
  camera.position.setFromMatrixPosition(m).add(new T.Vector3(0,0,3));camera.updateMatrixWorld();cell.update(camera);
  assert.equal(cell.getCurrentLevel(),0);assert.equal(cell.levels.filter(l=>l.object.visible).length,1);
 }
 assert(nearCount>9000);assert(farTriangles<=nearTriangles/4);
 let shadows=0;
 maze.group.getObjectByName('Stable hedge shadows')!.traverse(o=>{if(o instanceof T.InstancedMesh){shadows+=o.count;assert(o.castShadow);assert.equal((o.material as T.Material).colorWrite,false);}});
 assert.equal(shadows,maze.walls.length,'every wall retains its continuous shadow at all distances');
});

test('landmark LOD reduces distant geometry without losing decorations or shadows',()=>{
 const root=createLandmarks();root.updateMatrixWorld(true);
 let cells=0,nearTriangles=0,farTriangles=0,shadows=0;
 root.traverse(o=>{
  if(o instanceof T.LOD){
   cells++;const near=o.levels[0].object as T.InstancedMesh,far=o.levels[2].object as T.InstancedMesh;
   assert.equal(far.count,near.count);assert.equal(far.instanceMatrix,near.instanceMatrix);assert.equal(far.instanceColor,near.instanceColor);
   nearTriangles+=triangles(near);farTriangles+=triangles(far);
  }
  if(o instanceof T.InstancedMesh && o.castShadow){shadows+=o.count;assert.equal((o.material as T.Material).colorWrite,false);}
 });
 assert(cells>20);assert(shadows>100);assert(farTriangles<nearTriangles*.4);
});
