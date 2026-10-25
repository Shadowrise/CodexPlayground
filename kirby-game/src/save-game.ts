import {validStarfall,type StarfallState} from './starfall';
import {validBread,normalizeBread,type BreadState} from './bread-state';
import {validMillQuest,type MillQuest} from './mill-quest';
import {normalizeSealProgress,type SealProgress} from './meta-knight-seal-state';
import {validPidgieState,type PidgieState} from './pidgie-state';
import {WILD_PIGEONS} from './wild-pigeons';
import {MIN_BODY_SIZE} from './body-size';
import {validFruitBoost,type FruitBoostState} from './fruit-speed';
import { validAchievements, type ScoreAction } from './score';
import { KIRBY_VARIANTS, type KirbyVariant } from './variants';
import type { CharacterController } from './controller';
import type { KirbyNpc } from './npcs';
import type { FruitWorld } from './fruits';
import { STATION } from './coaster';
import {META_KNIGHT_ARENA,insideMetaKnightArena} from './meta-knight-arena-site';
import type { Vector3 } from 'three';
export const SAVE_KEY='kirby-save-v1';
type ActorSave={variant:string;x:number;z:number;yaw:number;size:number;speed?:number;fruitBoost?:FruitBoostState;fruitsEaten:number;achievements?:ScoreAction[];eventPoints?:number;location?:'meta-knight-arena'};
export type PortalSave={open:boolean;override?:boolean};
export type GameSave={version:1;savedAt:string;player:ActorSave;npcs:ActorSave[];fruits:boolean[];mazeStar?:boolean;starRemaining?:number;starCooldown?:number;night?:boolean;dayPhase?:number;festival?:StarfallState;skyCheckpoint?:number;mountainCheckpoint?:number;bread?:BreadState;pidgie?:PidgieState;snowball?:PidgieState;ugolyok?:PidgieState;ryzhik?:PidgieState;kurlyk?:PidgieState;seals?:SealProgress;millQuest?:MillQuest;portal?:PortalSave};
export function captureGame(player:CharacterController,variant:KirbyVariant,npcs:readonly KirbyNpc[],fruits:FruitWorld,riding=false,safePosition?:(c:CharacterController|KirbyNpc)=>Vector3|undefined,night=false,dayPhase?:number,bread?:BreadState,pidgie?:PidgieState,seals?:SealProgress,millQuest?:MillQuest,portal?:PortalSave,snowball?:PidgieState,extraBirds:Partial<Record<'ugolyok'|'ryzhik'|'kurlyk',PidgieState>>={}):GameSave {
  const actor=(c:CharacterController|KirbyNpc,name:string):ActorSave=>{const p=safePosition?.(c)??c.actor.position;return {variant:name,x:p.x,z:p.z,yaw:c.yaw,size:c.savedSize,fruitBoost:c.fruitBoost.snapshot(),fruitsEaten:c.fruitsEaten,achievements:[...c.achievements],...('eventPoints' in c?{eventPoints:c.eventPoints,speed:c.savedSpeedSize}:{})};};
  const savedPlayer=actor(player,variant[0]);
  if(player.actor.userData.location==='meta-knight-arena'){
    savedPlayer.location='meta-knight-arena';savedPlayer.x=player.actor.position.x;savedPlayer.z=player.actor.position.z;
  }else if(riding){savedPlayer.x=STATION.x;savedPlayer.z=STATION.z-8;savedPlayer.yaw=0;}
  return {version:1,savedAt:new Date().toISOString(),player:savedPlayer,npcs:npcs.map(n=>actor(n,n.variant[0])),fruits:fruits.fruits.map(f=>f.eaten),mazeStar:player.starBlessed,starRemaining:player.starRemaining,starCooldown:player.starCooldown,night,dayPhase,festival:player.festival,skyCheckpoint:player.skyCheckpoint,mountainCheckpoint:player.mountainCheckpoint,...(bread?{bread:structuredClone(bread)}:{}),...(pidgie?{pidgie:structuredClone(pidgie)}:{}),...(snowball?{snowball:structuredClone(snowball)}:{}),...structuredClone(extraBirds),...(seals?{seals:structuredClone(seals)}:{}),...(millQuest?{millQuest:structuredClone(millQuest)}:{}),...(portal?{portal:{...portal}}:{})};
}
export function parseSave(raw:string):GameSave {
  const data=JSON.parse(raw) as GameSave;
  if(data?.portal!==undefined&&(!data.portal||typeof data.portal.open!=='boolean'||data.portal.override!==undefined&&(typeof data.portal.override!=='boolean'||data.portal.override!==data.portal.open)))throw Error('Сохранение повреждено или несовместимо.');
  if(data?.player?.location!==undefined&&(data.player.location!=='meta-knight-arena'||!Number.isFinite(data.player.x)||!Number.isFinite(data.player.z)||!insideMetaKnightArena(data.player.x-META_KNIGHT_ARENA.x,data.player.z-META_KNIGHT_ARENA.z)))throw Error('Сохранение повреждено или несовместимо.');
  if(data?.bread!==undefined&&!validBread(data.bread))throw Error('Сохранение повреждено или несовместимо.');
  if(data?.bread)data.bread=normalizeBread(data.bread);
  if(data?.millQuest!==undefined&&(!validMillQuest(data.millQuest)||!Number.isFinite(Date.parse(data.savedAt))))throw Error('Сохранение повреждено или несовместимо.');
  if(data?.seals!==undefined){const seals=normalizeSealProgress(data.seals);if(!seals)throw Error('Сохранение повреждено или несовместимо.');data.seals=seals;}
  for(const id of WILD_PIGEONS)if(data?.[id]!==undefined&&!validPidgieState(data[id]))throw Error('Сохранение повреждено или несовместимо.');
  // Keep saves made before the bird received its name compatible.
  if(data?.player?.variant==='Голубь')data.player.variant='Пиджи';
  if(Array.isArray(data?.npcs))for(const npc of data.npcs)if(npc?.variant==='Голубь')npc.variant='Пиджи';
  const actor=(a:ActorSave)=>a && KIRBY_VARIANTS.some(v=>v[0]===a.variant) && [a.x,a.z,a.yaw,a.size,a.fruitsEaten].every(Number.isFinite) && a.size>0 && Number.isInteger(a.fruitsEaten) && a.fruitsEaten>=0 && (a.fruitBoost===undefined||validFruitBoost(a.fruitBoost)) && (a.speed===undefined||Number.isFinite(a.speed)&&a.speed>=.1&&a.speed<=20) && (a.achievements===undefined || validAchievements(a.achievements)) && (a.eventPoints===undefined||Number.isInteger(a.eventPoints)&&a.eventPoints>=0&&a.eventPoints<=12);
  if((data?.mountainCheckpoint!==undefined&&(!Number.isInteger(data.mountainCheckpoint)||data.mountainCheckpoint<0||data.mountainCheckpoint>2)) || (data?.dayPhase!==undefined&&(!Number.isFinite(data.dayPhase)||data.dayPhase<0||data.dayPhase>=1)) || (data?.skyCheckpoint!==undefined&&(!Number.isInteger(data.skyCheckpoint)||data.skyCheckpoint<0||data.skyCheckpoint>4)) || (data?.festival!==undefined&&!validStarfall(data.festival)) || data?.version!==1 || (data.starRemaining!==undefined && (!Number.isFinite(data.starRemaining) || data.starRemaining<0 || data.starRemaining>30)) || (data.starCooldown!==undefined && (!Number.isFinite(data.starCooldown) || data.starCooldown<0 || data.starCooldown>120)) || (data.night!==undefined && typeof data.night!=='boolean') || (data.mazeStar!==undefined && typeof data.mazeStar!=='boolean') || !actor(data.player) || !Array.isArray(data.npcs) || data.npcs.length!==14 || !data.npcs.every(actor)
    || new Set([data.player.variant,...data.npcs.map(n=>n.variant)]).size!==15
    || !Array.isArray(data.fruits) || data.fruits.length!==70 || !data.fruits.every(f=>typeof f==='boolean'))throw Error('Сохранение повреждено или несовместимо.');
  return data;
}
export function restoreGame(data:GameSave,player:CharacterController,npcs:readonly KirbyNpc[],fruits:FruitWorld) {
  const restore=(c:CharacterController|KirbyNpc,a:ActorSave)=>{
    c.actor.position.set(a.x,0,a.z);c.actor.scale.setScalar(Math.max(MIN_BODY_SIZE,a.size));c.yaw=a.yaw;c.actor.rotation.set(0,a.yaw,0);c.fruitsEaten=a.fruitsEaten;
    if('restoreMovementSpeed' in c){c.resizeTo(a.size,true);c.restoreMovementSpeed(a.speed??c.savedSize);}
    c.fruitBoost.restore(a.fruitBoost);
    c.achievements.clear();for(const action of a.achievements??[])c.achievements.add(action);
  };
  restore(player,data.player);player.eventPoints=data.player.eventPoints??0;player.skyCheckpoint=data.skyCheckpoint??0;player.mountainCheckpoint=data.mountainCheckpoint??0;
  if(data.festival){
    player.festival=structuredClone(data.festival);
    if(!player.festival.results){const shift=Math.max(0,Date.now()-Date.parse(data.savedAt));player.festival.startsAt+=shift;player.festival.endsAt+=shift;}
    player.bonusPoints=player.festival.players.solo?.bonus??0;
  }
  player.starBlessed=data.mazeStar===true;
  if(data.player.achievements===undefined && player.starBlessed)player.achievements.add('star');
  player.starRemaining=data.starRemaining??0;player.starCooldown=data.starCooldown??0;
  for(const npc of npcs)restore(npc,data.npcs.find(n=>n.variant===npc.variant[0])!);
  fruits.restore(data.fruits,data.npcs.reduce((total,n)=>total+n.fruitsEaten,0));
}
