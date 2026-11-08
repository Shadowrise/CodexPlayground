import {WILD_PIGEONS,isWildPigeonId,type WildPigeonId} from './wild-pigeons';

export type PigeonFeedingProgress={fed:Partial<Record<WildPigeonId,{by:string;at:number}>>};
export const newPigeonFeeding=():PigeonFeedingProgress=>({fed:{}});
export const allPigeonsFed=(progress:PigeonFeedingProgress)=>WILD_PIGEONS.every(id=>!!progress.fed[id]);
export function validPigeonFeeding(value:unknown):value is PigeonFeedingProgress{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1)return false;
 const fed=(value as PigeonFeedingProgress).fed;
 return !!fed&&typeof fed==='object'&&!Array.isArray(fed)&&Object.entries(fed).every(([id,entry])=>isWildPigeonId(id)&&!!entry&&typeof entry==='object'&&Object.keys(entry).length===2&&typeof entry.by==='string'&&entry.by.length>0&&entry.by.length<=128&&!/[\u0000-\u001f\u007f]/.test(entry.by)&&Number.isSafeInteger(entry.at)&&entry.at>=0);
}
/** Called only after bread has been accepted by a real meadow bird. */
export function recordPigeonFeeding(progress:PigeonFeedingProgress,id:WildPigeonId,by:string,at:number):PigeonFeedingProgress{
 if(!isWildPigeonId(id)||progress.fed[id])return progress;
 const next={fed:{...progress.fed,[id]:{by,at}}};
 return validPigeonFeeding(next)?next:progress;
}
/** Shared by solo and room logic: feathers take priority over earlier badges. */
export function openFedPigeonPortal(room:{pigeonFeeding?:PigeonFeedingProgress;metaKnightPortalOpen?:boolean;portalBoss?:'meta-knight'|'metapidgie';knightBattle?:unknown;knightSides?:Record<string,'players'|'boss'>}){
 if(!room.pigeonFeeding||!allPigeonsFed(room.pigeonFeeding))return false;
 const changed=room.portalBoss!=='metapidgie'||room.metaKnightPortalOpen!==true;
 room.metaKnightPortalOpen=true;room.portalBoss='metapidgie';
 if(changed){delete room.knightBattle;room.knightSides={};}
 return changed;
}
