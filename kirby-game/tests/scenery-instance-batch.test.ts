import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {batchSceneryAsync,configureSceneryBatching,SceneryInstanceBatch,scenerySources} from '../src/scenery-batch';
import {SceneryVisibility} from '../src/scenery-visibility';
import {instancedLod} from '../src/instanced-lod';
import {shadowParts} from '../src/prepared-shadows';
import {InteractionOutline,outlineRegion} from '../src/interaction-outline';

test('combined cells retain authored colour, poses, near shadows and regional outlines',async()=>{
 const root=new T.Group(),near=new T.BoxGeometry(),far=new T.SphereGeometry(1,8,6),material=new T.MeshStandardMaterial({color:'#789abc'});
 const parts=[-150,0,150].map(x=>({matrix:new T.Matrix4().makeTranslation(x,0,0),color:new T.Color('#ab9876'),detail:0}));
 root.add(instancedLod('Trees',near,material,parts,{middle:far,far,middleDistance:50,farDistance:100,cellSize:48},true));
 root.position.set(5,0,-20);root.rotation.y=.2;
 const before=shadowParts(root);assert.equal(before.length,3);
 await batchSceneryAsync(root,true);root.updateWorldMatrix(true,true);
 const batches:SceneryInstanceBatch[]=[];root.traverse(o=>{if(o instanceof SceneryInstanceBatch)batches.push(o);});assert.equal(batches.length,2);
 const after=shadowParts(root);assert.equal(after.length,before.length,'retained sources must not duplicate baked silhouettes');
 after.forEach((part,i)=>assert(part.matrix.elements.every((v,j)=>Math.abs(v-before[i].matrix.elements[j])<1e-5)));
 const camera=new T.PerspectiveCamera(60,1,.1,1000);camera.position.set(5,0,20);camera.lookAt(5,0,-20);
 const visibility=new SceneryVisibility([root]);visibility.update(camera,750);
 const active=batches.filter(b=>b.count);assert.equal(active.length,1);assert.equal(active[0].geometry,near);assert.equal(active[0].count,1);
 const matrix=new T.Matrix4(),source=scenerySources(active[0]).find(s=>s.shown)!;active[0].getMatrixAt(0,matrix);
 const expected=new T.Matrix4();source.mesh.getMatrixAt(0,expected);expected.premultiply(source.visibility.matrixWorld);matrix.premultiply(active[0].matrixWorld);
 assert(matrix.elements.every((v,i)=>Math.abs(v-expected.elements[i])<1e-5));
 const actual=new T.Color();active[0].getColorAt(0,actual);const colour=material.color.clone().multiply(parts[0].color);assert(actual.toArray().every((v,i)=>Math.abs(v-colour.toArray()[i])<1e-6));
 const point=new T.Vector3().setFromMatrixPosition(expected),outline=new InteractionOutline();outline.update(outlineRegion('one tree',root,point,new T.Vector3(4,4,4)));assert.equal(outline.group.children.length,1);
});

test('multi-draw does not rebatch retained originals, and reflected cells keep their original draws',async()=>{
 configureSceneryBatching(true);
 try{
  const root=new T.Group(),material=new T.MeshStandardMaterial();
  for(const geometry of [new T.BoxGeometry(),new T.SphereGeometry(1,8,6)])for(let cell=0;cell<3;cell++){
   const mesh=new T.InstancedMesh(geometry,material,1);mesh.userData.spatialCell=String(cell);mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(cell*64,0,0));root.add(mesh);
  }
  await batchSceneryAsync(root,true);const batches=root.children.filter(o=>o instanceof SceneryInstanceBatch);assert.equal(batches.length,2);
  for(const batch of batches)for(const source of scenerySources(batch))assert.equal(source.mesh.parent,source.visibility);
  assert(!root.children.some(o=>o instanceof T.BatchedMesh),'retained source meshes must not become a second copy of the scene');
  const reflected=new T.Group(),shape=new T.BoxGeometry();for(let i=0;i<3;i++){const mesh=new T.InstancedMesh(shape,material,1);mesh.userData.spatialCell=String(i);mesh.scale.x=-1;reflected.add(mesh);}
  await batchSceneryAsync(reflected,true);assert(reflected.children.every(o=>o instanceof T.InstancedMesh&&!(o instanceof SceneryInstanceBatch)));
 }finally{configureSceneryBatching(false);}
});

test('camera travel, fog, LOD and enabled fallback update before this frame uploads',async()=>{
 const scene=new T.Scene(),root=new T.Group();scene.add(root);const near=new T.BoxGeometry(),far=new T.SphereGeometry(1,8,6),material=new T.MeshLambertMaterial();
 root.add(instancedLod('Trees',near,material,[-160,0,160].map(x=>({matrix:new T.Matrix4().makeTranslation(x,0,0),color:new T.Color('white'),detail:0})),{middle:far,far,middleDistance:50,farDistance:100,cellSize:48},true));
 await batchSceneryAsync(root,true);const visibility=new SceneryVisibility([root],scene),batches:SceneryInstanceBatch[]=[];root.traverse(o=>{if(o instanceof SceneryInstanceBatch)batches.push(o);});
 const camera=new T.PerspectiveCamera(55,1,.1,1000);
 const render=()=>scene.onBeforeRender({} as T.WebGLRenderer,scene,camera,null as never,null as never,null as never);
 const frame=(x:number,distance=750)=>{camera.position.set(x,0,20);camera.lookAt(x,0,0);visibility.update(camera,distance);render();};
 for(const x of [-160,0,160,0,-160]){frame(x);const batch=batches.find(b=>b.count)!;assert.equal(batch.geometry,near);assert.equal(batch.count,1);const version=batch.instanceMatrix.version;frame(x);assert.equal(batch.instanceMatrix.version,version,'unchanged visible cells must not upload again');}
 camera.position.set(0,0,200);camera.lookAt(0,0,0);visibility.update(camera,750);render();assert(batches.some(b=>b.geometry===far&&b.count>0));
 visibility.update(camera,50);render();assert(batches.every(b=>b.count===0));
 batches.forEach(b=>b.enabled=false);frame(0);assert(batches.every(b=>!b.visible));assert(scenerySources(batches[0]).every(s=>s.mesh.visible));
 batches.forEach(b=>b.enabled=true);frame(0);assert(batches.some(b=>b.count===1));assert(scenerySources(batches[0]).every(s=>!s.mesh.visible));
});
