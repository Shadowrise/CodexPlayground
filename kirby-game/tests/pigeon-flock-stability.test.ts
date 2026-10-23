import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NetworkSession} from '../src/network';
import {pidgieFixture} from './pidgie-fixture';
import {validActor} from '../src/network-protocol';
import {validPigeonCheckpoint,compactPigeonCheckpoint,PIGEON_FLOCK_BATCH} from '../src/pigeon-flock-state';
import {PigeonSnapshots} from '../src/pigeon-snapshots';

test('world, complex player pose and flock checkpoints never exceed the room frame limit',()=>{
 const n=.12345678901234567,point:[number,number]=[n,n],bird={...pidgieFixture(),phase:'follow' as const,p:[n,n,n] as [number,number,number],refuge:point,target:point,origin:point,destination:point,yaw:n,elapsed:n,walkTimer:n,pause:n,cooldown:n,height:n,flightDuration:n,turnStart:n,turnTarget:n,clipTime:n,followId:'p'.repeat(64),followSpeed:n};
 const checkpoints=Array.from({length:PIGEON_FLOCK_BATCH},(_,i)=>({id:String(i).padStart(64,'b'),bird,helloIn:n,helloRemaining:n,helloCount:1}));
 assert(checkpoints.every(validPigeonCheckpoint));
 const actor={p:[n,n,n],q:[n,n,n,n],s:n,state:'Run',pose:Array.from({length:5},()=>Array(10).fill(n)),fruits:0,achievements:[],name:'Игрок',variant:0,star:0};assert(validActor(actor));
 const messages:string[]=[],session=new NetworkSession();session.id='host';session.peerCount=2;session.room={id:'room',host:'host',epoch:0,fruits:[],starAt:0,mill:false,locks:{},pigeonFlock:checkpoints.map((c,i)=>({id:c.id,playerId:bird.followId,skin:'pidgie',seed:1,order:i}))};
 (session as any).socket={readyState:1,bufferedAmount:0,send:(message:string)=>messages.push(message)};
 session.tick(.3,actor,()=>({padding:'x'.repeat(18000)} as any),()=>checkpoints);
 assert(messages.length>1,'oversized combinations are split without dropping the world or flock');
 for(const message of messages)assert(message.length<=22000,`host would be disconnected: ${message.length} characters`);
 assert.equal(messages.map(m=>JSON.parse(m).pigeons?.length??0).reduce((a,b)=>a+b,0),checkpoints.length);
});

test('flock packets shed float precision without changing simulation state, identities or counters',()=>{
 const n=.12345678901234567,bird={...pidgieFixture(),p:[-n,n,n] as [number,number,number],yaw:n,clipTime:n,seed:4294967295};
 const original={id:'bird',bird,helloIn:n,helloRemaining:n,helloCount:10000,slot:123,at:123456789.123456,departureY:n};
 const saved=structuredClone(original),compact=compactPigeonCheckpoint(original);
 assert.deepEqual(original,saved);assert(validPigeonCheckpoint(compact));
 assert.equal(compact.bird.seed,bird.seed);assert.equal(compact.helloCount,original.helloCount);assert.equal(compact.slot,123);
 for(let i=0;i<3;i++)assert(Math.abs(compact.bird.p[i]-bird.p[i])<=.0005);
 assert(Math.abs(compact.at!-original.at)<=.5);
 const repeated={...original,bird:{...bird,elapsed:n,walkTimer:n,pause:n,cooldown:n,height:n,flightDuration:n,turnStart:n,turnTarget:n}};
 assert(JSON.stringify(compactPigeonCheckpoint(repeated)).length<JSON.stringify(repeated).length*.8);
});

test('guests render a continuous host timeline with jitter instead of chasing each packet',()=>{
 const buffer=new PigeonSnapshots(),samples:number[]=[],base=pidgieFixture();
 const checkpoints=Array.from({length:35},(_,i)=>({id:'bird',at:i*100,bird:{...base,phase:'follow' as const,clip:'Run' as const,p:[i*.8,0,0] as [number,number,number],clipTime:(i*.1)%1.98},helloIn:4,helloRemaining:0,helloCount:0}));
 let next=0;
 for(let now=0;now<3400;now+=16){
  while(next<checkpoints.length&&checkpoints[next].at+80+(next%3)*35<=now){buffer.push(checkpoints[next],now);next++;}
  const state=buffer.sample(now,280);if(state&&now>=600)samples.push(state.p[0]);
 }
 for(let i=1;i<samples.length;i++)assert(Math.abs(samples[i]-samples[i-1]-.128)<.00001,`constant host speed between packets: frame ${i}, step ${samples[i]-samples[i-1]}`);
 // Angle interpolation takes the short route across ±pi.
 const turning=new PigeonSnapshots();turning.push({...checkpoints[0],bird:{...base,yaw:3.1}},0);turning.push({...checkpoints[1],bird:{...base,yaw:-3.1}},100);
 assert(Math.abs(turning.sample(50,0)!.yaw-Math.PI)<.001);
});
