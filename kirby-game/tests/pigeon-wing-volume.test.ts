import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AnimationMixer,Mesh,Texture,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createPigeon} from '../src/pigeon-model';
import {PigeonFlightWings} from '../src/pigeon-flight-wings';

test('flight wings retain rounded thickness, a tapered closed edge and the original upper surface',()=>{
 const {root,clips}=createPigeon(),mixer=new AnimationMixer(root);
 mixer.clipAction(clips.find(clip=>clip.name==='Fly')!).play();
 const a=new Vector3(),b=new Vector3();
 for(const side of ['Left','Right']){
  const mesh=root.getObjectByName(`${side}_wing_vane_sculpt_paint`) as Mesh;
  const p=mesh.geometry.attributes.position,d=mesh.geometry.morphAttributes.position![0];
  assert.equal(mesh.morphTargetDictionary?.Flight_wing_volume,0);
  for(let vertex=0;vertex<p.count;vertex++){
   assert.equal(d.getY(vertex),0);assert.equal(d.getZ(vertex),0);
   if(vertex<11*129)assert(Math.abs(d.getX(vertex))<1e-8,'upper feathers and outline stay fitted to the armor');
   assert(Number.isFinite(d.getX(vertex)));
  }
  for(let frame=0;frame<72;frame++){
   mixer.setTime(frame/72*.9);root.updateMatrixWorld(true);
   mesh.getVertexPosition(0,a).applyMatrix4(mesh.matrixWorld);
   mesh.getVertexPosition(20*129,b).applyMatrix4(mesh.matrixWorld);
   assert(a.distanceTo(b)>.14&&a.distanceTo(b)<.17,'wing cushion stays visible through the full beat');
  }
  // At the feather edge both halves still meet; volume grows towards the core.
  assert(Math.abs(d.getX(10*129+20))<1e-8);
 }
 mixer.stopAllAction();mixer.clipAction(clips.find(clip=>clip.name==='Idle')!).play();mixer.setTime(.2);
 for(const side of ['Left','Right'])assert.deepEqual((root.getObjectByName(`${side}_wing_vane_sculpt_paint`) as Mesh).morphTargetInfluences,[0]);
});

test('airborne chest pecks preserve wing volume and restore the underlying grounded pose',()=>{
 const {root,clips}=createPigeon(),mixer=new AnimationMixer(root),overlay=new PigeonFlightWings(root,clips.find(c=>c.name==='Fly')!);
 const push=mixer.clipAction(clips.find(c=>c.name==='Push')!).play();
 for(let frame=0;frame<48;frame++){
  overlay.clear();push.time=frame/48*.65;mixer.update(0);overlay.update(frame/48*.9,true);
  for(const side of ['Left','Right'])assert.deepEqual((root.getObjectByName(`${side}_wing_vane_sculpt_paint`) as Mesh).morphTargetInfluences,[1]);
 }
 overlay.update(.1,false);
 for(const side of ['Left','Right']){
  assert.deepEqual((root.getObjectByName(`${side}_wing_vane_sculpt_paint`) as Mesh).morphTargetInfluences,[0]);
  assert.equal(root.getObjectByName(`${side}_wing_vane`)!.scale.x,1);
 }
 overlay.dispose();
});

test('all five exported pigeon plumages keep the volumetric wings and their animation channels',async()=>{
 const loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));
 for(const id of ['pigeon','snowball','ugolyok','ryzhik','kurlyk']){
  const bytes=await readFile(new URL(`../public/models/${id}-animated.glb`,import.meta.url));
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const mixer=new AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations.find(c=>c.name==='Fly')!).play();mixer.setTime(.13);gltf.scene.updateMatrixWorld(true);
  for(const side of ['Left','Right']){
   const mesh=gltf.scene.getObjectByName(`${side}_wing_vane_sculpt_paint`) as Mesh;
   assert.equal(mesh.morphTargetDictionary?.Flight_wing_volume,0,`${id}: named volume shape is exported`);
   assert.deepEqual(mesh.morphTargetInfluences,[1]);
   const a=mesh.getVertexPosition(0,new Vector3()).applyMatrix4(mesh.matrixWorld),b=mesh.getVertexPosition(20*129,new Vector3()).applyMatrix4(mesh.matrixWorld);
   assert(a.distanceTo(b)>.14&&a.distanceTo(b)<.17,`${id}: baked flight wing retains thickness`);
  }
 }
});
