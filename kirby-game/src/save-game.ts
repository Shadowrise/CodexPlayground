import {validStarfall,type StarfallState} from './starfall';
import { validAchievements, type ScoreAction } from './score';
import { KIRBY_VARIANTS, type KirbyVariant } from './variants';
import type { CharacterController } from './controller';
import type { KirbyNpc } from './npcs';
import type { FruitWorld } from './fruits';
import { STATION } from './coaster';
import type { Vector3 } from 'three';
export const SAVE_KEY='kirby-save-v1';
type ActorSave={variant:string;x:number;z:number;yaw:number;size:number;fruitsEaten:number;achievements?:ScoreAction[]};
export type GameSave={version:1;savedAt:string;player:ActorSave;npcs:ActorSave[];fruits:boolean[];mazeStar?:boolean;starRemaining?:number;starCooldown?:number;night?:boolean;festival?:StarfallState};
export function captureGame(player:CharacterController,variant:KirbyVariant,npcs:readonly KirbyNpc[],fruits:FruitWorld,riding=false,safePosition?:(c:CharacterController|KirbyNpc)=>Vector3|undefined,night=false):GameSave {
  const actor=(c:CharacterController|KirbyNpc,name:string):ActorSave=>{const p=safePosition?.(c)??c.actor.position;return {variant:name,x:p.x,z:p.z,yaw:c.yaw,size:c.savedSize,fruitsEaten:c.fruitsEaten,achievements:[...c.achievements]};};
  const savedPlayer=actor(player,variant[0]);
  if(riding){savedPlayer.x=STATION.x;savedPlayer.z=STATION.z-8;savedPlayer.yaw=0;}
  return {version:1,savedAt:new Date().toISOString(),player:savedPlayer,npcs:npcs.map(n=>actor(n,n.variant[0])),fruits:fruits.fruits.map(f=>f.eaten),mazeStar:player.starBlessed,starRemaining:player.starRemaining,starCooldown:player.starCooldown,night,festival:player.festival};
}
export function parseSave(raw:string):GameSave {
  const data=JSON.parse(raw) as GameSave;
  const actor=(a:ActorSave)=>a && KIRBY_VARIANTS.some(v=>v[0]===a.variant) && [a.x,a.z,a.yaw,a.size,a.fruitsEaten].every(Number.isFinite) && a.size>0 && Number.isInteger(a.fruitsEaten) && a.fruitsEaten>=0 && (a.achievements===undefined || validAchievements(a.achievements));
  if((data?.festival!==undefined&&!validStarfall(data.festival)) || data?.version!==1 || (data.starRemaining!==undefined && (!Number.isFinite(data.starRemaining) || data.starRemaining<0 || data.starRemaining>30)) || (data.starCooldown!==undefined && (!Number.isFinite(data.starCooldown) || data.starCooldown<0 || data.starCooldown>120)) || (data.night!==undefined && typeof data.night!=='boolean') || (data.mazeStar!==undefined && typeof data.mazeStar!=='boolean') || !actor(data.player) || !Array.isArray(data.npcs) || data.npcs.length!==14 || !data.npcs.every(actor)
    || new Set([data.player.variant,...data.npcs.map(n=>n.variant)]).size!==15
    || !Array.isArray(data.fruits) || data.fruits.length!==70 || !data.fruits.every(f=>typeof f==='boolean'))throw Error('Сохранение повреждено или несовместимо.');
  return data;
}
export function restoreGame(data:GameSave,player:CharacterController,npcs:readonly KirbyNpc[],fruits:FruitWorld) {
  const restore=(c:CharacterController|KirbyNpc,a:ActorSave)=>{
    c.actor.position.set(a.x,0,a.z);c.actor.scale.setScalar(a.size);c.yaw=a.yaw;c.actor.rotation.set(0,a.yaw,0);c.fruitsEaten=a.fruitsEaten;
    c.achievements.clear();for(const action of a.achievements??[])c.achievements.add(action);
  };
  restore(player,data.player);
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
