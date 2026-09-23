import {test} from 'node:test';import assert from 'node:assert/strict';
import {NpcSnapshots} from '../src/npc-snapshots';import type {ActorState} from '../src/network-protocol';
const actor=(x:number):ActorState=>({p:[x,0,0],q:[0,0,0,1],s:1,state:'Walk',pose:[],fruits:0,achievements:[],name:'NPC',variant:0,star:0});
test('5 Hz packets produce steady per-frame motion, including packet boundaries',()=>{
 const buffer=new NpcSnapshots();let last:number|undefined;
 for(let time=0;time<=2000;time+=10){if(time%200===0)buffer.push(time,[actor(time/1000)]);const x=buffer.sample(time)![0].p[0];if(time>260)assert(Math.abs(x-last!-.01)<1e-8);last=x;}
});
test('late packets hold safely, teleports do not slide and host migration clears old states',()=>{
 const buffer=new NpcSnapshots();buffer.push(0,[actor(0)]);buffer.push(200,[actor(100)]);assert.equal(buffer.sample(350)![0].p[0],0);assert.equal(buffer.sample(1000)![0].p[0],100);buffer.clear();assert.equal(buffer.sample(1000),undefined);buffer.push(1100,[actor(3)]);assert.equal(buffer.sample(1100)![0].p[0],3);
});
