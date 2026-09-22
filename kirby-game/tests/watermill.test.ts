import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InstancedMesh, Mesh, Vector3 } from 'three';
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
  assert(Math.abs(positions.getY(positions.count-1)-.11)<1e-5);
});

test('mill requires proximity; gate and wheel accelerate and settle when stopped',()=>{
  const mill=new Watermill();
  assert.equal(mill.interact(new Vector3(-100,0,-100)),false);
  mill.update(1);assert.equal(mill.wheel.rotation.x,0);
  assert(mill.interact(MILL_LEVER));assert(mill.running);
  mill.update(1/60);const first=Math.abs(mill.wheel.rotation.x);
  assert(first>0 && first<.001);
  for(let i=0;i<300;i++)mill.update(1/60);
  assert(mill.flow>.99);assert(mill.gate.position.y>8);
  assert(Math.abs(mill.wheel.rotation.x)>1);
  assert(mill.interact(MILL_LEVER));assert(!mill.running);
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
test('mill batches detailed parts to keep draw calls bounded',()=>{
  const mill=new Watermill();let draws=0,instances=0;
  mill.group.traverse(o=>{if(o instanceof Mesh)draws++;if(o instanceof InstancedMesh)instances+=o.count;});
  assert(instances>600);assert(draws<90);
});
