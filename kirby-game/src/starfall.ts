import {KIRBY_VARIANTS} from './variant-palette';
import {SCORE_ACTIONS} from './score';
import {MIN_BODY_SIZE} from './body-size';
export const PREPARE_MS=20000, COLLECT_MS=120000, CELEBRATE_MS=8000, RESULTS_MS=120000, STAR_LIMIT=30, STAR_INTERVAL=1800, STAR_LIFE=22000;
export const STAR_COUNT=Math.ceil(COLLECT_MS/STAR_INTERVAL);
export type FestivalPlayer={name:string;variant:number;base:number;fruits:number;size:number;bonus:number;collected:number[]};
export type FestivalResult={id:string;name:string;variant:number;points:number;bonus:number;fruits:number;size:number};
export type StarfallState={startsAt:number;endsAt:number;initiator:string;players:Record<string,FestivalPlayer>;results?:FestivalResult[]};
export function allTasks(achievements:Iterable<string>){const done=new Set(achievements);return SCORE_ACTIONS.every(a=>done.has(a));}
export function createStarfall(now:number,initiator:string):StarfallState{return {startsAt:now+PREPARE_MS,endsAt:now+PREPARE_MS+COLLECT_MS,initiator,players:{}};}
export function starfallPhase(s:StarfallState,now:number){return now<s.startsAt?'countdown':now<s.endsAt?'collect':now<s.endsAt+CELEBRATE_MS?'celebrate':'done';}
export function starValue(index:number){return index%5===4?3:1;}
export function collectStar(s:StarfallState,id:string,index:number,now:number){
 const p=s.players[id],age=now-s.startsAt-index*STAR_INTERVAL;
 if(!p||s.results||starfallPhase(s,now)!=='collect'||!Number.isInteger(index)||index<0||index>=STAR_COUNT||age<2500||age>STAR_LIFE||p.collected.includes(index))return false;
 p.collected.push(index);p.bonus=Math.min(STAR_LIMIT,p.bonus+starValue(index));return true;
}
export function finishStarfall(s:StarfallState,now:number){if(s.results||now<s.endsAt)return false;s.results=Object.entries(s.players).map(([id,p])=>({id,name:p.name,variant:p.variant,points:p.base+p.bonus,bonus:p.bonus,fruits:p.fruits,size:p.size})).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'ru'));return true;}
/** Nominations use the frozen final results and never change the score. */
export function starfallAwards(results:readonly FestivalResult[],initiator:string){
 const humans=results.filter(r=>r.id!=='npc');
 const top=[...humans].sort((a,b)=>b.fruits-a.fruits||b.size-a.size)[0],best=Math.max(...humans.map(r=>r.bonus));
 return new Map(humans.map(r=>{
  const awards:string[]=[];
  if(top&&r.fruits===top.fruits&&r.size===top.size)awards.push('Толстячок');
  if(Math.abs(r.size-MIN_BODY_SIZE)<=1e-6)awards.push('Малявка');
  if(r.bonus===best)awards.push('Звёздный собиратель');
  if(r.name===initiator)awards.push('Любитель приключений');
  return [r.id,awards] as const;
 }));
}
export function validStarfall(v:unknown):v is StarfallState {
 const s=v as StarfallState;
 return !!s&&Number.isFinite(s.startsAt)&&Number.isFinite(s.endsAt)&&s.endsAt-s.startsAt===COLLECT_MS&&typeof s.initiator==='string'&&s.initiator.length<=24&&!!s.players&&typeof s.players==='object'&&Object.entries(s.players).length<=16&&Object.values(s.players).every(p=>!!p&&typeof p.name==='string'&&p.name.length<=24&&Number.isInteger(p.variant)&&p.variant>=0&&p.variant<KIRBY_VARIANTS.length&&Number.isFinite(p.size)&&p.size>0&&Number.isInteger(p.fruits)&&p.fruits>=0&&Number.isInteger(p.base)&&p.base>=0&&Number.isInteger(p.bonus)&&p.bonus>=0&&p.bonus<=30&&Array.isArray(p.collected)&&p.collected.every(i=>Number.isInteger(i)&&i>=0&&i<STAR_COUNT)&&new Set(p.collected).size===p.collected.length);
}
