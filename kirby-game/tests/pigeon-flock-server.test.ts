import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {roomSql} from './room-sql';
import {pidgieFixture} from './pidgie-fixture';
import {adminToken} from '../../game-server/src/admin-auth';
import {ADMIN_HTML} from '../../game-server/src/admin-page';
const {historyRoutes}=await import(new URL('../../game-server/src/admin.ts',import.meta.url).href);

test('admin pigeons accumulate independently of pranks, validate host checkpoints, survive storage and disappear with their target',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }').replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './", "from '"+new URL('../../game-server/src/',import.meta.url).href).replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const saved=(globalThis as any).WebSocketRequestResponsePair;(globalThis as any).WebSocketRequestResponsePair=class {};
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  class Socket{
   readyState=1;messages:any[]=[];
   data:any;constructor(id:string){this.data={id,variant:0,seen:Date.now(),visible:true,actor:{p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:id,variant:0,star:0}};}
   deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(a:any){this.data=structuredClone(a);}send(v:string){this.messages.push(JSON.parse(v));}close(){this.readyState=3;}
  }
  const host=new Socket('host'),guest=new Socket('target'),sockets=[host,guest],store=new Map<string,any>(),pending:Promise<unknown>[]=[];
  let ready=Promise.resolve();
  const ctx={waitUntil(p:Promise<unknown>){pending.push(p);},blockConcurrencyWhile(fn:()=>Promise<any>){const p=fn();ready=p;return p;},getWebSockets:()=>sockets,setWebSocketAutoResponse(){},getWebSocketAutoResponseTimestamp(){return null;},storage:{sql:roomSql(),async get(key:string){return structuredClone(store.get(key));},async put(key:string,v:any){store.set(key,structuredClone(v));},async delete(key:string){store.delete(key);},async list({prefix}:{prefix:string}){return new Map(Array.from(store).filter(([key])=>key.startsWith(prefix)));},async deleteAll(){store.clear();},async deleteAlarm(){}}};
  let room=new GameRoom(ctx,{});await ready;
  room.room={id:'room',host:'host',epoch:Date.now(),fruits:Array(70).fill(null),starAt:0,mill:false,locks:{}};
  assert.equal((await room.adminPigeon('stale','target')).ok,false);assert.equal((await room.adminPigeon('room','missing')).ok,false);
  assert.equal((await room.adminPrank('room','target','gift')).ok,true);
  for(let i=0;i<300;i++)assert.equal((await room.adminPigeon('room','target')).ok,true);
  assert.equal(room.room.pigeonFlock.length,300);assert.equal(new Set(room.room.pigeonFlock.map((b:any)=>b.id)).size,300);
  assert.deepEqual(new Set(room.room.pigeonFlock.map((b:any)=>b.skin)),new Set(['pidgie','snowball']));
  const bird=room.room.pigeonFlock[0],checkpoint={id:bird.id,bird:{...pidgieFixture(),seed:bird.seed},helloIn:4,helloRemaining:0,helloCount:1};
  room.webSocketMessage(guest,JSON.stringify({type:'frame',pigeons:[checkpoint]}));assert.equal(bird.checkpoint,undefined);
  room.webSocketMessage(host,JSON.stringify({type:'frame',pigeons:[{...checkpoint,bird:{...checkpoint.bird,seed:1}}]}));assert.equal(bird.checkpoint,undefined);
  room.webSocketMessage(host,JSON.stringify({type:'frame',pigeons:[checkpoint]}));assert.deepEqual(bird.checkpoint,checkpoint);assert(guest.messages.some(m=>m.type==='frame'&&m.pigeons?.[0]?.id===bird.id));
  await Promise.all(pending);assert.equal(store.get('room-state').pigeonFlock,undefined,'the flock cannot overflow the room storage value');
  room=new GameRoom(ctx,{});await ready;assert.equal(room.room.pigeonFlock.length,300);assert.deepEqual(room.room.pigeonFlock[0].checkpoint,checkpoint);
  assert.equal((await room.adminClearPigeons('stale')).ok,false);assert.equal(room.room.pigeonFlock.length,300);
  assert.equal((await room.adminClearPigeons('room')).ok,true);assert.equal(room.room.pigeonFlock.length,300);assert(room.room.pigeonFlock.every((b:any)=>Number.isFinite(b.dismissedAt)));
  assert(guest.messages.some(m=>m.type==='room'&&m.room.pigeonFlock?.[0]?.dismissedAt));
  room.webSocketMessage(host,JSON.stringify({type:'frame',pigeons:[{...checkpoint,departed:true,departureY:0}]}));assert.equal(room.room.pigeonFlock.length,299);
  room.webSocketMessage(host,JSON.stringify({type:'frame',pigeons:[checkpoint]}));assert.equal(room.room.pigeonFlock.length,299,'an in-flight checkpoint cannot recreate a departed bird');
  assert.equal((await room.adminPigeon('room','target')).ok,true);
  await room.webSocketClose(guest);await Promise.all(pending);assert.equal(room.room.pigeonFlock.length,0);assert(!Array.from(store.keys()).some(k=>k.startsWith('pigeon:')));
  room.room.festival={results:[]};assert.equal((await room.adminPigeon('room','host')).ok,false);
 }finally{(globalThis as any).WebSocketRequestResponsePair=saved;}
});

test('pigeon endpoint requires admin authentication, same origin, valid target and room; the UI has a repeatable per-player button',async()=>{
 let calls=0;const env:any={ADMIN_PASSWORD:'test-only',ROOMS:{getByName:()=>({adminClearPigeons:async(roomId:string)=>({ok:roomId==='room'}),adminPigeon:async(roomId:string,playerId:string)=>{calls++;return {ok:roomId==='room'&&playerId==='target'};}})}};
 const request=(body:any,cookie='',origin='https://game.test')=>new Request('https://game.test/admin/api/online/pigeon',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await historyRoutes(request({roomId:'room',playerId:'target'}),env))!.status,401);
 const cookie='kirby_admin='+await adminToken(env.ADMIN_PASSWORD);
 assert.equal((await historyRoutes(request({roomId:'room',playerId:'target'},cookie,'https://else.test'),env))!.status,403);
 assert.equal((await historyRoutes(request({roomId:'room',playerId:''},cookie),env))!.status,400);
 assert.equal((await historyRoutes(request({roomId:'stale',playerId:'target'},cookie),env))!.status,409);
 assert.equal((await historyRoutes(request({roomId:'room',playerId:'target'},cookie),env))!.status,200);assert.equal(calls,2);
 assert(ADMIN_HTML.includes('pigeonButton(p,data.room)'));assert(ADMIN_HTML.includes('Прислать голубя'));
 const clear=(body:any,cookieValue='')=>new Request('https://game.test/admin/api/online/clear-pigeons',{method:'POST',headers:{Origin:'https://game.test',Cookie:cookieValue,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await historyRoutes(clear({roomId:'room'}),env))!.status,401);assert.equal((await historyRoutes(clear({roomId:''},cookie),env))!.status,400);
 assert.equal((await historyRoutes(clear({roomId:'stale'},cookie),env))!.status,409);assert.equal((await historyRoutes(clear({roomId:'room'},cookie),env))!.status,200);
 assert(ADMIN_HTML.includes('Разогнать всех голубей'));
});
