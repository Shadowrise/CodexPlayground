import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {roomSql} from './room-sql';
import {BUILD,type ActorState} from '../src/network-protocol';
import {KIRBY_VARIANTS} from '../src/variant-palette';

test('actual Worker owns side selection, cast locks, persistence, independent hearts and rewards',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject {constructor(public ctx:any,public env:any){}}')
  .replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './","from '"+new URL('../../game-server/src/',import.meta.url).href)
  .replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2').replaceAll('new Response(null,{status:101,webSocket:client})','({status:101,webSocket:client})');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const globals=globalThis as any,oldPair=globals.WebSocketPair,oldResponse=globals.WebSocketRequestResponsePair,oldNow=Date.now;let now=100000;Date.now=()=>now;
 class Socket{readyState=1;data:any;messages:any[]=[];deserializeAttachment(){return structuredClone(this.data);}serializeAttachment(data:any){this.data=structuredClone(data);}send(v:string){this.messages.push(JSON.parse(v));}close(){this.readyState=3;}}
 let lastServer:Socket;globals.WebSocketPair=class{0=new Socket();1=lastServer=new Socket();};globals.WebSocketRequestResponsePair=class{};
 const sockets:Socket[]=[],storage=new Map<string,unknown>(),sql=roomSql(),waits:Promise<unknown>[]=[];
 const ctx={waitUntil(p:Promise<unknown>){waits.push(p);},blockConcurrencyWhile:(fn:()=>unknown)=>fn(),getWebSockets:()=>sockets,getWebSocketAutoResponseTimestamp:()=>new Date(now),acceptWebSocket:(s:Socket)=>sockets.push(s),setWebSocketAutoResponse(){},storage:{sql,async get(k:string){return structuredClone(storage.get(k));},async put(k:string,v:unknown){storage.set(k,structuredClone(v));},async delete(k:string){storage.delete(k);},async setAlarm(){},async deleteAlarm(){},async deleteAll(){storage.clear();sql.clear();}}};
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));let room=new GameRoom(ctx,{});
  const join=async(name:string,variant:number)=>{await room.fetch(new Request(`https://test/ws?build=${BUILD}&variant=${variant}&name=${encodeURIComponent(name)}`,{headers:{Upgrade:'websocket'}}));return lastServer!;};
  const hero=await join('Кирби',0),helper=await join('Рыцарь',KIRBY_VARIANTS.findIndex(v=>v[0]==='Meta Knight'));
  const actor=(x=2000,z=-2):ActorState=>({location:'meta-knight-arena',p:[x,0,z],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'spoof',variant:0,star:0});
  const send=(socket:Socket,p:ActorState,events:any[]=[])=>{now+=200;room.webSocketMessage(socket,JSON.stringify({type:'frame',actor:p,events}));};
  send(helper,actor(2012,0));send(hero,actor(),[{type:'knight',action:'start'}]);assert.equal(room.room.knightBattle,undefined,'an unanswered choice blocks the start');
  send(hero,actor(),[{type:'knight',action:'side',side:'boss'}]);assert.equal(room.room.knightSides,undefined,'Kirby cannot choose the boss team');
  send(helper,actor(2012,0),[{type:'knight',action:'side',side:'boss'}]);send(hero,actor(),[{type:'knight',action:'start'}]);
  const id=helper.data.id,s=room.room.knightBattle;assert.equal(s.players[id].side,'boss');assert.equal(s.players[id].hp,5);assert.equal(s.players[hero.data.id].hp,8);assert.equal(s.teamHp,undefined);
  now+=3500;send(hero,actor());Object.assign(s,{stage:'rest',until:now+1e9});
  send(helper,actor(2012,0),[{type:'knight',action:'ability',ability:2},{type:'knight',action:'ability',ability:3},{type:'knight',action:'side',side:'players'}]);
  assert.equal(s.players[id].helper.cast.ability,2);assert.equal(s.players[id].side,'boss');assert.equal(room.room.knightSides[id],'boss');
  send(helper,actor(2012,0),[{type:'knight',action:'ability',ability:4}]);assert.equal(s.duet.stage,'queued');assert.equal(s.players[id].helper.cooldowns[3],now+90000);
  const cooldowns=structuredClone(s.players[id].helper.cooldowns);send(helper,actor(2038,0));assert.equal(helper.data.actor.p[0],2012,'the server rejects movement during wind-up');
  await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(room.room.knightSides[id],'boss');assert.equal(room.room.knightBattle.duet.stage,'queued');assert.deepEqual(room.room.knightBattle.players[id].helper.cooldowns,cooldowns);assert.equal(room.room.knightBattle.players[id].hp,5);
  const resumed=room.room.knightBattle;resumed.stage='open';resumed.until=now+1e9;resumed.from=resumed.to=[12,0,0];const hp=resumed.hp;
  send(helper,actor(2012,0),[{type:'knight',action:'attack'}]);now+=1000;send(hero,actor());assert.equal(resumed.hp,hp,'ordinary Q never damages the allied boss');
  now=Math.max(now,resumed.players[id].helper.cast.recoverUntil)+100;resumed.until=now+200;send(hero,actor(1980,0));assert.equal(resumed.stage,'duet-gather');
  let guard=0;while(resumed.stage!=='duet-recover'&&guard++<20){now=resumed.until-200;send(hero,actor(1980,0));}assert(guard<20);const until=resumed.until,bossHp=resumed.hp;
  send(hero,actor(1996.7,-3.7),[{type:'knight',action:'attack'}]);now+=150;send(hero,actor(1996.7,-3.7));assert.equal(resumed.hp,bossHp-1);assert.equal(resumed.stage,'duet-recover');assert.equal(resumed.until,until);
  now+=400;send(hero,actor(2003.3,-2),[{type:'knight',action:'attack'}]);send(hero,actor(2003.3,-2));assert.equal(resumed.players[id].hp,4);assert.equal(resumed.hp,bossHp-1);assert.equal(resumed.until,until);
  resumed.stage='won';resumed.players[id].hits=10;resumed.players[hero.data.id].hits=1;send(hero,actor());
  assert(!helper.messages.some(m=>m.type==='knight-victory'));assert(hero.messages.some(m=>m.type==='knight-victory'));
 }finally{Date.now=oldNow;globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;}
});
