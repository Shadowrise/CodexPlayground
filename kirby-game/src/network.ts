import {CENTIPEDE_TIMES,CENTIPEDE_EMPTY_MS} from './centipede-event';
import {hasChasers,applyChaseSnapshot,CHASERS} from './centipede-chasers';
import {PlayerSnapshots} from './player-snapshots';
import type {PigeonCheckpoint} from './pigeon-flock-state';
import {emoteMessage} from './world-log';
import {validFlowerIndex} from './musical-flower-site';
import {validNumberDigit} from './number-garden-site';
import {numberDeadline} from './number-garden-game';
import {flowerDeadline} from './musical-flower-game';
import {newSealProgress,normalizeSealProgress} from './meta-knight-seal-state';
import type {PlayerEmote} from './emotes';
import type {LogEntry} from './world-log';
import type {DeviceInfo} from './history-types';
import {BUILD,PROTOCOL,type ActorState,type WorldState,type RoomState,type Event,type ServerMessage} from './network-protocol';
export class NetworkSession{
 log:LogEntry[]=[];
 readonly actorSnapshots=new Map<string,PlayerSnapshots>();
 private receiveActor(id:string,actor:ActorState){this.actors.set(id,actor);let buffer=this.actorSnapshots.get(id);if(!buffer){buffer=new PlayerSnapshots();this.actorSnapshots.set(id,buffer);}buffer.push(performance.now(),actor);}
 private clockOffset=0;
 get serverNow(){return Date.now()+this.clockOffset;}
 id='';peerCount=1;room!:RoomState;resume?:ActorState;actors=new Map<string,ActorState>();world?:WorldState;revision=0;
 onEmote?:(emote:PlayerEmote,id:string)=>void;
 onPigeonsCleared?:()=>void;
 onFlowerNote?:(index:number)=>void;
 onFlowerComplete?:()=>void;
 onKnightVictory?:()=>void;
 onNumberNote?:(digit:number)=>void;onNumberComplete?:()=>void;
 private numberStartPending=false;private numberStep='';
 get numberStarting(){return this.numberStartPending;}
 onCentipedeProgress?:(points:number,completed:boolean)=>void;onCentipedeBump?:(direction:number[])=>void;
 onHit?:(actor:ActorState,target:string)=>void;onStar?:()=>void;onResize?:(size:number)=>void;onDisconnect?:(reason:string)=>void;
 private socket?:WebSocket;private events:Event[]=[];private elapsed=0;private worldElapsed=0;private lastActor='';private heartbeat?:ReturnType<typeof setInterval>;
 private locks=new Map<string,(ok:boolean)=>void>();private closed=false;
 private requestedFestivalEnd?:number;private centipedeStep='';private chaseElapsed=0;
 private centipedeStartPending=false;
 private flowerStartPending=false;private flowerStep='';
 get flowerStarting(){return this.flowerStartPending;}
 get centipedeStarting(){return this.centipedeStartPending;}
 finishFestivalIfDue(){
  const f=this.room?.festival;
  if(!f||f.results||this.serverNow<f.endsAt||this.requestedFestivalEnd===f.endsAt||this.socket?.readyState!==WebSocket.OPEN)return;
  // One final frame wakes the room even after movement/world updates have stopped.
  this.socket.send(JSON.stringify({type:'frame',events:this.events.splice(0,16)}));
  this.requestedFestivalEnd=f.endsAt;
 }
 get host(){return this.room?.host===this.id;}
 private readRoom(room:RoomState){return {...room,sealProgress:normalizeSealProgress(room.sealProgress)??newSealProgress()};}
 private receivePigeons(checkpoints?:PigeonCheckpoint[]){
  if(!checkpoints)return;
  const flock=new Map(this.room.pigeonFlock?.map(b=>[b.id,b]));
  for(const c of checkpoints){const bird=flock.get(c.id);if(bird)bird.checkpoint=c;}
 }
 async connect(base:string,variant:number,name:string,device?:DeviceInfo){return new Promise<void>((resolve,reject)=>{
  const url=new URL(base);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/ws';url.searchParams.set('build',BUILD);url.searchParams.set('variant',String(variant));url.searchParams.set('name',name);
  if(device)url.searchParams.set('device',JSON.stringify(device));
  const s=this.socket=new WebSocket(url),timeout=setTimeout(()=>{s.close();reject(Error('Сервер не ответил. Попробуй подключиться ещё раз.'));},12000);
  s.onmessage=e=>{if(this.closed||e.data==='pong')return;let m:ServerMessage;try{m=JSON.parse(e.data);}catch{return;}
   if(m.type==='welcome'){if(Number.isFinite(m.serverNow))this.clockOffset=m.serverNow!-Date.now();if(m.protocolVersion!==PROTOCOL){s.close();reject(Error('Нужно обновить сервер и страницу игры.'));return;}clearTimeout(timeout);this.id=m.playerId;this.resume=m.resume;this.peerCount=m.players.length;this.room=this.readRoom(m.room);this.log=m.room.log??[];this.world=m.room.world;this.revision++;for(const p of m.players)if(p.actor&&p.id!==this.id)this.receiveActor(p.id,p.actor);this.heartbeat=setInterval(()=>{if(s.readyState===WebSocket.OPEN)s.send('ping');},15000);resolve();}
   else if(m.type==='number-game'){this.room.numberGame=m.game;this.numberStartPending=false;}
   else if(m.type==='knight-victory')this.onKnightVictory?.();
   else if(m.type==='number-complete')this.onNumberComplete?.();
   else if(m.type==='number-note'&&m.id!==this.id&&validNumberDigit(m.digit))this.onNumberNote?.(m.digit);
   else if(m.type==='flower-game'){this.room.flowerGame=m.game;this.flowerStartPending=false;}
   else if(m.type==='flower-complete')this.onFlowerComplete?.();
   else if(m.type==='centipede-progress')this.onCentipedeProgress?.(m.points,m.completed);
   else if(m.type==='centipede-bump')this.onCentipedeBump?.(m.direction);
   else if(m.type==='emote'&&m.id!==this.id&&emoteMessage(m.emote))this.onEmote?.(m.emote as PlayerEmote,m.id);
   else if(m.type==='flower-note'&&m.id!==this.id&&validFlowerIndex(m.index))this.onFlowerNote?.(m.index);
   else if(m.type==='log'){this.log=[...this.log,m.entry].slice(-10);}
   else if(m.type==='presence'){if(m.count>this.peerCount){this.worldElapsed=2;this.lastActor='';}this.peerCount=m.count;}
   else if(m.type==='error'){clearTimeout(timeout);if(this.id){this.close();this.onDisconnect?.(m.message);}reject(Error(m.message));}
   else if(m.type==='frame'){if(m.actor&&m.id!==this.id)this.receiveActor(m.id,m.actor);if(m.world){this.world=m.world;this.revision++;}this.receivePigeons(m.pigeons);if(m.chasers)applyChaseSnapshot(this.room.centipede,m.chasers);}
   else if(m.type==='room'){const changed=this.room.host!==m.room.host;this.room=this.readRoom(m.room);if(!this.room.pigeonFlock?.length)this.onPigeonsCleared?.();this.centipedeStartPending=false;if(changed&&m.room.world){this.world=m.room.world;this.revision++;}}
   else if(m.type==='left'){this.actors.delete(m.id);this.actorSnapshots.delete(m.id);}
   else if(m.type==='hit')this.onHit?.(m.actor,m.target);
   else if(m.type==='star')this.onStar?.();
   else if(m.type==='resize')this.onResize?.(m.size);
   else if(m.type==='lock'){this.locks.get(m.key)?.(m.ok);this.locks.delete(m.key);}
  };
  s.onerror=()=>{clearTimeout(timeout);reject(Error('Не удалось подключиться: сервер недоступен, обновляется или комната заполнена.'));};
  s.onclose=e=>{clearTimeout(timeout);clearInterval(this.heartbeat);for(const callback of this.locks.values())callback(false);this.locks.clear();if(!this.closed)this.onDisconnect?.(e.reason==='Admin recreated room'?'Ветерок пересоздал комнату. Вернись в меню и подключись к новой игре.':e.reason==='Admin disconnected'?'Ветерок отключил тебя от комнаты.':'Соединение потеряно. Вернись в меню и подключись снова.');reject(Error('Соединение закрыто.'));};
 });}
 event(event:Event){
  if(event.type==='seal'&&(this.room?.sealProgress?.collected[event.id]||this.events.some(queued=>queued.type==='seal'&&queued.id===event.id)))return;
  if(event.type==='number-start'){if(this.room?.festival||this.room?.numberGame||this.numberStartPending)return;this.numberStartPending=true;}
  if(event.type==='flower-start'||event.type==='flower-replay'){
   if(this.room?.festival||this.flowerStartPending||(event.type==='flower-start'?!!this.room?.flowerGame:this.room?.flowerGame?.stage!=='repeat'))return;
   this.flowerStartPending=true;
  }
  if(event.type==='centipede-start'){if(this.room?.centipede||this.room?.festival||this.centipedeStartPending)return;this.centipedeStartPending=true;}
  this.events.push(event);if(event.type==='visible')setTimeout(()=>{if(this.socket?.readyState===WebSocket.OPEN&&this.events.length)this.socket.send(JSON.stringify({type:'frame',events:this.events.splice(0,16)}));},150);
 }
 acquire(key:string){return new Promise<boolean>(resolve=>{if(this.locks.has(key)){resolve(false);return;}const timer=setTimeout(()=>{this.locks.delete(key);this.event({type:'release',key});resolve(false);},5000);this.locks.set(key,ok=>{clearTimeout(timer);resolve(ok);});this.event({type:'lock',key});});}
 tick(dt:number,actor:ActorState,world:()=>WorldState,pigeons?:()=>PigeonCheckpoint[]){
  this.elapsed+=dt;this.worldElapsed+=dt;this.chaseElapsed+=dt;if(this.elapsed<.1||this.socket?.readyState!==WebSocket.OPEN||this.socket.bufferedAmount>64000)return;
  this.elapsed=0;const boss=this.room?.centipede,deadline=boss?.emptySince===undefined?boss?boss.stageAt+CENTIPEDE_TIMES[boss.stage]:Infinity:boss.emptySince+CENTIPEDE_EMPTY_MS;
  if(this.host&&boss&&this.serverNow>=deadline){const key=`${boss.startedAt}:${boss.stageAt}:${boss.stage}:${boss.emptySince}`;if(this.centipedeStep!==key){this.centipedeStep=key;this.events.push({type:'centipede-step'});}}
  const flowers=this.room?.flowerGame;
  const numbers=this.room?.numberGame;
  if(this.host&&numbers&&this.serverNow>=numberDeadline(numbers)){const key=`${numbers.startedAt}:${numbers.stageAt}:${numbers.stage}:${numbers.emptySince}`;if(this.numberStep!==key){this.numberStep=key;this.events.push({type:'number-step'});}}
  if(this.host&&flowers&&this.serverNow>=flowerDeadline(flowers)){const key=`${flowers.startedAt}:${flowers.stageAt}:${flowers.stage}:${flowers.emptySince}`;if(this.flowerStep!==key){this.flowerStep=key;this.events.push({type:'flower-step'});}}
  const serialized=JSON.stringify(actor),changed=serialized!==this.lastActor;
  // Solo rooms only need recovery checkpoints; keep the full multiplayer cadence.
  const sendWorld=this.host&&this.worldElapsed>=(this.peerCount>1?.2:2);
  // Only the host wakes an idle pursuit; stationary guests need no extra
  // messages. Multiplayer already supplies the host world at this cadence.
  const sendChase=this.host&&hasChasers(boss)&&this.chaseElapsed>=CHASERS.snapshotMs/1000;
  const sendPigeons=this.host&&!!this.room.pigeonFlock?.length&&!!pigeons;
  if(this.peerCount===1&&!sendWorld&&!this.events.length&&!sendChase&&!sendPigeons)return;
  if(!changed&&!sendWorld&&!this.events.length&&!sendChase&&!sendPigeons)return;
  this.socket.send(JSON.stringify({type:'frame',actor:changed||this.events.length||sendChase?actor:undefined,world:sendWorld?world():undefined,pigeons:sendPigeons?pigeons!():undefined,events:this.events.splice(0,16)}));
  this.lastActor=serialized;this.chaseElapsed=0;if(sendWorld)this.worldElapsed=0;
 }
 close(){this.closed=true;clearInterval(this.heartbeat);for(const callback of this.locks.values())callback(false);this.locks.clear();this.events=[];this.socket?.close(1000,'Left game');}
}
