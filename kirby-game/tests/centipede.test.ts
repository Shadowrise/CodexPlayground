import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AnimationMixer,Mesh,LoopOnce,Vector3} from 'three';
import {CENTIPEDE_CLIPS} from '../src/centipede-clips';

test('exported centipede: complete clips, independent targets, blink and grounded rolling',async()=>{
 const bytes=await readFile(new URL('../public/models/centipede-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 assert.deepEqual(gltf.animations.map(c=>c.name),CENTIPEDE_CLIPS.map(c=>c.name));
 for(const name of ['TailTarget','BackTarget'])assert(gltf.scene.getObjectByName(name),name);
 let meshes=0,triangles=0;gltf.scene.traverse(o=>{if(o instanceof Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
 assert(meshes<=70);assert(triangles<100000);
 const mixer=new AnimationMixer(gltf.scene);
 const sample=(name:string,time:number)=>{mixer.stopAllAction();const action=mixer.clipAction(gltf.animations.find(c=>c.name===name)!);action.reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();action.time=time;mixer.update(0);gltf.scene.updateMatrixWorld(true);};
 for(const clip of gltf.animations){assert(clip.validate(),clip.name);for(const track of clip.tracks)assert(Array.from(track.values).every(Number.isFinite),track.name);sample(clip.name,clip.duration*.5);}
 sample('Idle',0);assert(gltf.scene.getObjectByName('Eye_L')!.scale.y>.95);
 sample('Idle',2.88);assert(gltf.scene.getObjectByName('Eye_L')!.scale.y<.2);
 sample('Walk',0);const leg=gltf.scene.getObjectByName('Leg_3_L')!,q=leg.quaternion.clone();sample('Walk',.25);assert(q.angleTo(leg.quaternion)>.1);
 const point=new Vector3();
 for(const time of [0,.3,.65,1,1.35,1.7,1.99]){
  sample('WheelRoll',time);let bottom=Infinity;
  gltf.scene.traverse(o=>{if(o instanceof Mesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);bottom=Math.min(bottom,point.y);}}});
  assert(bottom>-.035&&bottom<.09,`wheel ground contact at ${time}: ${bottom}`);
 }
 // Inspect the exported, interpolated tracks, not just generator keyframes.
 for(const name of ['TurnLeft','TurnRight','CoilArena','LowerBack','Rise','CurlWheel','Uncurl','Stomp']){
  const duration=gltf.animations.find(c=>c.name===name)!.duration;
  for(let frame=0;frame<=80;frame++){
   sample(name,duration*frame/80);
   const segments=Array.from({length:12},(_,i)=>gltf.scene.getObjectByName(`Segment_${i}`)!);
   const positions=segments.map(s=>s.getWorldPosition(new Vector3()));
   for(let i=0;i<12;i++){
    for(let j=i+2;j<12;j++){
     if(i===0&&j===11&&(name==='CurlWheel'||name==='Uncurl'))continue; // Intended wheel closure.
     assert(positions[i].distanceTo(positions[j])>1.9,`${name} crossing ${i}/${j}, frame ${frame}`);
    }
    if(!['CurlWheel','Uncurl'].includes(name)){
     const up=new Vector3(0,1,0).applyQuaternion(segments[i].quaternion);
     assert(up.y>.98,`${name} inverted segment ${i}, frame ${frame}`);
    }
    if(i>0){const gap=positions[i].distanceTo(positions[i-1]);assert(gap>1.25&&gap<1.65,`${name} broken link ${i}: ${gap}`);}
   }
  }
 }
 for(const name of ['TurnLeft','TurnRight']){
  sample(name,0);const tail=gltf.scene.getObjectByName('Segment_11')!,before=tail.position.clone();
  sample(name,3.2);assert(before.distanceTo(tail.position)>5,`${name} pinned tail`);
  assert(Math.abs(new Vector3(0,0,1).applyQuaternion(tail.quaternion).x)>.99,`${name} tail did not follow`);
 }
 for(const meta of CENTIPEDE_CLIPS.filter(c=>c.loop)){
  sample(meta.name,0);const before=new Map<string,{p:Vector3,q:typeof q,s:Vector3}>();gltf.scene.traverse(o=>before.set(o.uuid,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()}));
  sample(meta.name,meta.duration);gltf.scene.traverse(o=>{const b=before.get(o.uuid)!;assert(b.p.distanceTo(o.position)<.001,`${meta.name} position seam: ${o.name}`);assert(b.q.angleTo(o.quaternion)<.002,`${meta.name} rotation seam: ${o.name}`);assert(b.s.distanceTo(o.scale)<.001,`${meta.name} scale seam: ${o.name}`);});
 }
 sample('Uncurl',2.4);assert(Math.abs(gltf.scene.getObjectByName('Motion')!.position.y)<.001);
});
