export const SCORE_ACTIONS=['mill','sleep','coaster','bench','balloon','treehouse','swing','leaves','trampoline','star','firefly','skyStar','fountain'] as const;
export type ActiveScoreAction=typeof SCORE_ACTIONS[number];
// Keep previously earned lake points and accept older saves / connected clients.
// The retired action is no longer awarded, listed, or required for the finale.
export type ScoreAction=ActiveScoreAction|'swim';
export type ScoredActor={fruitsEaten:number;achievements:Set<ScoreAction>;bonusPoints?:number};
export function awardFirst(actor:ScoredActor,action:ActiveScoreAction){if(actor.achievements.has(action))return false;actor.achievements.add(action);return true;}
export function scoreOf(actor:ScoredActor){return actor.fruitsEaten+actor.achievements.size*3+(actor.bonusPoints??0);}
/** Equal scores share a place; only strictly higher scores outrank a player. */
export function placeOf(actor:ScoredActor,actors:ScoredActor[]){return 1+actors.filter(other=>scoreOf(other)>scoreOf(actor)).length;}
export function validAchievements(value:unknown):value is ScoreAction[]{return Array.isArray(value)&&value.every(v=>v==='swim'||SCORE_ACTIONS.includes(v))&&new Set(value).size===value.length;}
