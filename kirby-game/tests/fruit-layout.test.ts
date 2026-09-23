import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fruitLayout} from '../src/fruit-layout';
import {createForest} from '../src/forest';
import {sceneryClearance} from '../src/landmarks';
import {inWater} from '../src/pond-layout';
test('fruit placement is deterministic, clear of actual trees and landmarks, and spread across the meadow',()=>{
 const trees=createForest().userData.treePositions as {x:number;z:number}[],positions=fruitLayout(trees);
 assert.equal(positions.length,70);assert.deepEqual(positions,fruitLayout(trees));
 for(const [i,p] of positions.entries()){
  assert(sceneryClearance(p.x,p.z,5));assert(!inWater(p.x,p.z));assert(trees.every(t=>Math.hypot(t.x-p.x,t.z-p.z)>10));
  for(const q of positions.slice(i+1))assert(Math.hypot(q.x-p.x,q.z-p.z)>9);
 }
 for(const x of [-1,1])for(const z of [-1,1])assert(positions.filter(p=>p.x*x>0&&p.z*z>0).length>=12);
 assert(Math.max(...positions.map(p=>p.x))>170);assert(Math.min(...positions.map(p=>p.x))< -170);
});
