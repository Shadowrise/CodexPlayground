import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {createTreeShadowTexture,treeShadows,updateTreeShadows} from '../src/tree-shadows';
import {daylight} from '../src/day-cycle';
import {createBroadleafTree} from '../src/broadleaf-tree';
import {spruceGeometries,spruceParts} from '../src/spruce-shape';

test('shared painted shadows have smooth foliage gaps, mipmaps and two triangles instead of depth casters',()=>{
 const a=treeShadows([new T.Matrix4().makeTranslation(2,.018,4)]),b=treeShadows([new T.Matrix4().makeTranslation(128,.018,4)]);
 const first=a.children[0] as T.InstancedMesh,second=b.children[0] as T.InstancedMesh;
 assert.equal(first.geometry,second.geometry);assert.equal(first.material,second.material);
 assert.equal(first.geometry.index!.count,6);assert(!first.castShadow);assert(!first.receiveShadow);
 const material=first.material as T.MeshBasicMaterial;
 assert(material.transparent);assert(!material.depthWrite);assert.equal(material.alphaTest,0);assert(material.opacity>=.5&&material.opacity<.6);
 const map=material.map!;assert(map.generateMipmaps);assert.equal(map.minFilter,T.LinearMipmapLinearFilter);
 const texture=createTreeShadowTexture(),data=texture.image.data as Uint8Array,size=texture.image.width;
 const at=(u:number,v:number)=>data[(T.MathUtils.clamp(Math.floor(v*size),0,size-1)*size+T.MathUtils.clamp(Math.floor(u*size),0,size-1))*4+3];
 const projection=texture.userData.projection;
 assert.equal(projection.kind,'birch');assert.equal(projection.variation,1);
 const source=createBroadleafTree(projection.kind,projection.variation),leaves=source.leaves,index=leaves.index!,p=leaves.attributes.position,point=new T.Vector3(),vertex=new T.Vector3();
 let covered=0,count=0;
 for(let i=0;i<index.count;i+=24){
  point.set(0,0,0);for(let j=0;j<3;j++)point.add(vertex.fromBufferAttribute(p,index.getX(i+j)));point.multiplyScalar(1/3);
  if(at(.5+point.x/(2*projection.halfWidth),(point.z+point.y*projection.slope)/projection.length)>70)covered++;
  count++;
 }
 assert(covered/count>.9,'the mask must follow projected leaves from the real source tree');
 assert(at(.01,.02)<10,'transparent outside');
 assert(data.some((value,i)=>i%4===3&&value>230),'solid parts of the real silhouette');
 assert(data.some((value,i)=>i%4===3&&value>0&&value<255),'soft edge gradients');
 for(const part of [source.wood,source.leaves,source.fruit,source.shadow])part.dispose();
 texture.dispose();
});

test('sun/moon updates only shared uniforms and stay within conservative culling bounds',()=>{
 const group=treeShadows([new T.Matrix4().makeScale(4,1,4)],[new T.Matrix4().makeScale(2,1,2)]),mesh=group.children[0] as T.InstancedMesh,material=mesh.material as T.MeshBasicMaterial;
 const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:''};
 material.onBeforeCompile(shader as never,{} as never);
 const original=[...mesh.instanceMatrix.array],profile=new T.Color();let maximum=0;
 for(let i=0;i<=600;i++){
  updateTreeShadows(daylight(i/600));const d=shader.uniforms.treeShadowDirection.value as T.Vector2,s=shader.uniforms.treeShadowStretch.value as number;
  assert(Math.abs(d.length()-1)<1e-6);for(let j=0;j<mesh.count;j++){mesh.getColorAt(j,profile);maximum=Math.max(maximum,Math.hypot(1,s*profile.g*2));}
  assert(material.opacity>=0&&material.opacity<=.74*.8);
 }
 assert(maximum<=mesh.geometry.boundingSphere!.radius,'culling includes the GPU projection at dusk');
 assert.deepEqual([...mesh.instanceMatrix.array],original,'no per-tree matrix uploads while the sun moves');
 for(const phase of [0,.5,1]){updateTreeShadows(daylight(phase));assert.equal(material.opacity,0,'hide the silhouette while the sun/moon direction hands over');}
 updateTreeShadows(daylight(.25));assert.equal(material.opacity,.64*.8);
 updateTreeShadows(daylight(.75));assert.equal(material.opacity,.74*.8);
});

test('spruce shadows follow the actual conifer silhouette rather than the broadleaf crown',()=>{
 const texture=createTreeShadowTexture('spruce'),birch=createTreeShadowTexture(),p=texture.userData.projection;
 const size=texture.image.width,data=texture.image.data as Uint8Array;
 assert.equal(p.kind,'spruce');assert(p.aspect>birch.userData.projection.aspect*1.2,'conifers have a tall narrow outline');
 assert.notDeepEqual(data,birch.image.data);
 const at=(x:number,z:number)=>{
  const u=.5+x/(2*p.halfWidth),v=z/p.length;
  return data[(Math.min(size-1,Math.max(0,Math.floor(v*size)))*size+Math.min(size-1,Math.max(0,Math.floor(u*size))))*4+3];
 };
 const shapes=spruceGeometries(),point=new T.Vector3(),vertex=new T.Vector3();let covered=0,count=0;
 for(const part of spruceParts()){
  const g=shapes[part.kind],position=g.attributes.position,index=g.index!;
  for(let i=0;i<index.count;i+=12){
   point.set(0,0,0);for(let j=0;j<3;j++)point.add(vertex.fromBufferAttribute(position,index.getX(i+j)));
   point.multiplyScalar(1/3).applyMatrix4(part.matrix);
   if(at(point.x,point.z+point.y*p.slope)>70)covered++;count++;
  }
 }
 assert(covered/count>.9,'trunk and layered needle branches must lie inside their projected shadow');
 const span=(v:number)=>{let low=size,high=-1;for(let x=0;x<size;x++)if(data[(Math.floor(v*size)*size+x)*4+3]>80){low=Math.min(low,x);high=x;}return Math.max(0,high-low);};
 assert(span(.88)<span(.4)*.6,'the upper silhouette tapers to a narrow treetop');
 assert(data.some((value,i)=>i%4===3&&value>0&&value<255),'feathered edges instead of a sharp mask');
 Object.values(shapes).forEach(g=>g.dispose());texture.dispose();birch.dispose();
});

test('both silhouettes share a padded atlas and a single spatial draw with stable instance profiles',()=>{
 const a=new T.Matrix4().makeTranslation(2,.018,4),b=new T.Matrix4().makeTranslation(10,.018,4);
 const group=treeShadows([a],[b]);assert.equal(group.children.length,1);
 const mesh=group.children[0] as T.InstancedMesh,map=(mesh.material as T.MeshBasicMaterial).map!;
 assert.equal(mesh.count,2);assert.equal(mesh.geometry.index!.count,6);
 assert.deepEqual(map.userData.projections.map((p:{kind:string})=>p.kind),['birch','spruce']);
 const color=new T.Color(),matrix=new T.Matrix4();
 for(const kind of [0,1]){
  mesh.getColorAt(kind,color);assert.equal(color.r,kind);assert(Math.abs(color.g-map.userData.projections[kind].aspect)<1e-6);
  mesh.getMatrixAt(kind,matrix);assert.equal(matrix.elements[12],kind?10:2);
  if(kind)assert(Math.abs(matrix.elements[0]-map.userData.projections[kind].halfWidth)<1e-6);
 }
 const data=map.image.data as Uint8Array,width=map.image.width,height=map.image.height,{tile,padding}=map.userData.atlas;
 assert.equal(width,tile*2);assert.equal(height,tile);assert(padding>=16);
 for(let y=0;y<height;y++)for(let x=tile-padding;x<tile+padding;x++)assert.equal(data[(y*width+x)*4+3],0,'padding keeps filtered masks from bleeding into each other');
 const before=[...mesh.instanceColor!.array];updateTreeShadows(daylight(.22));updateTreeShadows(daylight(.75));
 assert.deepEqual([...mesh.instanceColor!.array],before,'time updates do not upload per-tree profile data');
 const mat=mesh.material as T.MeshBasicMaterial,shader={uniforms:{},vertexShader:'#include <common>\n#include <uv_vertex>\n#include <begin_vertex>',fragmentShader:''};
 mat.onBeforeCompile(shader as never,{} as never);assert(shader.vertexShader.includes('instanceColor.r'));assert(shader.vertexShader.includes('treeShadowStretch*instanceColor.g'));
});
