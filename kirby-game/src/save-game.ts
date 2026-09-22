import { KIRBY_VARIANTS, type KirbyVariant } from './variants';
import type { CharacterController } from './controller';
import type { KirbyNpc } from './npcs';
import type { FruitWorld } from './fruits';
import { STATION } from './coaster';
export const SAVE_KEY='kirby-save-v1';
type ActorSave={variant:string;x:number;z:number;yaw:number;size:number;fruitsEaten:number};
export type GameSave={version:1;savedAt:string;player:ActorSave;npcs:ActorSave[];fruits:boolean[]};
export function captureGame(player:CharacterController,variant:KirbyVariant,npcs:readonly KirbyNpc[],fruits:FruitWorld,riding=false):GameSave {
  const actor=(c:CharacterController|KirbyNpc,name:string):ActorSave=>({variant:name,x:c.actor.position.x,z:c.actor.position.z,yaw:c.yaw,size:c.savedSize,fruitsEaten:c.fruitsEaten});
  const savedPlayer=actor(player,variant[0]);
  if(riding){savedPlayer.x=STATION.x;savedPlayer.z=STATION.z-8;savedPlayer.yaw=0;}
  return {version:1,savedAt:new Date().toISOString(),player:savedPlayer,npcs:npcs.map(n=>actor(n,n.variant[0])),fruits:fruits.fruits.map(f=>f.eaten)};
}
export function parseSave(raw:string):GameSave {
  const data=JSON.parse(raw) as GameSave;
  const actor=(a:ActorSave)=>a && KIRBY_VARIANTS.some(v=>v[0]===a.variant) && [a.x,a.z,a.yaw,a.size,a.fruitsEaten].every(Number.isFinite) && a.size>0 && Number.isInteger(a.fruitsEaten) && a.fruitsEaten>=0;
  if(data?.version!==1 || !actor(data.player) || !Array.isArray(data.npcs) || data.npcs.length!==14 || !data.npcs.every(actor)
    || new Set([data.player.variant,...data.npcs.map(n=>n.variant)]).size!==15
    || !Array.isArray(data.fruits) || data.fruits.length!==70 || !data.fruits.every(f=>typeof f==='boolean'))throw Error('Сохранение повреждено или несовместимо.');
  return data;
}
export function restoreGame(data:GameSave,player:CharacterController,npcs:readonly KirbyNpc[],fruits:FruitWorld) {
  const restore=(c:CharacterController|KirbyNpc,a:ActorSave)=>{
    c.actor.position.set(a.x,0,a.z);c.actor.scale.setScalar(a.size);c.yaw=a.yaw;c.actor.rotation.set(0,a.yaw,0);c.fruitsEaten=a.fruitsEaten;
  };
  restore(player,data.player);
  for(const npc of npcs)restore(npc,data.npcs.find(n=>n.variant===npc.variant[0])!);
  fruits.restore(data.fruits,data.npcs.reduce((total,n)=>total+n.fruitsEaten,0));
}
