import {BUILD,PROTOCOL,type ActorState,type WorldState,type RoomState,type Event,type ServerMessage} from './network-protocol';
export class NetworkSession{
 id='';peerCount=1;room!:RoomState;actors=new Map<string,ActorState>();world?:WorldState;revision=0;
 onHit?:(actor:ActorState)=>void;onStar?:()=>void;onDisconnect?:(reason:string)=>void;
 private socket?:WebSocket;private events:Event[]=[];private elapsed=0;private worldElapsed=0;private lastActor='';private heartbeat?:ReturnType<typeof setInterval>;
 private locks=new Map<string,(ok:boolean)=>void>();private closed=false;
 get host(){return this.room?.host===this.id;}
 async connect(base:string,variant=0){return new Promise<void>((resolve,reject)=>{
  const url=new URL(base);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/ws';url.searchParams.set('build',BUILD);url.searchParams.set('variant',String(variant));
  const s=this.socket=new WebSocket(url),timeout=setTimeout(()=>{s.close();reject(Error('Сервер не ответил. Попробуй подключиться ещё раз.'));},12000);
  s.onmessage=e=>{if(e.data==='pong')return;let m:ServerMessage;try{m=JSON.parse(e.data);}catch{return;}
   if(m.type==='welcome'){if(m.protocolVersion!==PROTOCOL){s.close();reject(Error('Нужно обновить сервер и страницу игры.'));return;}clearTimeout(timeout);this.id=m.playerId;this.peerCount=m.players.length;this.room=m.room;this.world=m.room.world;this.revision++;for(const p of m.players)if(p.actor&&p.id!==this.id)this.actors.set(p.id,p.actor);this.heartbeat=setInterval(()=>{if(s.readyState===WebSocket.OPEN)s.send('ping');},15000);resolve();}
   else if(m.type==='presence'){if(m.count>this.peerCount){this.worldElapsed=2;this.lastActor='';}this.peerCount=m.count;}
   else if(m.type==='error'){clearTimeout(timeout);reject(Error(m.message));}
   else if(m.type==='frame'){if(m.actor&&m.id!==this.id)this.actors.set(m.id,m.actor);if(m.world){this.world=m.world;this.revision++;}}
   else if(m.type==='room'){const changed=this.room.host!==m.room.host;this.room=m.room;if(changed&&m.room.world){this.world=m.room.world;this.revision++;}}
   else if(m.type==='left')this.actors.delete(m.id);
   else if(m.type==='hit'&&this.host)this.onHit?.(m.actor);
   else if(m.type==='star')this.onStar?.();
   else if(m.type==='lock'){this.locks.get(m.key)?.(m.ok);this.locks.delete(m.key);}
  };
  s.onerror=()=>{clearTimeout(timeout);reject(Error('Не удалось подключиться: сервер недоступен, обновляется или комната заполнена.'));};
  s.onclose=()=>{clearTimeout(timeout);clearInterval(this.heartbeat);for(const callback of this.locks.values())callback(false);this.locks.clear();if(!this.closed)this.onDisconnect?.('Соединение потеряно. Вернись в меню и подключись снова.');reject(Error('Соединение закрыто.'));};
 });}
 event(event:Event){this.events.push(event);if(event.type==='visible')setTimeout(()=>{if(this.socket?.readyState===WebSocket.OPEN&&this.events.length)this.socket.send(JSON.stringify({type:'frame',events:this.events.splice(0,16)}));},150);}
 acquire(key:string){return new Promise<boolean>(resolve=>{if(this.locks.has(key)){resolve(false);return;}const timer=setTimeout(()=>{this.locks.delete(key);this.event({type:'release',key});resolve(false);},5000);this.locks.set(key,ok=>{clearTimeout(timer);resolve(ok);});this.event({type:'lock',key});});}
 tick(dt:number,actor:ActorState,world:()=>WorldState){
  this.elapsed+=dt;this.worldElapsed+=dt;if(this.elapsed<.1||this.socket?.readyState!==WebSocket.OPEN||this.socket.bufferedAmount>64000)return;
  this.elapsed=0;const serialized=JSON.stringify(actor),changed=serialized!==this.lastActor;
  // Solo rooms only need recovery checkpoints; keep the full multiplayer cadence.
  const sendWorld=this.host&&this.worldElapsed>=(this.peerCount>1?.2:2);
  if(this.peerCount===1&&!sendWorld&&!this.events.length)return;
  if(!changed&&!sendWorld&&!this.events.length)return;
  this.socket.send(JSON.stringify({type:'frame',actor:changed||this.events.length?actor:undefined,world:sendWorld?world():undefined,events:this.events.splice(0,16)}));
  this.lastActor=serialized;if(sendWorld)this.worldElapsed=0;
 }
 close(){this.closed=true;clearInterval(this.heartbeat);this.socket?.close(1000,'Left game');}
}
