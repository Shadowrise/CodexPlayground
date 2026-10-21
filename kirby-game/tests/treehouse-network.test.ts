import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {roomSql} from './room-sql';
import {validActor,validResourceKey,type ActorState} from '../src/network-protocol';

test('treehouse and swing ride payloads validate independently and reject invalid seats or angles',()=>{
 const actor:ActorState={p:[124,2,48],q:[0,0,0,1],s:1,state:'Swing',pose:[],fruits:0,achievements:[],name:'Test',variant:0,star:0};
 for(const key of ['tree:0','swing:0']){
  assert(validResourceKey(key));assert(validActor({...actor,ride:{key,data:[.4]}}));
  for(const data of [[],[0,1],[NaN],[Infinity],['angle']])assert(!validActor({...actor,ride:{key,data}}));
 }
 for(const key of ['tree:1','swing:1','swing:-1','swing:','swing:100'])assert(!validResourceKey(key));
});

test('actual room permits climbing and swinging together, excludes a second passenger, and releases only the departing activity',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }')
  .replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href)
  .replaceAll("from './","from '"+new URL('../../game-server/src/',import.meta.url).href)
  .replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const globals=globalThis as any,saved=globals.WebSocketRequestResponsePair;globals.WebSocketRequestResponsePair=class{};
 const actor=(state='Idle',ride?:ActorState['ride']):ActorState=>({p:[131,state==='Lookout'?18:0,52],q:[0,0,0,1],s:1,state,pose:[],fruits:0,achievements:[],name:'Test',variant:0,star:0,...(ride?{ride}:{})});
 class Socket{
  readyState=1;messages:any[]=[];data:any;
  constructor(id:string,variant:number){this.data={id,variant,seen:Date.now(),visible:true,actor:actor()};}
  deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(data:any){this.data=structuredClone(data);}
  send(value:string){this.messages.push(JSON.parse(value));}close(){this.readyState=3;}
 }
 const climber=new Socket('climber',0),swinger=new Socket('swinger',1),waiting=new Socket('waiting',2),sockets=[climber,swinger,waiting];
 const ctx={getWebSockets:()=>sockets,getWebSocketAutoResponseTimestamp:()=>new Date(),setWebSocketAutoResponse(){},blockConcurrencyWhile:(fn:()=>unknown)=>fn(),waitUntil(){},storage:{sql:roomSql(),get:async()=>undefined,put:async()=>{},delete:async()=>{},setAlarm:async()=>{}}};
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')),room=new GameRoom(ctx,{});
  await Promise.resolve();await Promise.resolve();
  room.room={id:'room',host:'climber',epoch:Date.now(),fruits:Array(70).fill(null),starAt:0,mill:false,locks:{}};
  const send=(socket:Socket,events:any[]=[],actor?:ActorState)=>room.webSocketMessage(socket,JSON.stringify({type:'frame',events,actor}));
  const lock=(socket:Socket,key:string)=>{send(socket,[{type:'lock',key}]);return socket.messages.filter(m=>m.type==='lock'&&m.key===key).at(-1)?.ok;};
  assert.equal(lock(climber,'tree:0'),true);assert.equal(lock(swinger,'swing:0'),true);
  assert.deepEqual(room.room.locks,{'tree:0':'climber','swing:0':'swinger'});
  for(const state of ['Climb','Lookout','LeafDive']){
   send(climber,[],actor(state,{key:'tree:0',data:[0]}));send(swinger,[],actor('Swing',{key:'swing:0',data:[.42]}));
   assert.equal(climber.data.actor.ride.key,'tree:0');assert.equal(swinger.data.actor.ride.key,'swing:0');
   assert.equal(lock(waiting,'tree:0'),false);assert.equal(lock(waiting,'swing:0'),false);
  }
  assert(waiting.messages.some(m=>m.type==='frame'&&m.id==='swinger'&&m.actor?.ride?.key==='swing:0'&&m.actor.ride.data[0]===.42));
  send(waiting,[{type:'release',key:'swing:0'}]);assert.equal(room.room.locks['swing:0'],'swinger');
  send(climber,[{type:'release',key:'tree:0'}],actor());
  assert.deepEqual(room.room.locks,{'swing:0':'swinger'});
  assert.equal(lock(waiting,'tree:0'),true,'ladder remains available while the swing is occupied');
  await room.webSocketClose(swinger);assert.deepEqual(room.room.locks,{'tree:0':'waiting'});
  assert.equal(lock(climber,'swing:0'),true,'the departed passenger frees the swing independently');
  await room.webSocketClose(waiting);assert.deepEqual(room.room.locks,{'swing:0':'climber'});
 }finally{globals.WebSocketRequestResponsePair=saved;}
});
