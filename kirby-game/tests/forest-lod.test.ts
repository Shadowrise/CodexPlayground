import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {forestInstances} from '../src/forest-lod';
import {ACTOR_DISTANCE} from '../src/visibility';

function crowns(){
 const shape=new T.SphereGeometry(3,8,6),coarse=new T.SphereGeometry(3.5,6,4);
 const root=forestInstances('Test crowns',shape,new T.MeshBasicMaterial(),[0,63].map(x=>({matrix:new T.Matrix4().makeTranslation(x,10,4),color:new T.Color('green'),detail:0})),{middle:coarse,far:coarse},false);
 root.updateMatrixWorld(true);
 return root.children[0] as T.LOD;
}

test('approaching a crown at the edge of a wide cell restores full leaves from either direction',()=>{
 const lod=crowns(),camera=new T.PerspectiveCamera(60,1,.1,1000);
 const update=(x:number)=>{camera.position.set(x,10,4);camera.updateMatrixWorld();lod.update(camera);};
 for(const x of [-6,69]){
  update(x<0?-800:800);assert.equal(lod.getCurrentLevel(),2);
  update(x<0?-250:313);assert.equal(lod.getCurrentLevel(),1);
  update(x);assert.equal(lod.getCurrentLevel(),0,'the full crown must return even when hysteresis was entered from far away');
  assert(lod.levels[0].object.visible);
  assert.equal(lod.levels.filter(l=>l.object.visible).length,1);
 }
});

test('foliage and tree fruit return at the firefly range, with hysteresis only on departure',()=>{
 const shape=new T.SphereGeometry(.3,10,8),root=forestInstances('Tree fruit',shape,new T.MeshBasicMaterial(),[0,63].map(x=>({matrix:new T.Matrix4().makeTranslation(x,10,4),color:new T.Color('red'),detail:2})),{middle:shape,far:shape,middleDetail:-1,farDetail:-1},false);
 root.updateMatrixWorld(true);
 const lod=root.children[0] as T.LOD,camera=new T.PerspectiveCamera(60,1,.1,1500);
 const radius=(lod.levels[0].object as T.InstancedMesh).boundingSphere!.radius;
 const update=(side:number,gap:number)=>{camera.position.copy(lod.position).add(new T.Vector3(side*(radius+gap),0,0));camera.updateMatrixWorld();lod.update(camera);};
 for(const side of [-1,1]){
  update(side,800);assert.equal(lod.getCurrentLevel(),2);
  update(side,ACTOR_DISTANCE+1);assert.equal(lod.getCurrentLevel(),1);
  update(side,ACTOR_DISTANCE-.01);assert.equal(lod.getCurrentLevel(),0,'fruit must return at the firefly visibility range');
  update(side,ACTOR_DISTANCE+1);assert.equal(lod.getCurrentLevel(),0,'small camera movements must not flicker');
  update(side,ACTOR_DISTANCE*1.16);assert.equal(lod.getCurrentLevel(),1);
  update(side,ACTOR_DISTANCE-.01);assert.equal(lod.getCurrentLevel(),0);
  assert.equal(lod.getObjectForDistance(radius+ACTOR_DISTANCE-1),lod.levels[0].object);
  assert.equal(lod.levels.filter(l=>l.object.visible).length,1);
 }
});

test('all detail levels keep both outer crowns inside their camera culling bounds',()=>{
 const lod=crowns(),camera=new T.PerspectiveCamera(45,1,.1,500),frustum=new T.Frustum(),projection=new T.Matrix4();
 const matrix=new T.Matrix4(),vertex=new T.Vector3();
 for(const level of lod.levels){
  const mesh=level.object as T.InstancedMesh;
  const sphere=mesh.boundingSphere!.clone().applyMatrix4(mesh.matrixWorld);
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);matrix.premultiply(mesh.matrixWorld);
   const position=mesh.geometry.getAttribute('position');
   for(let j=0;j<position.count;j++)assert(sphere.containsPoint(vertex.fromBufferAttribute(position,j).applyMatrix4(matrix)));
  }
  for(const x of [0,63]){
   camera.position.set(x,9,12);camera.lookAt(x,10,4);camera.updateMatrixWorld();
   projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
   assert(frustum.intersectsObject(mesh),'a close crown in the view must not lose its whole batch');
  }
 }
});
