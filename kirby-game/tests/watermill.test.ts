import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InstancedMesh, Matrix4, Mesh, ShaderMaterial, Vector3 } from 'three';
import {newMillQuest} from '../src/mill-quest';
import { Watermill, MILL_SITE, MILL_LEVER, createWheelWaterGeometry } from '../src/watermill';

test('water descends continuously and follows the outer scoops without crossing the wheel',()=>{
  const geometry=createWheelWaterGeometry(),positions=geometry.getAttribute('position'),uvs=geometry.getAttribute('uv');
  for(let i=2;i<positions.count;i+=2) {
    assert(positions.getY(i)<positions.getY(i-2));
    assert(uvs.getY(i)<uvs.getY(i-2),'positive shader time carries ripples downstream');
  }
  for(let i=2;i<positions.count-2;i+=2) {
    const radius=Math.hypot(positions.getY(i)-3.65,positions.getZ(i)+1);
    assert(Math.abs(radius-3.43)<1e-5);
    if(i>2){const y=(positions.getY(i)+positions.getY(i-2))*.5,z=(positions.getZ(i)+positions.getZ(i-2))*.5;
      assert(Math.hypot(y-3.65,z+1)>3.4,'segments also clear rotating paddle corners');}
  }
  assert(Math.abs(positions.getY(0)-7.05)<1e-5);
  assert(Math.abs(positions.getY(positions.count-1)+.31)<1e-5);
});

test('mill requires proximity; gate and wheel accelerate and settle when stopped',()=>{
  const mill=new Watermill();
  assert.equal(mill.action({id:'solo',p:[-100,0,-100],yaw:0,size:1}),undefined);
  mill.update(1);assert.equal(mill.wheel.rotation.x,0);
  mill.setQuest({...newMillQuest(),stage:'running',owner:'solo',runningUntil:61000},1000);assert(mill.running);
  mill.update(1/60);const first=Math.abs(mill.wheel.rotation.x);
  assert(first>0 && first<.001);
  for(let i=0;i<300;i++)mill.update(1/60);
  assert(mill.flow>.99);assert(mill.gate.position.y>8);
  assert(Math.abs(mill.wheel.rotation.x)>1);
  mill.setQuest(newMillQuest(),61000);assert(!mill.running);
  for(let i=0;i<600;i++)mill.update(1/60);
  assert(mill.flow<.001);
  const settled=mill.wheel.rotation.x;mill.update(1);
  assert(Math.abs(mill.wheel.rotation.x-settled)<.0001);
});
test('mill blocks building walls at enlarged sizes and leaves the lever approachable',()=>{
  const mill=new Watermill();
  for(const size of [1,4]) {
    const position=MILL_SITE.clone().add(new Vector3(17,0,3));
    mill.constrain(position,size);
    assert(position.z>=MILL_SITE.z+3.2+.65*size-1e-9);
  }
  const position=MILL_LEVER.clone();mill.constrain(position,1);assert(position.equals(MILL_LEVER));
});
test('pressure monitor follows actual flow through gate changes, milling and shutdown',()=>{
  const mill=new Watermill(),monitor=mill.decor.pressureMonitor;
  const settle=()=>{for(let i=0;i<100;i++)mill.update(.1);};
  mill.update(.1);assert.equal(monitor.percent,0);
  mill.setQuest({...newMillQuest(),stage:'flow',gate:0},1000);settle();assert.equal(monitor.percent,22);
  mill.setQuest({...newMillQuest(),stage:'flow',gate:2},2000);settle();assert.equal(monitor.percent,150);
  mill.setQuest({...newMillQuest(),stage:'flow',gate:1},3000);mill.update(.1);
  assert(monitor.percent>100&&monitor.percent<150,'reading follows the water settling after a lever change');
  settle();assert.equal(monitor.percent,100);
  for(const stage of ['bags','knead','bake','running'] as const){
    mill.setQuest({...newMillQuest(),stage,gate:2,runningUntil:61000},4000);settle();
    assert.equal(monitor.percent,100,'later stages show working flow even with a stale gate setting');
  }
  mill.setQuest(newMillQuest(),61000);mill.update(.1);assert(monitor.percent>0&&monitor.percent<100);
  settle();assert.equal(monitor.percent,0);
});

test('mill batches detailed parts to keep draw calls bounded',()=>{
  const mill=new Watermill();let draws=0,triangles=0;
  mill.group.traverse(o=>{if(o instanceof Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o instanceof InstancedMesh?o.count:1);}});
  assert(triangles>14000,'keep the detailed ornaments');assert(draws<75);
});

test('celebration bubbles appear near the funnel at player height, including at completion',()=>{
 const mill=new Watermill(),now=10000;
 mill.setQuest({...newMillQuest(),stage:'running',deliveredAt:now,runningUntil:now+60000},now);
 mill.update(.016);
 const bubbles=mill.group.getObjectByName('Mill celebration bubbles') as InstancedMesh;
 assert(bubbles.visible);assert.equal(bubbles.count,96);
 const matrix=new Matrix4(),p=new Vector3();let low=0;
 for(let i=0;i<bubbles.count;i++){bubbles.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);if(p.y<4.5&&matrix.elements[0]>.1)low++;assert(p.z>=38.8);}
 assert(low>=20,'plenty of visible bubbles near the player, not only above the roof');
});

test('channel shares wheel ripples: stopped, flowing and faster without phase jumps',()=>{
 const mill=new Watermill();
 const channel=mill.group.getObjectByName('Mill branch channel water') as Mesh;
 const wheel=mill.group.getObjectByName('Water over wheel scoops') as Mesh;
 assert.equal(channel.material,wheel.material);
 const shader=channel.material as ShaderMaterial;
 mill.update(1);assert.equal(shader.uniforms.phase.value,0);
 const settle=(gate:number)=>{mill.setQuest({...newMillQuest(),stage:'flow',gate},1000);for(let i=0;i<80;i++)mill.update(.1);};
 settle(0);let phase=shader.uniforms.phase.value;mill.update(.1);const slow=shader.uniforms.phase.value-phase;
 settle(2);phase=shader.uniforms.phase.value;mill.update(.1);const fast=shader.uniforms.phase.value-phase;assert(fast>slow*5);
 mill.setQuest(newMillQuest(),2000);phase=shader.uniforms.phase.value;mill.update(.1);
 assert(shader.uniforms.phase.value>=phase,'reducing pressure cannot make water run backwards');
 for(let i=0;i<80;i++)mill.update(.1);phase=shader.uniforms.phase.value;mill.update(2);assert.equal(shader.uniforms.phase.value,phase);
 const uv=channel.geometry.getAttribute('uv'),position=channel.geometry.getAttribute('position');
 assert(uv.getY(0)>uv.getY(2));assert(position.getY(0)>position.getY(2),'decreasing V goes downstream (+Z after rotation)');
});
