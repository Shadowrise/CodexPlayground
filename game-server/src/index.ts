import {validBugLanding,reconcileBugLanding} from '../../kirby-game/src/firefly-landing';
import {allTasks,createStarfall,collectStar,finishStarfall,CELEBRATE_MS,RESULTS_MS} from '../../kirby-game/src/starfall';
import {chatText,emoteMessage,type LogEntry} from '../../kirby-game/src/world-log';
import { DurableObject } from 'cloudflare:workers';
import {PROTOCOL,BUILD,validActor,validWorld,validResourceKey,type ActorState,type WorldState,type RoomState,type Event} from '../../kirby-game/src/network-protocol';
const MAX_PLAYERS=14,ROOM_NAME='main';
type Attachment={id:string;seen:number;visible:boolean;variant:number;actor?:ActorState;room?:RoomState;lastHit?:number;announced?:boolean;lastChat?:number;lastEmote?:number;left?:boolean;lastFrame?:number;window?:number;count?:number};
export class GameRoom extends DurableObject<Env>{
 private room?:RoomState;
 constructor(ctx:DurableObjectState,env:Env){super(ctx,env);ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));for(const s of this.players()){const a=s.deserializeAttachment() as Attachment; if(a?.room)this.room=a.room;}}
 private players(){return this.ctx.getWebSockets().filter(s=>s.readyState===WebSocket.OPEN);}
 info(){const players=this.players().length;return {room:ROOM_NAME,players,capacity:MAX_PLAYERS,full:players>=MAX_PLAYERS,occupiedVariants:this.players().map(s=>(s.deserializeAttachment() as Attachment).variant),protocolVersion:PROTOCOL};}
 private send(s:WebSocket,v:unknown){try{s.send(JSON.stringify(v));}catch{}}
 private broadcast(v:unknown,except?:WebSocket){for(const s of this.players())if(s!==except)this.send(s,v);}
 private persist(){if(!this.room)return;for(const s of this.players()){const a=s.deserializeAttachment() as Attachment; if(a.id===this.room.host){a.room=this.room;s.serializeAttachment(a);}else if(a.room){delete a.room;s.serializeAttachment(a);}}}
 private log(a:Attachment,text:string,chat=false){if(!this.room||!a.actor)return;const entry:LogEntry={id:crypto.randomUUID(),name:a.actor.name,variant:a.variant,text,chat};this.room.log=[...(this.room.log??[]),entry].slice(-10);this.broadcast({type:'log',entry});this.persist();}
 private finishFestival(now=Date.now()){
  const f=this.room?.festival;if(!f)return;
  if(!f.results&&now>=f.endsAt&&this.room?.world){const npcs=this.room.world.npcs;f.players.npc={name:'Другие кирби',variant:1,base:npcs.reduce((sum,n)=>sum+n.fruits+n.achievements.length*3,0),fruits:0,size:1,bonus:0,collected:[]};}
  if(finishStarfall(f,now))this.changed();
 }
 private changed(){this.persist();this.broadcast({type:'room',room:this.room});}
 async fetch(request:Request){
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  const url=new URL(request.url);if(url.searchParams.get('build')!==BUILD)return new Response('Refresh game client',{status:409});
  if(this.players().length>=MAX_PLAYERS)return Response.json({error:'ROOM_FULL'},{status:503});
  if(this.room?.festival&&Date.now()>=this.room.festival.endsAt&&this.players().length)return new Response('Celebration finished. Try again shortly.',{status:409});
  const variant=Number(url.searchParams.get('variant'));
  if(!url.searchParams.has('variant')||!Number.isInteger(variant)||variant<0||variant>=15)return new Response('Invalid variant',{status:400});
  if(this.players().some(s=>(s.deserializeAttachment() as Attachment).variant===variant)){const [client,server]=Object.values(new WebSocketPair());server.accept();this.send(server,{type:'error',message:'Этот цвет уже занят. Выбери другого Кирби.'});server.close(1008,'Color occupied');return new Response(null,{status:101,webSocket:client});}
  const id=crypto.randomUUID(),first=this.players().length===0;
  if(first)this.room={id:crypto.randomUUID(),host:id,epoch:Date.now(),fruits:Array(70).fill(null),starAt:0,mill:false,locks:{}};
  const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server);server.serializeAttachment({id,seen:Date.now(),visible:true,variant} satisfies Attachment);
  this.persist();this.send(server,{type:'welcome',protocolVersion:PROTOCOL,playerId:id,room:this.room,players:this.players().map(s=>{const a=s.deserializeAttachment() as Attachment;return {id:a.id,actor:a.actor};})});
  this.broadcast({type:'presence',count:this.players().length});
  if(first)await this.ctx.storage.setAlarm(Date.now()+30000);
  return new Response(null,{status:101,webSocket:client});
 }
 webSocketMessage(socket:WebSocket,message:string|ArrayBuffer){
  if(typeof message!=='string'||message.length>22000){socket.close(1009,'Message too large');return;}
  let m:any;try{m=JSON.parse(message);}catch{socket.close(1008,'Invalid JSON');return;}
  const a=socket.deserializeAttachment() as Attachment,r=this.room;if(!r||m?.type!=='frame')return;
  const now=Date.now();this.finishFestival(now);if(r.festival?.results)return;
  if(now-(a.window??0)>1000){a.window=now;a.count=0;}a.count=(a.count??0)+1;if(a.count>30){socket.close(1008,'Message rate exceeded');return;}a.lastFrame=now;a.seen=now;
  let actor:ActorState|undefined,world:WorldState|undefined;
  if(validActor(m.actor)){actor=m.actor as ActorState;actor.variant=a.variant;actor.fruits=r.fruits.filter(owner=>owner===a.id).length;if(actor.ride&&r.locks[actor.ride.key]!==a.id)delete actor.ride;a.actor=actor;}
  if(a.id===r.host&&validWorld(m.world)){world=m.world;r.world=world;}
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
  if(!r.festival&&a.actor&&allTasks(a.actor.achievements)){
   r.festival=createStarfall(now,a.actor.name);changed=true;
   for(const peer of this.players()){const v=peer.deserializeAttachment() as Attachment;if(v.actor)r.festival.players[v.id]={name:v.actor.name,variant:v.variant,base:v.actor.fruits+v.actor.achievements.length*3,fruits:v.actor.fruits,size:v.actor.s,bonus:0,collected:[]};}
   void this.ctx.storage.setAlarm(Math.min(now+30000,r.festival.endsAt));
  }
  if(r.festival&&a.actor&&!r.festival.results){const f=r.festival;if(!f.players[a.id])changed=true;const p=f.players[a.id]??={name:a.actor.name,variant:a.variant,base:0,fruits:0,size:1,bonus:0,collected:[]};p.base=r.fruits.filter(owner=>owner===a.id).length+a.actor.achievements.length*3;p.fruits=r.fruits.filter(owner=>owner===a.id).length;p.size=a.actor.s;}
  if(r.world)for(const [i,landing] of Object.entries(r.bugLandings??{}))if(!r.locks['bug:'+i])r.world.bugs[Number(i)]=reconcileBugLanding(r.world.bugs[Number(i)],landing);
  a.room=a.id===r.host?r:undefined;socket.serializeAttachment(a);
  if(changed)this.changed();else if(world||r.festival)this.persist();
  if(actor||world)this.broadcast({type:'frame',id:a.id,actor,world},socket);
 }
 private async remove(socket:WebSocket){
  const a=socket.deserializeAttachment() as Attachment;if(a.left)return;a.left=true;socket.serializeAttachment(a);if(a.announced)this.log(a,'покинул полянку.');try{socket.close(1000,'Disconnected');}catch{}
  const remaining=this.players().filter(s=>s!==socket);
  if(!remaining.length){this.room=undefined;await this.ctx.storage.deleteAlarm();await this.ctx.storage.deleteAll();return;}
  const r=this.room;if(!r)return;
  for(const key of Object.keys(r.locks))if(r.locks[key]===a.id)delete r.locks[key];
  if(r.host===a.id)r.host=(remaining[0].deserializeAttachment() as Attachment).id;
  this.broadcast({type:'left',id:a.id},socket);this.broadcast({type:'presence',count:remaining.length},socket);this.changed();
 }
 async webSocketClose(socket:WebSocket){await this.remove(socket);}
 async webSocketError(socket:WebSocket){await this.remove(socket);}
 async alarm(){
  this.finishFestival();
  if(this.room?.festival&&Date.now()>=this.room.festival.endsAt+CELEBRATE_MS+RESULTS_MS){
   for(const s of this.players()){const a=s.deserializeAttachment() as Attachment;a.left=true;s.serializeAttachment(a);s.close(1000,'Festival finished');}this.room=undefined;await this.ctx.storage.deleteAll();await this.ctx.storage.deleteAlarm();return;
  }
for(const s of this.players()){const a=s.deserializeAttachment() as Attachment;const seen=Math.max(a.seen,this.ctx.getWebSocketAutoResponseTimestamp(s)?.getTime()??0);if(Date.now()-seen>75000)await this.remove(s);}if(this.players().length)await this.ctx.storage.setAlarm(Math.min(Date.now()+30000,this.room?.festival?(Date.now()<this.room.festival.endsAt?this.room.festival.endsAt:this.room.festival.endsAt+CELEBRATE_MS+RESULTS_MS):Infinity));}
}
export default {async fetch(request,env):Promise<Response>{
 const path=new URL(request.url).pathname,headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 if(path==='/'||path==='/health')return Response.json({status:'ok',protocolVersion:PROTOCOL});
 if(path==='/players'||path==='/room'){const info=await env.ROOMS.getByName(ROOM_NAME).info();return Response.json(path==='/players'?{players:info.players}:info,{headers});}
 if(path==='/ws')return env.ROOMS.getByName(ROOM_NAME).fetch(request);
 return new Response('Not found',{status:404});
}} satisfies ExportedHandler<Env>;
