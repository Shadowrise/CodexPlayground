import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {roomSql} from './room-sql';
import {BUILD,type ActorState} from '../src/network-protocol';

test('actual Worker validates duel attacks, owns victory and respect chat, persists the encounter, and refuses client supplied health',async()=>{
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
  const a=await join('Рыцарь',0),b=await join('Сосед',1),aid=a.data.id;
  const actor=(p=[2000,0,-2]):ActorState=>({location:'meta-knight-arena',p,q:[0,1,0,0],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'FORGED NAME',variant:0,star:0});
  const send=(s:Socket,p:ActorState,events:any[]=[],extra={})=>{now+=200;room.webSocketMessage(s,JSON.stringify({type:'frame',actor:p,events,...extra}));};
  send(b,actor([2025,0,20]));send(a,actor(),[{type:'knight',action:'start'}]);assert.equal(room.room.knightBattle.hp,12);
  send(a,actor(),[{type:'knight',action:'win',hp:0}],{knightBattle:{stage:'won',hp:0}});assert.equal(room.room.knightBattle.hp,12);assert(!a.messages.some(m=>m.type==='knight-victory'));
  for(let i=0;i<12;i++){
   const s=room.room.knightBattle;Object.assign(s,{stage:'open',since:now,until:now+2500,checked:now,from:[0,0,0],to:[0,0,0],openHit:false});
   now+=800;send(a,actor([2000,0,2]),[{type:'knight',action:'attack'}]);send(a,actor([2000,0,2]));
   assert.equal(room.room.knightBattle.hp,11-i);
   if(i===3){await Promise.all(waits);room=new GameRoom(ctx,{});await new Promise(r=>setTimeout(r,0));assert.equal(room.room.knightBattle.hp,8,'Worker wakeup restores shared progress');}
  }
  assert.equal(room.room.knightBattle.stage,'won');assert.equal(room.room.knightBattle.players[aid].hits,12);
  assert.equal(a.messages.filter(m=>m.type==='knight-victory').length,1);assert.equal(b.messages.filter(m=>m.type==='knight-victory').length,0);
  assert(a.messages.some(m=>m.type==='log'&&m.entry.text==='Метакнайт с уважением смотрит на Рыцарь.'&&m.entry.name===''));
  assert(b.messages.some(m=>m.type==='log'&&m.entry.text==='Метакнайт с уважением смотрит на Рыцарь.'));
  send(a,actor());assert.equal(a.messages.filter(m=>m.type==='knight-victory').length,1);
  assert(!a.data.room?.knightBattle,'large encounter is stored outside socket attachments');
 }finally{Date.now=oldNow;globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;sql.close();}
});
