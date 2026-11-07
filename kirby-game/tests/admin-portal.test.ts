import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {roomSql} from './room-sql';
import {META_KNIGHT_ARENA} from '../src/meta-knight-arena-site';
import {BUILD} from '../src/network-protocol';
import {newSealProgress,SEAL_IDS} from '../src/meta-knight-seal-state';
import {adminToken} from '../../game-server/src/admin-auth';
const {historyRoutes}=await import(new URL('../../game-server/src/admin.ts',import.meta.url).href);

test('admin opens the shared portal without awarding badges; opening is idempotent, survives wakeup, and resets with the room',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }')
  .replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href)
  .replaceAll("from './","from '"+new URL('../../game-server/src/',import.meta.url).href)
  .replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2')
  .replaceAll('new Response(null,{status:101,webSocket:client})','({status:101,webSocket:client})');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const globals=globalThis as any,oldPair=globals.WebSocketPair,oldResponse=globals.WebSocketRequestResponsePair;
 class Socket{
  readyState=1;data:any;messages:any[]=[];
  deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(data:any){this.data=structuredClone(data);}
  send(value:string){this.messages.push(JSON.parse(value));}close(){this.readyState=3;}accept(){}
 }
 let lastServer:Socket;globals.WebSocketPair=class{0=new Socket();1=lastServer=new Socket();};globals.WebSocketRequestResponsePair=class{};
 const sockets:Socket[]=[],store=new Map<string,any>(),sql=roomSql();let ready=Promise.resolve();
 const ctx={waitUntil(){},blockConcurrencyWhile(fn:()=>Promise<any>){return ready=fn();},getWebSockets:()=>sockets,getWebSocketAutoResponseTimestamp:()=>new Date(),acceptWebSocket:(s:Socket)=>sockets.push(s),setWebSocketAutoResponse(){},
  storage:{sql,async get(key:string){return structuredClone(store.get(key));},async put(key:string,value:unknown){store.set(key,structuredClone(value));},async delete(key:string){store.delete(key);},async setAlarm(){},async deleteAlarm(){},async deleteAll(){store.clear();sql.clear();}}};
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));let room=new GameRoom(ctx,{});await ready;
  assert.equal((await room.adminOpenPortal('missing')).ok,false);
  const join=async(name:string,variant:number)=>{await room.fetch(new Request(`https://test/ws?build=${BUILD}&variant=${variant}&name=${name}`,{headers:{Upgrade:'websocket'}}));return lastServer!;};
  const a=await join('Host',0),b=await join('Guest',1),id=room.room.id;
  assert.equal((await room.adminOnline()).room.portalOpen,false);
  assert.equal((await room.adminOpenPortal('stale')).ok,false);
  room.webSocketMessage(a,JSON.stringify({type:'frame',room:{metaKnightPortalOpen:true},metaKnightPortalOpen:true}));
  assert.equal(room.room.metaKnightPortalOpen,undefined,'players cannot forge the admin override');
  room.room.sealProgress={collected:{maze:{by:a.data.id,at:1}}};
  const seals=structuredClone(room.room.sealProgress);
  for(const result of await Promise.all([room.adminOpenPortal(id),room.adminOpenPortal(id)]))assert.equal(result.ok,true);
  assert.deepEqual(room.room.sealProgress,seals);
  for(const socket of [a,b]){
   assert(socket.messages.some(m=>m.type==='room'&&m.room.metaKnightPortalOpen===true));
   assert.equal(socket.messages.filter(m=>m.type==='log'&&m.entry.text==='Портал на космическую арену открыт!').length,1);
  }
  assert.equal((await room.adminOnline()).room.portalOpen,true);
  assert.equal(store.get('room-state').metaKnightPortalOpen,true);
  room=new GameRoom(ctx,{});await ready;
  assert.equal(room.room.metaKnightPortalOpen,true);
  const late=await join('Late',2);assert.equal(late.messages.find(m=>m.type==='welcome').room.metaKnightPortalOpen,true);
  assert.equal((await room.adminOpenPortal(id,'metapidgie')).ok,true);
  assert.equal(room.room.portalBoss,'metapidgie');assert.deepEqual(room.room.sealProgress,seals);
  assert.equal((await room.adminOnline()).room.portalBoss,'metapidgie');
  const logs=a.messages.filter(m=>m.type==='log'&&m.entry.text==='Портал Мета Пиджи открыт!').length;
  assert.equal((await room.adminOpenPortal(id,'metapidgie')).ok,true);
  assert.equal(a.messages.filter(m=>m.type==='log'&&m.entry.text==='Портал Мета Пиджи открыт!').length,logs);
  room=new GameRoom(ctx,{});await ready;assert.equal(room.room.portalBoss,'metapidgie');
  const pgLate=await join('Pidgie guest',3);assert.equal(pgLate.messages.find(m=>m.type==='welcome').room.portalBoss,'metapidgie');
  a.data.actor={location:'meta-knight-arena',p:[META_KNIGHT_ARENA.x,0,-2],q:[0,1,0,0],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Host',variant:0,star:0};
  room.webSocketMessage(a,JSON.stringify({type:'frame',events:[{type:'knight',action:'start'}]}));
  assert.equal(room.room.knightBattle?.boss,'metapidgie');assert.equal(room.room.knightBattle?.phase,1);
  const battle=room.room.knightBattle,clock=Date.now();Object.assign(battle,{hp:4,phase:2,stage:'get-up',since:clock-300,until:clock,checked:clock-300});battle.players[a.data.id].hits=8;
  room.advanceKnight(clock);assert.equal(battle.stage,'transition');assert.equal(battle.phase,3);assert(!battle.rewarded);
  Object.assign(battle,{hp:0,phase:4,stage:'cosmic-descent',since:clock-3000,until:clock,checked:clock-3000,from:[0,0,0],to:[0,0,0],cosmicFall:{at:clock-3000,yaw:0}});room.advanceKnight(clock);assert.equal(battle.stage,'won');assert.equal(battle.phase,4);assert.equal(battle.rewarded,true);
  assert(a.messages.some(m=>m.type==='knight-victory'));assert(a.messages.some(m=>m.type==='log'&&m.entry.text==='Host победил Мета Пиджи!'));
  room.room.knightBattle={stage:'intro'};assert.equal((await room.adminOpenPortal(id,'meta-knight')).ok,false);assert.equal(room.room.portalBoss,'metapidgie');delete room.room.knightBattle;
  const reset=await room.adminRecreate(id);assert.equal(reset.ok,true);
  assert.equal((await room.adminOnline()).room.portalOpen,false);
  assert.equal((await room.adminOpenPortal(reset.roomId)).ok,false,'empty prepared rooms cannot be opened');
  await join('Fresh',0);assert.deepEqual(room.room.sealProgress,newSealProgress());assert.equal(room.room.metaKnightPortalOpen,undefined);
  room.room.sealProgress={collected:Object.fromEntries(SEAL_IDS.map(key=>[key,{by:'finder',at:1}]))};
  assert.equal((await room.adminOnline()).room.portalOpen,true,'collected badges still open the portal normally');
  assert.equal((await room.adminOpenPortal(reset.roomId)).ok,true);assert.equal(room.room.metaKnightPortalOpen,undefined);
  room.room.festival={results:[]};assert.equal((await room.adminOpenPortal(reset.roomId)).ok,false);
 }finally{globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;}
});

test('opening the portal requires admin authentication, same origin, and a current valid room',async()=>{
 let calls=0;const env:any={ADMIN_PASSWORD:'test-only',ROOMS:{getByName:()=>({adminOpenPortal:async(roomId:string)=>{calls++;return {ok:roomId==='room'};}})}};
 const request=(body:unknown,cookie='',origin='https://game.test')=>new Request('https://game.test/admin/api/online/open-portal',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await historyRoutes(request({roomId:'room'}),env))!.status,401);
 const cookie='kirby_admin='+await adminToken(env.ADMIN_PASSWORD);
 assert.equal((await historyRoutes(request({roomId:'room'},cookie,'https://else.test'),env))!.status,403);
 for(const body of [null,{}, {roomId:''},{roomId:1},{roomId:'x'.repeat(81)},{roomId:'room',boss:'unknown'},{roomId:'room',boss:2}])assert.equal((await historyRoutes(request(body,cookie),env))!.status,400);
 assert.equal(calls,0);
 assert.equal((await historyRoutes(request({roomId:'stale'},cookie),env))!.status,409);
 assert.equal((await historyRoutes(request({roomId:'room'},cookie),env))!.status,200);assert.equal(calls,2);
});
