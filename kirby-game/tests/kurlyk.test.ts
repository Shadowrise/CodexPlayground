import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AnimationMixer,Color,LoopOnce,Mesh,MeshPhysicalMaterial,Texture,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RAINBOW_COLORS} from '../src/rainbow-kirby';
import {pigeonPalette} from '../src/pigeon-crowd';
import {PIDGIE_CLIPS} from '../src/pidgie-state';

const loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));
const load=async(id:string)=>{const b=await readFile(new URL(`../public/models/${id}-animated.glb`,import.meta.url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const [original,kurlyk]=await Promise.all([load('pigeon'),load('kurlyk')]);

test('Kurlyk preserves every native mesh, morph, rig and animation, including ordinary legs and feet',()=>{
 assert.equal(kurlyk.animations.length,32);
 for(const [i,clip] of kurlyk.animations.entries()){
  const native=original.animations[i];assert.equal(clip.name,native.name);assert.equal(clip.duration,native.duration);
  for(const [j,track] of clip.tracks.entries()){assert.equal(track.name,native.tracks[j].name);assert.deepEqual(track.times,native.tracks[j].times);assert.deepEqual(track.values,native.tracks[j].values);}
 }
 original.scene.traverse(node=>{
  if(!(node instanceof Mesh))return;
  const painted=kurlyk.scene.getObjectByName(node.name) as Mesh;assert(painted);
  for(const name of ['position','normal','uv','skinIndex','skinWeight'])if(node.geometry.attributes[name])assert.deepEqual(painted.geometry.attributes[name].array,node.geometry.attributes[name].array,`${node.name}/${name}`);
  for(const name of ['position','normal'] as const)assert.deepEqual(painted.geometry.morphAttributes[name]?.map((a:{array:ArrayLike<number>})=>a.array),node.geometry.morphAttributes[name]?.map((a:{array:ArrayLike<number>})=>a.array));
  if(/hip|knee|foot|Beak|beak|eyes/.test(node.name)){
   assert.deepEqual(painted.geometry.attributes.color.array,node.geometry.attributes.color.array,node.name);
   const material=painted.material as MeshPhysicalMaterial;assert(!material.iridescence,`${node.name} keeps its ordinary finish`);
  }
 });
});

test('Kurlyk has all seven colours in a continuous feather gradient with a pearlescent finish',()=>{
 const body=kurlyk.scene.getObjectByName('Continuous_pigeon_body') as Mesh,position=body.geometry.attributes.position,color=body.geometry.attributes.color;
 assert(body.material instanceof MeshPhysicalMaterial);assert.equal(body.material.iridescence,.65);
 const sampled=new Color(),point=new Vector3();
 for(const [index,hex] of RAINBOW_COLORS.entries()){
  const y=2.73-index*2.19/6,target=new Color(hex);let closest=Infinity;
  for(let vertex=0;vertex<position.count;vertex++){
   point.fromBufferAttribute(position,vertex);if(Math.abs(point.y-y)>.06)continue;
   sampled.fromBufferAttribute(color,vertex);closest=Math.min(closest,Math.hypot(sampled.r-target.r,sampled.g-target.g,sampled.b-target.b));
  }
  assert(closest<.025,`${hex} is present at its expected height: ${closest}`);
 }
 // Compare vertical neighbours on the front, where every stop is visible.
 for(let row=1;row<=86;row++){
  const vertex=row*65+16,previous=vertex-65;
  const difference=Math.hypot(color.getX(vertex)-color.getX(previous),color.getY(vertex)-color.getY(previous),color.getZ(vertex)-color.getZ(previous));
  assert(difference<.25,`no hard colour boundary at body row ${row}: ${difference}`);
 }
 assert(new Set(Array.from({length:color.count},(_,i)=>[color.getX(i),color.getY(i),color.getZ(i)].join(','))).size>1000);
});

test('the crown follows the head in every clip and is present in the instanced admin flock palette',()=>{
 const crown=kurlyk.scene.getObjectByName('Kurlyk_crown')!,head=kurlyk.scene.getObjectByName('Head')!;
 assert.equal(crown.parent,head);assert.equal(crown.children.length,2);
 const local=crown.matrix.clone(),mixer=new AnimationMixer(kurlyk.scene);
 for(const clip of kurlyk.animations){
  mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
  for(const fraction of [.1,.5,.9]){
   mixer.setTime(clip.duration*fraction);kurlyk.scene.updateMatrixWorld(true);
   assert(crown.matrix.equals(local),clip.name);
   const expected=new Vector3().setFromMatrixPosition(head.matrixWorld.clone().multiply(local));
   assert(crown.getWorldPosition(new Vector3()).distanceTo(expected)<1e-6);
  }
 }
 mixer.stopAllAction();
 const palette=pigeonPalette(kurlyk);
 assert.equal(palette.parts.filter(p=>p.mesh.name.startsWith('Kurlyk_crown_')).length,2);
 assert.deepEqual([...palette.clips.keys()],PIDGIE_CLIPS);
});
