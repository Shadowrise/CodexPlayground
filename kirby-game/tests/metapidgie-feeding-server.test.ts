import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {roomSql} from './room-sql';
import {pidgieFixture} from './pidgie-fixture';
import {BUILD,type ActorState} from '../src/network-protocol';
import {newBread,grantBread} from '../src/bread-state';
import {newPigeonFeeding,allPigeonsFed} from '../src/metapidgie-feeding';
import {WILD_PIGEONS} from '../src/wild-pigeons';
import {METAPIDGIE_FEEDING_PORTAL_MESSAGE} from '../src/world-log';
import {META_KNIGHT_ARENA} from '../src/meta-knight-arena-site';

test('actual room accepts five shared bread offerings, replaces the Knight, announces once and restores for late guests',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }')
  .replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href)
  .replaceAll("from './","from '"+new URL('../../game-server/src/',import.meta.url).href)
  .replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2')
  .replaceAll('new Response(null,{status:101,webSocket:client})','({status:101,webSocket:client})');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const globals=globalThis as any,oldPair=globals.WebSocketPair,oldResponse=globals.WebSocketRequestResponsePair;
 class Socket{readyState=1;data:any;messages:any[]=[];deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(data:any){this.data=structuredClone(data);}send(value:string){this.messages.push(JSON.parse(value));}close(){this.readyState=3;}accept(){}}
 let lastServer:Socket,ready:Promise<unknown>=Promise.resolve();globals.WebSocketPair=class{0=new Socket();1=lastServer=new Socket();};globals.WebSocketRequestResponsePair=class{};
 const sockets:Socket[]=[],store=new Map<string,any>(),sql=roomSql(),visits:any[]=[];
 const env={HISTORY:{getByName:()=>({async write(rows:any[]){visits.push(...structuredClone(rows));}})}};
 const ctx={waitUntil(){},blockConcurrencyWhile:(fn:()=>Promise<unknown>)=>(ready=fn()),getWebSockets:()=>sockets,getWebSocketAutoResponseTimestamp:()=>new Date(),acceptWebSocket:(s:Socket)=>sockets.push(s),setWebSocketAutoResponse(){},storage:{sql,async get(key:string){return structuredClone(store.get(key));},async put(key:string,value:unknown){store.set(key,structuredClone(value));},async delete(key:string){store.delete(key);},async setAlarm(){},async deleteAlarm(){},async deleteAll(){store.clear();sql.clear();}}};
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));let room=new GameRoom(ctx,env);await ready;
  const join=async(name:string,variant:number)=>{await room.fetch(new Request(`https://test/ws?build=${BUILD}&variant=${variant}&name=${name}`,{headers:{Upgrade:'websocket'}}));return lastServer!;};
  const a=await join('Host',0),b=await join('Guest',1);
  const actor=(name:string,variant:number):ActorState=>({p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name,variant,star:0});
  const send=(s:Socket,events:any[]=[],extra={})=>room.webSocketMessage(s,JSON.stringify({type:'frame',actor:actor(s===a?'Host':'Guest',s===a?0:1),events,...extra}));
  send(a);send(b);assert.deepEqual(room.room.pigeonFeeding,newPigeonFeeding());
  const forged={fed:Object.fromEntries(WILD_PIGEONS.map(id=>[id,{by:'cheat',at:1}]))};
  send(b,[{type:'bread',action:{kind:'feed',bird:'pidgie'}}],{pigeonFeeding:forged,room:{pigeonFeeding:forged,portalBoss:'metapidgie'}});
  assert.deepEqual(room.room.pigeonFeeding,newPigeonFeeding(),'neither forged progress nor feeding without bread counts');
  await room.adminOpenPortal(room.room.id);assert.equal(room.room.portalBoss,'meta-knight');
  room.room.world=Object.fromEntries(WILD_PIGEONS.map(id=>[id,{...pidgieFixture(),phase:'follow',p:[0,0,4]}]));
  const seals=structuredClone(room.room.sealProgress);
  for(const [i,id] of WILD_PIGEONS.entries()){
   if(i===4)store.set('knight-battle',{boss:'meta-knight',stage:'cancelled',revision:9});
   const s=i%2?b:a,by=s.data.id;
   room.room.bread=grantBread(room.room.bread??newBread(),{id:by,p:[0,0,0],yaw:0,size:1,available:true},Date.now());
   if(i===0){send(s,[{type:'bread',action:{kind:'feed',bird:'unknown'}}]);assert.deepEqual(room.room.pigeonFeeding,newPigeonFeeding());}
   send(s,[{type:'bread',action:{kind:'feed',bird:id}}]);
   assert.equal(Object.keys(room.room.pigeonFeeding.fed).length,i+1);assert.equal(room.room.pigeonFeeding.fed[id].by,by);
   assert.equal(room.room.portalBoss,i===4?'metapidgie':'meta-knight');
   if(i===0){room.room.world[id]={...pidgieFixture(),phase:'follow',p:[0,0,4]};room.room.bread=grantBread(room.room.bread,{id:by,p:[0,0,0],yaw:0,size:1,available:true},Date.now());send(s,[{type:'bread',action:{kind:'feed',bird:id}}]);assert.equal(Object.keys(room.room.pigeonFeeding.fed).length,1);}
  }
  assert(allPigeonsFed(room.room.pigeonFeeding));assert.deepEqual(room.room.sealProgress,seals);assert.equal(room.room.metaKnightPortalOpen,true);
  assert.equal(a.data.history.progress.stats.feathers,3);assert.equal(b.data.history.progress.stats.feathers,2,'repeated feeding never awards a second personal feather');
  for(const s of [a,b])assert.equal(s.messages.filter(m=>m.type==='log'&&m.entry.text===METAPIDGIE_FEEDING_PORTAL_MESSAGE).length,1);
  const progress=structuredClone(room.room.pigeonFeeding);assert.deepEqual(store.get('room-state').pigeonFeeding,progress);assert(!store.has('knight-battle'),'the old persisted Knight battle cannot return on wakeup');
  room=new GameRoom(ctx,env);await ready;assert.deepEqual(room.room.pigeonFeeding,progress);assert.equal(room.room.portalBoss,'metapidgie');
  const late=await join('Late',2);assert.deepEqual(late.messages.find(m=>m.type==='welcome').room.pigeonFeeding,progress);
  assert.equal(late.data.history.progress.stats.feathers,0);
  const fighter={...actor('Host',0),location:'meta-knight-arena',p:[META_KNIGHT_ARENA.x,0,-2]};room.webSocketMessage(a,JSON.stringify({type:'frame',actor:fighter,events:[{type:'knight',action:'start'}]}));
  assert.equal(room.room.knightBattle?.boss,'metapidgie');
  assert.equal(a.data.history.progress.stats.pidgeyStarted,1);assert.equal(b.data.history.progress.stats.pidgeyStarted,0,'players outside the arena are spectators');
  room.room.knightBattle.stage='won';room.room.knightBattle.revision++;
  for(let i=0;i<3;i++)room.webSocketMessage(a,JSON.stringify({type:'frame',actor:fighter}));
  assert.equal(a.data.history.progress.stats.pidgeyWon,1,'repeated terminal frames count the victory once');
  room=new GameRoom(ctx,env);await ready;
  room.webSocketMessage(a,JSON.stringify({type:'frame',actor:fighter}));
  assert.equal(a.data.history.progress.stats.pidgeyWon,1,'hibernated attachments preserve the encounter deduplication');
  await room.adminOpenPortal(room.room.id,'meta-knight');
  room.webSocketMessage(a,JSON.stringify({type:'frame',actor:fighter,events:[{type:'knight',action:'start'}]}));
  assert.equal(a.data.history.progress.stats.knightStarted,1);assert.equal(a.data.history.progress.stats.pidgeyStarted,1);
  room.room.knightBattle.stage='lost';room.room.knightBattle.revision++;
  room.webSocketMessage(a,JSON.stringify({type:'frame',actor:fighter}));
  assert.equal(a.data.history.progress.stats.knightWon,0,'losing against the Knight does not count as winning');
  room.webSocketMessage(a,JSON.stringify({type:'frame',actor:fighter,events:[{type:'knight',action:'start'},{type:'knight',action:'cancel'}]}));
  assert.equal(a.data.history.progress.stats.knightStarted,2,'starting then immediately cancelling still counts as an attempt');
  const legacy=store.get('room-state');delete legacy.pigeonFeeding;legacy.portalBoss='meta-knight';store.set('room-state',legacy);store.set('knight-battle',{boss:'meta-knight',stage:'cancelled',revision:9});
  room=new GameRoom(ctx,env);await ready;assert(allPigeonsFed(room.room.pigeonFeeding));assert.equal(room.room.portalBoss,'metapidgie');assert.equal(room.room.knightBattle,undefined);assert(!store.has('knight-battle'));
  await room.webSocketClose(a);
  assert.deepEqual(visits.at(-1).stats,{seals:0,feathers:3,knightStarted:2,knightWon:0,pidgeyStarted:1,pidgeyWon:1},'departure archives every personal counter');
 }finally{globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;}
});
