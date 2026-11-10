import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mesh, MeshStandardMaterial, PointLight, Box3, Matrix4, Triangle, Vector3 } from 'three';
import { Firefly, FIREFLY_MODES } from '../src/firefly';
test('firefly GLB contains working idle blink, flight and independently configurable glow',async()=>{
 const bytes=await readFile(new URL('../public/models/firefly-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 assert.deepEqual(gltf.animations.map(c=>c.name).sort(),[...FIREFLY_MODES].sort());
 const f=new Firefly(gltf);f.update(.3);const eye=f.object.getObjectByName('Left_Eye')!;assert(eye.scale.y>.9);
 f.mixer.setTime(1.68);assert(eye.scale.y<.1);f.mixer.setTime(2);assert(eye.scale.y>.9);
 f.setMode('Fly');f.update(.3);const wing=f.object.getObjectByName('Left_Wing')!,pose=wing.quaternion.clone();f.update(.04);assert(wing.quaternion.angleTo(pose)>.1);assert(wing.scale.x>.99);
 const glow=(f.object.getObjectByName('Glow_Abdomen') as Mesh).material as MeshStandardMaterial;
 const shell=(f.object.getObjectByName('Thorax') as Mesh).material as MeshStandardMaterial,original=shell.color.clone();
 f.setGlowColor('#ff3388');assert.equal(glow.emissive.getHexString(),'ff3388');assert(shell.color.equals(original));
 assert.equal((f.object.getObjectByName('Firefly_Light') as PointLight).color.getHexString(),'ff3388');
 f.setMode('Sit');f.update(.3);assert(wing.scale.x<.05);assert(!new Box3().setFromObject(f.object).isEmpty());
});

test('standing feet support the front and rear of the body on the same ground plane',async()=>{
 const bytes=await readFile(new URL('../public/models/firefly-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const f=new Firefly(gltf);f.update(.3);
 for(const time of [0,2,5,8,11]){
  f.mixer.setTime(time);f.object.updateWorldMatrix(true,true);
  const abdomen=f.object.getObjectByName('Glow_Abdomen')!.getWorldPosition(new Vector3()),torso=f.object.getObjectByName('Thorax')!.getWorldPosition(new Vector3());
  for(const side of ['Left','Right']){
   const front=f.object.getObjectByName(side+'_Foot_0')!,rear=f.object.getObjectByName(side+'_Foot_2')!;
   assert(front.getWorldPosition(new Vector3()).z>torso.z+.1);
   assert(rear.getWorldPosition(new Vector3()).z<abdomen.z-.04,'rear feet stay behind the glowing abdomen');
   for(let i=0;i<3;i++){
    const foot=f.object.getObjectByName(side+'_Foot_'+i)!,bottom=new Box3().setFromObject(foot).min.y;
    assert(bottom>=.014&&bottom<.028,'all foot pads rest on the preview ground without clipping');
   }
  }
 }
});

test('the complete grooming leg stays outside the head at 120 Hz, including lifting and lowering',async()=>{
 const bytes=await readFile(new URL('../public/models/firefly-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const f=new Firefly(gltf);f.mixer.stopAllAction();f.mixer.clipAction(gltf.animations.find(c=>c.name==='Groom')!).reset().stopFading().setEffectiveWeight(1).play();
 const head=f.object.getObjectByName('Head')!,meshes:Mesh[]=[];
 for(const side of ['Left','Right'])f.object.getObjectByName(side+'_Leg_0')!.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});
 const inverse=new Matrix4(),matrix=new Matrix4(),normalize=new Matrix4().makeScale(1/.391,1/.351,1/.341);
 const triangle=new Triangle(),origin=new Vector3(),closest=new Vector3();
 for(let frame=0;frame<=8*120;frame++){
  const time=frame/120;f.mixer.setTime(time);f.object.updateWorldMatrix(true,true);inverse.copy(head.matrixWorld).invert();
  for(const mesh of meshes){
   matrix.multiplyMatrices(normalize,inverse).multiply(mesh.matrixWorld);
   const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?.count??positions.count;
   for(let i=0;i<count;i+=3){
    triangle.a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(matrix);
    triangle.b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(matrix);
    triangle.c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(matrix);
    triangle.closestPointToPoint(origin,closest);
    assert(closest.lengthSq()>=1,`${mesh.name} clips the head at ${time.toFixed(3)} s`);
   }
  }
 }
});

test('grooming antennas and paws clear both visible eyes throughout the complete loop',async()=>{
 const bytes=await readFile(new URL('../public/models/firefly-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const f=new Firefly(gltf);f.mixer.stopAllAction();f.mixer.clipAction(gltf.animations.find(c=>c.name==='Groom')!).reset().stopFading().setEffectiveWeight(1).play();
 const eyes=['Left','Right'].map(side=>f.object.getObjectByName(side+'_Eye_features')!),meshes:Mesh[]=[];
 for(const side of ['Left','Right'])for(const part of ['Antenna','Leg_0'])f.object.getObjectByName(side+'_'+part)!.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});
 // This volume encloses the lens, pupil, highlights and eyelids, and follows
 // the actual mild squint instead of treating the head as the eye boundary.
 const normalize=new Matrix4().makeScale(1/.155,1/.205,1/.105),inverse=new Matrix4(),matrix=new Matrix4();
 const triangle=new Triangle(),origin=new Vector3(),closest=new Vector3();
 f.object.updateWorldMatrix(true,true);
 for(const eye of eyes){
  inverse.copy(eye.matrixWorld).invert();
  eye.traverse(o=>{
   if(!(o instanceof Mesh))return;matrix.multiplyMatrices(normalize,inverse).multiply(o.matrixWorld);
   const positions=o.geometry.attributes.position;
   for(let i=0;i<positions.count;i++)assert(new Vector3().fromBufferAttribute(positions,i).applyMatrix4(matrix).lengthSq()<1,'eye clearance volume must enclose every visible eye detail');
  });
 }
 for(let frame=0;frame<=8*120;frame++){
  const time=frame/120;f.mixer.setTime(time);f.object.updateWorldMatrix(true,true);
  for(const eye of eyes){
   inverse.copy(eye.matrixWorld).invert();
   for(const mesh of meshes){
    matrix.multiplyMatrices(normalize,inverse).multiply(mesh.matrixWorld);
    const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?.count??positions.count;
    for(let i=0;i<count;i+=3){
     triangle.a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(matrix);
     triangle.b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(matrix);
     triangle.c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(matrix);
     triangle.closestPointToPoint(origin,closest);
     assert(closest.lengthSq()>=1,`${mesh.name} clips ${eye.name} at ${time.toFixed(3)} s`);
    }
   }
  }
 }
});

test('both grooming paws follow the visible bent antenna, with contact and a real cleaning stroke',async()=>{
 const bytes=await readFile(new URL('../public/models/firefly-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const f=new Firefly(gltf);f.mixer.stopAllAction();f.mixer.clipAction(gltf.animations.find(c=>c.name==='Groom')!).reset().stopFading().setEffectiveWeight(1).play();
 const triangle=new Triangle(),local=new Vector3(),closest=new Vector3();
 for(const [side,start] of [['Left',1.4],['Right',4.7]] as const){
  const antenna=f.object.getObjectByName(side+'_Antenna')!,foot=f.object.getObjectByName(side+'_Foot_0')!,stems:Mesh[]=[];
  antenna.traverse(o=>{if(o instanceof Mesh&&o.name.includes('_Antenna_stem_'))stems.push(o);});
  const path=new Box3();
  for(let sample=0;sample<14;sample++){
   f.mixer.setTime(start+sample*.1);f.object.updateWorldMatrix(true,true);
   const position=foot.getWorldPosition(new Vector3());path.expandByPoint(position);let distance=Infinity;
   for(const stem of stems){
    local.copy(position);stem.worldToLocal(local);const positions=stem.geometry.attributes.position,index=stem.geometry.index,count=index?.count??positions.count;
    for(let i=0;i<count;i+=3){
     triangle.a.fromBufferAttribute(positions,index?index.getX(i):i);triangle.b.fromBufferAttribute(positions,index?index.getX(i+1):i+1);triangle.c.fromBufferAttribute(positions,index?index.getX(i+2):i+2);
     triangle.closestPointToPoint(local,closest);distance=Math.min(distance,closest.distanceTo(local));
    }
   }
   assert(distance<.032,`${side} paw must touch the shaft, gap ${distance.toFixed(4)}`);
   if(sample%3===0){
    let surfaceGap=Infinity;const pad=foot as Mesh,padVertices=pad.geometry.attributes.position;
    for(const stem of stems){
     const transform=new Matrix4().multiplyMatrices(stem.matrixWorld.clone().invert(),foot.matrixWorld);
     const vertices=stem.geometry.attributes.position,index=stem.geometry.index!;
     for(let vertex=0;vertex<padVertices.count;vertex++){
      local.fromBufferAttribute(padVertices,vertex).applyMatrix4(transform);
      for(let i=0;i<index.count;i+=3){
       triangle.a.fromBufferAttribute(vertices,index.getX(i));triangle.b.fromBufferAttribute(vertices,index.getX(i+1));triangle.c.fromBufferAttribute(vertices,index.getX(i+2));
       triangle.closestPointToPoint(local,closest);surfaceGap=Math.min(surfaceGap,closest.distanceTo(local));
      }
     }
    }
    assert(surfaceGap<.002,`${side} visible foot pad must contact the visible shaft, gap ${surfaceGap}`);
   }
   const eyelid=f.object.getObjectByName(side+'_Eye')!.scale.y;
   assert(eyelid>.85&&eyelid<.95,'grooming uses a slight squint, preserving the eye shape');
  }
  assert(path.getSize(new Vector3()).length()>.12,'the paw slides along the antenna rather than remaining at one point');
 }
});

test('flight has independent leg and antenna motion; idle occasionally opens and folds its wings',async()=>{
 const bytes=await readFile(new URL('../public/models/firefly-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const f=new Firefly(gltf),wing=f.object.getObjectByName('Left_Wing')!;
 f.update(.3);f.mixer.setTime(2);assert(wing.scale.x<.05);
 f.mixer.setTime(3.5);assert(wing.scale.x>.95,'idle has a short wing flutter');
 f.mixer.setTime(5);assert(wing.scale.x<.05,'wings fold after the idle flutter');
 f.setMode('Fly');f.update(.3);f.mixer.setTime(.4);
 const nodes=['Left_Leg_0','Left_Leg_1','Right_Leg_2','Left_Antenna','Right_Antenna'];
 const rotations=nodes.map(name=>f.object.getObjectByName(name)!.quaternion.clone());
 f.mixer.setTime(.55);
 nodes.forEach((name,i)=>assert(f.object.getObjectByName(name)!.quaternion.angleTo(rotations[i])>.015,name+' must move during flight'));
});

test('all five exported animations loop without snapping and return cleanly to sitting',async()=>{
 const bytes=await readFile(new URL('../public/models/firefly-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 for(const clip of gltf.animations)for(const track of clip.tracks){
  assert(Array.from(track.values).every(Number.isFinite),track.name);
  const n=track.getValueSize();
  for(let i=0;i<n;i++)assert(Math.abs(track.values[i]-track.values[track.values.length-n+i])<1e-5,clip.name+': '+track.name+' must loop');
 }
 const f=new Firefly(gltf);f.update(.3);
 for(const mode of FIREFLY_MODES){
  f.setMode(mode);f.update(.3);f.mixer.setTime(2.2);
  f.setMode('Sit');f.update(.3);f.mixer.setTime(2);
  assert(f.object.getObjectByName('Left_Wing')!.scale.x<.05,'return from '+mode);
  assert(Math.abs(f.object.getObjectByName('Motion')!.position.y)<.02,'sitting height after '+mode);
 }
});
