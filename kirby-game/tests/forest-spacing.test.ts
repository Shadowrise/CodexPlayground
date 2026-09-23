import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createForest} from '../src/forest';
import {sceneryClearance} from '../src/landmarks';
import {createCoasterCurve} from '../src/coaster';

test('tall tree crowns leave clearance between trees, attractions and the track',()=>{
  const forest=createForest();
  const trees=forest.userData.treePositions as {x:number;z:number;crownRadius:number}[];
  assert(trees.length>100);
  const track=createCoasterCurve().getPoints(1800);
  for(const [i,p] of trees.entries()){
    assert(sceneryClearance(p.x,p.z,p.crownRadius+1));
    for(const q of trees.slice(i+1))assert(Math.hypot(p.x-q.x,p.z-q.z)>=p.crownRadius+q.crownRadius+1.2);
    for(const q of track)assert(Math.hypot(p.x-q.x,p.z-q.z)>=p.crownRadius+5);
  }
});
