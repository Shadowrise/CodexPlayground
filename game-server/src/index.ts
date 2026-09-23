import { DurableObject } from 'cloudflare:workers';
import {PROTOCOL,BUILD,validActor,validWorld,validResourceKey,type ActorState,type WorldState,type RoomState,type Event} from '../../kirby-game/src/network-protocol';
const MAX_PLAYERS=14,ROOM_NAME='main';
type Attachment={id:string;seen:number;visible:boolean;actor?:ActorState;room?:RoomState;lastHit?:number;lastFrame?:number;window?:number;count?:number};
export class GameRoom extends DurableObject<Env>{
 private room?:RoomState;
 constructor(ctx:DurableObjectState,env:Env){super(ctx,env);ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));for(const s of this.players()){const a=s.deserializeAttachment() as Attachment; if(a?.room)this.room=a.room;}}
 private players(){return this.ctx.getWebSockets().filter(s=>s.readyState===WebSocket.OPEN);}
 info(){const players=this.players().length;return {room:ROOM_NAME,players,capacity:MAX_PLAYERS,full:players>=MAX_PLAYERS,protocolVersion:PROTOCOL};}
 private send(s:WebSocket,v:unknown){try{s.send(JSON.stringify(v));}catch{}}
 private broadcast(v:unknown,except?:WebSocket){for(const s of this.players())if(s!==except)this.send(s,v);}
 private persist(){if(!this.room)return;for(const s of this.players()){const a=s.deserializeAttachment() as Attachment; if(a.id===this.room.host){a.room=this.room;s.serializeAttachment(a);}else if(a.room){delete a.room;s.serializeAttachment(a);}}}
 private changed(){this.persist();this.broadcast({type:'room',room:this.room});}
 async fetch(request:Request){
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  const url=new URL(request.url);if(url.searchParams.get('build')!==BUILD)return new Response('Refresh game client',{status:409});
  if(this.players().length>=MAX_PLAYERS)return Response.json({error:'ROOM_FULL'},{status:503});
  const id=crypto.randomUUID(),first=this.players().length===0;
  if(first)this.room={id:crypto.randomUUID(),host:id,epoch:Date.now(),fruits:Array(70).fill(null),starAt:0,mill:false,locks:{}};
  const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server);server.serializeAttachment({id,seen:Date.now(),visible:true} satisfies Attachment);
  this.persist();this.send(server,{type:'welcome',protocolVersion:PROTOCOL,playerId:id,room:this.room,players:this.players().map(s=>{const a=s.deserializeAttachment() as Attachment;return {id:a.id,actor:a.actor};})});
  if(first)await this.ctx.storage.setAlarm(Date.now()+30000);
  return new Response(null,{status:101,webSocket:client});
 }
 webSocketMessage(socket:WebSocket,message:string|ArrayBuffer){
  if(typeof message!=='string'||message.length>22000){socket.close(1009,'Message too large');return;}
  let m:any;try{m=JSON.parse(message);}catch{socket.close(1008,'Invalid JSON');return;}
  const a=socket.deserializeAttachment() as Attachment,r=this.room;if(!r||m?.type!=='frame')return;
  const now=Date.now();if(now-(a.window??0)>1000){a.window=now;a.count=0;}a.count=(a.count??0)+1;if(a.count>30){socket.close(1008,'Message rate exceeded');return;}a.lastFrame=now;a.seen=now;
  let actor:ActorState|undefined,world:WorldState|undefined;
  if(validActor(m.actor)){actor=m.actor as ActorState;actor.fruits=r.fruits.filter(owner=>owner===a.id).length;if(actor.ride&&r.locks[actor.ride.key]!==a.id)delete actor.ride;a.actor=actor;}
  if(a.id===r.host&&validWorld(m.world)){world=m.world;r.world=world;}
  socket.serializeAttachment(a);
  let changed=false;
  for(const e of (Array.isArray(m.events)?m.events.slice(0,16):[]) as Event[]){
   if(!e||typeof e!=='object')continue;
   if(e.type==='fruit'&&Number.isInteger(e.index)&&e.index>=0&&e.index<70&&!r.fruits[e.index]&&a.actor){
    if(e.npc===undefined){r.fruits[e.index]=a.id;changed=true;}
    else if(a.id===r.host&&Number.isInteger(e.npc)&&e.npc>=0&&e.npc<14){r.fruits[e.index]='npc:'+e.npc;changed=true;}
   }else if(e.type==='mill'){r.mill=!r.mill;changed=true;}
   else if(e.type==='star'&&now>=r.starAt&&a.actor){r.starAt=now+120000;a.actor.star=30;this.send(socket,{type:'star'});changed=true;}
   else if(e.type==='lock'&&validResourceKey(e.key)){
    const ok=!r.locks[e.key]||r.locks[e.key]===a.id;if(ok){for(const key of Object.keys(r.locks))if(r.locks[key]===a.id)delete r.locks[key];r.locks[e.key]=a.id;changed=true;}this.send(socket,{type:'lock',key:e.key,ok});
   }else if(e.type==='release'&&r.locks[e.key]===a.id){delete r.locks[e.key];changed=true;}
   else if(e.type==='hit'&&a.actor&&now-(a.lastHit??0)>350){a.lastHit=now;this.broadcast({type:'hit',id:a.id,actor:a.actor});}
   else if(e.type==='visible'){a.visible=e.value===true;socket.serializeAttachment(a);if(a.id===r.host&&!a.visible){const next=this.players().find(s=>(s.deserializeAttachment() as Attachment).visible);if(next){r.host=(next.deserializeAttachment() as Attachment).id;changed=true;}}}
  }
  a.room=a.id===r.host?r:undefined;socket.serializeAttachment(a);
  if(changed)this.changed();else if(world)this.persist();
  if(actor||world)this.broadcast({type:'frame',id:a.id,actor,world},socket);
 }
 private async remove(socket:WebSocket){
  const a=socket.deserializeAttachment() as Attachment;try{socket.close(1000,'Disconnected');}catch{}
  const remaining=this.players().filter(s=>s!==socket);
  if(!remaining.length){this.room=undefined;await this.ctx.storage.deleteAlarm();await this.ctx.storage.deleteAll();return;}
  const r=this.room;if(!r)return;
  for(const key of Object.keys(r.locks))if(r.locks[key]===a.id)delete r.locks[key];
  if(r.host===a.id)r.host=(remaining[0].deserializeAttachment() as Attachment).id;
  this.broadcast({type:'left',id:a.id},socket);this.changed();
 }
 async webSocketClose(socket:WebSocket){await this.remove(socket);}
 async webSocketError(socket:WebSocket){await this.remove(socket);}
 async alarm(){for(const s of this.players()){const a=s.deserializeAttachment() as Attachment;const seen=Math.max(a.seen,this.ctx.getWebSocketAutoResponseTimestamp(s)?.getTime()??0);if(Date.now()-seen>75000)await this.remove(s);}if(this.players().length)await this.ctx.storage.setAlarm(Date.now()+30000);}
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
