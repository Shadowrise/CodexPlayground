import * as T from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {PIDGIE_CLIPS,type PidgieClip} from './pidgie-state';
import {PIGEON_CLIP_BY_NAME} from './pigeon-clips';
import {SimplifyModifier} from 'three/addons/modifiers/SimplifyModifier.js';
import {startupWork} from './startup-tasks';

type Template=Pick<GLTF,'scene'|'animations'>;
type Clip={start:number;frames:number;duration:number;loop:boolean};
type Part={mesh:T.Mesh;geometry:T.BufferGeometry;base:number;bones:number;morphBase:number;morphCount:number;morph?:T.DataTexture};
export type PigeonPalette={data:Float32Array;width:number;parts:Part[];clips:Map<PidgieClip,Clip>};
const palettes=new WeakMap<T.Object3D,PigeonPalette>();
const FPS=24;

/** Retriangulate the authored body grid without changing skin, UVs or morph IDs. */
function bodyGeometry(source:T.BufferGeometry){
 const uv=source.attributes.uv;if(!uv)return source;
 let stride=1;while(stride<uv.count&&uv.getY(stride)===uv.getY(0))stride++;
 const columns=stride-1,rows=uv.count/stride-1;
 if(columns<16||rows<16||!Number.isInteger(rows)||columns%2||rows%2)return source;
 const indices:number[]=[];
 for(let row=0;row<rows;row+=2)for(let col=0;col<columns;col+=2){
  const a=row*stride+col,b=a+2*stride;
  if(row)indices.push(a,b,a+2);
  if(row<rows-2)indices.push(a+2,b,b+2);
 }
 const geometry=source.clone();geometry.setIndex(indices);return geometry;
}

/** Bake the native rig once. Only small bone/part matrices are stored, not vertices. */
export function pigeonPalette(template:Template):PigeonPalette{
 const cached=palettes.get(template.scene);if(cached)return cached;
 const work=bakePalette(template);for(;;){const step=work.next();if(step.done)return step.value;}
}
export async function preparePigeonPalette(template:Template){
 const cached=palettes.get(template.scene);return cached??await startupWork(bakePalette(template));
}
function* bakePalette(template:Template):Generator<void,PigeonPalette>{
 const root=cloneSkeleton(template.scene),parts:Part[]=[],clips=new Map<PidgieClip,Clip>();let matrices=0,rows=0;
 const meshes:T.Mesh[]=[];root.traverse(node=>{if(node instanceof T.Mesh)meshes.push(node);});
 for(const node of meshes){
  const bones=node instanceof T.SkinnedMesh?node.skeleton.bones.length:0,morphCount=node.morphTargetInfluences?.length??0,base=matrices,morphBase=base+(bones||1);
  let morph:T.DataTexture|undefined;
  if(morphCount){
   const position=node.geometry.attributes.position,normal=node.geometry.attributes.normal,width=1024,height=T.MathUtils.ceilPowerOfTwo(Math.ceil(position.count*morphCount*2/width)),values=new Float32Array(width*height*4);
   for(let v=0;v<position.count;v++)for(let target=0;target<morphCount;target++)for(const [kind,source] of [[0,position],[1,normal]] as const){
    const delta=node.geometry.morphAttributes[kind?'normal':'position']?.[target];if(!delta)continue;
    for(let axis=0;axis<3;axis++)values[((v*morphCount+target)*2+kind)*4+axis]=delta.getComponent(v,axis)-(node.geometry.morphTargetsRelative?0:source.getComponent(v,axis));
   }
   morph=new T.DataTexture(values,width,height,T.RGBAFormat,T.FloatType);morph.minFilter=morph.magFilter=T.NearestFilter;morph.generateMipmaps=false;morph.needsUpdate=true;
  }
  // Thousands of triangles in a beak/toe/wing are invisible at game scale.
  // The body keeps every authored attribute; only its grid indices get coarser.
  // Eyes and expressions retain their native meshes.
  const geometry=bones&&/^Continuous[ _]pigeon[ _]body$/.test(node.name)?bodyGeometry(node.geometry):!bones&&!morphCount&&(node.geometry.index?.count??0)>1800
   ?new SimplifyModifier().modify(node.geometry,Math.floor(node.geometry.attributes.position.count*.9)):node.geometry;
  parts.push({mesh:node,geometry,base,bones,morphBase,morphCount,morph});matrices+= (bones||1)+Math.ceil(morphCount/16);
  yield;
 }
 for(const name of PIDGIE_CLIPS){const source=template.animations.find(c=>c.name===name);if(!source)throw Error('Missing flock animation '+name);const frames=Math.ceil(source.duration*FPS)+1;clips.set(name,{start:rows,frames,duration:source.duration,loop:PIGEON_CLIP_BY_NAME[name].loop});rows+=frames;}
 const width=T.MathUtils.ceilPowerOfTwo(matrices*4),height=T.MathUtils.ceilPowerOfTwo(rows),data=new Float32Array(width*height*4),mixer=new T.AnimationMixer(root),matrix=new T.Matrix4(),bone=new T.Matrix4();
 for(const [name,clip] of clips){
  mixer.stopAllAction();const action=mixer.clipAction(template.animations.find(c=>c.name===name)!);action.reset().setLoop(clip.loop?T.LoopRepeat:T.LoopOnce,clip.loop?Infinity:1);action.clampWhenFinished=!clip.loop;action.play();
  for(let frame=0;frame<clip.frames;frame++){
   mixer.setTime(frame/(clip.frames-1)*clip.duration);root.updateMatrixWorld(true);
   for(const part of parts){
    const mesh=part.mesh;
    if(mesh instanceof T.SkinnedMesh){
     mesh.skeleton.update();
     for(let i=0;i<part.bones;i++){
      bone.fromArray(mesh.skeleton.boneMatrices,i*16);
      matrix.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(bone).multiply(mesh.bindMatrix);
      matrix.toArray(data,((clip.start+frame)*width+4*(part.base+i))*4);
     }
    }else mesh.matrixWorld.toArray(data,((clip.start+frame)*width+4*part.base)*4);
    if(part.morphCount)data.set(mesh.morphTargetInfluences!,((clip.start+frame)*width+4*part.morphBase)*4);
   }
   yield;
  }
 }
 mixer.stopAllAction();mixer.uncacheRoot(root);
 const palette={data,width,parts,clips};palettes.set(template.scene,palette);return palette;
}

const poseShader=/* glsl */`
uniform highp sampler2D flockPose;
uniform float flockPart;
attribute vec3 flockFrame;
mat4 flockRead(float part,float row){
 int x=int(part)*4;int y=int(row);
 return mat4(texelFetch(flockPose,ivec2(x,y),0),texelFetch(flockPose,ivec2(x+1,y),0),texelFetch(flockPose,ivec2(x+2,y),0),texelFetch(flockPose,ivec2(x+3,y),0));
}
mat4 flockMatrix(float part){return flockRead(part,flockFrame.x);}
`;

type CrowdActor={actor:T.Object3D;state:PidgieClip;clipTime:number};
/** One instanced draw per authored part, regardless of how many birds share it. */
export class PigeonCrowd{
 readonly group=new T.Group();
 readonly palette:PigeonPalette;
 private meshes:T.InstancedMesh[]=[];
 private capacity=0;
 private transforms:T.InstancedBufferAttribute[]=[];
 private frames?:T.InstancedBufferAttribute;
 private poseUniform:{value:T.DataTexture|null}={value:null};
 private matrix=new T.Matrix4();private posed=new T.Matrix4();
 private bounds=new T.Box3();private sphere=new T.Sphere();private padding=0;
 private count=0;
 private morphBuffers:{part:Part;attributes:T.InstancedBufferAttribute[]}[]=[];
 constructor(template:Template,private prepare?:(root:T.Object3D)=>void){this.palette=pigeonPalette(template);this.group.name='Instanced pigeon plumage';}
 private grow(count:number){
  if(count<=this.capacity)return;
  // Retire uploaded buffers on registered geometries before resizing them.
  // Native templates and the cached lower-detail geometry are never disposed.
  for(const mesh of this.meshes){mesh.geometry.dispose();mesh.dispose();}this.poseUniform.value?.dispose();
  this.capacity=T.MathUtils.ceilPowerOfTwo(Math.max(8,count));
  const frames=new T.InstancedBufferAttribute(new Float32Array(this.capacity*3),3).setUsage(T.DynamicDrawUsage);
  const live=new T.DataTexture(new Float32Array(this.palette.width*this.capacity*4),this.palette.width,this.capacity,T.RGBAFormat,T.FloatType);live.minFilter=live.magFilter=T.NearestFilter;live.generateMipmaps=false;this.poseUniform.value=live;
  if(!this.meshes.length){
   for(const part of this.palette.parts){
    const geometry=part.geometry.clone();geometry.morphAttributes={};
    const source=Array.isArray(part.mesh.material)?part.mesh.material[0]:part.mesh.material,material=source.clone();
    const native=material.onBeforeCompile;material.customProgramCacheKey=()=>`pigeon-crowd-${part.bones?'skin':'rigid'}-m${part.morphCount}-v2`;
    if(part.bones||part.morphCount)material.onBeforeCompile=(shader,renderer)=>{
     native.call(material,shader,renderer);shader.uniforms.flockPose=this.poseUniform;shader.uniforms.flockPart={value:part.base};
     shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+poseShader+(part.bones?'\nattribute vec4 skinIndex;\nattribute vec4 skinWeight;':''));
     let morphPosition='',morphNormal='';
     if(part.morph){
      shader.uniforms.flockMorph={value:part.morph};
      let definitions='\nuniform highp sampler2D flockMorph;\n';
      for(let i=0;i<Math.ceil(part.morphCount/4);i++)definitions+=`attribute vec4 flockMorph${i};\n`;
      definitions+='vec3 flockDelta(int target,int kind){int pixel=(gl_VertexID*'+part.morphCount+'+target)*2+kind;return texelFetch(flockMorph,ivec2(pixel%1024,pixel/1024),0).xyz;}\n';
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>'+definitions);
      for(let i=0;i<part.morphCount;i++){
       const weight=`flockMorph${Math.floor(i/4)}[${i%4}]`;
       morphPosition+=`if(abs(${weight})>0.00001)flockPosition+=flockDelta(${i},0)*${weight};\n`;
       morphNormal+=`if(abs(${weight})>0.00001)objectNormal+=flockDelta(${i},1)*${weight};\n`;
      }
     }
     const transform=part.bones?'flockMatrix(flockPart+skinIndex.x)*skinWeight.x+flockMatrix(flockPart+skinIndex.y)*skinWeight.y+flockMatrix(flockPart+skinIndex.z)*skinWeight.z+flockMatrix(flockPart+skinIndex.w)*skinWeight.w':'mat4(1.0)';
     shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>\n${morphNormal}\nmat4 flockTransform=${transform};\nobjectNormal=mat3(flockTransform)*objectNormal;`);
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`vec3 flockPosition=position;\n${morphPosition}\nvec3 transformed=(flockTransform*vec4(flockPosition,1.0)).xyz;`);
    };
    const mesh=new T.InstancedMesh(geometry,material,this.capacity);mesh.name=part.mesh.name;mesh.boundingSphere=this.sphere;mesh.castShadow=false;mesh.receiveShadow=true;mesh.count=0;this.meshes.push(mesh);this.group.add(mesh);
   }
   this.prepare?.(this.group);
  }
  this.frames=frames;this.transforms=[];
  for(const mesh of this.meshes){const transforms=new T.InstancedBufferAttribute(new Float32Array(this.capacity*16),16).setUsage(T.DynamicDrawUsage);this.transforms.push(transforms);mesh.instanceMatrix=transforms;mesh.geometry.setAttribute('flockFrame',frames);}
  this.morphBuffers=[];
  this.palette.parts.forEach((part,index)=>{if(part.morphCount){const attributes=Array.from({length:Math.ceil(part.morphCount/4)},()=>new T.InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(T.DynamicDrawUsage));attributes.forEach((a,i)=>this.meshes[index].geometry.setAttribute('flockMorph'+i,a));this.morphBuffers.push({part,attributes});}});
 }
 begin(count:number){this.grow(count);this.count=0;this.bounds.makeEmpty();this.padding=0;}
 add(bird:CrowdActor){
  if(!bird.actor.visible||!this.frames)return;
  bird.actor.updateMatrix();
  this.bounds.expandByPoint(bird.actor.position);this.padding=Math.max(this.padding,6*Math.max(bird.actor.scale.x,bird.actor.scale.y,bird.actor.scale.z));
  const clip=this.palette.clips.get(bird.state)!,clock=bird.clipTime;
  const time=clip.loop?clock%clip.duration:Math.min(clip.duration,clock),frame=Math.max(0,time/clip.duration)*(clip.frames-1),a=Math.floor(frame),b=Math.min(a+1,clip.frames-1);
  const fromRow=(clip.start+a)*this.palette.width*4,toRow=(clip.start+b)*this.palette.width*4,blend=frame-a,live=this.poseUniform.value!.image.data as Float32Array;
  this.palette.parts.forEach((part,index)=>{
   const from=fromRow+part.base*16,to=toRow+part.base*16;
   if(part.bones){
    bird.actor.matrix.toArray(this.transforms[index].array,this.count*16);
    const offset=this.count*this.palette.width*4+part.base*16;
    for(let j=0;j<part.bones*16;j++)live[offset+j]=T.MathUtils.lerp(this.palette.data[from+j],this.palette.data[to+j],blend);
   }else {
    for(let j=0;j<16;j++)this.posed.elements[j]=T.MathUtils.lerp(this.palette.data[from+j],this.palette.data[to+j],blend);
    this.matrix.multiplyMatrices(bird.actor.matrix,this.posed).toArray(this.transforms[index].array,this.count*16);
   }
  });
  this.frames.setXYZ(this.count,this.count,0,0);this.count++;
  for(const {part,attributes} of this.morphBuffers){
   const from=((clip.start+a)*this.palette.width+4*part.morphBase)*4,to=((clip.start+b)*this.palette.width+4*part.morphBase)*4;
   for(let i=0;i<part.morphCount;i++)attributes[Math.floor(i/4)].array[(this.count-1)*4+i%4]=T.MathUtils.lerp(this.palette.data[from+i],this.palette.data[to+i],frame-a);
  }
 }
 end(){this.bounds.getBoundingSphere(this.sphere);if(this.count)this.sphere.radius+=this.padding;for(const mesh of this.meshes)mesh.count=this.count;for(const a of this.transforms)a.needsUpdate=true;if(this.frames)this.frames.needsUpdate=true;if(this.poseUniform.value)this.poseUniform.value.needsUpdate=true;for(const {attributes} of this.morphBuffers)for(const a of attributes)a.needsUpdate=true;}
 clear(){this.count=0;for(const mesh of this.meshes)mesh.count=0;}
 dispose(){for(const mesh of this.meshes){mesh.geometry.dispose();(mesh.material as T.Material).dispose();mesh.dispose();}this.poseUniform.value?.dispose();this.poseUniform.value=null;this.meshes=[];this.transforms=[];this.frames=undefined;this.morphBuffers=[];this.capacity=0;this.group.clear();}
}
