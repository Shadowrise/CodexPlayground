import {validBugLanding,reconcileBugLanding} from '../../kirby-game/src/firefly-landing';
import {normalizePlayerName,playerNameKey} from '../../kirby-game/src/player-name';
import {sanitizeDevice,deviceInfo,type DeviceInfo} from '../../kirby-game/src/history-types';
import {SCORE_ACTIONS} from '../../kirby-game/src/score';
import {isPrankKind,makePrank,PRANKS} from '../../kirby-game/src/pranks';
import {historyRoutes} from './admin';
import {initHistory,writeVisits,historyPage,type Visit,type HistoryFilter} from './history-store';
import {allTasks,createStarfall,collectStar,finishStarfall,COLLECT_MS,RESULTS_MS} from '../../kirby-game/src/starfall';
import {chatText,emoteMessage,type LogEntry} from '../../kirby-game/src/world-log';
import { DurableObject } from 'cloudflare:workers';
import {PROTOCOL,BUILD,validActor,validWorld,validResourceKey,type ActorState,type WorldState,type RoomState,type Event} from '../../kirby-game/src/network-protocol';
const MAX_PLAYERS=14,ROOM_NAME='main';
type OnlineVisit={id:string;startedAt:number;activeMs:number;tick:number;lastWrite:number;startScore:number;seq:number;device:DeviceInfo;finished?:boolean};
type Attachment={id:string;session?:string;name?:string;seen:number;visible:boolean;variant:number;actor?:ActorState;room?:RoomState;lastHit?:number;announced?:boolean;lastChat?:number;lastEmote?:number;left?:boolean;lastFrame?:number;window?:number;count?:number;history?:OnlineVisit};
type DepartedPlayer={id:string;actor:ActorState;savedAt:number};
/** Permanent archive: deliberately separate from the disposable game room. */
export class HistoryStore extends DurableObject<Env>{
 constructor(ctx:DurableObjectState,env:Env){super(ctx,env);initHistory(ctx.storage.sql);}
 write(visits:Visit[]){this.ctx.storage.transactionSync(()=>writeVisits(this.ctx.storage.sql,visits));}
 list(filter:HistoryFilter){return historyPage(this.ctx.storage.sql,filter);}
}
export class GameRoom extends DurableObject<Env>{
 private room?:RoomState;
 constructor(ctx:DurableObjectState,env:Env){super(ctx,env);ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));for(const s of this.players()){const a=s.deserializeAttachment() as Attachment; if(a?.room)this.room=a.room;}}
 private players(){return this.ctx.getWebSockets().filter(s=>s.readyState===WebSocket.OPEN&&!(s.deserializeAttachment() as Attachment)?.left);}
 info(){const players=this.players().length;return {room:ROOM_NAME,players,capacity:MAX_PLAYERS,full:players>=MAX_PLAYERS,occupiedVariants:this.players().map(s=>(s.deserializeAttachment() as Attachment).variant),protocolVersion:PROTOCOL};}
 private newRoom(host=''):RoomState{return {id:crypto.randomUUID(),host,epoch:Date.now(),dayPhase:Math.random(),fruits:Array(70).fill(null),starAt:0,mill:false,locks:{}};}
 adminPrank(roomId:string,playerId:string,kind:unknown){return this.ctx.blockConcurrencyWhile(async()=>{
  const r=this.room,now=Date.now();if(!r||r.id!==roomId)return {ok:false,error:'Комната уже изменилась. Обнови список.'};
  if(!isPrankKind(kind))return {ok:false,error:'Неизвестный розыгрыш.'};
  if(r.festival?.results)return {ok:false,error:'Игра уже завершена.'};
  const socket=this.players().find(s=>(s.deserializeAttachment() as Attachment).id===playerId),a=socket?.deserializeAttachment() as Attachment|undefined;
  if(!a?.actor)return {ok:false,error:'Игрок отключился или ещё загружается.'};
  r.pranks=(r.pranks??[]).filter(p=>p.endsAt>now&&this.players().some(s=>(s.deserializeAttachment() as Attachment).id===p.playerId));
  if(r.pranks.some(p=>p.playerId===playerId))return {ok:false,error:'У этого игрока ещё идёт розыгрыш. Подожди немного.'};
  r.pranks.push(makePrank(playerId,kind,now,a.actor.p,a.actor.s));this.log(a,PRANKS[kind].text);this.changed();return {ok:true};
 });}
 adminOnline(){return this.ctx.blockConcurrencyWhile(async()=>{
  const room=this.room??await this.ctx.storage.get<RoomState>('prepared-room');
  return {room:room?{id:room.id,createdAt:room.epoch,festival:room.festival?.results?'finished':room.festival?'running':'none'}:null,players:this.players().map(s=>{const a=s.deserializeAttachment() as Attachment;return {id:a.id,name:a.name??a.actor?.name??'Кирби',variant:a.variant,host:a.id===room?.host,joinedAt:a.history?.startedAt??null};})};
 });}
 adminDisconnect(roomId:string,playerId:string){return this.ctx.blockConcurrencyWhile(async()=>{
  if(this.room?.id!==roomId)return {ok:false,error:'Комната уже изменилась. Обнови список.'};
  const socket=this.players().find(s=>(s.deserializeAttachment() as Attachment).id===playerId);
  if(!socket)return {ok:false,error:'Игрок уже отключился.'};
  this.send(socket,{type:'error',message:'Ветерок отключил тебя от комнаты.'});
  await this.removePlayer(socket,'left','Admin disconnected');return {ok:true};
 });}
 adminRecreate(roomId:string){return this.ctx.blockConcurrencyWhile(async()=>{
  const current=this.room??await this.ctx.storage.get<RoomState>('prepared-room');
  if(!current||current.id!==roomId)return {ok:false,error:'Комната уже изменилась. Обнови список.'};
  const visits=this.players().map(s=>{const a=s.deserializeAttachment() as Attachment;const visit=this.historySnapshot(a,'left');a.left=true;delete a.room;s.serializeAttachment(a);this.send(s,{type:'error',message:'Ветерок пересоздал комнату. Вернись в меню и подключись к новой игре.'});try{s.close(1000,'Admin recreated room');}catch{}return visit;});
  this.archive(visits);this.room=undefined;await this.ctx.storage.deleteAlarm();await this.ctx.storage.deleteAll();
  // An empty replacement sleeps without an alarm until the first player joins.
  const room=this.newRoom();await this.ctx.storage.put('prepared-room',room);return {ok:true,roomId:room.id};
 });}
 adminFestival(roomId:string,finish:boolean){return this.ctx.blockConcurrencyWhile(async()=>{
  const r=this.room;if(!r||r.id!==roomId||!this.players().length)return {ok:false,error:'Активной комнаты уже нет. Обнови список.'};
  if(r.festival?.results||r.festival&&!finish)return {ok:false,error:'Финальный ивент уже запущен или завершён.'};
  const now=Date.now();this.startFestival(now,'Ветерок');
  if(finish){r.festival!.endsAt=now;r.festival!.startsAt=now-COLLECT_MS;this.finishFestival(now);}
  else this.changed();
  await this.ctx.storage.setAlarm(Math.min(now+30000,r.festival!.endsAt+(finish?RESULTS_MS:0)));return {ok:true};
 });}
 private startFestival(now:number,initiator:string){
  const r=this.room;if(!r||r.festival)return;
  r.festival=createStarfall(now,initiator);
  for(const peer of this.players()){const a=peer.deserializeAttachment() as Attachment;const actor=a.actor;r.festival.players[a.id]={name:a.name??actor?.name??'Кирби',variant:a.variant,base:(actor?.fruits??0)+(actor?.achievements.length??0)*3,fruits:actor?.fruits??0,size:actor?.s??1,bonus:0,collected:[]};}
 }
 private send(s:WebSocket,v:unknown){try{s.send(JSON.stringify(v));}catch{}}
 private broadcast(v:unknown,except?:WebSocket){for(const s of this.players())if(s!==except)this.send(s,v);}
 private accountHistory(a:Attachment,now=Date.now()){
  const h=a.history;if(!h||h.finished)return;
  now=Math.max(now,h.tick);if(a.visible)h.activeMs+=Math.max(0,Math.min(75000,now-h.tick));h.tick=now;
 }
 private historySnapshot(a:Attachment,status:Visit['status']='playing',now=Date.now()):Visit|undefined{
  const h=a.history;if(!h||h.finished)return;this.accountHistory(a,now);h.lastWrite=now;
  const result=this.room?.festival?.results?.find(p=>p.id===a.id),completed=status==='finished';
  const score=result?.points??(a.actor?.fruits??0)+(a.actor?.achievements.length??0)*3+(this.room?.festival?.players[a.id]?.bonus??0);
  if(completed)h.finished=true;
  return {id:h.id,mode:'online',roomId:a.session??this.room?.id??null,playerId:a.id,name:a.name??a.actor?.name??'Кирби',variant:a.variant,startedAt:h.startedAt,lastSeen:now,endedAt:status==='playing'?null:now,activeMs:h.activeMs,startScore:h.startScore,score,tasksDone:SCORE_ACTIONS.filter(t=>a.actor?.achievements.includes(t)).length,tasksTotal:SCORE_ACTIONS.length,status,completed,place:completed&&result?1+this.room!.festival!.results!.filter(p=>p.points>result.points).length:null,device:h.device,seq:h.seq++};
 }
 private archive(visits:(Visit|undefined)[]){
  const rows=visits.filter((v):v is Visit=>!!v);if(!rows.length||!this.env.HISTORY)return;
  try{this.ctx.waitUntil(this.env.HISTORY.getByName('archive').write(rows).catch(()=>{}));}catch{/* History must not affect the shared game. */}
 }
 private persist(){if(!this.room)return;for(const s of this.players()){const a=s.deserializeAttachment() as Attachment; if(a.id===this.room.host){a.room=this.room;s.serializeAttachment(a);}else if(a.room){delete a.room;s.serializeAttachment(a);}}}
 private log(a:Attachment,text:string,chat=false){if(!this.room||!a.actor)return;const entry:LogEntry={id:crypto.randomUUID(),name:a.actor.name,variant:a.variant,text,chat};this.room.log=[...(this.room.log??[]),entry].slice(-10);this.broadcast({type:'log',entry});this.persist();}
 private finishFestival(now=Date.now()){
  const f=this.room?.festival;if(!f)return;
  if(!f.results&&now>=f.endsAt&&this.room?.world){const npcs=this.room.world.npcs;f.players.npc={name:'Другие кирби',variant:1,base:npcs.reduce((sum,n)=>sum+n.fruits+n.achievements.length*3,0),fruits:0,size:1,bonus:0,collected:[]};}
  if(finishStarfall(f,now)){
   const visits=this.players().map(s=>{const a=s.deserializeAttachment() as Attachment;const row=this.historySnapshot(a,'finished',Math.min(now,f.endsAt));s.serializeAttachment(a);return row;});this.archive(visits);this.changed();
  }
 }
 private changed(){this.persist();this.broadcast({type:'room',room:this.room});}
 private reject(message:string){const [client,server]=Object.values(new WebSocketPair());server.accept();this.send(server,{type:'error',message});server.close(1008,'Join rejected');return new Response(null,{status:101,webSocket:client});}
 async fetch(request:Request){return this.ctx.blockConcurrencyWhile(()=>this.join(request));}
 private async join(request:Request){
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  const url=new URL(request.url);if(url.searchParams.get('build')!==BUILD)return new Response('Refresh game client',{status:409});
  const name=normalizePlayerName((url.searchParams.get('name')??'').normalize('NFKC')),key=playerNameKey(name);
  if(!key)return this.reject('Введи имя, чтобы подключиться к игре.');
  if(this.players().some(s=>{const a=s.deserializeAttachment() as Attachment;return playerNameKey(a.name??a.actor?.name??'')===key;}))return this.reject('Игрок с таким именем уже на полянке. Выбери другое имя или выйди из игры на другом устройстве.');
  if(this.players().length>=MAX_PLAYERS)return Response.json({error:'ROOM_FULL'},{status:503});
  if(this.room?.festival&&Date.now()>=this.room.festival.endsAt&&this.players().length)return new Response('Celebration finished. Try again shortly.',{status:409});
  let variant=Number(url.searchParams.get('variant'));
  if(!url.searchParams.has('variant')||!Number.isInteger(variant)||variant<0||variant>=15)return new Response('Invalid variant',{status:400});
  const first=this.players().length===0;
  const saved=!first&&this.room?await this.ctx.storage.get<DepartedPlayer>(`player:${this.room.id}:${key}`):undefined;
  const occupied=new Set(this.players().map(s=>(s.deserializeAttachment() as Attachment).variant));
  // Restore the original colour if it is still free; otherwise keep the new selection.
  if(saved&&!occupied.has(saved.actor.variant))variant=saved.actor.variant;
  if(occupied.has(variant))return this.reject('Этот цвет уже занят. Выбери другого Кирби.');
  const id=saved?.id??crypto.randomUUID();
  if(first){const prepared=await this.ctx.storage.get<RoomState>('prepared-room');await this.ctx.storage.deleteAll();this.room=prepared??this.newRoom();this.room.host=id;}
  const resume=saved?{...saved.actor,name,variant,star:Math.max(0,saved.actor.star-(Date.now()-saved.savedAt)/1000)}:undefined;
  let device=deviceInfo(request.headers.get('User-Agent')??'');try{const raw=url.searchParams.get('device');if(raw&&raw.length<1024)device=sanitizeDevice(JSON.parse(raw));}catch{}
  const now=Date.now(),history:OnlineVisit={id:'online:'+crypto.randomUUID(),startedAt:now,activeMs:0,tick:now,lastWrite:now,startScore:(resume?.fruits??0)+(resume?.achievements.length??0)*3+(this.room?.festival?.players[id]?.bonus??0),seq:0,device};
  const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server);const attachment:Attachment={id,session:this.room!.id,name,seen:now,visible:true,variant,actor:resume,history};this.archive([this.historySnapshot(attachment)]);server.serializeAttachment(attachment);
  this.persist();this.send(server,{type:'welcome',serverNow:Date.now(),protocolVersion:PROTOCOL,playerId:id,resume,room:this.room,players:this.players().map(s=>{const a=s.deserializeAttachment() as Attachment;return {id:a.id,actor:a.actor};})});
  this.broadcast({type:'presence',count:this.players().length});
  if(first)await this.ctx.storage.setAlarm(Date.now()+30000);
  return new Response(null,{status:101,webSocket:client});
 }
 webSocketMessage(socket:WebSocket,message:string|ArrayBuffer){
  if(typeof message!=='string'||message.length>22000){socket.close(1009,'Message too large');return;}
  let m:any;try{m=JSON.parse(message);}catch{socket.close(1008,'Invalid JSON');return;}
  const a=socket.deserializeAttachment() as Attachment,r=this.room;if(!r||a.left||(a.session&&a.session!==r.id)||m?.type!=='frame')return;
  const now=Date.now(),alreadyFinished=!!r.festival?.results;this.finishFestival(now);
  if(r.festival?.results){if(alreadyFinished)this.send(socket,{type:'room',room:r});return;}
  this.accountHistory(a,now);
  if(now-(a.window??0)>1000){a.window=now;a.count=0;}a.count=(a.count??0)+1;if(a.count>30){socket.close(1008,'Message rate exceeded');return;}a.lastFrame=now;a.seen=now;
  let actor:ActorState|undefined,world:WorldState|undefined;
  if(validActor(m.actor)){actor=m.actor as ActorState;actor.variant=a.variant;actor.name=a.name??a.actor?.name??actor.name;if(actor.ride&&r.locks[actor.ride.key]!==a.id)delete actor.ride;a.actor=actor;}
  if(a.id===r.host&&validWorld(m.world)){const next=m.world as WorldState;world=next;const previous=r.world;r.world=next;
   next.npcLife.forEach((life,i)=>{if(previous&&previous.npcLife[i][0]>0&&life[0]===0){const npc=next.npcs[i];this.log({id:`npc:${i}`,seen:now,visible:true,variant:npc.variant,actor:{...npc,name:npc.name+' кирби'}},'уснул и немного отдохнёт, а потом вернётся к приключениям.');}});
  }
  socket.serializeAttachment(a);
  if(a.actor&&!a.announced){a.announced=true;this.log(a,'зашёл на полянку.');}
  let changed=false;
  for(const e of (Array.isArray(m.events)?m.events.slice(0,16):[]) as Event[]){
   if(!e||typeof e!=='object')continue;
   if(e.type==='festival-star'&&r.festival){if(collectStar(r.festival,a.id,e.index,now))changed=true;}
   else if(e.type==='chat'&&a.actor&&now-(a.lastChat??0)>=700){const text=chatText(e.text);if(text){a.lastChat=now;this.log(a,text,true);}}
   else if(e.type==='emote'&&a.actor&&now-(a.lastEmote??0)>=1500){const text=emoteMessage(e.emote);if(text){a.lastEmote=now;this.log(a,text);this.broadcast({type:'emote',emote:e.emote,id:a.id},socket);}}
   else if(e.type==='fruit'&&Number.isInteger(e.index)&&e.index>=0&&e.index<70&&!r.fruits[e.index]&&a.actor){
    if(e.npc===undefined){r.fruits[e.index]=a.id;changed=true;}
    else if(a.id===r.host&&Number.isInteger(e.npc)&&e.npc>=0&&e.npc<14){r.fruits[e.index]='npc:'+e.npc;changed=true;}
   }else if(e.type==='mill'){r.mill=!r.mill;changed=true;}
   else if(e.type==='star'&&now>=r.starAt&&a.actor){r.starAt=now+120000;a.actor.star=30;this.send(socket,{type:'star'});changed=true;}
   else if(e.type==='lock'&&validResourceKey(e.key)){
    const ok=!r.locks[e.key]||r.locks[e.key]===a.id;if(ok){for(const key of Object.keys(r.locks))if(r.locks[key]===a.id)delete r.locks[key];r.locks[e.key]=a.id;changed=true;}this.send(socket,{type:'lock',key:e.key,ok});
   }else if(e.type==='release'&&r.locks[e.key]===a.id){
    if(e.key.startsWith('bug:')&&validBugLanding(e.bugState)){const i=e.key.split(':')[1];(r.bugLandings??={})[i]=[...e.bugState];if(r.world)r.world.bugs[Number(i)]=[...e.bugState];}
    delete r.locks[e.key];changed=true;
   }
   else if(e.type==='hit'&&a.actor&&now-(a.lastHit??0)>350){a.lastHit=now;this.broadcast({type:'hit',id:a.id,actor:a.actor});}
   else if(e.type==='visible'){a.visible=e.value===true;socket.serializeAttachment(a);if(a.id===r.host&&!a.visible){const next=this.players().find(s=>(s.deserializeAttachment() as Attachment).visible);if(next){r.host=(next.deserializeAttachment() as Attachment).id;changed=true;}}}
  }
  if(a.actor){
   const count=r.fruits.filter(owner=>owner===a.id).length,extra=Math.max(0,count-a.actor.fruits);
   const grown=(size:number)=>Math.min(20,Math.round((size+extra*.1)*1000)/1000);
   if(extra){a.actor.s=grown(a.actor.s);if(a.actor.progress)a.actor.progress.size=grown(a.actor.progress.size);}
   a.actor.fruits=count;
  }
  if(!r.festival&&a.actor&&allTasks(a.actor.achievements)){
   this.startFestival(now,a.actor.name);changed=true;
   void this.ctx.storage.setAlarm(Math.min(now+30000,r.festival!.endsAt));
  }
  if(r.festival&&a.actor&&!r.festival.results){const f=r.festival;if(!f.players[a.id])changed=true;const p=f.players[a.id]??={name:a.actor.name,variant:a.variant,base:0,fruits:0,size:1,bonus:0,collected:[]};p.name=a.actor.name;p.variant=a.variant;p.base=r.fruits.filter(owner=>owner===a.id).length+a.actor.achievements.length*3;p.fruits=r.fruits.filter(owner=>owner===a.id).length;p.size=a.actor.s;}
  if(r.world)for(const [i,landing] of Object.entries(r.bugLandings??{}))if(!r.locks['bug:'+i])r.world.bugs[Number(i)]=reconcileBugLanding(r.world.bugs[Number(i)],landing);
  a.room=a.id===r.host?r:undefined;socket.serializeAttachment(a);
  if(changed)this.changed();else if(world||r.festival)this.persist();
  if(actor||world)this.broadcast({type:'frame',id:a.id,actor,world},socket);
 }
 private remove(socket:WebSocket,status:Visit['status']='left'){return this.ctx.blockConcurrencyWhile(()=>this.removePlayer(socket,status));}
 private async removePlayer(socket:WebSocket,status:Visit['status'],reason='Disconnected'){
  const a=socket.deserializeAttachment() as Attachment;if(a.left)return;a.left=true;socket.serializeAttachment(a);try{socket.close(1000,reason);}catch{}
  if(a.session&&a.session!==this.room?.id)return;
  const seen=Math.max(a.seen,this.ctx.getWebSocketAutoResponseTimestamp(socket)?.getTime()??0);
  this.archive([this.historySnapshot(a,status,status==='lost'?seen:Date.now())]);
  if(a.announced)this.log(a,'покинул полянку.');
  const remaining=this.players().filter(s=>s!==socket);
  if(!remaining.length){this.room=undefined;await this.ctx.storage.deleteAlarm();await this.ctx.storage.deleteAll();return;}
  const r=this.room;if(!r)return;
  if(a.actor){
   const actor=structuredClone(a.actor);actor.s=actor.progress?.size??actor.s;
   actor.p[1]=actor.ride?0:actor.progress?.ground??0;actor.state='Idle';actor.pose=[];delete actor.ride;
   // Only write on departure; ordinary movement continues using the existing frames.
   await this.ctx.storage.put(`player:${r.id}:${playerNameKey(a.name??actor.name)}`,{id:a.id,actor,savedAt:Date.now()} satisfies DepartedPlayer);
  }
  for(const key of Object.keys(r.locks))if(r.locks[key]===a.id)delete r.locks[key];
  if(r.host===a.id)r.host=(remaining[0].deserializeAttachment() as Attachment).id;
  this.broadcast({type:'left',id:a.id},socket);this.broadcast({type:'presence',count:remaining.length},socket);this.changed();
 }
 async webSocketClose(socket:WebSocket,code=1000){try{socket.close(1000,'Disconnected');}catch{}await this.remove(socket,code===1000?'left':'lost');}
 async webSocketError(socket:WebSocket){await this.remove(socket,'lost');}
 async alarm(){
  this.finishFestival();
  const visits:(Visit|undefined)[]=[];
  for(const s of this.players()){
   const a=s.deserializeAttachment() as Attachment;const seen=Math.max(a.seen,this.ctx.getWebSocketAutoResponseTimestamp(s)?.getTime()??0);
   this.accountHistory(a,Math.min(Date.now(),seen));
   if(a.history&&Date.now()-a.history.lastWrite>=60000)visits.push(this.historySnapshot(a,'playing',Math.min(Date.now(),seen)));
   s.serializeAttachment(a);
  }
  this.archive(visits);
  if(this.room?.festival&&Date.now()>=this.room.festival.endsAt+RESULTS_MS){
   for(const s of this.players()){const a=s.deserializeAttachment() as Attachment;a.left=true;s.serializeAttachment(a);s.close(1000,'Festival finished');}this.room=undefined;await this.ctx.storage.deleteAll();await this.ctx.storage.deleteAlarm();return;
  }
for(const s of this.players()){const a=s.deserializeAttachment() as Attachment;const seen=Math.max(a.seen,this.ctx.getWebSocketAutoResponseTimestamp(s)?.getTime()??0);if(Date.now()-seen>75000)await this.remove(s,'lost');}if(this.players().length)await this.ctx.storage.setAlarm(Math.min(Date.now()+30000,this.room?.festival?(Date.now()<this.room.festival.endsAt?this.room.festival.endsAt:this.room.festival.endsAt+RESULTS_MS):Infinity));}
}
export default {async fetch(request,env):Promise<Response>{
 const history=await historyRoutes(request,env);if(history)return history;
 const path=new URL(request.url).pathname,headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 if(path==='/'||path==='/health')return Response.json({status:'ok',protocolVersion:PROTOCOL});
 if(path==='/players'||path==='/room'){const info=await env.ROOMS.getByName(ROOM_NAME).info();return Response.json(path==='/players'?{players:info.players}:info,{headers});}
 if(path==='/ws')return env.ROOMS.getByName(ROOM_NAME).fetch(request);
 return new Response('Not found',{status:404});
}} satisfies ExportedHandler<Env>;
