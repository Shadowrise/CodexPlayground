import {roomSql} from './room-sql';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {BUILD,validActor} from '../src/network-protocol';
import {playerNameKey} from '../src/player-name';
import {createStarfall,validStarfall,RESULTS_MS} from '../src/starfall';
import {cyclePhase,phaseAtHour,DAY_CYCLE_MS} from '../src/day-cycle';

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
 const sockets:Socket[]=[],storage=new Map<string,unknown>(),sql=roomSql();let writes=0;
 const ctx={waitUntil(){},blockConcurrencyWhile:(fn:()=>unknown)=>fn(),getWebSocketAutoResponseTimestamp:()=>new Date(now),getWebSockets:()=>sockets,acceptWebSocket:(s:Socket)=>sockets.push(s),setWebSocketAutoResponse(){},
  storage:{sql,async get(key:string){return structuredClone(storage.get(key));},async put(key:string,value:unknown){if(key.startsWith('player:'))writes++;storage.set(key,structuredClone(value));},async delete(key:string){storage.delete(key);},async setAlarm(){},async deleteAlarm(){},async deleteAll(){storage.clear();sql.clear();}}};
 try{
  const {GameRoom}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));let room=new GameRoom(ctx,{});
  const wake=async()=>{room=new GameRoom(ctx,{});await Promise.resolve();await Promise.resolve();};
  const join=async(name:string,variant:number)=>{await room.fetch(new Request(`https://test/ws?build=${BUILD}&variant=${variant}&name=${encodeURIComponent(name)}`,{headers:{Upgrade:'websocket'}}));return lastServer!;};
  const send=(s:Socket,actor?:any,events:any[]=[])=>room.webSocketMessage(s,JSON.stringify({type:'frame',actor,events}));
  const first=await join('  Кирби   Друг  ',0),id=first.data.id,roomId=room.room.id;
  assert.equal(cyclePhase(room.room.dayPhase,room.room.epoch,now),phaseAtHour(9),'a new online game starts at 09:00');
  const duplicate=await join('КИРБИ ДРУГ',1);assert.equal(duplicate.messages[0].type,'error');assert.match(duplicate.messages[0].message,/именем/);assert.equal(room.info().players,1);
  assert.equal((await join('\u200b ',1)).messages[0].type,'error');
  now+=DAY_CYCLE_MS/24;
  const second=await join('Другой',1);
  assert(Math.abs(cyclePhase(second.messages[0].room.dayPhase,second.messages[0].room.epoch,now)-phaseAtHour(10))<1e-9,'late joining preserves the advancing room clock');
  const actor={p:[12,8,-16],q:[0,0,0,1],s:2,state:'Fly',pose:[],fruits:0,achievements:['mill','bench'],name:'Попытка сменить имя',variant:7,star:30,progress:{size:2.2,checkpoint:2,ground:4}};
  send(first,actor,[{type:'fruit',index:0},{type:'lock',key:'bug:0'}]);
  assert.equal(first.data.actor.name,'Кирби Друг');assert.equal(first.data.actor.variant,0);assert.equal(first.data.actor.fruits,1);assert.equal(writes,0);
  assert.equal(first.data.actor.s,2);assert.equal(first.data.actor.progress.size,2.2);assert.deepEqual(first.data.actor.fruitBoost,{stacks:1,remaining:20});
  room.room.festival=createStarfall(now,'Кирби Друг');room.room.festival.players[id]={name:'Кирби Друг',variant:0,base:7,fruits:1,size:2.2,bonus:6,collected:[0,1,2,3,4,5]};
  await room.webSocketClose(first);
  assert.equal(writes,1);assert.equal(room.room.host,second.data.id);assert(!room.room.locks['bug:0']);
  // A new Durable Object instance recovers the shared storage checkpoint.
  await wake();now+=5000;
  const returned=await join('кирби друг',3),welcome=returned.messages.find(m=>m.type==='welcome');
  assert.equal(welcome.playerId,id);assert.equal(welcome.room.id,roomId);assert.equal(welcome.resume.variant,0);
  assert.equal(welcome.resume.fruits,1);assert.deepEqual(welcome.resume.achievements,['mill','bench']);
  assert.deepEqual(welcome.resume.p,[12,4,-16]);assert.equal(welcome.resume.progress.checkpoint,2);assert.equal(welcome.resume.progress.size,2.2);
  assert.deepEqual(welcome.resume.fruitBoost,{stacks:1,remaining:15});
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
  // Admin chat uses the same broadcast as players, without occupying a seat.
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench']},[{type:'chat',text:'Привет админу!'}]);
  assert((await room.adminChat(activeId)).entries.some((e:any)=>e.text==='Привет админу!'));
  assert.equal((await room.adminChatMessage(activeId,'  Привет\nвсем!  ')).ok,true);
  for(const socket of [fresh,peer])assert(socket.messages.some((m:any)=>m.type==='log'&&m.entry.name==='Ветерок'&&m.entry.variant===-1&&m.entry.chat&&m.entry.text==='Привет всем!'));
  assert.equal((await room.adminOnline()).players.length,2);
  assert.equal((await room.adminChatMessage('stale','Нет')).ok,false);assert.equal((await room.adminChatMessage(activeId,'  ')).ok,false);
  for(let i=0;i<25;i++)await room.adminChatMessage(activeId,'История '+i);
  assert.equal(room.room.log.length,10);
  await wake();
  const chat=await room.adminChat(activeId);assert(chat.entries.some((e:any)=>e.text==='Привет всем!'));assert(chat.entries.some((e:any)=>e.text==='История 0'));
  assert.equal((await room.adminChat('stale')).ok,false);
  const host=online.players.find((p:any)=>p.id===fresh.data.id);assert.equal(host.ready,true);assert.equal(host.size,2.2);assert.equal(fresh.data.actor.fruits,0);
  const grown=await room.adminResize(activeId,fresh.data.id,.5);assert.equal(grown.ok,true);assert.equal(grown.size,2.7);assert.equal(fresh.data.actor.fruits,0);assert.equal(fresh.data.actor.progress.size,2.7);assert.equal(fresh.data.actor.progress.speed,2.7);
  const last=(items:any[],pred:(m:any)=>boolean)=>items.filter(pred).at(-1);
  assert.equal(last(fresh.messages,m=>m.type==='resize').size,2.7);assert.equal(last(peer.messages,m=>m.type==='frame'&&m.actor).actor.s,2.7);
  assert.match(last(peer.messages,m=>m.type==='log').entry.text,/вырос до 270% — Ветерок налепил немного жирка/);
  const retries=()=>fresh.messages.filter((m:any)=>m.type==='resize'&&m.size===2.7).length;const beforeRetry=retries();
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench'],s:1,fruits:0,progress:{size:1,checkpoint:0,ground:0}});assert.equal(fresh.data.actor.s,2.7);assert.equal(fresh.data.actor.progress.size,2.7);assert.equal(fresh.data.adminSize,2.7);assert.equal(retries(),beforeRetry+1);
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench'],s:2.7,fruits:0,progress:{size:2.7,checkpoint:0,ground:0}});assert.equal(fresh.data.adminSize,undefined);
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench'],s:.15,fruits:0,progress:{size:.15,checkpoint:0,ground:0}});
  const shrunk=await room.adminResize(activeId,fresh.data.id,-.5);assert.equal(shrunk.ok,true);assert.equal(shrunk.size,.3);assert.equal(fresh.data.actor.fruits,0);
  assert.match(last(peer.messages,m=>m.type==='log').entry.text,/уменьшился до 30% — Ветерок сдул лишний жирок/);
  const logs=()=>peer.messages.filter((m:any)=>m.type==='log'&&/жирка/.test(m.entry.text)).length;const before=logs();
  assert.equal((await room.adminResize(activeId,fresh.data.id,-.5)).ok,false);assert.equal(logs(),before);assert.equal(fresh.data.actor.s,.3);
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench'],s:.3,fruits:0,progress:{size:.3,checkpoint:0,ground:0}});assert.equal(fresh.data.adminSize,undefined);
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench'],s:9.6,fruits:1,progress:{size:9.6,checkpoint:0,ground:0}});
  assert.equal((await room.adminResize(activeId,fresh.data.id,.5)).size,10);assert.equal((await room.adminResize(activeId,fresh.data.id,.5)).ok,false);
  assert.equal((await room.adminResize(activeId,'missing',.5)).ok,false);assert.equal((await room.adminResize('stale',fresh.data.id,.5)).ok,false);
  send(fresh,{...actor,name:'Кирби Друг',achievements:['bench'],s:10,fruits:1,progress:{size:10,checkpoint:0,ground:0}});
  assert.equal((await room.adminDisconnect('stale',fresh.data.id)).ok,false);assert.equal(fresh.readyState,1);
  assert.equal((await room.adminDisconnect(activeId,fresh.data.id)).ok,true);assert.equal(fresh.readyState,3);assert.equal(room.room.host,peer.data.id);assert(!room.room.locks['bug:0']);
  assert.equal((await room.adminDisconnect(activeId,fresh.data.id)).ok,false);
  const reset=await room.adminRecreate(activeId);assert(reset.ok);assert.equal(peer.readyState,3);assert.notEqual(reset.roomId,activeId);
  // The empty replacement survives hibernation; stale close events cannot delete it.
  await wake();await room.webSocketClose(peer);
  assert.equal((await room.adminOnline()).room.id,reset.roomId);assert.equal((await room.adminOnline()).players.length,0);
  assert.deepEqual((await room.adminChat(reset.roomId)).entries,[]);assert.equal((await room.adminChatMessage(reset.roomId,'Нет игроков')).ok,false);assert.equal((await room.adminChat(activeId)).ok,false);
  assert.equal((await room.adminRecreate(activeId)).ok,false);assert.equal((await room.adminFestival(reset.roomId,false)).ok,false);
  now+=DAY_CYCLE_MS/2;
  const nextPlayer=await join('Кирби Друг',0);assert.equal(nextPlayer.messages[0].room.id,reset.roomId);assert(!nextPlayer.messages[0].resume);assert.deepEqual([...storage.keys()],['room-state']);
  assert.equal(cyclePhase(nextPlayer.messages[0].room.dayPhase,nextPlayer.messages[0].room.epoch,now),phaseAtHour(9),'a prepared room starts its clock when the first player joins');
  assert.equal((await room.adminChat(reset.roomId)).entries.length,0);assert.equal((await room.adminChatMessage(reset.roomId,'Новая комната')).ok,true);
  // The admin uses the normal starfall, including immediate results and their deadline.
  send(nextPlayer,{...actor,achievements:['bench'],fruits:0});
  assert.equal((await room.adminPrank(reset.roomId,nextPlayer.data.id,'hiccup')).ok,true);
  const prank=room.room.pranks[0];assert.equal(prank.kind,'hiccup');assert.equal(nextPlayer.data.actor.fruits,0);
  assert.equal((await room.adminPrank(reset.roomId,nextPlayer.data.id,'gift')).ok,false,'do not pile multiple surprises on one player');
  assert.equal((await room.adminPrank('stale',nextPlayer.data.id,'rainbow')).ok,false);
  assert.equal((await room.adminPrank(reset.roomId,nextPlayer.data.id,'constructor')).ok,false);
  await wake();assert.equal(room.room.pranks[0].id,prank.id,'effects survive host hibernation');
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
  // Fruit claims preserve even a fountain-shrunk body with a separate admin speed.
  const eater=await join('Фрукты',0),contender=await join('Сосед',1);
  const small={...actor,s:.3,state:'Idle',star:0,fruits:0,achievements:[],progress:{size:.3,speed:2,checkpoint:0,ground:0}};
  send(eater,small,[{type:'fruit',index:0}]);
  assert.equal(eater.data.actor.s,.3);assert.equal(eater.data.actor.progress.speed,2);
  now+=10000;
  send(eater,{...eater.data.actor,fruitBoost:{stacks:1,remaining:10}},[{type:'fruit',index:1}]);
  assert.deepEqual(eater.data.actor.fruitBoost,{stacks:2,remaining:20});assert.equal(eater.data.actor.progress.size,.3);
  send(contender,small,[{type:'fruit',index:1}]);assert.equal(contender.data.actor.fruits,0);assert.equal(contender.data.actor.fruitBoost,undefined);
  send(eater,{...eater.data.actor,fruitBoost:{stacks:2,remaining:10}},[{type:'fruit',index:1}]);
  assert.deepEqual(eater.data.actor.fruitBoost,{stacks:2,remaining:10},'duplicate claims do not add or refresh a bonus');
  await room.webSocketClose(eater);now+=11000;
  const expired=await join('Фрукты',0);assert.equal(expired.messages[0].resume.fruitBoost,undefined);
  assert.equal(expired.messages[0].resume.progress.size,.3);assert.equal(expired.messages[0].resume.progress.speed,2);
  const resized=await room.adminResize(room.room.id,expired.data.id,.5);assert.equal(resized.size,.8);
  send(expired,{...expired.data.actor,s:.79,progress:{size:.79,speed:.8,checkpoint:0,ground:0}});
  assert.equal(expired.data.adminSize,undefined,'a fountain bath can shrink the body before the admin resize acknowledgement');
  assert.equal(expired.data.actor.s,.79);assert.equal(expired.data.actor.progress.speed,.8);
  await room.webSocketClose(expired);await room.webSocketClose(contender);
 }finally{Date.now=oldNow;globals.WebSocketPair=oldPair;globals.WebSocketRequestResponsePair=oldResponse;}
});

test('name identity and reconnect progress validation',()=>{
 assert.equal(playerNameKey('  КИРБИ  друг '),playerNameKey('кирби друг'));
 assert.equal(playerNameKey('Ｋｉｒｂｙ'),playerNameKey('Kirby'));
 const a={p:[0,0,0],q:[0,0,0,1],s:1,state:'Idle',pose:[],fruits:0,achievements:[],name:'Test',variant:0,star:0};
 for(const progress of [null,{}, {size:NaN,checkpoint:1,ground:0},{size:1,checkpoint:5,ground:0},{size:1,checkpoint:1,ground:Infinity}])assert(!validActor({...a,progress}));
 assert(validActor({...a,progress:{size:1.4,checkpoint:3,ground:12}}));
 for(const fruitBoost of [null,{}, {stacks:11,remaining:20},{stacks:1,remaining:21},{stacks:1,remaining:0},{stacks:0,remaining:20}])assert(!validActor({...a,fruitBoost}));
 assert(validActor({...a,fruitBoost:{stacks:10,remaining:20},progress:{size:.3,speed:2,checkpoint:0,ground:0}}));
 assert(!validActor({...a,progress:{size:.3,speed:Infinity,checkpoint:0,ground:0}}));
});
