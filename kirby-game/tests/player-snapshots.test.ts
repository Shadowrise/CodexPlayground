import {test} from 'node:test';import assert from 'node:assert/strict';import {Quaternion,Vector3} from 'three';
import {PlayerSnapshots} from '../src/player-snapshots';import type {ActorState} from '../src/network-protocol';
const state=(x:number):ActorState=>({p:[x,0,0],q:[0,0,0,1],s:1,state:'Run',pose:[[0,0,0,0,0,0,1,1,1,1]],fruits:0,achievements:[],name:'Игрок',variant:0,star:0});
test('10 Hz packets render at evenly spaced intermediate positions and limb rotations',()=>{
 const b=new PlayerSnapshots(),a=state(0),z=state(10);z.pose[0][0]=2;const q=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2);z.pose[0].splice(3,4,...q.toArray());b.push(0,a);b.push(100,z);
 for(let i=0;i<=10;i++)assert(Math.abs(b.sample(150+i*10)!.p[0]-i)<1e-9);
 const mid=b.sample(200)!;assert.equal(mid.pose[0][0],1);assert(Math.abs(new Quaternion().fromArray(mid.pose[0].slice(3,7)).angleTo(new Quaternion())-Math.PI/4)<1e-8);
});
test('jitter is buffered; missing frames stop at the last position instead of extrapolating',()=>{const b=new PlayerSnapshots();b.push(0,state(0));b.push(120,state(6));b.push(210,state(12));assert.equal(b.sample(315)!.p[0],9);assert.equal(b.sample(2000)!.p[0],12);});
test('teleports and reconnect gaps discard old movement history',()=>{const b=new PlayerSnapshots();b.push(0,state(0));b.push(100,state(100));assert.equal(b.sample(100)!.p[0],100);b.push(2000,state(102));assert.equal(b.sample(2000)!.p[0],102);});
test('bug carrier offsets and rider are sampled on the same timeline',()=>{const b=new PlayerSnapshots(),a=state(0),z=state(10);a.ride={key:'bug:0',data:[0,0,0,0,0,-1,0,0,0,1]};z.ride={key:'bug:0',data:[0,0,0,0,10,-2,0,0,0,2]};b.push(0,a);b.push(100,z);const mid=b.sample(200)!;assert.equal(mid.ride!.data[4],mid.p[0]);assert.equal(mid.ride!.data[5],-1.5);assert.equal(mid.ride!.data[9],1.5);});
test('action transitions keep the old pose until the new state begins',()=>{const b=new PlayerSnapshots(),a=state(0),z=state(1);z.state='Idle';z.pose=[];b.push(0,a);b.push(100,z);assert.equal(b.sample(200)!.state,'Run');assert.equal(b.sample(250)!.state,'Idle');assert.equal(b.sample(250)!.pose.length,0);});
