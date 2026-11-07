import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AnimationMixer,Mesh,Raycaster,Texture,Vector3,type Object3D,type AnimationClip} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createPigeon} from '../src/pigeon-model';

function sectionThickness(wing:Object3D,span:number){
 let maximum=0;
 const surface=wing.getObjectByName(`${wing.name}_vane_sculpt_paint`)!;
 const axis=new Vector3(0,1,0).transformDirection(wing.matrixWorld);
 for(let step=0;step<=32;step++){
  const x=(wing.name.startsWith('Left')?-1:1)*(-.13+step*.035),top=wing.localToWorld(new Vector3(x,2,-span)),bottom=wing.localToWorld(new Vector3(x,-2,-span));
  const a=new Raycaster(top,axis.clone().negate(),0,5).intersectObject(surface,false)[0],b=new Raycaster(bottom,axis,0,5).intersectObject(surface,false)[0];
  if(a&&b)maximum=Math.max(maximum,a.point.clone().sub(b.point).dot(axis));
 }
 return maximum;
}
function validateTaper(root:Object3D,clips:AnimationClip[]){
 const mixer=new AnimationMixer(root);mixer.clipAction(clips.find(c=>c.name==='Fly')!).play();mixer.setTime(0);root.updateMatrixWorld(true);
 const measurements:number[][]=[];
 for(const side of ['Left','Right']){
  const wing=root.getObjectByName(`${side}_wing`)!,mesh=root.getObjectByName(`${side}_wing_vane_sculpt_paint`) as Mesh;
  assert.equal(root.getObjectByName(`${side}_wing_shoulder_coverts`),undefined,'no separate root pad can pass through the torso');
  assert.equal(mesh.morphTargetDictionary?.Flight_wing_volume,0);
  const p=mesh.geometry.attributes.position,delta=mesh.geometry.morphAttributes.position![0],sign=side==='Left'?-1:1;
  for(let vertex=0;vertex<p.count;vertex++){
   assert.equal(delta.getY(vertex),0);assert.equal(delta.getZ(vertex),0);
   if(vertex<11*129)assert(Math.abs(delta.getX(vertex))<1e-7,'volume never rises through the dorsal feathers');
   else{const row=Math.floor(vertex/129),upper=(20-row)*129+vertex%129;assert(sign*(p.getX(vertex)+delta.getX(vertex)-p.getX(upper))<=1e-6);}
  }
  const profile=[.12,.30,.50,.75,1.00,1.20].map(span=>sectionThickness(wing,span));
  measurements.push(profile);
  assert(profile[0]>.20&&profile[0]<.29,'the proximal arm has visible volume');
  for(let i=1;i<profile.length;i++)assert(profile[i]<profile[i-1]+.008,'each outward section stays thinner than the preceding section');
  assert(profile.at(-1)!<.06,'flight feather tips remain fine');
  assert(profile.at(-1)!>.008,'measure an actual outer feather section on both sides');
 }
 return measurements;
}
test('flight thickness decreases from the rounded shoulder to the outer feathers',t=>{
 const {root,clips}=createPigeon();for(const [i,profile]of validateTaper(root,clips).entries())t.diagnostic(`${i?'Right':'Left'} thickness: ${profile.map(n=>(n*100).toFixed(1)).join(', ')} cm`);
});
for(const id of ['pigeon','snowball','ugolyok','ryzhik','kurlyk','metapidgie'])test(`${id} GLB retains a continuous tapered wing without a separate root pad`,async()=>{
 const bytes=await readFile(new URL(`../public/models/${id}-animated.glb`,import.meta.url)),loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));
 const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');validateTaper(gltf.scene,gltf.animations);
});
