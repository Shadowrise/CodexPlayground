import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {BUILD,validActor} from '../src/network-protocol';
import {playerNameKey} from '../src/player-name';
import {createStarfall,validStarfall,RESULTS_MS} from '../src/starfall';

test('room restores disconnected players by name, rejects online duplicates, and forgets an empty session',async()=>{
 const source=(await readFile(new URL('../../game-server/src/index.ts',import.meta.url),'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject { constructor(public ctx:any,public env:any){} }')
  .replaceAll('../../kirby-game/src/',new URL('../src/',import.meta.url).href).replaceAll("from './", "from '"+new URL('../../game-server/src/',import.meta.url).href)
  .replace(/(from ['"]file:[^'"]+)(['"])/g,'$1.ts$2')
  .replaceAll('new Response(null,{status:101,webSocket:client})','({status:101,webSocket:client})');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const globals=globalThis as any,oldPair=globals.WebSocketPair,oldResponse=globals.WebSocketRequestResponsePair,oldNow=Date.now;
 let now=100000;Date.now=()=>now;
 class Socket {
  readyState=1;data:any;messages:any[]=[];
  deserializeAttachment(){return structuredClone(this.data);}
  serializeAttachment(a:any){this.data=structuredClone(a);}
  send(v:string){this.messages.push(JSON.parse(v));}
  close(){this.readyState=3;}
  accept(){}
 }
 let lastServer:Socket;
 globals.WebSocketPair=class {0=new Socket();1=lastServer=new Socket();};globals.WebSocketRequestResponsePair=class {};
 const sockets:Socket[]=[],storage=new Map<string,unknown>();let writes=0;
 const ctx={blockConcurrencyWhile:(fn:()=>unknown)=>fn(),getWebSocketAutoResponseTimestamp:()=>new Date(now),getWebSockets:()=>sockets,acceptWebSocket:(s:Socket)=>sockets.push(s),setWebSocketAutoResponse(){},
  storage:{async get(key:string){return structuredClone(storage.get(key));},async put(key:string,value:unknown){writes++;storage.set(key,structuredClone(value));},async setAlarm(){},async deleteAlarm(){},async deleteAll(){storage.clear();}}};
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));let room=new GameRoom(ctx,{});
  const join=async(name:string,variant:number)=>{await room.fetch(new Request(`https://test/ws?build=${BUILD}&variant=${variant}&name=${encodeURIComponent(name)}`,{headers:{Upgrade:'websocket'}}));return lastServer!;};
  const send=(s:Socket,actor?:any,events:any[]=[])=>room.webSocketMessage(s,JSON.stringify({type:'frame',actor,events}));
  const first=await join('  Кирби   Друг  ',0),id=first.data.id,roomId=room.room.id;
  const duplicate=await join('КИРБИ ДРУГ',1);assert.equal(duplicate.messages[0].type,'error');assert.match(duplicate.messages[0].message,/именем/);assert.equal(room.info().players,1);
  assert.equal((await join('\u200b ',1)).messages[0].type,'error');
  const second=await join('Другой',1);
  const actor={p:[12,8,-16],q:[0,0,0,1],s:2,state:'Fly',pose:[],fruits:0,achievements:['mill','bench'],name:'Попытка сменить имя',variant:7,star:30,progress:{size:2.2,checkpoint:2,ground:4}};
  send(first,actor,[{type:'fruit',index:0},{type:'lock',key:'bug:0'}]);
  assert.equal(first.data.actor.name,'Кирби Друг');assert.equal(first.data.actor.variant,0);assert.equal(first.data.actor.fruits,1);assert.equal(writes,0);
  room.room.festival=createStarfall(now,'Кирби Друг');room.room.festival.players[id]={name:'Кирби Друг',variant:0,base:7,fruits:1,size:2.3,bonus:6,collected:[0,1,2,3,4,5]};
  await room.webSocketClose(first);
  assert.equal(writes,1);assert.equal(room.room.host,second.data.id);assert(!room.room.locks['bug:0']);
  // A new Durable Object instance recovers the room through the surviving host attachment.
  room=new GameRoom(ctx,{});now+=5000;
  const returned=await join('кирби друг',3),welcome=returned.messages.find(m=>m.type==='welcome');
  assert.equal(welcome.playerId,id);assert.equal(welcome.room.id,roomId);assert.equal(welcome.resume.variant,0);
  assert.equal(welcome.resume.fruits,1);assert.deepEqual(welcome.resume.achievements,['mill','bench']);
  assert.deepEqual(welcome.resume.p,[12,4,-16]);assert.equal(welcome.resume.progress.checkpoint,2);assert.equal(welcome.resume.progress.size,2.3);
  assert.equal(welcome.resume.state,'Idle');assert(!welcome.resume.ride);assert.equal(welcome.resume.star,25);assert(validActor(welcome.resume));
  assert.equal(welcome.room.fruits[0],id);assert.equal(welcome.room.festival.players[id].bonus,6);
  // Rejoining cannot claim an already-collected festival star again.
  send(returned,welcome.resume,[{type:'festival-star',index:0}]);assert.equal(room.room.festival.players[id].bonus,6);
  const count=writes;send(returned,welcome.resume);assert.equal(writes,count);
  assert.equal((await join('Кирби Друг',4)).messages[0].type,'error');
  // Riding is not restored: dismount at the same horizontal location, release the lock.
  send(returned,{...welcome.resume,p:[22,11,33],ride:{key:'bug:0',data:Array(10).fill(0)}},[{type:'lock',key:'bug:0'}]);
  send(returned,{...welcome.resume,p:[22,11,33],ride:{key:'bug:0',data:Array(10).fill(0)}});
  await room.webSocketClose(returned);const colourUser=await join('Новый',0);
  const fallback=await join('Кирби Друг',4),restored=fallback.messages[0].resume;
  assert.equal(restored.variant,4);assert.deepEqual(restored.p,[22,0,33]);assert(!restored.ride);assert.equal(fallback.data.id,id);
  await room.webSocketClose(second);await room.webSocketClose(colourUser);await room.webSocketClose(fallback);
  assert.equal(room.room,undefined);assert.equal(storage.size,0);
  const fresh=await join('Кирби Друг',0);assert.notEqual(fresh.messages[0].room.id,roomId);assert.notEqual(fresh.data.id,id);assert(!fresh.messages[0].resume);assert(fresh.messages[0].room.fruits.every((x:unknown)=>x===null));
  // Admin disconnect uses normal departure cleanup, transfers host and releases rides.
  const peer=await join('Гость',1),activeId=room.room.id;
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench']},[{type:'lock',key:'bug:0'}]);
  const online=await room.adminOnline();assert.equal(online.room.id,activeId);assert.equal(online.players.length,2);assert.equal(online.players.find((p:any)=>p.id===fresh.data.id).host,true);
  const host=online.players.find((p:any)=>p.id===fresh.data.id);assert.equal(host.ready,true);assert.equal(host.size,2.2);assert.equal(fresh.data.actor.fruits,0);
  const grown=await room.adminResize(activeId,fresh.data.id,.5);assert.equal(grown.ok,true);assert.equal(grown.size,2.7);assert.equal(fresh.data.actor.fruits,0);assert.equal(fresh.data.actor.progress.size,2.7);
  const last=(items:any[],pred:(m:any)=>boolean)=>items.filter(pred).at(-1);
  assert.equal(last(fresh.messages,m=>m.type==='resize').size,2.7);assert.equal(last(peer.messages,m=>m.type==='frame'&&m.actor).actor.s,2.7);
  assert.match(last(peer.messages,m=>m.type==='log').entry.text,/вырос до 270% — Ветерок налепил немного жирка/);
  const retries=()=>fresh.messages.filter((m:any)=>m.type==='resize'&&m.size===2.7).length;const beforeRetry=retries();
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench'],s:1,fruits:0,progress:{size:1,checkpoint:0,ground:0}});assert.equal(fresh.data.actor.s,2.7);assert.equal(fresh.data.actor.progress.size,2.7);assert.equal(fresh.data.adminSize,2.7);assert.equal(retries(),beforeRetry+1);
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench'],s:2.7,fruits:0,progress:{size:2.7,checkpoint:0,ground:0}});assert.equal(fresh.data.adminSize,undefined);
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench'],s:.15,fruits:0,progress:{size:.15,checkpoint:0,ground:0}});
  const shrunk=await room.adminResize(activeId,fresh.data.id,-.5);assert.equal(shrunk.ok,true);assert.equal(shrunk.size,.1);assert.equal(fresh.data.actor.fruits,0);
  assert.match(last(peer.messages,m=>m.type==='log').entry.text,/уменьшился до 10% — Ветерок сдул лишний жирок/);
  const logs=()=>peer.messages.filter((m:any)=>m.type==='log'&&/жирка/.test(m.entry.text)).length;const before=logs();
  assert.equal((await room.adminResize(activeId,fresh.data.id,-.5)).ok,false);assert.equal(logs(),before);assert.equal(fresh.data.actor.s,.1);
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench'],s:.1,fruits:0,progress:{size:.1,checkpoint:0,ground:0}});assert.equal(fresh.data.adminSize,undefined);
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench'],s:9.6,fruits:1,progress:{size:9.6,checkpoint:0,ground:0}});
  assert.equal((await room.adminResize(activeId,fresh.data.id,.5)).size,10);assert.equal((await room.adminResize(activeId,fresh.data.id,.5)).ok,false);
  assert.equal((await room.adminResize(activeId,'missing',.5)).ok,false);assert.equal((await room.adminResize('stale',fresh.data.id,.5)).ok,false);
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench'],s:10,fruits:1,progress:{size:10,checkpoint:0,ground:0}});
  assert.equal((await room.adminDisconnect('stale',fresh.data.id)).ok,false);assert.equal(fresh.readyState,1);
  assert.equal((await room.adminDisconnect(activeId,fresh.data.id)).ok,true);assert.equal(fresh.readyState,3);assert.equal(room.room.host,peer.data.id);assert(!room.room.locks['bug:0']);
  assert.equal((await room.adminDisconnect(activeId,fresh.data.id)).ok,false);
  const reset=await room.adminRecreate(activeId);assert(reset.ok);assert.equal(peer.readyState,3);assert.notEqual(reset.roomId,activeId);
  // The empty replacement survives hibernation; stale close events cannot delete it.
  room=new GameRoom(ctx,{});await room.webSocketClose(peer);
  assert.equal((await room.adminOnline()).room.id,reset.roomId);assert.equal((await room.adminOnline()).players.length,0);
  assert.equal((await room.adminRecreate(activeId)).ok,false);assert.equal((await room.adminFestival(reset.roomId,false)).ok,false);
  const nextPlayer=await join('Кирби Друг',0);assert.equal(nextPlayer.messages[0].room.id,reset.roomId);assert(!nextPlayer.messages[0].resume);assert.equal(storage.size,0);
  // The admin uses the normal starfall, including immediate results and their deadline.
  send(nextPlayer,{...actor,achievements:['bench'],fruits:0});
  assert.equal((await room.adminPrank(reset.roomId,nextPlayer.data.id,'hiccup')).ok,true);
  const prank=room.room.pranks[0];assert.equal(prank.kind,'hiccup');assert.equal(nextPlayer.data.actor.fruits,0);
  assert.equal((await room.adminPrank(reset.roomId,nextPlayer.data.id,'gift')).ok,false,'do not pile multiple surprises on one player');
  assert.equal((await room.adminPrank('stale',nextPlayer.data.id,'rainbow')).ok,false);
  assert.equal((await room.adminPrank(reset.roomId,nextPlayer.data.id,'constructor')).ok,false);
  room=new GameRoom(ctx,{});assert.equal(room.room.pranks[0].id,prank.id,'effects survive host hibernation');
  const spectator=await join('Зритель',3);assert.equal(spectator.messages[0].room.pranks[0].id,prank.id,'late joiners see the same effect timeline');await room.webSocketClose(spectator);
  now=prank.endsAt+1;assert.equal((await room.adminPrank(reset.roomId,nextPlayer.data.id,'rainbow')).ok,true);assert.equal(room.room.pranks.length,1);
  now=room.room.pranks[0].endsAt+1;assert.equal((await room.adminPrank(reset.roomId,nextPlayer.data.id,'gift')).ok,true);
  assert.equal((await room.adminFestival(reset.roomId,false)).ok,true);assert(validStarfall(room.room.festival));
  assert.equal((await room.adminFestival(reset.roomId,false)).ok,false);
  assert.equal((await room.adminFestival(reset.roomId,true)).ok,true);assert(validStarfall(room.room.festival));
  assert.equal(room.room.festival.results[0].points,3);assert.equal(room.room.festival.endsAt,now);
  assert.equal((await room.adminPrank(reset.roomId,nextPlayer.data.id,'gift')).ok,false,'no pranks on the results screen');
  assert(nextPlayer.messages.some(m=>m.type==='room'&&m.room.festival?.results));assert.equal((await room.adminFestival(reset.roomId,true)).ok,false);
  now+=RESULTS_MS;await room.alarm();assert.equal((await room.adminOnline()).room,null);
  const immediate=await join('Без ивента',2),immediateId=room.room.id;
  assert.equal((await room.adminFestival(immediateId,true)).ok,true);assert.equal(room.room.festival.results[0].name,'Без ивента');assert.equal(room.room.festival.results[0].points,0);
  await room.webSocketClose(immediate);assert.equal((await room.adminOnline()).room,null);
 }finally{Date.now=oldNow;globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;}
});

test('name identity and reconnect progress validation',()=>{
 assert.equal(playerNameKey('  КИРБИ  друг '),playerNameKey('кирби друг'));
 assert.equal(playerNameKey('Ｋｉｒｂｙ'),playerNameKey('Kirby'));
 const a={p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Test',variant:0,star:0};
 for(const progress of [null,{}, {size:NaN,checkpoint:1,ground:0},{size:1,checkpoint:5,ground:0},{size:1,checkpoint:1,ground:Infinity}])assert(!validActor({...a,progress}));
 assert(validActor({...a,progress:{size:1.4,checkpoint:3,ground:12}}));
});
