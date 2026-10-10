import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Mesh,Vector3,Box3} from 'three';
import {ArenaCentipede,centipedeRoam,ROAM_STAGES} from '../src/arena-centipede';
import {BOSS_ARENA} from '../src/boss-arena-site';
import {startCentipede,advanceCentipede,pushCentipede,centipedeTarget,centipedeWheel,CENTIPEDE_TIMES,type CentipedeActor} from '../src/centipede-event';

test('roaming clock stops during rests and continuously accelerates, without extra network state',()=>{
 let total=0;
 for(const stage of ROAM_STAGES){
  const middle=centipedeRoam(total+stage.duration/2);assert.equal(middle.animation,stage.animation);
  if(stage.animation==='Idle'){assert.equal(middle.speed,0);assert(Math.abs(centipedeRoam(total+.9).distance-centipedeRoam(total+stage.duration-.9).distance)<1e-8);}
  total+=stage.duration;
  assert(Math.abs(centipedeRoam(total+.0001).distance-centipedeRoam(total-.0001).distance)<.001);
 }
});

test('wide event runs keep the actual head, boots and antennae inside the arena',async()=>{
 const b=await readFile(new URL('../public/models/centipede-animated.glb',import.meta.url)),gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const model=new ArenaCentipede(gltf),trail=model.startTrail(12),head=trail.at(-1)!,center=new Vector3(BOSS_ARENA.x,0,BOSS_ARENA.z);
 const player:CentipedeActor={id:'test',p:[head[0]+3,0,head[1]],yaw:0,size:1,available:true,done:false,points:0};
 const meshes:Mesh[]=[];model.group.traverse(o=>{if(o instanceof Mesh&&!o.name.includes('simple body shadows')){o.geometry.computeBoundingBox();meshes.push(o);}});
 let q=startCentipede(trail,player,1000)!;
 for(let cycle=0;cycle<4;cycle++){
  q=advanceCentipede(q,q.stageAt+CENTIPEDE_TIMES[q.stage]+1,[player]).event!;q=advanceCentipede(q,q.stageAt+CENTIPEDE_TIMES.warning+1,[player]).event!;assert.equal(q.stage,'charge');
  for(let i=0;i<=24;i++){
   const now=q.stageAt+i/24*CENTIPEDE_TIMES.charge;model.update(now/1000,center,q,now);model.group.updateMatrixWorld(true);
   for(const mesh of meshes){const box=new Box3().copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);for(const x of [box.min.x,box.max.x])for(const z of [box.min.z,box.max.z])assert(Math.hypot(x-center.x,z-center.z)<BOSS_ARENA.playRadius,`body outside on run ${cycle}/${i}`);}
  }
  q=advanceCentipede(q,q.stageAt+CENTIPEDE_TIMES.charge+1,[player]).event!;assert.equal(q.stage,'balls');
  for(let i=0;i<12;i++){const now=q.stageAt+i*1000;model.update(now/1000,center,q,now);model.group.updateMatrixWorld(true);for(const mesh of meshes){const box=new Box3().copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);for(const x of [box.min.x,box.max.x])for(const z of [box.min.z,box.max.z])assert(Math.hypot(x-center.x,z-center.z)<BOSS_ARENA.playRadius,'sneeze outside arena');}}
  q=advanceCentipede(q,q.stageAt+CENTIPEDE_TIMES.balls+1,[player]).event!;
 }
});

test('whole animated centipede stays on the arena, follows its head and resumes exactly after culling',async()=>{
 const b=await readFile(new URL('../public/models/centipede-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const actor=new ArenaCentipede(gltf),center=new Vector3(BOSS_ARENA.x,0,BOSS_ARENA.z),pos=new Vector3();
 const meshes:Mesh[]=[];actor.group.traverse(o=>{if(o instanceof Mesh&&!o.name.includes('simple body shadows'))meshes.push(o);});
 for(let time=0;time<300;time+=1.7){
  actor.update(time,center);actor.group.updateMatrixWorld(true);
  // Conservative world-space boxes cover the face, shoes, bells and antennae.
  for(const mesh of meshes){mesh.geometry.computeBoundingBox();const box=new Box3().copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
   for(const x of [box.min.x,box.max.x])for(const z of [box.min.z,box.max.z])assert(Math.hypot(x-center.x,z-center.z)<BOSS_ARENA.playRadius,`outside arena at ${time}`);
  }
  const points=Array.from({length:12},(_,i)=>actor.group.getObjectByName(`Segment_${i}`)!.getWorldPosition(new Vector3()));
  for(let i=1;i<12;i++)assert(points[i].distanceTo(points[i-1])<2.3,'broken segment chain');
 }
 actor.update(33,center);actor.group.updateMatrixWorld(true);const head=actor.group.getObjectByName('Segment_0')!,expected=head.getWorldPosition(new Vector3());
 for(let i=0;i<10;i++)actor.update(33,center);actor.group.updateMatrixWorld(true);assert(head.getWorldPosition(pos).distanceTo(expected)<1e-6,'same-time drift');
 actor.update(60,new Vector3(-1000,0,-1000));assert(!actor.group.visible);
 actor.update(33,center);actor.group.updateMatrixWorld(true);assert(actor.group.visible);assert(head.getWorldPosition(pos).distanceTo(expected)<1e-6,'culling changed route');
 assert(meshes.every(m=>!m.castShadow));
});
test('accepted coil and wheel poses stay connected, grounded and inside arena throughout all three phases and rest',async()=>{
 const b=await readFile(new URL('../public/models/centipede-animated.glb',import.meta.url)),gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const model=new ArenaCentipede(gltf),trail=model.startTrail(0),head=trail.at(-1)!,center=new Vector3(BOSS_ARENA.x,0,BOSS_ARENA.z);
 const a:CentipedeActor={id:'a',p:[head[0]+3,0,head[1]],yaw:0,size:1,available:true,done:false,points:0};let q=startCentipede(trail,a,1000)!,count=0;
 const meshes:Mesh[]=[];model.group.traverse(o=>{if(o instanceof Mesh&&!o.name.includes('simple body shadows')){o.geometry.computeBoundingBox();meshes.push(o);}});
 while(q&&count++<100){
  for(let frame=0;frame<=12;frame++){
   const now=q.stageAt+CENTIPEDE_TIMES[q.stage]*frame/12;model.update(now/1000,center,q,now);model.group.updateMatrixWorld(true);
   for(const mesh of meshes){const box=new Box3().copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);for(const x of [box.min.x,box.max.x])for(const z of [box.min.z,box.max.z])assert(Math.hypot(x-center.x,z-center.z)<BOSS_ARENA.playRadius+1,`${q.stage} outside arena at ${frame}`);}
   if(['stomp','back','wheelRoll','dizzy'].includes(q.stage)&&frame>0){
    const positions=Array.from({length:12},(_,i)=>model.group.getObjectByName(`Segment_${i}`)!.getWorldPosition(new Vector3()));
    for(let i=1;i<12;i++)assert(positions[i].distanceTo(positions[i-1])<2.15,`${q.stage} broken segment ${i}`);
   }
  }
  if(['exhausted','back','dizzy'].includes(q.stage)){
   const p=centipedeTarget(q);a.p=[p[0],q.stage==='back'?2.9:0,p[2]+(q.stage==='dizzy'?0:1)];const target=q.stage==='dizzy'?centipedeWheel(q,q.stageAt):{x:p[0],z:p[2]};a.yaw=Math.atan2(target.x-a.p[0],target.z-a.p[2]);
   if(q.stage==='back'){const actual=model.group.getObjectByName('BackTarget')!.getWorldPosition(new Vector3());assert(actual.distanceTo(new Vector3(...p))<.3,'painted back target aligns with actual bell');}
   assert(pushCentipede(q,a,q.stageAt+CENTIPEDE_TIMES[q.stage]-1));
  }else q=advanceCentipede(q,q.stageAt+CENTIPEDE_TIMES[q.stage]+1,[a]).event!;
 }
 assert(count<100);assert.equal(q,undefined);
});
