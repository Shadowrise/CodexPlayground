import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {pushTarget} from '../src/push-target';
import {validActor} from '../src/network-protocol';
test('push targeting respects direction, height, activities and rolls',()=>{
 const target={id:'b',p:[0,0,2],s:1,state:'Idle'};
 assert.equal(pushTarget([0,0,0],0,1,[target])?.id,'b');
 for(const other of [{...target,p:[0,0,-2]},{...target,p:[0,30,2]},{...target,state:'Roll'},{...target,state:'Balloon'}])assert.equal(pushTarget([0,0,0],0,1,[other]),undefined);
 assert(pushTarget([0,0,0],0,1,[{...target,state:'FireflyRide',p:[0,6,2]}]));
});
test('a 700% Kirby reaches smaller bodies in front without reaching through height gaps',()=>{
 for(const size of [.3,1,7]){
  const target={id:'small',p:[0,0,8],s:size,state:'Idle'};
  assert.equal(pushTarget([0,0,0],0,7,[target])?.id,'small');
  assert.equal(pushTarget([0,0,0],Math.PI/2,7,[{...target,p:[8,0,0]}])?.id,'small');
  assert.equal(pushTarget([0,0,0],0,7,[{...target,p:[0,0,-12]}]),undefined);
  assert.equal(pushTarget([0,0,0],0,7,[{...target,p:[0,30,8]}]),undefined);
  assert.equal(pushTarget([0,15,0],0,7,[target]),undefined);
 }
});
test('server chooses exactly one human or NPC target and broadcasts it to all clients',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }').replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './", "from '"+new URL('../../game-server/src/',import.meta.url).href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const saved=(globalThis as any).WebSocketRequestResponsePair;(globalThis as any).WebSocketRequestResponsePair=class {};const original=Date.now;let now=100000;Date.now=()=>now;
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const actor=(z:number,state='Idle')=>({p:[0,0,z],q:[0,0,0,1],s:1,state,pose:[],fruits:0,achievements:[],name:'Test',variant:0,star:0});
  class Socket{readyState=1;messages:any[]=[];constructor(public data:any){}deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(a:any){this.data=structuredClone(a);}send(m:string){this.messages.push(JSON.parse(m));}}
  const a=new Socket({id:'a',variant:0,seen:now,visible:true,actor:actor(0,'Push')}),b=new Socket({id:'b',variant:1,seen:now,visible:true,actor:actor(2,'FireflyRide')}),sockets=[a,b];
  const ctx={getWebSockets:()=>sockets,setWebSocketAutoResponse(){},blockConcurrencyWhile:(fn:()=>unknown)=>fn(),waitUntil(){},storage:{get:async()=>undefined,delete:async()=>{},setAlarm:async()=>{}}};const room=new GameRoom(ctx,{});room.room={id:'room',host:'a',epoch:now,fruits:Array(70).fill(null),starAt:0,mill:false,locks:{'bug:0':'b'},world:{npcs:[actor(2.7)]}};
  room.webSocketMessage(a,JSON.stringify({type:'frame',events:[{type:'hit'},{type:'hit'}]}));
  for(const s of sockets){const hits=s.messages.filter(m=>m.type==='hit');assert.equal(hits.length,1);assert.equal(hits[0].target,'b');}
  now+=99;room.webSocketMessage(a,JSON.stringify({type:'frame',events:[{type:'hit'}]}));
  for(const s of sockets)assert.equal(s.messages.filter(m=>m.type==='hit').length,1);
  now+=1;room.webSocketMessage(a,JSON.stringify({type:'frame',events:[{type:'hit'}]}));
  for(const s of sockets){const hits=s.messages.filter(m=>m.type==='hit');assert.equal(hits.length,2);assert.equal(hits[1].target,'b');}
  b.data.actor.state='Roll';now+=500;room.webSocketMessage(a,JSON.stringify({type:'frame',events:[{type:'hit'}]}));assert.equal(a.messages.filter(m=>m.type==='hit').at(-1).target,'npc:0');
  a.data.actor.s=7;b.data.actor.state='Idle';b.data.actor.p=[0,0,8];room.room.world.npcs[0].p=[0,0,9];room.room.world.npcs[0].s=.3;
  now+=500;room.webSocketMessage(a,JSON.stringify({type:'frame',events:[{type:'hit'}]}));
  for(const s of sockets)assert.equal(s.messages.filter(m=>m.type==='hit').at(-1).target,'b','a giant pushes the small human in front');
  b.data.actor.state='Roll';now+=500;room.webSocketMessage(a,JSON.stringify({type:'frame',events:[{type:'hit'}]}));
  for(const s of sockets)assert.equal(s.messages.filter(m=>m.type==='hit').at(-1).target,'npc:0','a giant also pushes a 30% NPC');
  assert(validActor({...actor(0),state:'Roll',roll:[1,0,.5,-5,0]}));assert(!validActor({...actor(0),roll:[NaN,0,.5,-5,0]}));
 }finally{Date.now=original;(globalThis as any).WebSocketRequestResponsePair=saved;}
});
