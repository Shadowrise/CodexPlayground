import {META_KNIGHT_SEAL_SITES,isInsideSealPickup} from './meta-knight-seal-sites';

export const SEAL_IDS=['maze','mountain','treehouse'] as const;
export type SealId=typeof SEAL_IDS[number];
export type SealProgress={collected:Partial<Record<SealId,{by:string;at:number}>>};
export type SealActor={id:string;p:readonly number[];size:number;available:boolean};
export const newSealProgress=():SealProgress=>({collected:{}});
/** Only the three distinct hunt badges open the portal; collector count is irrelevant. */
export function allSealsCollected(progress:SealProgress){return SEAL_IDS.every(id=>!!progress.collected[id]);}
export function isSealId(value:unknown):value is SealId{return typeof value==='string'&&(SEAL_IDS as readonly string[]).includes(value);}
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const identity=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=80&&!/[\u0000-\u001f\u007f]/.test(value);

/** Small server-owned state, also used by solo saves. Unknown seal/reward fields
 * are rejected rather than turning saved client data into quest authority. */
function validProgress(value:unknown,legacy=false):value is SealProgress&{collected:{grotto?:{by:string;at:number}}}{
  if(!record(value)||Object.keys(value).length!==1||!Object.hasOwn(value,'collected')||!record(value.collected))return false;
  return Object.entries(value.collected).every(([id,entry])=>(isSealId(id)||legacy&&id==='grotto')&&record(entry)&&Object.keys(entry).length===2&&Object.hasOwn(entry,'by')&&Object.hasOwn(entry,'at')&&identity(entry.by)&&Number.isSafeInteger(entry.at)&&(entry.at as number)>=0);
}
export function validSealProgress(value:unknown):value is SealProgress{return validProgress(value);}

/** Save/room boundary migration only. Current claims always use treehouse. */
export function normalizeSealProgress(value:unknown):SealProgress|null{
  if(!validProgress(value,true))return null;
  if(!Object.hasOwn(value.collected,'grotto'))return value;
  const {grotto,...collected}=value.collected;
  return {collected:{...collected,...(!collected.treehouse?{treehouse:grotto}:{})}};
}

export function canCollectSeal(progress:SealProgress,id:unknown,actor:SealActor){
  if(!validSealProgress(progress)||!isSealId(id)||progress.collected[id]||!actor||actor.available!==true||!identity(actor.id))return false;
  if(!Array.isArray(actor.p)||actor.p.length!==3||!actor.p.every(Number.isFinite)||!Number.isFinite(actor.size)||actor.size<.1||actor.size>20)return false;
  const site=META_KNIGHT_SEAL_SITES.find(site=>site.id===id);
  return !!site&&isInsideSealPickup(site,actor.p,actor.size);
}

/** An immutable, idempotent claim. One player may find all three seals. */
export function collectSeal(progress:SealProgress,id:unknown,actor:SealActor,now:number):SealProgress{
  if(!Number.isSafeInteger(now)||now<0||!canCollectSeal(progress,id,actor))return progress;
  return {collected:{...progress.collected,[id as SealId]:{by:actor.id,at:now}}};
}
