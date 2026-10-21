import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Raycaster,Vector3} from 'three';
import {makeCoasterDepot} from '../src/coaster-depot';
import {DEPOT_PLATFORM} from '../src/depot-floor';

test('both platform sides have one visible stone surface, clear of the foundation core',()=>{
 const depot=makeCoasterDepot();depot.updateMatrixWorld(true);
 const ray=new Raycaster();
 for(const side of [-1,1])for(let i=0;i<6;i++){
  ray.set(new Vector3(side*14,.2,DEPOT_PLATFORM.z-4.15+i*1.63+.11),new Vector3(-side,0,0));
  const hits=ray.intersectObject(depot,true);assert(hits.length>0);
  assert(Math.abs(hits[0].point.x-side*12)<.001,'cladding keeps the original platform outline');
  assert.equal(hits.filter(h=>Math.abs(h.distance-hits[0].distance)<.005).length,1,'overlapping outer faces cause depth fighting');
 }
});
