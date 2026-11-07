import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {roomSql} from './room-sql';
import {BUILD,type ActorState} from '../src/network-protocol';
import {KIRBY_VARIANTS} from '../src/variant-palette';

test('actual Worker authorizes bird helpers, persists their side and spawns NPC opposition',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject {constructor(public ctx:any,public env:any){}}')
  .replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './","from '"+new URL('../../game-server/src/',import.meta.url).href)
  .replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2').replaceAll('new Response(null,{status:101,webSocket:client})','({status:101,webSocket:client})');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const globals=globalThis as any,oldPair=globals.WebSocketPair,oldResponse=globals.WebSocketRequestResponsePair,oldNow=Date.now;let now=100000;Date.now=()=>now;
 class Socket{readyState=1;data:any;messages:any[]=[];deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(data:any){this.data=structuredClone(data);}send(v:string){this.messages.push(JSON.parse(v));}close(){this.readyState=3;}}
 let server:Socket;globals.WebSocketPair=class{0=new Socket();1=server=new Socket();};globals.WebSocketRequestResponsePair=class{};
 const sockets:Socket[]=[],storage=new Map<string,unknown>(),sql=roomSql(),waits:Promise<unknown>[]=[];
 const ctx={waitUntil(p:Promise<unknown>){waits.push(p);},blockConcurrencyWhile:(fn:()=>unknown)=>fn(),getWebSockets:()=>sockets,getWebSocketAutoResponseTimestamp:()=>new Date(now),acceptWebSocket:(s:Socket)=>sockets.push(s),setWebSocketAutoResponse(){},storage:{sql,async get(k:string){return structuredClone(storage.get(k));},async put(k:string,v:unknown){storage.set(k,structuredClone(v));},async delete(k:string){storage.delete(k);},async setAlarm(){},async deleteAlarm(){},async deleteAll(){storage.clear();sql.clear();}}};
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));let room=new GameRoom(ctx,{});
  const variant=KIRBY_VARIANTS.findIndex(v=>v[0]==='Мета Пиджи');await room.fetch(new Request(`https://test/ws?build=${BUILD}&variant=${variant}&name=Bird`,{headers:{Upgrade:'websocket'}}));const socket=server!,id=socket.data.id;
  const actor:ActorState={location:'meta-knight-arena',p:[2000,0,-2],q:[0,1,0,0],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'spoof',variant:18,star:0};
  const send=(events:any[]=[])=>{now+=200;room.webSocketMessage(socket,JSON.stringify({type:'frame',actor,events}));};
  room.room.portalBoss='metapidgie';room.room.metaKnightPortalOpen=true;
  send();send([{type:'knight',action:'start'}]);assert.equal(room.room.knightBattle.stage,'side-choice');assert.equal(room.room.knightBattle.choice.actors[0].metaKnight,false);
  send([{type:'knight',action:'side',side:'boss'}]);assert.equal(room.room.knightBattle.players[id].side,'boss');assert(Object.keys(room.room.knightBattle.opponents).length>0);
  await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(room.room.knightBattle.boss,'metapidgie');assert.equal(room.room.knightSides[id],'boss');assert.equal(room.room.knightBattle.players[id].hp,5);
  now+=3500;send();Object.assign(room.room.knightBattle,{stage:'rest',until:now+1e9});
  send([{type:'knight',action:'ability',ability:2}]);assert.equal(room.room.knightBattle.players[id].helper.cast.ability,2);
  delete room.room.knightBattle.players[id].helper.cast;Object.assign(room.room.knightBattle,{stage:'rest',since:now,until:now+10000});send([{type:'knight',action:'ability',ability:4}]);assert.equal(room.room.knightBattle.duet.owner,id);assert(room.room.knightBattle.players[id].helper.cooldowns[3]>now+85000);
  await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(room.room.knightBattle.duet.owner,id,'bird storm reservation survives Worker wakeup');
  send([{type:'knight',action:'cancel'}]);send([{type:'knight',action:'start'}]);assert.equal(room.room.knightBattle.stage,'side-choice');assert.equal(room.room.knightSides[id],undefined,'retry clears the previous boss-side choice for the bird');
  now=room.room.knightBattle.choice.until;await room.alarm();assert.equal(room.room.knightSides[id],'players');assert.equal(room.room.knightBattle.players[id].helper,undefined);
 }finally{Date.now=oldNow;globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;}
});
