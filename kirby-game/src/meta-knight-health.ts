import {KNIGHT_PHASE_HEALTH,KNIGHT_PHASE_HITS,type KnightBattle} from './meta-knight-battle';

const PHASES=[1,2,3,4] as const;
/** Phase one/two use the legacy bank; crystal and cosmic stages have their own HP. */
export function knightHealthPhases(s:Pick<KnightBattle,'phase'|'hp'>|undefined){
 return PHASES.map(phase=>{
  const maximum=KNIGHT_PHASE_HITS[phase],current=phase===(s?.phase??0),completed=!!s&&phase<s.phase;
  const remaining=completed?0:current?Math.max(0,Math.min(maximum,s!.hp-(KNIGHT_PHASE_HEALTH[phase]-maximum))):maximum;
  return {phase,maximum,remaining,state:completed?'completed' as const:current?'current' as const:'upcoming' as const};
 });
}
