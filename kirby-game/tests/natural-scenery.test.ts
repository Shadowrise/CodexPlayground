import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {createRockGeometry,createRockMaterial} from '../src/rock-model';
import {createReedGeometry,createWaterLilyGeometry,createWaterPlantMaterial} from '../src/water-plants';

const triangles=(g:T.BufferGeometry)=>g.index!.count/3;

test('weathered stone variants sit in the ground and share a small matte mineral surface',()=>{
 const material=createRockMaterial(),other=createRockMaterial();assert.equal(material.map,other.map);assert(!material.transparent);assert(material.vertexColors);assert.equal(material.map!.image.width,256);assert(material.map!.generateMipmaps);
 const shapes=[];
 for(let v=0;v<3;v++){
  const near=createRockGeometry(v),far=createRockGeometry(v,'far');assert(triangles(near)<=300);assert(triangles(far)<triangles(near)/4);
  const p=near.attributes.position;for(let i=0;i<p.count;i++)assert(Math.hypot(p.getX(i)*1.2,p.getZ(i))<1.45,'stone fits its dry-ground footprint');
  assert(near.boundingBox!.min.y*.85+.6<0,'bottom is seated rather than floating');
  assert(near.boundingBox!.max.y<1);assert(near.attributes.color.count===p.count);shapes.push([...p.array]);near.dispose();far.dispose();
 }
 assert.notDeepEqual(shapes[0],shapes[1]);assert.notDeepEqual(shapes[1],shapes[2]);material.dispose();other.dispose();
});

test('reed leaves join real curved stalks, retain biome colours and fit the old footprint at each LOD',()=>{
 for(const biome of ['spruce','birch','orchard','autumn'] as const)for(const detail of ['near','middle','far'] as const){
  const g=createReedGeometry(biome,0,detail),p=g.attributes.position;assert(triangles(g)<=800);
  for(let i=0;i<p.count;i++){assert(Number.isFinite(p.getY(i)));assert(p.getY(i)>=-.02,'only the stalk base is slightly buried');assert(Math.hypot(p.getX(i),p.getZ(i))<.68);}
  for(const anchor of g.userData.attachments as T.Vector3[]){
   let distance=Infinity;
   for(const points of g.userData.stems as T.Vector3[][])for(let i=1;i<points.length;i++)distance=Math.min(distance,anchor.distanceTo(new T.Line3(points[i-1],points[i]).closestPointToPoint(anchor,true,new T.Vector3())));
   assert(distance<1e-6,'blade base must lie on the rendered stalk');
  }
  g.dispose();
 }
 const spruce=createReedGeometry('spruce'),birch=createReedGeometry('birch');assert.notDeepEqual([...spruce.attributes.color.array],[...birch.attributes.color.array]);spruce.dispose();birch.dispose();
});

test('water lilies have open leaf notches, layered opaque flowers and cheaper distant forms',()=>{
 const near=createWaterLilyGeometry(),far=createWaterLilyGeometry(0,'far'),material=createWaterPlantMaterial();assert(triangles(near)<1000);assert(triangles(far)<triangles(near)/2);assert(!material.transparent);assert(material.depthWrite);assert(material.map!.generateMipmaps);assert.equal(material.map!.image.width,256);
 const p=near.attributes.position,uv=near.attributes.uv;
 let leafPoints=0;
 for(let i=0;i<p.count;i++)if(uv.getX(i)<.5&&uv.getY(i)>.5&&p.getX(i)>-.5){
  if(Math.hypot(p.getX(i),p.getZ(i))<.05)continue;
  assert(!(p.getZ(i)>.12&&Math.abs(p.getX(i))<p.getZ(i)*.22),'main leaf has a genuine cut-out, not a flattened ball');leafPoints++;
 }
 assert(leafPoints>80);assert(near.boundingBox!.min.y>0,'leaf rim is above the water surface');assert(near.boundingSphere!.radius<1.2,'keep clear of the boat route');near.dispose();far.dispose();material.dispose();
});
