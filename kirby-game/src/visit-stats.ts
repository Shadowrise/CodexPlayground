import type {KnightBattle} from './meta-knight-battle';

/** Personal rewards and encounters earned during one visit, excluding loaded progress. */
export type VisitStats={seals:number;feathers:number;knightStarted:number;knightWon:number;pidgeyStarted:number;pidgeyWon:number};
export type VisitProgress={stats:VisitStats;battle?:{id:number;boss:'meta-knight'|'metapidgie';won:boolean}};
export const newVisitProgress=():VisitProgress=>({stats:{seals:0,feathers:0,knightStarted:0,knightWon:0,pidgeyStarted:0,pidgeyWon:0}});

export function validVisitStats(value:unknown):value is VisitStats{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const a=value as VisitStats;
 return (Object.keys(newVisitProgress().stats) as (keyof VisitStats)[]).every(key=>Number.isSafeInteger(a[key])&&a[key]>=0&&a[key]<=1000000)
  &&a.seals<=3&&a.feathers<=5&&a.knightWon<=a.knightStarted&&a.pidgeyWon<=a.pidgeyStarted;
}

/** Polling, repeated packets and socket hibernation cannot count an encounter twice. */
export function recordVisitBattle(progress:VisitProgress,battle:KnightBattle|undefined,id:string){
 const player=battle?.players[id];if(!battle||!player||battle.stage==='side-choice')return false;
 const boss=battle.boss??'meta-knight',terminal=['won','lost','cancelled'].includes(battle.stage);
 let changed=false;
 if(progress.battle?.id!==battle.id||progress.battle.boss!==boss){
  // A visitor arriving after the result did not start this fight.
  if(terminal||player.withdrawn)return false;
  progress.battle={id:battle.id,boss,won:false};
  progress.stats[boss==='metapidgie'?'pidgeyStarted':'knightStarted']++;changed=true;
 }
 const won=!player.withdrawn&&player.hp>0&&(player.side==='boss'?battle.stage==='lost':battle.stage==='won');
 if(won&&!progress.battle.won){progress.battle.won=true;progress.stats[boss==='metapidgie'?'pidgeyWon':'knightWon']++;changed=true;}
 return changed;
}
