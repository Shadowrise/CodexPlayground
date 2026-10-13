import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,InstancedMesh,PerspectiveCamera,Vector3} from 'three';
import {MusicalFlowers} from '../src/musical-flowers';
import {MUSICAL_FLOWERS,canPlayFlower,validFlowerIndex} from '../src/musical-flower-site';
import {flatGround} from '../src/pond-layout';

test('seven reachable flowers stand on dry ground with separated blooms and three idle draws',()=>{
 const garden=new MusicalFlowers(),batches:InstancedMesh[]=[];garden.group.traverse(o=>{if(o instanceof InstancedMesh)batches.push(o);});
 assert.equal(garden.flowers.length,7);assert.equal(new Set(MUSICAL_FLOWERS.map(f=>f.color)).size,7);assert.equal(batches.length,3);
 let triangles=0;
 for(const batch of batches){assert(!batch.castShadow);triangles+=(batch.geometry.index?.count??batch.geometry.attributes.position.count)/3*batch.count;assert([...batch.geometry.attributes.position.array].every(Number.isFinite));}
 assert(triangles<35000,String(triangles));
 MUSICAL_FLOWERS.forEach((f,i)=>{
  assert(flatGround(f.x,f.z,1.3));const p=new Vector3(f.x,0,f.z+1.5);assert.equal(garden.nearest(p,1),i);assert(canPlayFlower(i,p,1));
  for(const other of MUSICAL_FLOWERS.slice(i+1))assert(Math.hypot(f.x-other.x,f.z-other.z)>2.7);
 });
 for(const invalid of [-1,7,NaN,.5,'0'])assert(!validFlowerIndex(invalid));
 assert(!canPlayFlower(0,{x:NaN,y:0,z:0},1));assert(!canPlayFlower(0,{x:0,y:10,z:0},1));assert(!canPlayFlower(0,{x:100,y:0,z:0},20));
});

test('playing lights one bloom, emits a coloured bounded note and cleans up without allocating scene objects',()=>{
 const garden=new MusicalFlowers(),camera=new PerspectiveCamera();camera.position.set(0,5,12);camera.lookAt(0,2,-8);
 let objects=0;garden.group.traverse(()=>objects++);
 assert(garden.press(4,10));assert(!garden.press(4,10.1));garden.update(10.25,camera);
 const petals=garden.group.getObjectByName('Instanced flower petals') as InstancedMesh,pulse=petals.geometry.getAttribute('flowerPulse');
 assert(pulse.getX(4)>.4);assert.equal(pulse.getX(0),0);
 const notes:Mesh[]=[];garden.group.traverse(o=>{if(o.name==='Floating musical note')notes.push(o as Mesh);});
 const floating=notes.find(n=>n.visible)!;assert(floating);assert.equal((floating.material as any).color.getHexString(),MUSICAL_FLOWERS[4].color.slice(1));
 const low=floating.position.y;garden.update(10.7,camera);assert(floating.position.y>low);
 for(let i=0;i<100;i++)garden.play(i%7,11+i*.01);garden.update(12,camera);assert(notes.filter(n=>n.visible).length<=14);
 let after=0;garden.group.traverse(()=>after++);assert.equal(after,objects);
 garden.update(14,camera);assert(notes.every(n=>!n.visible));for(let i=0;i<7;i++)assert.equal(pulse.getX(i),0);
 garden.reset();assert(garden.press(0,0));garden.reset();assert(notes.every(n=>!n.visible));
});
