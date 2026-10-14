import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {BUILD,validWorld,type WorldState} from '../src/network-protocol';
import {PIDGIE_CLIPS,PIDGIE_PHASES,validPidgieState} from '../src/pidgie-state';
import {pidgieFixture} from './pidgie-fixture';

function worldFixture():WorldState {
 const actor={p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Кирби',variant:0,star:0};
 return {npcs:Array.from({length:14},()=>structuredClone(actor)),npcLife:Array.from({length:14},()=>Array(15).fill(0)),
  carts:Array.from({length:12},()=>Array(4).fill(0)),balloons:Array.from({length:3},()=>[0,'parked',...Array(14).fill(0)]),
  bugs:Array.from({length:40},()=>Array(10).fill(0))};
}

test('Pidgie optional checkpoint preserves the fourteen existing NPCs and legacy snapshots',()=>{
 const legacy=worldFixture();assert(validWorld(legacy));
 const next={...legacy,pidgie:pidgieFixture()};assert(validWorld(next));assert.equal(next.npcs.length,14);
 assert(!validWorld({...next,npcs:[...next.npcs,next.npcs[0]]}));
 assert(!validWorld({...next,pidgie:null}));assert(!validWorld({...next,pidgie:{}}));
 for(const phase of PIDGIE_PHASES)assert(validWorld({...next,pidgie:{...next.pidgie,phase,...(phase==='follow'?{followId:'guest',followSpeed:6.5}:{}),...(['joy','toBread','feast'].includes(phase)?{friend:{by:'guest',at:1,bird:[0,0,0],bread:[0,0,2]}}:{})}}),phase);
 for(const clip of PIDGIE_CLIPS)assert(validWorld({...next,pidgie:{...next.pidgie,clip}}),clip);
 assert(!validWorld({...next,pidgie:{...next.pidgie,extra:'x'.repeat(12500)}}),'NPC additions share the attachment size limit');
});

test('Pidgie rejects malformed tuples, non-finite values, unknown phases and out-of-range checkpoints',()=>{
 const good=pidgieFixture();assert(validPidgieState(good));
 for(const value of [null,undefined,{},[],true,'pigeon'])assert.equal(validPidgieState(value),false);
 for(const key of Object.keys(good)){
  const missing={...good} as Record<string,unknown>;delete missing[key];assert(!validPidgieState(missing),`missing ${key}`);
 }
 for(const key of ['p','refuge','target','origin','destination'] as const){
  for(const tuple of [null,[],[0],[0,0,0,0],['0',0],[NaN,0],[Infinity,0],[-Infinity,0]])
   assert(!validPidgieState({...good,[key]:tuple}),`${key}: ${String(tuple)}`);
  for(let i=0;i<good[key].length;i++)for(const value of [NaN,Infinity,-Infinity,513,-513]){
   const tuple=[...good[key]];tuple[i]=value;assert(!validPidgieState({...good,[key]:tuple}),`${key}[${i}]: ${value}`);
  }
 }
 for(const key of ['yaw','elapsed','walkTimer','pause','cooldown','height','flightDuration','turnStart','turnTarget','clipTime','seed','fearCount'] as const)
  for(const value of [NaN,Infinity,-Infinity,'1',null])assert(!validPidgieState({...good,[key]:value}),`${key}: ${String(value)}`);
 for(const key of ['elapsed','walkTimer','pause','cooldown','clipTime'] as const)
  for(const value of [-.001,3600.001])assert(!validPidgieState({...good,[key]:value}),`${key} bounds`);
 for(const key of ['seed','fearCount'] as const)
  for(const value of [-1,.5,0x100000000])assert(!validPidgieState({...good,[key]:value}),`${key} uint32`);
 assert(!validPidgieState({...good,phase:'Fly'}));assert(!validPidgieState({...good,clip:'Sleep'}));
 assert(!validPidgieState({...good,height:256.001}));assert(!validPidgieState({...good,height:-.001}));
 assert(!validPidgieState({...good,p:[0,256.001,0]}));assert(!validPidgieState({...good,p:[0,-20.001,0]}));
 assert(!validPidgieState({...good,flightDuration:120.001}));assert(!validPidgieState({...good,flightDuration:-.001}));
 for(const key of ['yaw','turnStart','turnTarget'] as const)assert(!validPidgieState({...good,[key]:10000.001}));
 for(const followId of ['',null,12,'x'.repeat(65),'guest\n'])assert(!validPidgieState({...good,phase:'follow',followId,followSpeed:1}));
 for(const followSpeed of [undefined,null,NaN,Infinity,-1,18.001,'1'])assert(!validPidgieState({...good,phase:'follow',followId:'guest',followSpeed}));
 assert(!validPidgieState({...good,phase:'follow'}));assert(validPidgieState({...good,phase:'follow',followId:'guest',followSpeed:18}));
 assert(validPidgieState({...good,p:[-512,256,512],height:256,seed:0xffffffff,fearCount:0xffffffff}),
  'an obstacle-clearing flight above the tall treehouse remains valid');
});

test('Worker keeps host-owned Pidgie pecking through late join, host transfer and hibernation',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }')
  .replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href)
  .replaceAll("from './", "from '"+new URL('../../game-server/src/',import.meta.url).href)
  .replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2')
  .replaceAll('new Response(null,{status:101,webSocket:client})','({status:101,webSocket:client})');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const globals=globalThis as any,oldPair=globals.WebSocketPair,oldResponse=globals.WebSocketRequestResponsePair;
 class Socket {
  readyState=1;data:any;messages:any[]=[];
  deserializeAttachment(){return structuredClone(this.data);}
  serializeAttachment(value:any){this.data=structuredClone(value);}
  send(value:string){this.messages.push(JSON.parse(value));}
  close(){this.readyState=3;}
  accept(){}
 }
 let lastServer:Socket;
 globals.WebSocketPair=class {0=new Socket();1=lastServer=new Socket();};globals.WebSocketRequestResponsePair=class {};
 const sockets:Socket[]=[],storage=new Map<string,unknown>();
 const ctx={waitUntil(){},blockConcurrencyWhile:(fn:()=>unknown)=>fn(),getWebSocketAutoResponseTimestamp:()=>new Date(),
  getWebSockets:()=>sockets,acceptWebSocket:(socket:Socket)=>sockets.push(socket),setWebSocketAutoResponse(){},
  storage:{async get(key:string){return structuredClone(storage.get(key));},async put(key:string,value:unknown){storage.set(key,structuredClone(value));},
   async delete(key:string){storage.delete(key);},async setAlarm(){},async deleteAlarm(){},async deleteAll(){storage.clear();}}};
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));let room=new GameRoom(ctx,{});
  const join=async(name:string,variant:number)=>{await room.fetch(new Request(`https://test/ws?build=${BUILD}&variant=${variant}&name=${name}`,{headers:{Upgrade:'websocket'}}));return lastServer!;};
  const send=(socket:Socket,world:unknown)=>room.webSocketMessage(socket,JSON.stringify({type:'frame',events:[],world}));
  const peck=pidgieFixture();peck.phase='wander';peck.clip='Peck';peck.p[1]=0;peck.pause=2.2;peck.walkTimer=0;peck.clipTime=1;
  const host=await join('Host',0),guest=await join('Guest',1),world={...worldFixture(),pidgie:peck};
  const frame=(socket:Socket,events:unknown[])=>room.webSocketMessage(socket,JSON.stringify({type:'frame',events}));
  for(const [socket,name,variant] of [[host,'Host',0],[guest,'Guest',1]] as const)room.webSocketMessage(socket,JSON.stringify({type:'frame',actor:{...world.npcs[0],name,variant},events:[]}));
  assert(validWorld(world));send(host,world);assert.deepEqual(room.room.world,world);
  assert.deepEqual(guest.messages.filter(m=>m.type==='frame').at(-1).world.pidgie,world.pidgie);
  assert.deepEqual(host.data.room.world.pidgie,world.pidgie);assert(!guest.data.room);
  assert(new TextEncoder().encode(JSON.stringify(host.data)).length<16*1024,'checkpoint fits the host WebSocket attachment');
  send(guest,{...world,pidgie:{...world.pidgie,seed:123}});assert.deepEqual(room.room.world,world,'guest cannot author NPC movement');
  send(host,{...world,pidgie:{...world.pidgie,p:[0,257,0]}});assert.deepEqual(room.room.world,world,'shared validator rejects the complete malformed snapshot');
  const hints=()=>room.room.log.filter((entry:any)=>entry.text.startsWith('Дикий Пиджи окинул '));
  frame(guest,[{type:'pidgie-scare',playerId:host.data.id}]);frame(host,[{type:'pidgie-scare',playerId:'missing'}]);
  assert.equal(hints().length,0,'guests and unknown players cannot author a pigeon announcement');
  frame(host,[{type:'pidgie-scare',playerId:guest.data.id}]);
  const hint=hints()[0];assert.equal(hints().length,1);
  assert.equal(hint.text,'Дикий Пиджи окинул Guest голодным взглядом. Хлебушка не заметил, испугался и улетел на другую полянку.');
  assert.equal(hint.name,'');assert.equal(hint.chat,false);
  for(const socket of [host,guest])assert.deepEqual(socket.messages.filter(m=>m.type==='log'&&m.entry.id===hint.id).map(m=>m.entry),[hint],'one shared system message reaches each player');
  send(host,world);assert.equal(hints().length,1,'ordinary world frames cannot repeat the scare hint');
  const interests=()=>room.room.log.filter((entry:any)=>entry.text.startsWith('Дикий Пиджи внимательно смотрит на '));
  frame(guest,[{type:'pidgie-interest',playerId:guest.data.id}]);frame(host,[{type:'pidgie-interest',playerId:guest.data.id}]);
  assert.equal(interests().length,0,'only the host can announce interest, and the server checks for carried bread');
  const achievements=['sleep','coaster','bench','balloon','treehouse','swing','leaves','star','firefly','skyStar'];
  room.room.fruits=Array(70).fill(guest.data.id);room.room.fruits[0]=null;
  room.webSocketMessage(guest,JSON.stringify({type:'frame',actor:{...world.npcs[0],name:'Guest',variant:1,fruits:69,achievements},events:[]}));
  frame(host,[{type:'pidgie-interest',playerId:guest.data.id}]);assert.equal(interests().length,0,'69 fruits plus 30 achievement points is still below the threshold');
  room.room.fruits[0]=guest.data.id;
  room.webSocketMessage(guest,JSON.stringify({type:'frame',actor:{...world.npcs[0],name:'Guest',variant:1,fruits:70,achievements},events:[]}));
  frame(host,[{type:'pidgie-interest',playerId:guest.data.id}]);assert.equal(interests().length,0,'even 100 points cannot replace bread in hand');
  room.webSocketMessage(guest,JSON.stringify({type:'frame',actor:{...world.npcs[0],p:room.room.bread.p,name:'Guest',variant:1,fruits:70,achievements},events:[{type:'bread',action:{kind:'pick'}}]}));
  assert.equal(room.room.bread.owner,guest.data.id);
  frame(host,[{type:'pidgie-interest',playerId:guest.data.id}]);assert.equal(interests().length,1);
  const interest=interests()[0];assert.equal(interest.text,'Дикий Пиджи внимательно смотрит на Guest. Что-то его очень заинтересовало.');
  for(const socket of [host,guest])assert.equal(socket.messages.filter(m=>m.type==='log'&&m.entry.id===interest.id).length,1);
  const late=await join('Late',2);assert.deepEqual(late.messages[0].room.world.pidgie,world.pidgie);
  assert(late.messages[0].room.log.some((entry:any)=>entry.id===hint.id),'a late join receives the existing chat history');
  assert(late.messages[0].room.log.some((entry:any)=>entry.id===interest.id));
  await room.webSocketClose(host);assert.equal(room.room.host,guest.data.id);
  assert.deepEqual(guest.data.room.world.pidgie,world.pidgie,'new host receives the phase clock, route and PRNG checkpoint');
  assert.deepEqual(late.messages.filter(m=>m.type==='room').at(-1).room.world.pidgie,world.pidgie);
  room=new GameRoom(ctx,{});assert.deepEqual(room.room.world.pidgie,world.pidgie,'Worker wakes from the new host attachment');
  assert.equal(hints().length,1,'host handoff and hibernation retain the message without replaying it');
  frame(guest,[{type:'pidgie-scare',playerId:guest.data.id}]);assert.equal(hints().length,2,'the new host can announce its own next scare');
  const afterWake=await join('Awake',3);assert.deepEqual(afterWake.messages[0].room.world.pidgie,world.pidgie);
  const continued={...world,pidgie:{...world.pidgie,elapsed:1.012,clipTime:.622,seed:0x627af94e}};
  send(guest,continued);assert.deepEqual(room.room.world.pidgie,continued.pidgie,'new host can continue the same route and animation clock');
  assert.deepEqual(afterWake.messages.filter(m=>m.type==='frame').at(-1).world.pidgie,continued.pidgie);
  const following={...continued,pidgie:{...continued.pidgie,phase:'follow',p:[67.375,0,-29.25],clip:'Run',followId:guest.data.id,followSpeed:6.5}};
  assert(validWorld(following));send(guest,following);
  assert.deepEqual(afterWake.messages.filter(m=>m.type==='frame').at(-1).world.pidgie,following.pidgie);
  room=new GameRoom(ctx,{});assert.deepEqual(room.room.world.pidgie,following.pidgie,'the followed player and ground speed survive Worker hibernation');
  assert.equal(interests().length,1,'state updates and waking the room never repeat the interest message');
 }finally{globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;}
});
