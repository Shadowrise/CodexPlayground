import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {batchScenery,configureSceneryBatching,scenerySources} from '../src/scenery-batch';
import {instancedLod} from '../src/instanced-lod';
import {consolidateSceneryShadows,sceneryShadowBatch,skipShadowOnlyColourPass} from '../src/scenery-shadows';
import {InteractionOutline,outlineRegion} from '../src/interaction-outline';
import {batchRigidMeshes} from '../src/rigid-batch';

test('multi-draw preserves geometry, colour, world pose, cell bounds and approaching LODs',()=>{
 configureSceneryBatching(true);
 try{
  const root=new T.Group(),material=new T.MeshStandardMaterial({roughness:.9}),coarse=new T.BoxGeometry();
  for(const [i,g] of [new T.SphereGeometry(1,12,8),new T.CylinderGeometry(1,1,1,8)].entries())root.add(instancedLod('Shapes '+i,g,material,[{matrix:new T.Matrix4().makeTranslation(8+i*8,2,9),color:new T.Color(i?'red':'green'),detail:0}],{middle:coarse,far:coarse,middleDistance:60,farDistance:150},true));
  root.position.set(5,2,-20);root.rotation.y=.7;root.updateMatrixWorld(true);
  const old:T.InstancedMesh[]=[];root.traverse(o=>{if(o instanceof T.InstancedMesh)old.push(o);});
  const poses=old.map(m=>m.matrixWorld.clone());batchScenery(root);root.updateMatrixWorld(true);
  const batches=root.children.filter(o=>o instanceof T.BatchedMesh) as T.BatchedMesh[];assert.equal(batches.length,1);
  const b=batches[0],matrix=new T.Matrix4(),color=new T.Color(),point=new T.Vector3();
  for(const source of scenerySources(b)){
   const i=old.indexOf(source.mesh);assert(i>=0);assert.equal(source.visibility.parent?.type,'LOD');
   source.mesh.getMatrixAt(0,matrix);matrix.premultiply(poses[i]);const actual=new T.Matrix4();b.getMatrixAt(source.ids[0],actual);actual.premultiply(b.matrixWorld);
   assert(actual.elements.every((v,j)=>Math.abs(v-matrix.elements[j])<1e-5));
   b.getColorAt(source.ids[0],color);const expected=new T.Color();source.mesh.getColorAt(0,expected);assert(color.toArray().every((v,j)=>Math.abs(v-expected.toArray()[j])<1e-6));
   const bounds=b.boundingSphere!.clone().applyMatrix4(b.matrixWorld),positions=source.mesh.geometry.attributes.position;
   for(let j=0;j<positions.count;j++)assert(bounds.containsPoint(point.fromBufferAttribute(positions,j).applyMatrix4(actual)));
  }
  const camera=new T.PerspectiveCamera(),scene=new T.Scene();
  for(const x of [700,8]){
   camera.position.set(x,2,9);camera.updateMatrixWorld();root.traverse(o=>{if(o instanceof T.LOD)o.update(camera);});
   b.onBeforeRender({} as T.WebGLRenderer,scene,camera,b.geometry,b.material,null as never);
   for(const source of scenerySources(b))for(const id of source.ids)assert.equal(b.getVisibleAt(id),source.visibility.visible);
  }
  // Selection regions still isolate a bench inside a combined cell.
  const source=scenerySources(b).find(s=>s.visibility.visible)!;const p=new T.Vector3().setFromMatrixPosition(source.visibility.matrixWorld);source.mesh.getMatrixAt(0,matrix);p.setFromMatrixPosition(matrix.premultiply(source.visibility.matrixWorld));
  const outline=new InteractionOutline();outline.update(outlineRegion('bench',root,p,new T.Vector3(3,3,3)));assert.equal(outline.group.children.length,1);
 }finally{configureSceneryBatching(false);}
});

test('unsupported multi-draw keeps instancing and different finishes or reflections are never combined',()=>{
 const make=()=>{const root=new T.Group();for(let i=0;i<2;i++){const m=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial({roughness:.8}),1);m.userData.spatialCell='0,0';m.setMatrixAt(0,new T.Matrix4().makeTranslation(i*3,0,0));root.add(m);}return root;};
 const fallback=make();batchScenery(fallback);assert(fallback.children.every(m=>m instanceof T.InstancedMesh));
 configureSceneryBatching(true);
 try{
  const finishes=make();(finishes.children[0] as T.InstancedMesh<T.BufferGeometry,T.MeshStandardMaterial>).material.roughness=.2;batchScenery(finishes);assert(finishes.children.every(m=>m instanceof T.InstancedMesh));
  const reflected=make();(reflected.children[0] as T.InstancedMesh).setMatrixAt(0,new T.Matrix4().makeScale(-1,1,1));batchScenery(reflected);assert(reflected.children.every(m=>m instanceof T.InstancedMesh));
  const dense=new T.Group();for(const g of [new T.BoxGeometry(),new T.SphereGeometry()]){const m=new T.InstancedMesh(g,new T.MeshStandardMaterial(),500);m.userData.spatialCell='0,0';dense.add(m);}batchScenery(dense);assert(dense.children.every(m=>m instanceof T.InstancedMesh),'dense repeated parts keep instancing instead of many tiny GPU draws');
 }finally{configureSceneryBatching(false);}
});

test('different culling cells share a prototype atlas while retaining independent poses and bounds',()=>{
 configureSceneryBatching(true);
 try{
  const root=new T.Group(),box=new T.BoxGeometry(),ball=new T.SphereGeometry(1,8,6),pole=new T.CylinderGeometry(1,1,1,8),material=new T.MeshStandardMaterial();
  for(const [cell,geometries] of [[0,[box,ball]],[1,[box,pole]]] as const)for(const [i,geometry] of geometries.entries()){
   const m=new T.InstancedMesh(geometry,material,1);m.userData.spatialCell=`${cell},0`;m.setMatrixAt(0,new T.Matrix4().makeTranslation(cell*100+i*5,0,0));root.add(m);
  }
  batchScenery(root);const batches=root.children.filter(o=>o instanceof T.BatchedMesh) as T.BatchedMesh[];assert.equal(batches.length,2);assert.equal(batches[0].geometry,batches[1].geometry);
  assert(batches[1].boundingSphere!.center.x-batches[0].boundingSphere!.center.x>90);
  for(const b of batches)for(const source of scenerySources(b)){const id=b.getGeometryIdAt(source.ids[0]);assert.equal(b.getGeometryRangeAt(id)!.vertexCount,source.mesh.geometry.attributes.position.count);}
 }finally{configureSceneryBatching(false);}
});

test('consolidating stable silhouettes preserves every shadow matrix and geometry',()=>{
 const root=new T.Group(),geometry=new T.IcosahedronGeometry(1,2);root.position.set(17,1,8);root.rotation.y=.3;
 const positions=[new T.Matrix4().makeTranslation(3,7,5),new T.Matrix4().makeTranslation(23,8,3)];
 for(const matrix of positions)root.add(sceneryShadowBatch('Crown variant',geometry,[matrix]));
 consolidateSceneryShadows(root);root.updateMatrixWorld(true);
 const result:T.Matrix4[]=[];root.traverse(o=>{if(o instanceof T.InstancedMesh){assert(o.castShadow);assert.equal((o.material as T.Material).colorWrite,false);assert.equal(o.geometry,geometry);for(let i=0;i<o.count;i++){const m=new T.Matrix4();o.getMatrixAt(i,m);result.push(m.premultiply(o.matrixWorld));}}});
 assert.equal(result.length,positions.length);for(const m of positions){const expected=root.matrixWorld.clone().multiply(m);assert(result.some(actual=>actual.elements.every((v,i)=>Math.abs(v-expected.elements[i])<1e-5)));}
 let draws=0;root.traverse(o=>{if(o instanceof T.InstancedMesh)draws++;});assert.equal(draws,1);
});

test('regional outlines retain independent bed/ladder parts after rigid merging and follow their parent',()=>{
 const root=new T.Group();root.position.x=4;
 for(const x of [0,10]){const m=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:x?'red':'green'}));m.position.x=x;root.add(m);}
 batchRigidMeshes(root);assert.equal(root.children.length,1);
 const outline=new InteractionOutline(),target=outlineRegion('bed',root,new T.Vector3(14,0,0),new T.Vector3(3,3,3));outline.update(target);
 assert.equal(outline.group.children.length,1);assert.equal(outline.group.children[0].matrix.elements[12],14);
 root.position.x=8;outline.update(target);assert.equal(outline.group.children[0].matrix.elements[12],18);
});

test('shadow-only colour-pass suppression restores shared visible geometry and preserves complete shadow draws',()=>{
 const geometry=new T.BoxGeometry();geometry.setDrawRange(3,24);
 const proxy=new T.Mesh(geometry,new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}));proxy.castShadow=true;
 skipShadowOnlyColourPass(proxy);skipShadowOnlyColourPass(proxy);
 const args=[{} as T.WebGLRenderer,new T.Scene(),new T.PerspectiveCamera(),geometry,proxy.material,null as never] as const;
 proxy.onBeforeRender(...args);assert.equal(geometry.drawRange.count,0);
 proxy.onAfterRender(...args);assert.deepEqual(geometry.drawRange,{start:3,count:24});
 proxy.onBeforeShadow(args[0],args[1],args[2],args[2],geometry,proxy.material as never,null as never);assert.deepEqual(geometry.drawRange,{start:3,count:24});
});
