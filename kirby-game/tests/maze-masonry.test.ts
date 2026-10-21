import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Color,InstancedMesh,LOD,Matrix4,Mesh,MeshStandardMaterial,Vector3} from 'three';
import {makeMazeMasonry,mazeBrickGeometry,mazeTrimGeometry} from '../src/maze-masonry';
import {HedgeMaze} from '../src/maze';
import {makeMazeEntrance} from '../src/maze-entrance-model';

test('rounded brick faces keep curved silhouettes, smooth rim normals and a small triangle budget',()=>{
 for(const [segments,returnSide,limit] of [[3,false,22],[1,false,6],[3,true,36],[1,true,12]] as const){
  const g=mazeBrickGeometry(.16,segments,returnSide),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,idx=g.index!;assert.equal(idx.count/3,limit);
  for(let i=0;i<p.count;i++){assert(Math.max(Math.abs(p.getX(i)),Math.abs(p.getY(i)),Math.abs(p.getZ(i)))<=.500001);assert(Number.isFinite(uv.getX(i))&&Number.isFinite(uv.getY(i)));assert(p.getZ(i)>=(returnSide?0:.42));assert(!(Math.abs(p.getX(i))>.499&&Math.abs(p.getY(i))>.499),'corners curve away from the rectangular bounds');assert(Math.abs(new Vector3().fromBufferAttribute(n,i).length()-1)<1e-6);}
  for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2),normal=new Vector3().fromBufferAttribute(p,b).sub(new Vector3().fromBufferAttribute(p,a)).cross(new Vector3().fromBufferAttribute(p,c).sub(new Vector3().fromBufferAttribute(p,a)));assert(normal.dot(new Vector3().fromBufferAttribute(n,a))>0,'every face is opaque from the outside');}
  if(segments>1)assert(Array.from({length:n.count},(_,i)=>n.getX(i)).some(x=>Math.abs(x)>.1&&Math.abs(x)<.7),'rim normals follow the round corners');
  if(returnSide)assert.equal(g.boundingBox!.min.z,0,'returns close each brick all the way to the wall centre');
 }
});

test('coping, wall ends and footing curve across every axis with bounded shared geometry',()=>{
 for(const radius of [new Vector3(.1,.42,.18),new Vector3(.04,.025,.2),new Vector3(.04,.36,.18)])for(const [segments,half,limit] of [[2,true,58],[1,true,30],[1,false,44]] as const){
  const g=mazeTrimGeometry(radius,segments,half),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,idx=g.index!;assert.equal(idx.count/3,limit);
  for(let i=0;i<p.count;i++){
   const point=new Vector3().fromBufferAttribute(p,i),normal=new Vector3().fromBufferAttribute(n,i);assert(Math.max(Math.abs(point.x),Math.abs(point.y),Math.abs(point.z))<=.500001);if(half)assert(point.z>=0);assert(Math.abs(normal.length()-1)<1e-6);assert(Number.isFinite(uv.getX(i))&&Number.isFinite(uv.getY(i)));
   assert([point.x,point.y,point.z].filter(v=>Math.abs(v)>.499999).length<=1,'no pair of extreme planes meets in a sharp edge');
  }
  if(segments>1)for(let axis=0;axis<3;axis++)assert(Array.from({length:n.count},(_,i)=>Math.abs(n.getComponent(i,axis))).some(v=>v>.01&&v<.99),'every axis participates in the rounded rims');
  for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2),cross=new Vector3().fromBufferAttribute(p,b).sub(new Vector3().fromBufferAttribute(p,a)).cross(new Vector3().fromBufferAttribute(p,c).sub(new Vector3().fromBufferAttribute(p,a)));assert(cross.dot(new Vector3().fromBufferAttribute(n,a))>0,'curved trim stays opaque from outside');}
 }
});

test('mortar, footing and coping retain each passage hue at a darker shade',()=>{
 const colors=[new Color('#9444d2'),new Color('#36b7e5')],root=makeMazeMasonry([{x:0,z:0,hx:5,hz:.7,cell:0,neighbor:1}],cell=>colors[cell]);root.updateMatrixWorld(true);
 for(const name of ['Maze mortar and footing','Maze coping stones']){
  const seen=new Set<number>();root.getObjectByName(name)!.traverse(o=>{if(!(o instanceof LOD))return;const mesh=o.levels[0].object as InstancedMesh;
   for(let i=0;i<mesh.count;i++){const matrix=new Matrix4();mesh.getMatrixAt(i,matrix);const side=matrix.elements[10]<0?1:0,color=new Color();mesh.getColorAt(i,color);const expected=colors[side],scale=color.r/expected.r;assert(scale>.3&&scale<.65);assert(Math.abs(color.g-expected.g*scale)<1e-6&&Math.abs(color.b-expected.b*scale)<1e-6,'trim is a darker version of its passage colour');seen.add(side);}
  });assert.equal(seen.size,2,'both passage colours survive on trim');
 }
});

test('brick scenery stays within a quarter-million triangles, shares one stone material and keeps a two-triangle floor',()=>{
 const maze=new HedgeMaze(),root=maze.group.getObjectByName('Dressed maze masonry')!;let triangles=0,cells=0;const materials=new Set();
 root.traverse(o=>{assert(!('isLight' in o));assert(!('isSprite' in o));if(o instanceof LOD){cells++;const mesh=o.levels[0].object as InstancedMesh;triangles+=(mesh.geometry.index!.count/3)*mesh.count;materials.add(mesh.material);assert(mesh.instanceColor);assert(!mesh.castShadow);}});
 assert(cells<=20);assert(triangles<250000);assert.equal(materials.size,1);assert(!root.getObjectByName('Detailed maze foliage'));
 const floor=root.getObjectByName('Maze paved floor') as Mesh,material=floor.material as MeshStandardMaterial;assert.equal(floor.geometry.index!.count,6);assert(!floor.castShadow);assert(material.map&&material.bumpMap);assert.equal(material.map.image.width,512);assert(material.map.generateMipmaps&&!material.transparent);
 const bounds=new Box3().setFromObject(makeMazeEntrance());assert(bounds.max.z<38,'no old stepping boards extend along the approach');
});
