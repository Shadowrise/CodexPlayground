import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {PigeonCrowd,pigeonPalette} from '../src/pigeon-crowd';
import {PidgieNpc} from '../src/pidgie-npc';
const load=async(file:string)=>{const bytes=await readFile(new URL('../public/models/'+file,import.meta.url)),loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new T.Texture())}));return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');};
const templates=await Promise.all(['pigeon','snowball'].map(n=>load(n+'-animated.glb')));

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

test('flock geometry reduces rigid detail while keeping native deforming bodies and paint',()=>{
 for(const template of templates){
  let native=0,reduced=0;
  for(const part of pigeonPalette(template).parts){
   native+=(part.mesh.geometry.index?.count??part.mesh.geometry.attributes.position.count)/3;reduced+=(part.geometry.index?.count??part.geometry.attributes.position.count)/3;
   assert(part.geometry.attributes.uv&&part.geometry.attributes.color,'native paint attributes');
   if(part.bones||part.morphCount)assert.equal(part.geometry,part.mesh.geometry);
  }
  assert(reduced<native*.5);assert(reduced>15000,'retain enough silhouette detail');
 }
});

test('instances grow past twenty without new rigs, keep independent clocks, and release old pose buffers',()=>{
 const template=templates[0],crowd=new PigeonCrowd(template);crowd.begin(1);
 const first=crowd.group.children[0] as T.InstancedMesh,skin=crowd.group.children.find(n=>(n as T.Mesh).geometry.attributes.skinIndex) as T.InstancedMesh;
 const shader={uniforms:{} as Record<string,{value:T.DataTexture}>,vertexShader:'#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',fragmentShader:''};
 (skin.material as T.Material).onBeforeCompile(shader as never,{} as T.WebGLRenderer);
 const old=shader.uniforms.flockPose.value;let disposed=0;old.addEventListener('dispose',()=>disposed++);
 crowd.begin(41);assert.equal(disposed,1);assert.notEqual(shader.uniforms.flockPose.value,old);
 for(let i=0;i<41;i++){
  const npc=new PidgieNpc(template,{safeGround:()=>true,summoned:true,clockOnly:true}),state=npc.networkState();state.phase='follow';state.followId='p';state.followSpeed=0;state.clip=i%2?'Fly':'Hello';state.clipTime=.3;state.p=[i*8,0,0];npc.presentSummoned(state,.2);
  assert.equal(npc.model.children.length,0);assert(Array.from(npc.actions.values()).every(a=>a.getClip().tracks.length===0));crowd.add(npc);
 }
 crowd.end();assert.equal(crowd.group.children.length,21);assert.equal(first.count,41);
 const matrix=new T.Matrix4();first.getMatrixAt(40,matrix);assert(matrix.elements[12]>300);
 crowd.clear();assert.equal(first.count,0);crowd.dispose();assert.equal(crowd.group.children.length,0);
});
