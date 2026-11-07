import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {PigeonCrowd,pigeonPalette} from '../src/pigeon-crowd';
import {PidgieNpc} from '../src/pidgie-npc';
import {WILD_PIGEONS} from '../src/wild-pigeons';
const load=async(file:string)=>{const bytes=await readFile(new URL('../public/models/'+file,import.meta.url)),loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new T.Texture())}));return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');};
const templates=await Promise.all(WILD_PIGEONS.map(id=>load((id==='pidgie'?'pigeon':id)+'-animated.glb')));

test('shared animation poses preserve native skinning, morphs and independent parts in every clip',()=>{
 for(const template of templates){
  const palette=pigeonPalette(template),native=clone(template.scene),meshes:T.Mesh[]=[];native.traverse(n=>{if(n instanceof T.Mesh)meshes.push(n);});
  const mixer=new T.AnimationMixer(native),point=new T.Vector3(),expected=new T.Vector3(),posed=new T.Vector3(),bone=new T.Matrix4();
  for(const [name,clip] of palette.clips){
   mixer.stopAllAction();const action=mixer.clipAction(template.animations.find(c=>c.name===name)!);action.reset().setLoop(clip.loop?T.LoopRepeat:T.LoopOnce,clip.loop?Infinity:1);action.clampWhenFinished=!clip.loop;action.play();
   for(const sample of [.13,.47,.83]){
    const frame=Math.floor(sample*(clip.frames-1));mixer.setTime(frame/(clip.frames-1)*clip.duration);native.updateMatrixWorld(true);
    palette.parts.forEach((part,index)=>{
     const mesh=meshes[index],position=mesh.geometry.attributes.position,row=(clip.start+frame)*palette.width*4;
     if(mesh instanceof T.SkinnedMesh)mesh.skeleton.update();
     for(let v=0;v<position.count;v+=Math.max(1,Math.floor(position.count/13))){
      mesh.getVertexPosition(v,expected).applyMatrix4(mesh.matrixWorld);point.fromBufferAttribute(position,v);
      for(let morph=0;morph<part.morphCount;morph++){
       const delta=part.morph!.image.data as Float32Array,offset=(v*part.morphCount+morph)*8,weight=palette.data[row+part.morphBase*16+morph];point.addScaledVector(posed.fromArray(delta,offset),weight);
      }
      if(part.bones){
       const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;posed.set(0,0,0);
       for(let i=0;i<4;i++){bone.fromArray(palette.data,row+(part.base+indices.getComponent(v,i))*16);posed.addScaledVector(new T.Vector3().copy(point).applyMatrix4(bone),weights.getComponent(v,i));}
      }else posed.copy(point).applyMatrix4(bone.fromArray(palette.data,row+part.base*16));
      assert(posed.distanceTo(expected)<.00002,`${name}/${mesh.name}: ${posed.distanceTo(expected)}`);
     }
    });
   }
  }
  assert.equal(pigeonPalette(template),palette);
 }
});

test('flock geometry reduces rigid detail while preserving deforming wings, oral lining and paint',()=>{
 for(const template of templates){
  let rigidNative=0,rigidReduced=0;
  for(const part of pigeonPalette(template).parts){
   for(const name of ['uv','color'])assert.equal(!!part.geometry.attributes[name],!!part.mesh.geometry.attributes[name],`${part.mesh.name}: preserve authored ${name} paint attributes`);
   if(part.bones||part.morphCount){
    const native=part.mesh.geometry;
    for(const name of ['position','normal','uv','color','skinIndex','skinWeight'])if(native.attributes[name])assert.deepEqual(part.geometry.attributes[name].array,native.attributes[name].array);
    for(const name of ['position','normal'] as const)assert.deepEqual(part.geometry.morphAttributes[name]?.map(a=>a.array),native.morphAttributes[name]?.map(a=>a.array));
    if(part.mesh.name==='Continuous_pigeon_body')assert(part.geometry.index!.count<native.index!.count*.3,'body grid uses fewer triangles with unchanged deformation data');
    else assert.deepEqual(part.geometry.index?.array,native.index?.array,`${part.mesh.name}: animated wing and mouth topology stays intact`);
   }else{
    rigidNative+=(part.mesh.geometry.index?.count??part.mesh.geometry.attributes.position.count)/3;
    rigidReduced+=(part.geometry.index?.count??part.geometry.attributes.position.count)/3;
   }
  }
  // Morphing wings and the skinned mouth retain native geometry. Apply the
  // reduction budget to rigid parts, independently of those animated additions.
  assert(rigidNative>0);assert(rigidReduced>0);
  assert(rigidReduced<rigidNative*.25,`rigid geometry budget: ${rigidReduced}/${rigidNative} triangles`);
 }
});

test('instances grow past twenty without new rigs, keep independent clocks, and release old pose buffers',()=>{
 const template=templates[0],crowd=new PigeonCrowd(template);crowd.begin(1);
 const nativeParts:string[]=[];template.scene.traverse(n=>{if(n instanceof T.Mesh)nativeParts.push(n.name);});
 const instances=[...crowd.group.children];
 assert.deepEqual(instances.map(n=>n.name),nativeParts,'one instanced draw per authored part');
 const first=crowd.group.children[0] as T.InstancedMesh,skin=crowd.group.children.find(n=>(n as T.Mesh).geometry.attributes.skinIndex) as T.InstancedMesh;
 const shader={uniforms:{} as Record<string,{value:T.DataTexture}>,vertexShader:'#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',fragmentShader:''};
 (skin.material as T.Material).onBeforeCompile(shader as never,{} as T.WebGLRenderer);
 const old=shader.uniforms.flockPose.value;let disposed=0;old.addEventListener('dispose',()=>disposed++);
 crowd.begin(41);assert.equal(disposed,1);assert.notEqual(shader.uniforms.flockPose.value,old);
 crowd.group.children.forEach((mesh,i)=>assert.equal(mesh,instances[i],'growing the flock reuses its instanced meshes'));
 for(let i=0;i<41;i++){
  const npc=new PidgieNpc(template,{safeGround:()=>true,summoned:true,clockOnly:true}),state=npc.networkState();state.phase='follow';state.followId='p';state.followSpeed=0;state.clip=i%2?'Fly':'Hello';state.clipTime=.15+i*.01;state.p=[i*8,0,0];npc.presentSummoned(state,.2);
  assert.equal(npc.model.children.length,0);assert(Array.from(npc.actions.values()).every(a=>a.getClip().tracks.length===0));crowd.add(npc);
 }
 crowd.end();assert.equal(crowd.group.children.length,nativeParts.length);
 for(const mesh of crowd.group.children){assert(mesh instanceof T.InstancedMesh);assert.equal(mesh.count,41);}
 const live=shader.uniforms.flockPose.value,row=live.image.width*4,data=live.image.data as Float32Array;
 assert.notDeepEqual(data.slice(0,row),data.slice(row*2,row*3),'two birds in the same clip retain independent animation clocks');
 let liveDisposed=0;live.addEventListener('dispose',()=>liveDisposed++);
 const matrix=new T.Matrix4();first.getMatrixAt(40,matrix);assert(matrix.elements[12]>300);
 crowd.clear();for(const mesh of crowd.group.children)assert.equal((mesh as T.InstancedMesh).count,0);
 crowd.dispose();assert.equal(crowd.group.children.length,0);assert.equal(liveDisposed,1);
});
