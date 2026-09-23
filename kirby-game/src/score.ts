export const SCORE_ACTIONS=['mill','sleep','coaster','bench','balloon','treehouse','swing','leaves','trampoline','star','swim'] as const;
export type ScoreAction=typeof SCORE_ACTIONS[number];
export type ScoredActor={fruitsEaten:number;achievements:Set<ScoreAction>};
export function awardFirst(actor:ScoredActor,action:ScoreAction){if(actor.achievements.has(action))return false;actor.achievements.add(action);return true;}
export function scoreOf(actor:ScoredActor){return actor.fruitsEaten+actor.achievements.size*3;}
/** Equal scores share a place; only strictly higher scores outrank a player. */
export function placeOf(actor:ScoredActor,actors:ScoredActor[]){return 1+actors.filter(other=>scoreOf(other)>scoreOf(actor)).length;}
export function validAchievements(value:unknown):value is ScoreAction[]{return Array.isArray(value)&&value.every(v=>SCORE_ACTIONS.includes(v))&&new Set(value).size===value.length;}
