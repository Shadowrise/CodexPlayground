import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {Route,type Destination} from '../src/navigation';
const places:Destination[]=[{id:'east',name:'East',x:100,z:0},{id:'north',name:'North',x:0,z:100}];
test('route follows selected destination in world space and resets on arrival',()=>{
 const route=new Route();route.select('east',places);const first=route.update(new Vector3(0,0,0))!;
 assert.equal(first.distance,100);assert.equal(first.yaw,Math.PI/2);
 const closer=route.update(new Vector3(50,0,0))!;assert.equal(closer.distance,50);
 route.select('north',places);assert.equal(route.update(new Vector3())!.yaw,0);
 assert.equal(route.update(new Vector3(0,0,97)),undefined);assert.equal(route.target,undefined);
});
test('flying above a destination does not clear it; cancellation and switching do',()=>{
 const route=new Route();route.select('east',places);assert(route.update(new Vector3(100,20,0)));assert(route.target);
 route.select('',places);assert.equal(route.update(new Vector3()),undefined);
 route.select('north',places);assert.equal(route.target?.id,'north');route.select('invalid',places);assert.equal(route.target,undefined);
});
