import {knightBattleActive,type KnightBattle} from './meta-knight-battle';

export type KnightArenaAction={key:'interact'|'attack';action:'start'|'cancel'|'finish'|'leave';label:string};
/** The bottom legend and the actual controls use the same available actions. */
export function knightArenaActions(s:KnightBattle|undefined,id:string,withdrawn:boolean,near:boolean,exit:boolean,inside=true):KnightArenaAction[]{
 const player=s?.players[id],participant=!!player&&!player.withdrawn&&!withdrawn,active=knightBattleActive(s);
 if(participant&&active)return [{key:'interact',action:'cancel',label:'Прервать дуэль'}];
 if(exit)return [{key:'interact',action:'leave',label:'Вернуться на поляну'}];
 if(!inside)return [];
 if(participant&&(s?.stage==='won'||s?.stage==='lost'))return [{key:'interact',action:'finish',label:'Завершить дуэль'},{key:'attack',action:'start',label:'Ещё раз'}];
 if(!active&&(near||!!s))return [{key:'interact',action:'start',label:s&&s.stage!=='cancelled'?'Ещё раз':'Начать дуэль'}];
 return [];
}
