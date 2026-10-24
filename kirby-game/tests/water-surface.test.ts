import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CircleGeometry,Mesh,MeshStandardMaterial,PlaneGeometry} from 'three';
import {waterPlanarUVs} from '../src/water-surface';
import {Ponds} from '../src/ponds';
import {RainbowFountain} from '../src/fountain';
import {Watermill,createWheelWaterGeometry} from '../src/watermill';

test('river, fountain pools/jets and mill channels share one static texture and independent flow clocks',()=>{
 const ponds=new Ponds(),fountain=new RainbowFountain(),mill=new Watermill(),materials=new Set<MeshStandardMaterial>();
 for(const group of [ponds.group,fountain.group,mill.group])group.traverse(o=>{
  if(o instanceof Mesh&&o.material instanceof MeshStandardMaterial&&o.material.userData.waterPhase)materials.add(o.material);
 });
 assert.equal(materials.size,4);
 const textures=new Set([...materials].map(m=>m.map));assert.equal(textures.size,1);
 const texture=[...textures][0]!;assert.equal(texture.image.width,256);assert.equal(texture.image.height,256);
 for(const m of materials){assert.equal(m.normalMap,texture);assert.equal(m.metalness,0);assert(m.forceSinglePass);}
 const version=texture.version;ponds.update(2);fountain.update(3,1);mill.update(1);
 assert.deepEqual([...materials].map(m=>m.userData.waterPhase.value).sort(),[0,2,3,3]);
 assert.equal(texture.version,version,'animation must not upload a new texture');
 assert.equal(texture.offset.length(),0,'animation must not move the shared texture transform');
});

test('planar and curved water keep the same ripple scale in metres',()=>{
 for(const geometry of [waterPlanarUVs(new PlaneGeometry(2.45,11.2)),waterPlanarUVs(new CircleGeometry(9.4,48))]){
  const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
  for(let i=0;i<p.count;i++){assert.equal(uv.getX(i),p.getX(i));assert.equal(uv.getY(i),p.getY(i));}
  geometry.dispose();
 }
 const geometry=createWheelWaterGeometry(),p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
 for(let i=2;i<p.count;i+=2){
  const distance=Math.hypot(p.getY(i)-p.getY(i-2),p.getZ(i)-p.getZ(i-2));
  assert(Math.abs(uv.getY(i-2)-uv.getY(i)-distance)<2e-6);
 }
 geometry.dispose();
});

test('fountain jets have length and finite surface normals along the complete arc',()=>{
 const fountain=new RainbowFountain(),arcs=fountain.group.getObjectByName('Fountain water arcs') as Mesh;
 const positions=arcs.geometry.getAttribute('position'),normals=arcs.geometry.getAttribute('normal');
 // The first main jet has 25 rings with six vertices per ring (five sides).
 assert(Math.hypot(positions.getX(0)-positions.getX(144),positions.getY(0)-positions.getY(144),positions.getZ(0)-positions.getZ(144))>4);
 for(const value of normals.array)assert(Number.isFinite(value));
});
