import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {MetaKnightDashSparks,DASH_SPARK_COUNT} from '../src/meta-knight-dash-sparks';

test('sword flight uses feathered translucent mist with small twinkles around the blade',()=>{
 const blade=new T.Group(),effect=new MetaKnightDashSparks(blade);effect.update(150,true);
 const mist=effect.group.getObjectByName('Galaxia soft flying mist')!;assert.equal(mist.children.length,8);assert.equal(effect.group.parent,blade);
 for(const puff of mist.children as T.Mesh<T.IcosahedronGeometry,T.MeshBasicMaterial>[]){
  assert(puff.material.transparent);assert(!puff.material.depthWrite);assert(puff.material.opacity>=.22&&puff.material.opacity<=.3);assert.equal(puff.material.blending,T.AdditiveBlending);assert.equal(puff.material.customProgramCacheKey(),'soft-volume-mist-v1');
  assert(puff.position.y>.3&&puff.position.y<2.1);assert(puff.scale.x>.35&&puff.scale.z>.3,'the cloud stays broad throughout its breathing cycle');assert(puff.position.y-puff.scale.y>.1,'the hot atmosphere remains in front of the hilt');
 }
 const core=effect.group.children[0] as T.InstancedMesh<T.OctahedronGeometry,T.MeshBasicMaterial>;assert(core.geometry.parameters.radius<=.03);assert.equal(core.count,DASH_SPARK_COUNT);effect.dispose();assert(!effect.group.parent);
});

test('particles remain in a small volume along Galaxia instead of trailing back through the body',()=>{
 const effect=new MetaKnightDashSparks(new T.Group()),core=effect.group.children[0] as T.InstancedMesh,matrix=new T.Matrix4(),point=new T.Vector3(),buffer=core.instanceMatrix;
 for(const time of [0,120,360,650,1500,7500]){
  effect.update(time,true);
  for(let i=0;i<core.count;i++){core.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert(point.y>.2&&point.y<2.1);assert(Math.abs(point.z)<.4);assert(Math.abs(point.x+.315*point.y/2.05)<.4);assert(matrix.elements.every(Number.isFinite));}
 }
 assert.equal(core.instanceMatrix,buffer);effect.update(8000,false);assert(!effect.group.visible);effect.dispose();
});
