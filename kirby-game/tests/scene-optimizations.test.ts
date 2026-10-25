import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clusteredGeometry} from '../src/geometry-detail';
import {CharacterShadowPass} from '../src/character-shadow-pass';
import {NightFireflies} from '../src/night-fireflies';
import {ForestDetail} from '../src/forest-detail';
import {parseRenderScale} from '../src/render-scale';

test('shadow geometry preserves authored morph/skin data, bounds and material groups',()=>{
 const source=new T.SphereGeometry(1,128,96),count=source.attributes.position.count;
 source.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(count*4).fill(2),4));
 const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
 source.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 source.morphAttributes.position=[source.attributes.position.clone()];source.morphTargetsRelative=true;
 source.clearGroups();source.addGroup(0,source.index!.count/2,0);source.addGroup(source.index!.count/2,source.index!.count/2,1);
 const reduced=clusteredGeometry(source);
 assert(reduced.index!.count<source.index!.count*.5);assert.equal(clusteredGeometry(source),reduced);
 assert.equal(reduced.groups.length,2);assert(reduced.morphTargetsRelative);
 const p=reduced.attributes.position,vertex=new T.Vector3();
 for(let i=0;i<p.count;i++){
  assert.equal(reduced.attributes.skinIndex.getX(i),2);assert.equal(reduced.attributes.skinWeight.getX(i),1);
  vertex.fromBufferAttribute(p,i);assert(Math.abs(vertex.length()-1)<1e-6);
  assert.equal(reduced.morphAttributes.position![0].getX(i),p.getX(i));
 }
 assert(reduced.boundingBox!.min.distanceTo(source.boundingBox!.min)<.05);
 assert.equal(source.attributes.position.count,count);
});

test('shadow view excludes scenery and follows live pose and ancestor visibility without reparenting',()=>{
 const scene=new T.Scene(),actor=new T.Group(),model=new T.Group(),background=new T.Group();model.userData.characterShadow=true;
 const source=new T.Mesh(new T.SphereGeometry(1,128,96),new T.MeshStandardMaterial());source.castShadow=true;
 model.add(source);actor.add(model);scene.add(actor,background);background.add(new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial()));
 let rendered:T.Object3D|undefined;
 const renderer={shadowMap:{render:(_lights:unknown,root:T.Object3D)=>{rendered=root;}}} as unknown as T.WebGLRenderer;
 const pass=new CharacterShadowPass(renderer,scene);pass.refresh();scene.updateMatrixWorld(true);
 const render=()=>renderer.shadowMap.render([],scene,new T.Camera());render();
 assert.equal(rendered,pass.scene);const proxies:T.Mesh[]=[];pass.scene.traverse(o=>{if(o instanceof T.Mesh)proxies.push(o);});
 assert.equal(proxies.length,1);const proxy=proxies[0];
 assert.notEqual(proxy.geometry,source.geometry);assert.equal(proxy.matrixWorld,source.matrixWorld);assert.equal(proxy.material,source.material);
 assert.equal(source.parent,model);assert.equal(model.parent,actor);
 actor.position.set(4,2,3);scene.updateMatrixWorld(true);render();assert.equal(proxy.matrixWorld.elements[12],4);
 actor.visible=false;render();let visible=0;pass.scene.traverseVisible(o=>{if(o instanceof T.Mesh)visible++;});assert.equal(visible,0);
 source.castShadow=false;render();assert(!proxy.castShadow);
 pass.enabled=false;render();assert.equal(rendered,scene);
});

test('distant fireflies share posed geometry while nearby bugs and glow colours stay independent',async()=>{
 const bytes=await readFile(new URL('../public/models/firefly-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const fireflies=new NightFireflies(gltf),camera=fireflies.bugs[0].home.clone().add(new T.Vector3(0,3,5));
 fireflies.update(.1,1,camera);fireflies.syncInstances();
 assert(fireflies.bugs[0].firefly.object.visible,'nearby bug keeps native details');
 const distant=fireflies.bugs.find(b=>b.carrier.position.distanceTo(camera)>90&&b.carrier.position.distanceTo(camera)<160)!;
 assert(distant);assert(!distant.firefly.object.visible);
 const meshes=fireflies.instances.group.children as T.InstancedMesh[];
 assert(meshes.some(mesh=>mesh.count>0));assert(meshes.every(mesh=>!mesh.castShadow));
 const matrix=new T.Matrix4(),point=new T.Vector3();
 for(const mesh of meshes)if(mesh.count){mesh.getMatrixAt(0,matrix);point.setFromMatrixPosition(matrix);assert(point.toArray().every(Number.isFinite));assert(matrix.determinant()>=0);assert(mesh.boundingSphere!.radius>0);}
 const glow=meshes.find(mesh=>(mesh.material as T.Material).name==='Firefly_Glow'&&mesh.count)!;
 assert.equal((glow.material as T.MeshStandardMaterial).color.getHexString(),'ffffff');
 assert.equal((glow.material as T.MeshStandardMaterial).emissive.getHexString(),'ffffff');
 fireflies.instances.enabled=false;fireflies.syncInstances();assert(distant.firefly.object.visible);assert(!fireflies.instances.group.visible);
});

test('shadow rig follows an attached skeleton after movement and growth, including live morphs',()=>{
 const scene=new T.Scene(),actor=new T.Group(),model=new T.Group();model.userData.characterShadow=true;scene.add(actor);actor.add(model);
 const geometry=new T.SphereGeometry(1,8,6),count=geometry.attributes.position.count;
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(count*4),4));
 const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 geometry.morphAttributes.position=[geometry.attributes.position.clone()];geometry.morphTargetsRelative=true;
 const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial()),bone=new T.Bone();mesh.castShadow=true;mesh.add(bone);model.add(mesh);
 actor.position.x=2;scene.updateMatrixWorld(true);mesh.bind(new T.Skeleton([bone]));
 const renderer={shadowMap:{render:()=>{}}} as unknown as T.WebGLRenderer,pass=new CharacterShadowPass(renderer,scene);pass.refresh();
 let proxy:T.SkinnedMesh|undefined;pass.scene.traverse(o=>{if(o instanceof T.SkinnedMesh)proxy=o;});assert(proxy);
 actor.position.set(7,3,-2);actor.scale.setScalar(2.5);bone.rotation.z=.3;mesh.morphTargetInfluences![0]=.4;scene.updateMatrixWorld(true);
 renderer.shadowMap.render([],scene,new T.Camera());
 assert.equal(proxy.skeleton,mesh.skeleton);assert.equal(proxy.morphTargetInfluences,mesh.morphTargetInfluences);
 for(let i=0;i<count;i+=5){
  const expected=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld),actual=proxy.getVertexPosition(i,new T.Vector3()).applyMatrix4(proxy.matrixWorld);
  assert(actual.distanceTo(expected)<1e-6,'shadow skin must use the current bind inverse');
 }
});

test('forest detail changes crown geometry distances without shortening fruit or forest visibility',()=>{
 const forest=new T.Group(),crown=new T.LOD(),fruit=new T.LOD();crown.name='Decorative forest leaves oak 0';fruit.name='Decorative forest fruit oak 0';
 for(const lod of [crown,fruit])for(const distance of [0,168,336])lod.addLevel(new T.Mesh(new T.SphereGeometry(),new T.MeshBasicMaterial()),distance,.15);
 forest.add(crown,fruit);const detail=new ForestDetail([forest]);assert.deepEqual(crown.levels.map(l=>l.distance),[0,80,180]);assert.deepEqual(fruit.levels.map(l=>l.distance),[0,168,336]);
 detail.setEnabled(false);assert.deepEqual(crown.levels.map(l=>l.distance),[0,168,336]);
 for(const mobile of [false,true]){
  for(const value of [null,'','bad','0.1','Infinity'])assert.equal(parseRenderScale(value,mobile),mobile?1:1.25);
  assert.equal(parseRenderScale('1',mobile),1);assert.equal(parseRenderScale('1.25',mobile),1.25);
 }
});
