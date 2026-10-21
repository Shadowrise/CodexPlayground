import {startKnightBattle,advanceKnightBattle,knightAttack,cancelKnightBattle,knightArenaSide,type KnightActor,type KnightBattle} from '../../kirby-game/src/meta-knight-battle';
import {constrainKnightShield} from '../../kirby-game/src/meta-knight-shield';
import {META_KNIGHT_ARENA,constrainMetaKnightArena} from '../../kirby-game/src/meta-knight-arena-site';
import {metaKnightVictoryLog,metaKnightSealLogs} from '../../kirby-game/src/world-log';
import {startCentipede,advanceCentipede,pushCentipede,bumpCentipede,completedCentipede,CENTIPEDE_EMPTY_MS,type CentipedeActor,type CentipedeEvent} from '../../kirby-game/src/centipede-event';
import {advanceChasers,pushChaser,bumpChaser,chaseSnapshot,hasChasers,CHASERS} from '../../kirby-game/src/centipede-chasers';
import {newMillQuest,advanceMill,applyMill,millPushTarget,millWorking,millCarrying,type MillAction,type MillActor} from '../../kirby-game/src/mill-quest';
import {newBread,applyBread,advanceBread,grantBread,holdsBread,breadOffering,normalizeBread,type BreadAction} from '../../kirby-game/src/bread-state';
import {newSealProgress,normalizeSealProgress,collectSeal,type SealActor} from '../../kirby-game/src/meta-knight-seal-state';
import {KIRBY_VARIANTS} from '../../kirby-game/src/variant-palette';
import {WILD_PIGEONS,isWildPigeonId,pigeonFriendAchievement} from '../../kirby-game/src/wild-pigeons';
import {canPressNumber,NUMBER_PRESS_MS} from '../../kirby-game/src/number-garden-site';
import {startNumberGame,advanceNumberGame,pressNumberGame,validNumberGame,NUMBER_EMPTY_MS,type NumberGame} from '../../kirby-game/src/number-garden-game';
import {canPlayFlower,FLOWER_NOTE_COOLDOWN_MS} from '../../kirby-game/src/musical-flower-site';
import {startFlowerGame,replayFlowerGame,advanceFlowerGame,playFlowerGame,validFlowerGame,FLOWER_EMPTY_MS,type FlowerGame,type FlowerActor} from '../../kirby-game/src/musical-flower-game';
import {pushTarget,PUSH_COOLDOWN_MS} from '../../kirby-game/src/push-target';
import {validBugLanding,reconcileBugLanding} from '../../kirby-game/src/firefly-landing';
import {normalizePlayerName,playerNameKey} from '../../kirby-game/src/player-name';
import {sanitizeDevice,deviceInfo,type DeviceInfo} from '../../kirby-game/src/history-types';
import {SCORE_ACTIONS,achievementPoints} from '../../kirby-game/src/score';
import {isPrankKind,makePrank,PRANKS} from '../../kirby-game/src/pranks';
import {PIGEON_FLOCK_BATCH,validPigeonCheckpoint,type PigeonCheckpoint,type SummonedPigeon} from '../../kirby-game/src/pigeon-flock-state';
import {historyRoutes} from './admin';
import {initRoomChat,writeRoomChat,roomChatPage,type ChatCursor} from './room-chat';
import {initHistory,writeVisits,historyPage,type Visit,type HistoryFilter} from './history-store';
import {allTasks,createStarfall,collectStar,finishStarfall,COLLECT_MS,RESULTS_MS} from '../../kirby-game/src/starfall';
import {chatText,emoteMessage,pidgieScareLog,pidgieInterestLog,pidgieFriendLog,type LogEntry} from '../../kirby-game/src/world-log';
import {beginPidgieFeeding} from '../../kirby-game/src/pidgie-state';
import { DurableObject } from 'cloudflare:workers';
import {PROTOCOL,BUILD,validActor,validWorld,validResourceKey,type ActorState,type WorldState,type RoomState,type Event} from '../../kirby-game/src/network-protocol';
import {stepBodySize} from '../../kirby-game/src/body-size';
import {FruitSpeedBoost} from '../../kirby-game/src/fruit-speed';
const MAX_PLAYERS=14,ROOM_NAME='main';
type OnlineVisit={id:string;startedAt:number;activeMs:number;tick:number;lastWrite:number;startScore:number;seq:number;device:DeviceInfo;finished?:boolean};
type Attachment={id:string;session?:string;name?:string;seen:number;visible:boolean;variant:number;actor?:ActorState;room?:RoomState;adminSize?:number;lastHit?:number;announced?:boolean;lastChat?:number;lastEmote?:number;lastFlower?:number;lastNumber?:number;left?:boolean;lastFrame?:number;window?:number;count?:number;history?:OnlineVisit};
type DepartedPlayer={id:string;actor:ActorState;savedAt:number};
/** Permanent archive: deliberately separate from the disposable game room. */
export class HistoryStore extends DurableObject<Env>{
 constructor(ctx:DurableObjectState,env:Env){super(ctx,env);initHistory(ctx.storage.sql);}
 write(visits:Visit[]){this.ctx.storage.transactionSync(()=>writeVisits(this.ctx.storage.sql,visits));}
 list(filter:HistoryFilter){return historyPage(this.ctx.storage.sql,filter);}
}
export class GameRoom extends DurableObject<Env>{
 private room?:RoomState;private knightSaved=0;private bossSaved='';private flowerSaved='null';private numberSaved='null';private chaseSentAt=0;private chatRoom?:string;
 constructor(ctx:DurableObjectState,env:Env){
  super(ctx,env);ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
  // Read legacy host checkpoints once; new sockets only retain player data.
  for(const s of this.players()){const a=s.deserializeAttachment() as Attachment;if(a?.room)this.room=a.room;}
  this.restoreSeals();
  ctx.blockConcurrencyWhile(async()=>{
   const [saved,battle,event,flowers,numbers]=await Promise.all([ctx.storage.get<RoomState>('room-state'),ctx.storage.get<KnightBattle>('knight-battle'),ctx.storage.get<CentipedeEvent>('centipede-event'),ctx.storage.get<FlowerGame>('flower-game'),ctx.storage.get<NumberGame>('number-game')]);
   if(saved&&(!this.room||this.room.id===saved.id)&&this.players().some(s=>{const a=s.deserializeAttachment() as Attachment;return !a.session||a.session===saved.id;}))this.room=saved;
   this.restoreSeals();
   if(this.room&&ctx.storage.list){const birds=await ctx.storage.list<SummonedPigeon>({prefix:`pigeon:${this.room.id}:`});if(birds.size)this.room.pigeonFlock=Array.from(birds.values()).sort((a,b)=>a.order-b.order);}
   if(this.room&&battle){this.room.knightBattle=battle;this.knightSaved=battle.revision;}
   if(this.room&&event){this.room.centipede=event;this.bossSaved=JSON.stringify({...event,chasers:undefined});}
   if(this.room&&validFlowerGame(flowers)){this.room.flowerGame=flowers;this.flowerSaved=JSON.stringify(flowers);}
   if(this.room&&validNumberGame(numbers)){this.room.numberGame=numbers;this.numberSaved=JSON.stringify(numbers);}
   if(this.room)this.persist();
  });
 }
 private restoreSeals(){if(this.room){this.room.sealProgress=normalizeSealProgress(this.room.sealProgress)??newSealProgress();this.room.bread=normalizeBread(this.room.bread);if(this.room.millQuest&&this.room.millQuest.kneadStep===undefined)this.room.millQuest=this.room.millQuest.stage==='running'?newMillQuest():{...newMillQuest(),...this.room.millQuest};}}
 private players(){return this.ctx.getWebSockets().filter(s=>s.readyState===WebSocket.OPEN&&!(s.deserializeAttachment() as Attachment)?.left);}
 info(){const players=this.players().length;return {room:ROOM_NAME,players,capacity:MAX_PLAYERS,full:players>=MAX_PLAYERS,occupiedVariants:this.players().map(s=>(s.deserializeAttachment() as Attachment).variant),protocolVersion:PROTOCOL};}
 private newRoom(host=''):RoomState{return {id:crypto.randomUUID(),host,epoch:Date.now(),dayPhase:Math.random(),fruits:Array(70).fill(null),starAt:0,mill:false,millQuest:newMillQuest(),bread:newBread(),sealProgress:newSealProgress(),locks:{}};}
 private chatStorage(){
  if(this.room&&this.chatRoom!==this.room.id){initRoomChat(this.ctx.storage.sql,this.room.log);this.chatRoom=this.room.id;}
  return this.ctx.storage.sql;
 }
 adminChat(roomId:string,cursor:ChatCursor={}){return this.ctx.blockConcurrencyWhile(async()=>{
  const room=this.room??await this.ctx.storage.get<RoomState>('prepared-room');
  if(!room||room.id!==roomId)return {ok:false,error:'Комната уже изменилась. Обнови список.'};
  return {ok:true,roomId,entries:[],more:false,...(this.room?roomChatPage(this.chatStorage(),cursor):{})};
 });}
 adminChatMessage(roomId:string,value:unknown){return this.ctx.blockConcurrencyWhile(async()=>{
  if(!this.room||this.room.id!==roomId||!this.players().length)return {ok:false,error:'Активной комнаты уже нет. Обнови список.'};
  const text=chatText(value);if(!text)return {ok:false,error:'Напиши сообщение.'};
  this.logEntry({id:crypto.randomUUID(),name:'Ветерок',variant:-1,text,chat:true});return {ok:true};
 });}
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
 adminPigeon(roomId:string,playerId:string){return this.ctx.blockConcurrencyWhile(async()=>{
  const r=this.room;if(!r||r.id!==roomId)return {ok:false,error:'Комната уже изменилась. Обнови список.'};
  if(r.festival?.results)return {ok:false,error:'Игра уже завершена.'};
  const a=this.players().map(s=>s.deserializeAttachment() as Attachment).find(a=>a.id===playerId);
  if(!a?.actor)return {ok:false,error:'Игрок отключился или ещё загружается.'};
  const flock=r.pigeonFlock??=[],bird:SummonedPigeon={id:crypto.randomUUID(),playerId,skin:Math.random()<.5?'pidgie':'snowball',seed:(Math.random()*0x100000000)>>>0,order:(flock.at(-1)?.order??-1)+1};
  await this.ctx.storage.put(`pigeon:${r.id}:${bird.id}`,bird);
  (r.pigeonFlock??=[]).push(bird);this.log(a,'получил голубиную почту от Ветерка.');this.changed();return {ok:true};
 });}
 adminClearPigeons(roomId:string){return this.ctx.blockConcurrencyWhile(async()=>{
  const r=this.room;if(!r||r.id!==roomId)return {ok:false,error:'Комната уже изменилась. Обнови список.'};
  const birds=r.pigeonFlock??[],now=Date.now();
  await Promise.all(birds.map(bird=>{bird.dismissedAt??=now;return this.ctx.storage.put(`pigeon:${r.id}:${bird.id}`,bird);}));
  this.changed();return {ok:true};
 });}
 adminResize(roomId:string,playerId:string,delta:unknown){return this.ctx.blockConcurrencyWhile(async()=>{
  const r=this.room;if(!r||r.id!==roomId)return {ok:false,error:'Комната уже изменилась. Обнови список.'};
  if(delta!==.5&&delta!==-.5)return {ok:false,error:'Некорректный шаг размера.'};
  const socket=this.players().find(s=>(s.deserializeAttachment() as Attachment).id===playerId),a=socket?.deserializeAttachment() as Attachment|undefined;
  if(!socket||!a?.actor)return {ok:false,error:'Игрок отключился или ещё загружается.'};
  const current=a.actor.progress?.size??a.actor.s,next=stepBodySize(current,delta);
  if(Math.abs(next-current)<.001)return {ok:false,error:delta>.0?'Уже максимальный размер.':'Уже минимальный размер.'};
  a.actor.s=next;if(a.actor.progress){a.actor.progress.size=next;a.actor.progress.speed=next;}a.adminSize=next;socket.serializeAttachment(a);
  this.send(socket,{type:'resize',size:next});
  const pct=Math.round(next*100);
  this.log(a,delta>.0?`вырос до ${pct}% — Ветерок налепил немного жирка.`:`уменьшился до ${pct}% — Ветерок сдул лишний жирок.`);
  this.broadcast({type:'frame',id:a.id,actor:a.actor},socket);this.changed();return {ok:true,size:next};
 });}
 adminOnline(){return this.ctx.blockConcurrencyWhile(async()=>{
  const room=this.room??await this.ctx.storage.get<RoomState>('prepared-room');
  return {room:room?{id:room.id,createdAt:room.epoch,festival:room.festival?.results?'finished':room.festival?'running':'none'}:null,players:this.players().map(s=>{const a=s.deserializeAttachment() as Attachment;const size=a.actor?Math.round((a.actor.progress?.size??a.actor.s)*1000)/1000:1;return {id:a.id,name:a.name??a.actor?.name??'Кирби',variant:a.variant,host:a.id===room?.host,joinedAt:a.history?.startedAt??null,size,ready:!!a.actor};})};
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
  for(const peer of this.players()){const a=peer.deserializeAttachment() as Attachment;const actor=a.actor;r.festival.players[a.id]={name:a.name??actor?.name??'Кирби',variant:a.variant,base:(actor?.fruits??0)+achievementPoints(actor?.achievements??[])+(actor?.eventPoints??0),fruits:actor?.fruits??0,size:actor?.progress?.size??actor?.s??1,bonus:0,collected:[],numbersCompleted:actor?.achievements.includes('numbers')??false};}
 }
 private millActor(a:Attachment):MillActor|undefined{
  const c=a.actor;if(!c)return;const q=c.q;
  return {id:a.id,p:c.p,yaw:Math.atan2(2*(q[0]*q[2]+q[3]*q[1]),1-2*(q[0]*q[0]+q[1]*q[1])),size:c.s,available:!holdsBread(this.room?.bread,a.id)&&!c.ride&&['Idle','Run','Walk','WalkBackward','RotateLeft','RotateRight','Attack','Push'].includes(c.state)};
 }
 private sealActor(a:Attachment,id:unknown):SealActor|undefined{
  const c=a.actor,r=this.room;if(!c||!r)return;
  const carryingBag=millCarrying(r.millQuest,a.id);
  const activity=id==='treehouse'
   ?r.locks['tree:0']===a.id&&c.ride?.key==='tree:0'&&!Object.entries(r.locks).some(([key,owner])=>owner===a.id&&key!=='tree:0')&&['Lookout','Walk','WalkBackward'].includes(c.state)
   :!c.ride&&!Object.values(r.locks).includes(a.id)&&['Idle','Run','Walk','WalkBackward','RotateLeft','RotateRight'].includes(c.state);
  return {id:a.id,p:c.p,size:c.s,available:a.visible===true&&!c.roll&&!holdsBread(r.bread,a.id)&&!carryingBag&&activity};
 }
 private advanceMill(now:number){
  const r=this.room;if(!r)return false;const old=r.millQuest??newMillQuest();
  const next=advanceMill(old,now,old.stage==='idle'||old.stage==='running'||this.players().some(s=>(s.deserializeAttachment() as Attachment).id===old.owner));
  r.millQuest=next;r.mill=millWorking(next);return next!==old;
 }
 private breadAction(a:Attachment,action:BreadAction,now:number){
  const r=this.room,actor=this.millActor(a);if(!r||!actor)return false;
  const bag=millCarrying(r.millQuest,a.id);
  actor.available=!a.actor?.ride&&['Idle','Run','Walk','WalkBackward','RotateLeft','RotateRight','Attack','Push','Jump','Fly'].includes(a.actor!.state)&&!bag&&!Object.values(r.locks).includes(a.id);
  if(action?.kind==='feed'&&action.bird!==undefined&&!isWildPigeonId(action.bird))return false;
  const bird=action?.kind==='feed'?action.bird??'pidgie':'pidgie';
  const birds=action?.kind==='pick'?WILD_PIGEONS.flatMap(id=>r.world?.[id]?[r.world[id]!]:[]):r.world?.[bird];
  const old=r.bread??newBread(),next=applyBread(old,action,{...actor,available:actor.available!==false},now,r.world?.mountainSteps,birds);
  if(next===old)return false;r.bread=next;
  if(action.kind==='feed'&&next.offering&&a.actor){
   const achievement=pigeonFriendAchievement(bird);
   if(!a.actor.achievements.includes(achievement))a.actor.achievements.push(achievement);
   if(r.world?.[bird])r.world[bird]=beginPidgieFeeding(r.world[bird]!,next.offering);
   this.logEntry(pidgieFriendLog(a.actor.name,bird));
  }
  return true;
 }
 private millAction(a:Attachment,action:MillAction,now:number){
  const r=this.room,actor=this.millActor(a);if(!r||!actor||!action||typeof action!=='object')return false;
  const old=r.millQuest??newMillQuest(),next=applyMill(old,action,actor,now);if(next===old)return false;
  r.millQuest=next;r.mill=millWorking(next);
  if(next.stage==='running'&&old.stage!=='running'&&a.actor){
   r.bread=grantBread(r.bread??newBread(),{...actor,available:true},now);
   if(!a.actor.achievements.includes('millQuest'))a.actor.achievements.push('millQuest');
   this.log(a,'испёк хлебушек на мельнице — над поляной закружились мыльные пузыри!');
  }
  return true;
 }
 private bossActor(a:Attachment):CentipedeActor|undefined{
  const c=a.actor;if(!c)return;const q=c.q;
  return {id:a.id,p:c.p,yaw:Math.atan2(2*(q[0]*q[2]+q[3]*q[1]),1-2*(q[0]*q[0]+q[1]*q[1])),size:c.s,available:!c.ride&&c.state!=='Roll',done:c.achievements.includes('centipede'),points:c.eventPoints??0};
 }
 private flowerActor(a:Attachment):FlowerActor|undefined{
  const actor=this.millActor(a);return actor?{id:a.id,p:actor.p,size:actor.size,available:actor.available,present:a.visible}:undefined;
 }
 private numberEmptyDeadline(){const since=this.room?.numberGame?.emptySince;return since===undefined?Infinity:since+NUMBER_EMPTY_MS;}
 private rewardNumbers(current?:Attachment){
  const game=this.room?.numberGame;if(game?.stage!=='celebrate')return;
  for(const {socket,a} of this.flowerPlayers(current))if(game.winners.includes(a.id)&&a.actor&&!a.actor.achievements.includes('numbers')){
   a.actor.achievements.push('numbers');socket.serializeAttachment(a);this.send(socket,{type:'number-complete'});this.broadcast({type:'frame',id:a.id,actor:a.actor},socket);
  }
 }
 private advanceNumbers(now:number,current?:Attachment){
  const r=this.room;if(!r?.numberGame)return false;const old=r.numberGame,next=advanceNumberGame(old,now,this.flowerActors(current));r.numberGame=next;
  if(next?.emptySince!==undefined&&old.emptySince!==next.emptySince)this.ctx.waitUntil(this.ctx.storage.setAlarm(Math.min(this.numberEmptyDeadline(),r.flowerGame?.emptySince===undefined?Infinity:r.flowerGame.emptySince+FLOWER_EMPTY_MS,r.centipede?.emptySince===undefined?Infinity:r.centipede.emptySince+CENTIPEDE_EMPTY_MS)));
  this.rewardNumbers(current);return next!==old;
 }
 private flowerPlayers(current?:Attachment){return this.players().map(socket=>({socket,a:current&&(socket.deserializeAttachment() as Attachment).id===current.id?current:socket.deserializeAttachment() as Attachment}));}
 private flowerActors(current?:Attachment){return this.flowerPlayers(current).map(p=>this.flowerActor(p.a)).filter((a):a is FlowerActor=>!!a);}
 private rewardFlowers(current?:Attachment){
  const game=this.room?.flowerGame;if(game?.stage!=='celebrate')return;
  for(const {socket,a} of this.flowerPlayers(current))if(game.winners.includes(a.id)&&a.actor&&!a.actor.achievements.includes('flowers')){
   a.actor.achievements.push('flowers');socket.serializeAttachment(a);this.send(socket,{type:'flower-complete'});this.broadcast({type:'frame',id:a.id,actor:a.actor},socket);
  }
 }
 private advanceFlowers(now:number,current?:Attachment){
  const r=this.room;if(!r?.flowerGame)return false;const old=r.flowerGame,next=advanceFlowerGame(old,now,this.flowerActors(current));r.flowerGame=next;
  if(next?.emptySince!==undefined&&old.emptySince!==next.emptySince)this.ctx.waitUntil(this.ctx.storage.setAlarm(Math.min(this.numberEmptyDeadline(),next.emptySince+FLOWER_EMPTY_MS,r.centipede?.emptySince===undefined?Infinity:r.centipede.emptySince+CENTIPEDE_EMPTY_MS)));
  this.rewardFlowers(current);return next!==old;
 }
 private knightActors(current?:Attachment):KnightActor[]{return this.players().map(socket=>{const stored=socket.deserializeAttachment() as Attachment,a=current?.id===stored.id?current:stored,c=a.actor;if(!c)return undefined;const q=c.q;return {id:a.id,p:[c.p[0]-META_KNIGHT_ARENA.x,c.p[1],c.p[2]] as [number,number,number],yaw:Math.atan2(2*(q[0]*q[2]+q[3]*q[1]),1-2*(q[0]*q[0]+q[1]*q[1])),available:c.location==='meta-knight-arena'&&!c.ride};}).filter((a):a is KnightActor=>!!a);}
 private advanceKnight(now:number,current?:Attachment){
  const s=this.room?.knightBattle;if(!s)return false;const changed=advanceKnightBattle(s,this.knightActors(current),now);
  if(s.stage==='won'&&!s.rewarded){s.rewarded=true;s.revision++;for(const socket of this.players()){const a=(current&&(socket.deserializeAttachment() as Attachment).id===current.id)?current:socket.deserializeAttachment() as Attachment,p=s.players[a.id];if(p&&!p.withdrawn&&p.hp>0&&p.hits+p.reflects>0){this.send(socket,{type:'knight-victory'});this.logEntry(metaKnightVictoryLog(a.name??a.actor?.name??''));}}return true;}
  return changed;
 }
 private advanceBoss(now:number,current?:Attachment,contacts=true){
  const r=this.room;if(!r?.centipede)return false;
  const players=this.players().map(socket=>({socket,a:current&&(socket.deserializeAttachment() as Attachment).id===current.id?current:socket.deserializeAttachment() as Attachment}));
  const actors=players.map(p=>this.bossActor(p.a)).filter((a):a is CentipedeActor=>!!a);
  const emptySince=r.centipede.emptySince,result=advanceCentipede(r.centipede,now,actors);r.centipede=result.event;let changed=result.changed;
  advanceChasers(r.centipede,actors,now);
  if(r.centipede?.emptySince!==undefined&&r.centipede.emptySince!==emptySince)this.ctx.waitUntil(this.ctx.storage.setAlarm(Math.min(this.numberEmptyDeadline(),r.centipede.emptySince+CENTIPEDE_EMPTY_MS,r.flowerGame?.emptySince===undefined?Infinity:r.flowerGame.emptySince+FLOWER_EMPTY_MS)));
  for(const {socket,a} of players){const c=a.actor,actor=this.bossActor(a);if(!c||!actor)continue;
   const direction=contacts?(bumpChaser(r.centipede,actor,now)??bumpCentipede(r.centipede,actor,now)):undefined;if(direction){this.send(socket,{type:'centipede-bump',direction});changed=true;}
   const p=r.centipede?.players[a.id],complete=completedCentipede(r.centipede,a.id)&&!c.achievements.includes('centipede');
   if(complete||(p?.points??0)>(c.eventPoints??0)){
    c.eventPoints=Math.max(c.eventPoints??0,p?.points??0);if(complete)c.achievements.push('centipede');
    socket.serializeAttachment(a);this.send(socket,{type:'centipede-progress',points:c.eventPoints,completed:complete});this.broadcast({type:'frame',id:a.id,actor:c},socket);
    if(complete)this.log(a,'прошёл все три испытания и подружился с Топотушкой!');changed=true;
   }
  }
  return changed;
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
  const score=result?.points??(a.actor?.fruits??0)+achievementPoints(a.actor?.achievements??[])+(a.actor?.eventPoints??0)+(this.room?.festival?.players[a.id]?.bonus??0);
  if(completed)h.finished=true;
  return {id:h.id,mode:'online',roomId:a.session??this.room?.id??null,playerId:a.id,name:a.name??a.actor?.name??'Кирби',variant:a.variant,startedAt:h.startedAt,lastSeen:now,endedAt:status==='playing'?null:now,activeMs:h.activeMs,startScore:h.startScore,score,tasksDone:SCORE_ACTIONS.filter(t=>a.actor?.achievements.includes(t)).length,tasksTotal:SCORE_ACTIONS.length,status,completed,place:completed&&result?1+this.room!.festival!.results!.filter(p=>p.points>result.points).length:null,device:h.device,seq:h.seq++};
 }
 private archive(visits:(Visit|undefined)[]){
  const rows=visits.filter((v):v is Visit=>!!v);if(!rows.length||!this.env.HISTORY)return;
  try{this.ctx.waitUntil(this.env.HISTORY.getByName('archive').write(rows).catch(()=>{}));}catch{/* History must not affect the shared game. */}
 }
 private persist(){
  if(!this.room)return;
  // A world plus quests/chat can exceed the socket's 16KiB structured-clone
  // limit. Store room checkpoints independently so persistence cannot interrupt
  // broadcasts as the room grows. Encounter writes retain their own cadence.
  this.ctx.waitUntil(this.ctx.storage.put('room-state',{...this.room,pigeonFlock:undefined,knightBattle:undefined,centipede:undefined,flowerGame:undefined,numberGame:undefined}));
  if(this.room.knightBattle&&this.room.knightBattle.revision!==this.knightSaved){this.knightSaved=this.room.knightBattle.revision;this.ctx.waitUntil(this.ctx.storage.put('knight-battle',this.room.knightBattle));}
  const boss=JSON.stringify(this.room.centipede?{...this.room.centipede,chasers:undefined}:null);
  if(boss!==this.bossSaved){this.bossSaved=boss;this.ctx.waitUntil(this.room.centipede?this.ctx.storage.put('centipede-event',this.room.centipede):this.ctx.storage.delete('centipede-event'));}
  const flowers=JSON.stringify(this.room.flowerGame??null);if(flowers!==this.flowerSaved){this.flowerSaved=flowers;this.ctx.waitUntil(this.room.flowerGame?this.ctx.storage.put('flower-game',this.room.flowerGame):this.ctx.storage.delete('flower-game'));}
  const numbers=JSON.stringify(this.room.numberGame??null);if(numbers!==this.numberSaved){this.numberSaved=numbers;this.ctx.waitUntil(this.room.numberGame?this.ctx.storage.put('number-game',this.room.numberGame):this.ctx.storage.delete('number-game'));}
  for(const s of this.players()){const a=s.deserializeAttachment() as Attachment;if(a.room){delete a.room;s.serializeAttachment(a);}}
 }
 private logEntry(entry:LogEntry){if(!this.room)return;writeRoomChat(this.chatStorage(),entry);this.room.log=[...(this.room.log??[]),entry].slice(-10);this.broadcast({type:'log',entry});this.persist();}
 private log(a:Attachment,text:string,chat=false){if(!a.actor)return;this.logEntry({id:crypto.randomUUID(),name:a.actor.name,variant:a.variant,text,chat});}
 private finishFestival(now=Date.now()){
  const f=this.room?.festival;if(!f)return;
  if(!f.results&&now>=f.endsAt&&this.room?.world){const npcs=this.room.world.npcs;f.players.npc={name:'Другие кирби',variant:1,base:npcs.reduce((sum,n)=>sum+n.fruits+achievementPoints(n.achievements),0),fruits:0,size:1,bonus:0,collected:[]};}
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
  if(!url.searchParams.has('variant')||!Number.isInteger(variant)||variant<0||variant>=KIRBY_VARIANTS.length)return new Response('Invalid variant',{status:400});
  const first=this.players().length===0;
  const saved=!first&&this.room?await this.ctx.storage.get<DepartedPlayer>(`player:${this.room.id}:${key}`):undefined;
  const occupied=new Set(this.players().map(s=>(s.deserializeAttachment() as Attachment).variant));
  // Restore the original colour if it is still free; otherwise keep the new selection.
  if(saved&&!occupied.has(saved.actor.variant))variant=saved.actor.variant;
  if(occupied.has(variant))return this.reject('Этот цвет уже занят. Выбери другого Кирби.');
  const id=saved?.id??crypto.randomUUID();
  if(first){const prepared=await this.ctx.storage.get<RoomState>('prepared-room');await this.ctx.storage.deleteAll();this.room=prepared??this.newRoom();this.restoreSeals();this.room.host=id;}
  const resume=saved?{...saved.actor,name,variant,star:Math.max(0,saved.actor.star-(Date.now()-saved.savedAt)/1000)}:undefined;
  if(resume){const boost=new FruitSpeedBoost();boost.restore(resume.fruitBoost);boost.update(Math.max(0,(Date.now()-saved!.savedAt)/1000));resume.fruitBoost=boost.snapshot();}
  let device=deviceInfo(request.headers.get('User-Agent')??'');try{const raw=url.searchParams.get('device');if(raw&&raw.length<1024)device=sanitizeDevice(JSON.parse(raw));}catch{}
  const now=Date.now(),history:OnlineVisit={id:'online:'+crypto.randomUUID(),startedAt:now,activeMs:0,tick:now,lastWrite:now,startScore:(resume?.fruits??0)+achievementPoints(resume?.achievements??[])+(resume?.eventPoints??0)+(this.room?.festival?.players[id]?.bonus??0),seq:0,device};
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
  const oldKnightPoint=a.actor?.location==='meta-knight-arena'?[a.actor.p[0]-META_KNIGHT_ARENA.x,a.actor.p[1],a.actor.p[2]] as [number,number,number]:undefined;
  let actor:ActorState|undefined,world:WorldState|undefined,reportedSize:number|undefined,pigeons:PigeonCheckpoint[]|undefined,flockChanged=false;
  if(a.id===r.host&&Array.isArray(m.pigeons)&&m.pigeons.length<=PIGEON_FLOCK_BATCH){
   const birds=new Map(r.pigeonFlock?.map(b=>[b.id,b]));pigeons=[];
   for(const c of m.pigeons)if(validPigeonCheckpoint(c)){
    const bird=birds.get(c.id);if(!bird||c.bird.seed!==bird.seed||c.bird.friend||c.bird.followId&&c.bird.followId!==bird.playerId)continue;
    if(c.departed&&bird.dismissedAt!==undefined){r.pigeonFlock=r.pigeonFlock!.filter(b=>b.id!==bird.id);birds.delete(bird.id);this.ctx.waitUntil(this.ctx.storage.delete(`pigeon:${r.id}:${bird.id}`));flockChanged=true;continue;}
    if((c.departureY!==undefined||c.departed)&&bird.dismissedAt===undefined)continue;
    bird.checkpoint=c;pigeons.push(c);this.ctx.waitUntil(this.ctx.storage.put(`pigeon:${r.id}:${bird.id}`,bird));
   }
  }
  if(validActor(m.actor)){actor=m.actor as ActorState;const earned=a.actor?.achievements??[];actor.achievements=actor.achievements.filter(id=>!['millQuest','centipede','flowers','numbers','pidgieFriend','snowballFriend'].includes(id));for(const id of ['millQuest','centipede','flowers','numbers','pidgieFriend','snowballFriend'])if(earned.includes(id))actor.achievements.push(id);actor.eventPoints=a.actor?.eventPoints??0;actor.variant=a.variant;actor.name=a.name??a.actor?.name??actor.name;if(actor.ride&&r.locks[actor.ride.key]!==a.id)delete actor.ride;reportedSize=actor.progress?.size??actor.s;if(a.adminSize!==undefined){if(Math.abs(reportedSize-a.adminSize)<.001||actor.progress?.speed===a.adminSize)delete a.adminSize;else{actor.s=a.adminSize;if(actor.progress){actor.progress.size=a.adminSize;actor.progress.speed=a.adminSize;}}}a.actor=actor;}
  if(actor?.location==='meta-knight-arena'){
   const position={x:actor.p[0],y:actor.p[1],z:actor.p[2]};constrainMetaKnightArena(position,actor.s,knightArenaSide(r.knightBattle,a.id));
   const p:[number,number,number]=[position.x-META_KNIGHT_ARENA.x,position.y,position.z];constrainKnightShield(r.knightBattle,p,oldKnightPoint);actor.p=[p[0]+META_KNIGHT_ARENA.x,p[1],p[2]];
  }
  if(a.id===r.host&&validWorld(m.world)){const next=m.world as WorldState;world=next;r.world=next;
   for(const id of WILD_PIGEONS){const offering=breadOffering(r.bread,id);if(offering&&next[id])next[id]=beginPidgieFeeding(next[id]!,offering);}

  }
  socket.serializeAttachment(a);
  if(a.actor&&!a.announced){a.announced=true;this.log(a,'зашёл на полянку.');}
  const events=(Array.isArray(m.events)?m.events.slice(0,16):[]) as Event[];
  // Only a frame with a ready push needs deferred contact handling. Ordinary
  // frames advance the room once, regardless of how many balls are active.
  const deferContacts=hasChasers(r.centipede)&&!!a.actor&&now-(a.lastHit??0)>=PUSH_COOLDOWN_MS&&events.some(e=>e?.type==='hit');
  let changed=this.advanceMill(now);if(this.advanceBoss(now,a,!deferContacts))changed=true;
  const oldBread=r.bread??newBread(),nextBread=advanceBread(oldBread,now,r.world?.mountainSteps);if(nextBread!==oldBread){r.bread=nextBread;changed=true;}
  let flowersChanged=this.advanceFlowers(now,a),numbersChanged=this.advanceNumbers(now,a);
  for(const e of events){
   if(!e||typeof e!=='object')continue;
   if(e.type==='seal'){
    const actor=this.sealActor(a,e.id),old=r.sealProgress??newSealProgress();
    if(actor){const next=collectSeal(old,e.id,actor,now);if(next!==old){
     r.sealProgress=next;changed=true;
     for(const entry of metaKnightSealLogs(a.name??a.actor!.name,Object.keys(next.collected).length))this.logEntry(entry);
    }}
   }
   else if(e.type==='knight'&&a.actor?.location==='meta-knight-arena'){
    const actors=this.knightActors(a),me=actors.find(p=>p.id===a.id);if(!me)continue;
    if(e.action==='start'&&(!r.knightBattle||['won','lost','cancelled'].includes(r.knightBattle.stage))){const battle=startKnightBattle(actors,a.id,now);if(battle){r.knightBattle=battle;changed=true;}}
    else if(e.action==='attack')knightAttack(r.knightBattle,me,now);
    else if(e.action==='cancel'&&cancelKnightBattle(r.knightBattle,a.id,now))changed=true;
   }
   else if(e.type==='centipede-start'&&!holdsBread(r.bread,a.id)){
    // A simultaneous/stale request never replaces the running event. Return the
    // current state so the caller also removes an outdated interaction prompt.
    if(!r.centipede&&!r.festival){const boss=this.bossActor(a);if(boss){const q=startCentipede(e.trail,boss,now);if(q){r.centipede=q;this.log(a,'позвал Топотушку поиграть в догонялки и подружиться!');changed=true;}}}
    this.send(socket,{type:'room',room:r});
   }
   else if(e.type==='festival-star'&&r.festival){if(collectStar(r.festival,a.id,e.index,now))changed=true;}
   else if(e.type==='chat'&&a.actor&&now-(a.lastChat??0)>=700){const text=chatText(e.text);if(text){a.lastChat=now;this.log(a,text,true);}}
   else if((e.type==='pidgie-scare'||e.type==='pidgie-interest')&&a.id===r.host){
    if(e.bird!==undefined&&!isWildPigeonId(e.bird))continue;
    const bird=e.bird??'pidgie';
    const player=e.playerId===a.id?a:this.players().map(s=>s.deserializeAttachment() as Attachment).find(p=>p.id===e.playerId);
    if(player?.actor){
     if(!breadOffering(r.bread,bird)&&(e.type==='pidgie-scare'||holdsBread(r.bread,player.id)))this.logEntry((e.type==='pidgie-interest'?pidgieInterestLog:pidgieScareLog)(player.actor.name,bird));
    }
   }
   else if(e.type==='emote'&&a.actor&&now-(a.lastEmote??0)>=1500){const text=emoteMessage(e.emote);if(text){a.lastEmote=now;this.log(a,text);this.broadcast({type:'emote',emote:e.emote,id:a.id},socket);}}
   else if(e.type==='number-start'){
    const actor=this.flowerActor(a),old=r.numberGame;if(actor&&!r.festival&&!holdsBread(r.bread,a.id))r.numberGame=startNumberGame(old,actor,now);if(r.numberGame!==old)numbersChanged=true;this.send(socket,{type:'number-game',game:r.numberGame});
   }
   else if(e.type==='number-note'&&a.actor&&a.visible&&!holdsBread(r.bread,a.id)&&now-(a.lastNumber??0)>=NUMBER_PRESS_MS&&canPressNumber(e.digit,{x:a.actor.p[0],y:a.actor.p[1],z:a.actor.p[2]},a.actor.s)){
    if(r.numberGame&&r.numberGame.stage!=='answer')continue;const actor=this.flowerActor(a);if(!actor?.available)continue;
    a.lastNumber=now;this.broadcast({type:'number-note',digit:e.digit,id:a.id},socket);
    const old=r.numberGame;r.numberGame=pressNumberGame(old,e.digit,actor,now,this.flowerActors(a));if(r.numberGame!==old){numbersChanged=true;this.rewardNumbers(a);}
   }
   else if(e.type==='flower-start'||e.type==='flower-replay'){
    const flowerActor=this.flowerActor(a),old=r.flowerGame;if(flowerActor&&!r.festival)r.flowerGame=e.type==='flower-start'?startFlowerGame(old,flowerActor,now):replayFlowerGame(old,flowerActor,now);if(r.flowerGame!==old)flowersChanged=true;
    this.send(socket,{type:'flower-game',game:r.flowerGame});
   }
   else if(e.type==='flower-note'&&a.actor&&a.visible&&!a.actor.ride&&now-(a.lastFlower??0)>=FLOWER_NOTE_COOLDOWN_MS&&canPlayFlower(e.index,{x:a.actor.p[0],y:a.actor.p[1],z:a.actor.p[2]},a.actor.s)){
    if(r.flowerGame&&r.flowerGame.stage!=='repeat')continue;
    const flowerActor=this.flowerActor(a);if(!flowerActor?.available)continue;
    a.lastFlower=now;this.broadcast({type:'flower-note',index:e.index,id:a.id},socket);
    const old=r.flowerGame;r.flowerGame=playFlowerGame(old,e.index,flowerActor,now,this.flowerActors(a));if(r.flowerGame!==old){flowersChanged=true;this.rewardFlowers(a);}
   }
   else if(e.type==='fruit'&&Number.isInteger(e.index)&&e.index>=0&&e.index<70&&!r.fruits[e.index]&&a.actor){
    if(e.npc===undefined){r.fruits[e.index]=a.id;changed=true;}
    else if(a.id===r.host&&Number.isInteger(e.npc)&&e.npc>=0&&e.npc<14){r.fruits[e.index]='npc:'+e.npc;changed=true;}
   }else if(e.type==='bread'){if(this.breadAction(a,e.action,now))changed=true;}
   else if(e.type==='mill'){if(e.action?.kind!=='push'&&this.millAction(a,e.action,now))changed=true;}
   else if(e.type==='star'&&!holdsBread(r.bread,a.id)&&now>=r.starAt&&a.actor){r.starAt=now+120000;a.actor.star=30;this.send(socket,{type:'star'});changed=true;}
   else if(e.type==='lock'&&validResourceKey(e.key)){
    const ok=!holdsBread(r.bread,a.id)&&(!r.locks[e.key]||r.locks[e.key]===a.id);if(ok){for(const key of Object.keys(r.locks))if(r.locks[key]===a.id)delete r.locks[key];r.locks[e.key]=a.id;changed=true;}this.send(socket,{type:'lock',key:e.key,ok});
   }else if(e.type==='release'&&r.locks[e.key]===a.id){
    if(e.key.startsWith('bug:')&&validBugLanding(e.bugState)){const i=e.key.split(':')[1];(r.bugLandings??={})[i]=[...e.bugState];if(r.world)r.world.bugs[Number(i)]=[...e.bugState];}
    delete r.locks[e.key];changed=true;
   }
   else if(e.type==='hit'&&!holdsBread(r.bread,a.id)&&a.actor&&now-(a.lastHit??0)>=PUSH_COOLDOWN_MS){
    a.lastHit=now;const millActor=this.millActor(a),branch=millActor?millPushTarget(r.millQuest??newMillQuest(),millActor):-1;
    if(pushChaser(r.centipede,this.bossActor(a)!,now)){this.broadcast({type:'hit',id:a.id,actor:a.actor,target:'centipede-ball'});changed=true;continue;}
    if(pushCentipede(r.centipede,this.bossActor(a)!,now)){this.advanceBoss(now,a,false);changed=true;continue;}
    if(branch>=0&&this.millAction(a,{kind:'push',index:branch},now)){changed=true;continue;}
    const actor=a.actor,q=actor.q,yaw=Math.atan2(2*(q[0]*q[2]+q[3]*q[1]),1-2*(q[0]*q[0]+q[1]*q[1]));
    const humans=this.players().map(s=>s.deserializeAttachment() as Attachment).filter(p=>p.id!==a.id&&p.actor).map(p=>({id:p.id,...p.actor!}));
    const targets=[...humans,...(r.world?.npcs??[]).map((n,i)=>({id:'npc:'+i,...n}))];
    const target=pushTarget(actor.p,yaw,actor.s,targets);if(target)this.broadcast({type:'hit',id:a.id,actor,target:target.id});
   }
   else if(e.type==='visible'){a.visible=e.value===true;socket.serializeAttachment(a);if(a.id===r.host&&!a.visible){const next=this.players().find(s=>(s.deserializeAttachment() as Attachment).visible);if(next){r.host=(next.deserializeAttachment() as Attachment).id;changed=true;}}}
  }
  if(this.advanceFlowers(now,a))flowersChanged=true;
  if(this.advanceNumbers(now,a))numbersChanged=true;
  if(a.actor){
   const count=r.fruits.filter(owner=>owner===a.id).length,extra=Math.max(0,count-a.actor.fruits);
   if(extra){const boost=new FruitSpeedBoost();boost.restore(a.actor.fruitBoost);boost.eat(extra);a.actor.fruitBoost=boost.snapshot();}
   a.actor.fruits=count;
   if(a.adminSize!==undefined){const final=a.actor.progress?.size??a.actor.s;a.adminSize=final;if(reportedSize===undefined||Math.abs(reportedSize-final)>=.001)this.send(socket,{type:'resize',size:final});}
  }
  if(deferContacts&&this.advanceBoss(now,a))changed=true;
  if(!r.festival&&a.actor&&allTasks(a.actor.achievements)&&r.flowerGame?.stage!=='celebrate'&&r.numberGame?.stage!=='celebrate'){
   this.startFestival(now,a.actor.name);changed=true;
   void this.ctx.storage.setAlarm(Math.min(now+30000,r.festival!.endsAt));
  }
  if(r.festival&&a.actor&&!r.festival.results){const f=r.festival;if(!f.players[a.id])changed=true;const p=f.players[a.id]??={name:a.actor.name,variant:a.variant,base:0,fruits:0,size:1,bonus:0,collected:[]};p.name=a.actor.name;p.variant=a.variant;p.base=r.fruits.filter(owner=>owner===a.id).length+achievementPoints(a.actor.achievements)+(a.actor.eventPoints??0);p.fruits=r.fruits.filter(owner=>owner===a.id).length;p.size=a.actor.progress?.size??a.actor.s;p.numbersCompleted=a.actor.achievements.includes('numbers');}
  if(r.world)for(const [i,landing] of Object.entries(r.bugLandings??{}))if(!r.locks['bug:'+i])r.world.bugs[Number(i)]=reconcileBugLanding(r.world.bugs[Number(i)],landing);
  if(this.advanceKnight(now,a))changed=true;
  delete a.room;socket.serializeAttachment(a);
  if(changed||flockChanged)this.changed();else if(world||r.festival||flowersChanged||numbersChanged)this.persist();
  if(flowersChanged)this.broadcast({type:'flower-game',game:r.flowerGame});
  if(numbersChanged)this.broadcast({type:'number-game',game:r.numberGame});
  const chasers=r.centipede&&now-this.chaseSentAt>=CHASERS.snapshotMs?chaseSnapshot(r.centipede):undefined;
  if(chasers)this.chaseSentAt=now;
  // Include the sender only when a compact chase update is due. No new timer,
  // HTTP request or full-room broadcast for ordinary ball movement.
  if(actor||world||chasers||pigeons?.length)this.broadcast({type:'frame',id:a.id,actor,world,chasers,pigeons},chasers?undefined:socket);
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
  if(r.pigeonFlock){for(const bird of r.pigeonFlock)if(bird.playerId===a.id)this.ctx.waitUntil(this.ctx.storage.delete(`pigeon:${r.id}:${bird.id}`));r.pigeonFlock=r.pigeonFlock.filter(b=>b.playerId!==a.id);}
  if(a.actor){
   const actor=structuredClone(a.actor);actor.s=actor.progress?.size??actor.s;
   actor.p[1]=actor.ride?0:actor.progress?.ground??0;actor.state='Idle';actor.pose=[];delete actor.ride;delete actor.fit;
   // Only write on departure; ordinary movement continues using the existing frames.
   await this.ctx.storage.put(`player:${r.id}:${playerNameKey(a.name??actor.name)}`,{id:a.id,actor,savedAt:Date.now()} satisfies DepartedPlayer);
  }
  for(const key of Object.keys(r.locks))if(r.locks[key]===a.id)delete r.locks[key];
  if(holdsBread(r.bread,a.id))this.breadAction(a,{kind:'drop'},Date.now());
  if(r.millQuest?.owner===a.id&&r.millQuest.stage!=='running'){r.millQuest=newMillQuest();r.mill=false;}
  if(r.host===a.id)r.host=(remaining[0].deserializeAttachment() as Attachment).id;
  this.advanceBoss(Date.now());
  this.advanceFlowers(Date.now());this.advanceNumbers(Date.now());
  this.broadcast({type:'left',id:a.id},socket);this.broadcast({type:'presence',count:remaining.length},socket);this.changed();
 }
 async webSocketClose(socket:WebSocket,code=1000){try{socket.close(1000,'Disconnected');}catch{}await this.remove(socket,code===1000?'left':'lost');}
 async webSocketError(socket:WebSocket){await this.remove(socket,'lost');}
 async alarm(){
  const millChanged=this.advanceMill(Date.now()),bossChanged=this.advanceBoss(Date.now()),flowersChanged=this.advanceFlowers(Date.now()),numbersChanged=this.advanceNumbers(Date.now());if(millChanged||bossChanged)this.changed();else if(flowersChanged){this.persist();this.broadcast({type:'flower-game',game:this.room?.flowerGame});}if(numbersChanged){this.persist();this.broadcast({type:'number-game',game:this.room?.numberGame});}
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
for(const s of this.players()){const a=s.deserializeAttachment() as Attachment;const seen=Math.max(a.seen,this.ctx.getWebSocketAutoResponseTimestamp(s)?.getTime()??0);if(Date.now()-seen>75000)await this.remove(s,'lost');}if(this.players().length)await this.ctx.storage.setAlarm(Math.min(this.numberEmptyDeadline(),Date.now()+30000,this.room?.festival?(Date.now()<this.room.festival.endsAt?this.room.festival.endsAt:this.room.festival.endsAt+RESULTS_MS):Infinity,this.room?.centipede?.emptySince===undefined?Infinity:this.room.centipede.emptySince+CENTIPEDE_EMPTY_MS,this.room?.flowerGame?.emptySince===undefined?Infinity:this.room.flowerGame.emptySince+FLOWER_EMPTY_MS));}
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
