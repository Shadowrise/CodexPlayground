import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {NetworkSession} from '../src/network';
import {PROTOCOL} from '../src/network-protocol';
import {MUSICAL_FLOWERS} from '../src/musical-flower-site';

test('flower notes share the existing frame and remote notes are validated without replaying the sender',async()=>{
 const original=globalThis.WebSocket;let socket:any;
 class FakeSocket {static OPEN=1;readyState=1;sent:string[]=[];constructor(){socket=this;}close(){}send(text:string){this.sent.push(text);}}
 globalThis.WebSocket=FakeSocket as any;
 const session=new NetworkSession(),heard:number[]=[];session.onFlowerNote=index=>heard.push(index);
 try{
  const connected=session.connect('https://example.test',0,'Test');
  socket.onmessage({data:JSON.stringify({type:'welcome',protocolVersion:PROTOCOL,playerId:'self',players:[{},{}],room:{id:'room',host:'other',epoch:0,fruits:[],starAt:0,mill:false,locks:{}}})});await connected;
  for(const [id,index] of [['other',3],['self',3],['other',7],['other','1']] as const)socket.onmessage({data:JSON.stringify({type:'flower-note',id,index})});
  assert.deepEqual(heard,[3]);session.event({type:'flower-note',index:2});assert.equal(socket.sent.length,0);
  session.tick(.1,{p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Test',variant:0,star:0},()=>({} as any));
  const frame=JSON.parse(socket.sent[0]);assert.equal(frame.type,'frame');assert.deepEqual(frame.events,[{type:'flower-note',index:2}]);assert.equal(socket.sent.length,1);
 }finally{session.close();globalThis.WebSocket=original;}
});

test('Worker relays only nearby, available players and rejects malformed or rapid notes',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }').replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './", "from '"+new URL('../../game-server/src/',import.meta.url).href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const saved=(globalThis as any).WebSocketRequestResponsePair;(globalThis as any).WebSocketRequestResponsePair=class{};
 const original=Date.now;let now=100000;Date.now=()=>now;
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  class Socket {readyState=1;messages:any[]=[];data:any;constructor(id:string){const f=MUSICAL_FLOWERS[2];this.data={id,variant:0,announced:true,seen:now,visible:true,actor:{p:[f.x,0,f.z+1],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:id,variant:0,star:0}};}deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(a:any){this.data=structuredClone(a);}send(text:string){this.messages.push(JSON.parse(text));}}
  const a=new Socket('a'),b=new Socket('b');
  const ctx={blockConcurrencyWhile:(f:()=>unknown)=>f(),getWebSockets:()=>[a,b],setWebSocketAutoResponse(){},storage:{async get(){},async put(){},async setAlarm(){}}};
  const room=new GameRoom(ctx,{});room.room={id:'room',host:'a',epoch:now,fruits:Array(70).fill(null),starAt:0,mill:false,locks:{}};
  const play=(index:any)=>room.webSocketMessage(a,JSON.stringify({type:'frame',events:[{type:'flower-note',index}]}));
  play(2);assert.equal(b.messages.filter(m=>m.type==='flower-note').length,1);assert(!a.messages.some(m=>m.type==='flower-note'));
  play(2);now+=200;play(7);play('2');play(-1);assert.equal(b.messages.filter(m=>m.type==='flower-note').length,1);
  a.data.actor.p[0]=100;play(2);a.data.actor.p[0]=MUSICAL_FLOWERS[2].x;a.data.actor.p[1]=10;play(2);a.data.actor.p[1]=0;
  a.data.visible=false;play(2);a.data.visible=true;a.data.actor.ride={key:'boat:0',data:[0]};play(2);delete a.data.actor.ride;
  assert.equal(b.messages.filter(m=>m.type==='flower-note').length,1);play(2);assert.equal(b.messages.filter(m=>m.type==='flower-note').length,2);
  assert(!room.room.festival);assert.deepEqual(a.data.actor.achievements,[]);
 }finally{Date.now=original;(globalThis as any).WebSocketRequestResponsePair=saved;}
});
