import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomSpawn} from '../src/spawn';
import {sceneryClearance} from '../src/landmarks';

test('random spawns vary, stay inside the track and avoid scenery and actors',()=>{
  let seed=817;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const obstacles=[{x:0,z:0},{x:100,z:100},{x:-80,z:40}];
  const points=Array.from({length:100},()=>randomSpawn(obstacles,random));
  assert(new Set(points.map(p=>`${p.x},${p.z}`)).size>90);
  for(const p of points) {
    assert(Math.abs(p.x)<=208 && Math.abs(p.z)<=208);
    assert(sceneryClearance(p.x,p.z,5));
    assert(obstacles.every(o=>Math.hypot(o.x-p.x,o.z-p.z)>7));
  }
});
