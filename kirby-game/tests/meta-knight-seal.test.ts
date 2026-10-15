import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BufferAttribute,FrontSide,Group,Light,Mesh,MeshBasicMaterial,Vector3} from 'three';
import {MetaKnightSeal} from '../src/meta-knight-seal';
import {ACTOR_DISTANCE,MIST_DISTANCE} from '../src/visibility';

function meshes(root:Group){const result:Mesh[]=[];root.traverse(node=>{if(node instanceof Mesh)result.push(node);});return result;}
function transform(seal:MetaKnightSeal){return [seal.model,seal.aura].flatMap(node=>[...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray()]);}

test('three seal displays share every geometry and material and stay within four draws each',()=>{
 const seals=[new MetaKnightSeal(),new MetaKnightSeal(2),new MetaKnightSeal(4)];
 const original=meshes(seals[0].group);assert.equal(original.length,4,'three solid batches and one analytic mist proxy');
 for(const seal of seals){
  const parts=meshes(seal.group);let triangles=0;
  assert.equal(parts.length,4);assert.equal(seal.model.children.length,3);
  parts.forEach((mesh,i)=>{
   assert.equal(mesh.geometry,original[i].geometry);assert.equal(mesh.material,original[i].material);
   assert(!Array.isArray(mesh.material),'one draw per mesh');assert.equal(mesh.geometry.groups.length,0);
   triangles+=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;
   assert(!mesh.castShadow);assert(!mesh.receiveShadow);assert(mesh.frustumCulled);
  });
  assert(triangles<=3180,`solid asset plus 180 proxy triangles: ${triangles}`);
  seal.group.traverse(node=>assert(!(node instanceof Light),'the seal adds no lights or shadow maps'));
 }
 assert.notEqual(seals[0].model,seals[1].model);assert.notEqual(seals[0].aura,seals[1].aura);
});

test('violet fog uses a compact occluded proxy behind the readable front relief',()=>{
 const seal=new MetaKnightSeal();seal.spinEnabled=false;seal.update(0);
 assert(seal.aura.material instanceof MeshBasicMaterial);const material=seal.aura.material;
 assert(material.transparent);assert(material.depthTest);assert(!material.depthWrite);assert.equal(material.side,FrontSide);assert(!material.toneMapped);assert.equal(material.map,null);
 assert(material.color.r>material.color.g);assert(material.color.b>material.color.r);assert(material.opacity>.5&&material.opacity<.7);
 const bounds=new Box3().setFromObject(seal.aura,true),size=bounds.getSize(new Vector3());
 assert(size.x<2.6&&size.y<2.6&&size.z<.7,'mist bounds stay close to the 1.4 metre seal');
 assert(bounds.max.z<0,'front-facing mist cannot wash out the mask and eyes');
 assert(bounds.max.x>.8&&bounds.min.x<-.8,'mist shows around both outer edges');
 const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>',uniforms:{}};
 material.onBeforeCompile(shader as unknown as Parameters<typeof material.onBeforeCompile>[0],{} as Parameters<typeof material.onBeforeCompile>[1]);
 assert(shader.fragmentShader.includes('mistChord'));assert(!shader.fragmentShader.includes('sampler2D'));assert(!/for\s*\(/.test(shader.fragmentShader),'analytic thickness needs no ray-march loop');
});

test('floating and mist breathing never upload geometry, colours, textures or material changes per frame',()=>{
 const seal=new MetaKnightSeal(),parts=meshes(seal.group),buffers=new Map<BufferAttribute,number>();
 for(const mesh of parts){for(const attribute of Object.values(mesh.geometry.attributes))if(attribute instanceof BufferAttribute)buffers.set(attribute,attribute.version);if(mesh.geometry.index)buffers.set(mesh.geometry.index,mesh.geometry.index.version);}
 const materials=parts.map(mesh=>{assert(!Array.isArray(mesh.material));return mesh.material;});
 const versions=materials.map(material=>material.version),before=transform(seal);
 for(let frame=0;frame<600;frame++)seal.update(frame/60,new Vector3(0,0,5));
 assert.notDeepEqual(transform(seal),before,'motion is visible');
 for(const [attribute,version] of buffers)assert.equal(attribute.version,version,'GPU vertex buffers remain static');
 materials.forEach((material,i)=>assert.equal(material.version,versions[i],'material programs and textures remain static'));
 assert(Math.abs(seal.model.position.y)<=.06);
});

test('distance culling skips far motion and deterministic re-entry restores fog and reset pose',()=>{
 const parent=new Group(),seal=new MetaKnightSeal(1);parent.position.set(80,0,0);seal.group.position.set(10,0,0);parent.add(seal.group);
 const near=new Vector3(90,0,5);seal.update(2,near);const displayed=transform(seal);assert(seal.group.visible&&seal.aura.visible);
 seal.update(10,new Vector3(90+ACTOR_DISTANCE+1,0,0));assert(!seal.group.visible);assert(!seal.aura.visible);assert.deepEqual(transform(seal),displayed,'far displays do not animate');
 seal.update(10,new Vector3(90+MIST_DISTANCE+1,0,0));assert(seal.group.visible);assert(!seal.aura.visible);assert.notDeepEqual(transform(seal),displayed);
 seal.update(2,near);assert(seal.aura.visible);assert.deepEqual(transform(seal),displayed,'absolute time is independent of hidden frames');
 seal.active=false;seal.update(12,near);assert(!seal.group.visible&&!seal.aura.visible);assert.deepEqual(transform(seal),displayed);
 seal.active=true;seal.update(2,near);assert(seal.group.visible&&seal.aura.visible);assert.deepEqual(transform(seal),displayed);
 seal.mistEnabled=false;seal.update(3,near);assert(seal.group.visible&&!seal.aura.visible);
 seal.mistEnabled=true;seal.update(0,near);const reset=transform(seal);seal.update(5,near);seal.update(0,near);assert.deepEqual(transform(seal),reset);
});

test('disposing one display cannot dispose the shared buffers or hide another seal',()=>{
 const parent=new Group(),first=new MetaKnightSeal(),other=new MetaKnightSeal();parent.add(first.group,other.group);let disposed=0;
 for(const mesh of meshes(first.group)){mesh.geometry.addEventListener('dispose',()=>disposed++);assert(!Array.isArray(mesh.material));mesh.material.addEventListener('dispose',()=>disposed++);}
 first.dispose();first.dispose();assert.equal(first.group.parent,null);assert(!first.active);assert(!first.group.visible);assert.equal(disposed,0);
 first.active=true;first.update(1);assert(!first.active&&!first.group.visible);
 other.update(1);assert(other.active&&other.group.visible&&other.aura.visible);assert.equal(other.group.parent,parent);
});
