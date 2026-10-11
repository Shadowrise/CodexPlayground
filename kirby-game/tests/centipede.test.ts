import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AnimationMixer,Box3,Mesh,LoopOnce,Vector3} from 'three';
import {CENTIPEDE_CLIPS} from '../src/centipede-clips';
import {centipedeCrawl,CENTIPEDE_STEP} from '../src/centipede-event';
import {BOSS_ARENA} from '../src/boss-arena-site';

test('phase-two body follows the head history, and exported walking feet plant between lifted steps',async()=>{
 const bytes=await readFile(new URL('../public/models/centipede-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),mixer=new AnimationMixer(gltf.scene);
 const point=new Vector3(),box=new Box3();
 const inverseDistance=(stage:'coil'|'lower'|'rise',distance:number)=>{
  let lo=0,hi=1;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(centipedeCrawl(stage,mid).distance<distance)lo=mid;else hi=mid;}return (lo+hi)/2;
 };
 for(const [stage,name] of [['coil','CoilArena'],['lower','LowerBack'],['rise','Rise']] as const){
  const clip=gltf.animations.find(c=>c.name===name)!;
  mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(LoopOnce,1).play();action.clampWhenFinished=true;
  for(let frame=1;frame<80;frame++){
   const u=frame/80,crawl=centipedeCrawl(stage,u);action.time=u*clip.duration;mixer.update(0);gltf.scene.updateMatrixWorld(true);
   for(let i=0;i<12;i++){
    if(crawl.distance<i*CENTIPEDE_STEP)continue;
    const past=centipedeCrawl(stage,inverseDistance(stage,crawl.distance-i*CENTIPEDE_STEP)).links[0],p=crawl.links[i];
    assert(Math.hypot(p.x-past.x,p.z-past.z)<.0001,`${name} link ${i} must follow the head, not slide into a bent pose`);
    const actual=gltf.scene.getObjectByName(`Segment_${i}`)!.getWorldPosition(point);
    assert(Math.hypot(actual.x*1.25+BOSS_ARENA.x-p.x,actual.z*1.25+BOSS_ARENA.z-p.z)<.16,'export follows the crawl path, including the slight stair sway');
   }
  }
  // Select two instants in one stance, away from start/end and stair lifting.
  const stride=1.5*1.25,segment=6,k=Math.floor(centipedeCrawl(stage,.5).distance/stride-segment*.13);
  const foot=gltf.scene.getObjectByName(`Boot_${segment}_-1`)!,boots:Mesh[]=[];foot.traverse(o=>{if(o instanceof Mesh){o.geometry.computeBoundingBox();boots.push(o);}});
  const positions:Vector3[]=[];
  for(const fraction of [.18,.38]){
   const u=inverseDistance(stage,(k+fraction+segment*.13)*stride);action.time=u*clip.duration;mixer.update(0);gltf.scene.updateMatrixWorld(true);
   positions.push(foot.getWorldPosition(new Vector3()));
   for(const boot of boots){box.copy(boot.geometry.boundingBox!).applyMatrix4(boot.matrixWorld);assert(Math.abs(box.min.y-.02)<.012,`${name} planted sole should touch the floor`);}
  }
  assert(positions[0].distanceTo(positions[1])<.012,`${name} planted boot must not slide across the floor`);
 }
});

test('stationary boots stay on the ground while the body breathes and the face animates',async()=>{
 const bytes=await readFile(new URL('../public/models/centipede-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const mixer=new AnimationMixer(gltf.scene),box=new Box3(),boots:Mesh[]=[];
 gltf.scene.traverse(o=>{if(o instanceof Mesh&&o.parent!.name.startsWith('Boot_')){o.geometry.computeBoundingBox();boots.push(o);}});
 assert.equal(boots.length,22);
 for(const name of ['Idle','Exhausted','Sneeze']){
  mixer.stopAllAction();const clip=gltf.animations.find(c=>c.name===name)!,action=mixer.clipAction(clip);action.setLoop(LoopOnce,1).play();action.clampWhenFinished=true;
  let previous:Vector3[]|undefined,bodyMin=Infinity,bodyMax=-Infinity;
  for(let i=0;i<=60;i++){
   action.time=clip.duration*i/60;mixer.update(0);gltf.scene.updateMatrixWorld(true);
   const positions=boots.map(b=>b.getWorldPosition(new Vector3()));
   for(const [index,boot] of boots.entries()){
    box.copy(boot.geometry.boundingBox!).applyMatrix4(boot.matrixWorld);
    assert(Math.abs(box.min.y-.02)<.003,`${name} sole ${index} floating at ${box.min.y}`);
    if(previous)assert(positions[index].distanceTo(previous[index])<.003,`${name} boot slides while stationary`);
   }
   previous=positions;
   const scale=gltf.scene.getObjectByName('Segment_3')!.scale.y;bodyMin=Math.min(bodyMin,scale);bodyMax=Math.max(bodyMax,scale);
  }
  assert(bodyMax-bodyMin>.01,'body breathing must remain visible');
 }
});

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
