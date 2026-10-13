import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {BUILD,validWorld,type WorldState} from '../src/network-protocol';
import {PIDGIE_PHASES,validPidgieState} from '../src/pidgie-state';
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
 for(const phase of PIDGIE_PHASES)assert(validWorld({...next,pidgie:{...next.pidgie,phase}}),phase);
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
 assert(validPidgieState({...good,p:[-512,256,512],height:256,seed:0xffffffff,fearCount:0xffffffff}),
  'an obstacle-clearing flight above the tall treehouse remains valid');
});

test('Worker keeps host-owned Pidgie state through late join, host transfer and hibernation',async()=>{
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
  const host=await join('Host',0),guest=await join('Guest',1),world={...worldFixture(),pidgie:pidgieFixture()};
  assert(validWorld(world));send(host,world);assert.deepEqual(room.room.world,world);
  assert.deepEqual(guest.messages.filter(m=>m.type==='frame').at(-1).world.pidgie,world.pidgie);
  assert.deepEqual(host.data.room.world.pidgie,world.pidgie);assert(!guest.data.room);
  assert(new TextEncoder().encode(JSON.stringify(host.data)).length<16*1024,'checkpoint fits the host WebSocket attachment');
  send(guest,{...world,pidgie:{...world.pidgie,seed:123}});assert.deepEqual(room.room.world,world,'guest cannot author NPC movement');
  send(host,{...world,pidgie:{...world.pidgie,p:[0,257,0]}});assert.deepEqual(room.room.world,world,'shared validator rejects the complete malformed snapshot');
  const late=await join('Late',2);assert.deepEqual(late.messages[0].room.world.pidgie,world.pidgie);
  await room.webSocketClose(host);assert.equal(room.room.host,guest.data.id);
  assert.deepEqual(guest.data.room.world.pidgie,world.pidgie,'new host receives the phase clock, route and PRNG checkpoint');
  assert.deepEqual(late.messages.filter(m=>m.type==='room').at(-1).room.world.pidgie,world.pidgie);
  room=new GameRoom(ctx,{});assert.deepEqual(room.room.world.pidgie,world.pidgie,'Worker wakes from the new host attachment');
  const afterWake=await join('Awake',3);assert.deepEqual(afterWake.messages[0].room.world.pidgie,world.pidgie);
  const continued={...world,pidgie:{...world.pidgie,elapsed:1.012,clipTime:.622,seed:0x627af94e}};
  send(guest,continued);assert.deepEqual(room.room.world.pidgie,continued.pidgie,'new host can continue the same route and animation clock');
  assert.deepEqual(afterWake.messages.filter(m=>m.type==='frame').at(-1).world.pidgie,continued.pidgie);
 }finally{globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;}
});
