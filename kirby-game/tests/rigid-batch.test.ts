import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {batchRigidMeshes,batchRigidTree} from '../src/rigid-batch';
import {Firefly} from '../src/firefly';

function triangles(root:T.Object3D){let count=0;root.traverse(o=>{if(o instanceof T.Mesh)count+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o instanceof T.InstancedMesh?o.count:1);});return count;}
function meshCount(root:T.Object3D){let count=0;root.traverse(o=>{if(o instanceof T.Mesh)count++;});return count;}

test('rigid batching preserves transformed vertices, normals, UVs and linear colours, including reflected instances',()=>{
 const root=new T.Group(),geometry=new T.BoxGeometry(1,1,1),red=new T.MeshStandardMaterial({color:'#cc3344',roughness:.7}),green=red.clone();green.color.set('#44cc66');
 const box=new T.Mesh(geometry,red);box.position.set(2,1,-3);box.rotation.y=.7;box.scale.set(2,3,1);root.add(box);
 const instanced=new T.InstancedMesh(geometry,green,2);instanced.position.set(-4,2,6);
 instanced.setMatrixAt(0,new T.Matrix4().makeScale(-2,1,3));instanced.setMatrixAt(1,new T.Matrix4().makeTranslation(2,3,4));instanced.setColorAt(0,new T.Color('#aaddff'));instanced.setColorAt(1,new T.Color('white'));root.add(instanced);
 root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),before=triangles(root);
 const expected:T.Vector3[]=[],normalExpected:T.Vector3[]=[],colours:T.Color[]=[];const matrix=new T.Matrix4(),instance=new T.Matrix4(),colour=new T.Color();
 for(const source of [box,instanced])for(let i=0;i<(source instanceof T.InstancedMesh?source.count:1);i++){
  matrix.copy(source.matrix);colour.copy((source.material as T.MeshStandardMaterial).color);
  if(source instanceof T.InstancedMesh){source.getMatrixAt(i,instance);matrix.multiply(instance);const c=new T.Color();source.getColorAt(i,c);colour.multiply(c);}
  const normal=new T.Matrix3().getNormalMatrix(matrix);
  for(let j=0;j<geometry.attributes.position.count;j++){expected.push(new T.Vector3().fromBufferAttribute(geometry.attributes.position,j).applyMatrix4(matrix));normalExpected.push(new T.Vector3().fromBufferAttribute(geometry.attributes.normal,j).applyNormalMatrix(normal));colours.push(colour.clone());}
 }
 batchRigidMeshes(root);root.updateMatrixWorld(true);assert.equal(meshCount(root),1);assert.equal(triangles(root),before);
 const mesh=root.children[0] as T.Mesh,g=mesh.geometry;
 assert(new T.Box3().setFromObject(root).min.distanceTo(bounds.min)<1e-5);assert(new T.Box3().setFromObject(root).max.distanceTo(bounds.max)<1e-5);
 assert.equal(g.attributes.position.count,expected.length);assert.equal(g.attributes.uv.count,expected.length);
 for(let i=0;i<expected.length;i++){
  assert(new T.Vector3().fromBufferAttribute(g.attributes.position,i).distanceTo(expected[i])<1e-5);
  assert(new T.Vector3().fromBufferAttribute(g.attributes.normal,i).distanceTo(normalExpected[i])<1e-5);
  assert(new T.Color().fromBufferAttribute(g.attributes.color,i).equals(colours[i])||new T.Color().fromBufferAttribute(g.attributes.color,i).toArray().every((c,j)=>Math.abs(c-colours[i].toArray()[j])<1e-6));
 }
 // The mirrored instance's triangles still face outwards.
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3();
 for(let i=0;i<g.index!.count;i+=3){const index=g.index!.getX(i);a.fromBufferAttribute(g.attributes.position,index);b.fromBufferAttribute(g.attributes.position,g.index!.getX(i+1));c.fromBufferAttribute(g.attributes.position,g.index!.getX(i+2));n.fromBufferAttribute(g.attributes.normal,index);assert(b.sub(a).cross(c.sub(a)).dot(n)>0);}
});

test('animated meshes, transparent surfaces and different lighting/shadow properties stay independent',()=>{
 const root=new T.Group(),g=new T.BoxGeometry(),m=new T.MeshStandardMaterial({roughness:.6});
 const animated=new T.Mesh(g,m);animated.name='Moving';root.add(animated,new T.Mesh(g,m),new T.Mesh(g,m));
 const glass=new T.Mesh(g,new T.MeshStandardMaterial({transparent:true,opacity:.4})),shiny=new T.Mesh(g,new T.MeshStandardMaterial({roughness:.2})),shadow=new T.Mesh(g,m);shadow.castShadow=true;root.add(glass,shiny,shadow);
 const clip=new T.AnimationClip('Move',1,[new T.VectorKeyframeTrack('Moving.position',[0,1],[0,0,0,2,0,0])]);
 batchRigidTree(root,[clip]);assert.equal(animated.parent,root);assert.equal(glass.parent,root);assert.equal(shiny.parent,root);assert.equal(shadow.parent,root);assert.equal(meshCount(root),5);
 new T.AnimationMixer(root).clipAction(clip).play().getMixer().update(.5);assert.equal(animated.position.x,1);
});

test('batched firefly retains all animated pivots, blinking, poses and independently coloured glow with shared geometry',async()=>{
 const bytes=await readFile(new URL('../public/models/firefly-animated.glb',import.meta.url));const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const template=gltf.scene.clone(true),before=triangles(template);batchRigidTree(template,gltf.animations);
 assert(meshCount(template)<=40);assert.equal(triangles(template),before);
 const original=new Firefly({...gltf,scene:gltf.scene.clone(true)}),batched=new Firefly({...gltf,scene:template.clone(true)}),other=new Firefly({...gltf,scene:template.clone(true)});
 for(const mode of ['Sit','Fly','Sit'] as const){
  original.setMode(mode);batched.setMode(mode);
  for(const dt of [.3,.04,1.34,.32]){
   original.update(dt);batched.update(dt);original.object.updateMatrixWorld(true);batched.object.updateMatrixWorld(true);
   for(const track of gltf.animations.find(c=>c.name===mode)!.tracks){const name=T.PropertyBinding.parseTrackName(track.name).nodeName!,a=original.object.getObjectByName(name)!,b=batched.object.getObjectByName(name)!;assert(a.matrixWorld.elements.every((v,i)=>Math.abs(v-b.matrixWorld.elements[i])<1e-6),name);}
   const a=new T.Box3().setFromObject(original.object,true),b=new T.Box3().setFromObject(batched.object,true);assert(a.min.distanceTo(b.min)<1e-5);assert(a.max.distanceTo(b.max)<1e-5);
  }
 }
 batched.setGlowColor('#ff3388');other.setGlowColor('#22ccff');
 const glow=(f:Firefly)=>(f.object.getObjectByName('Glow_Abdomen') as T.Mesh).material as T.MeshStandardMaterial;
 assert.equal(glow(batched).emissive.getHexString(),'ff3388');assert.equal(glow(other).emissive.getHexString(),'22ccff');
 const a=batched.object.getObjectByName('Batched rigid details') as T.Mesh,b=other.object.getObjectByName('Batched rigid details') as T.Mesh;assert.equal(a.geometry,b.geometry);
});
