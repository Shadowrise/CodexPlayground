export const SCORE_ACTIONS=['millQuest','sleep','coaster','bench','balloon','treehouse','swing','leaves','trampoline','star','firefly','skyStar','fountain','boat'] as const;
export type ActiveScoreAction=typeof SCORE_ACTIONS[number];
// Preserve old lake/lever rewards in saves; completing the new mill quest earns six.
// The retired action is no longer awarded, listed, or required for the finale.
export type ScoreAction=ActiveScoreAction|'swim'|'mill';
export type ScoredActor={fruitsEaten:number;achievements:Set<ScoreAction>;bonusPoints?:number};
export function awardFirst(actor:ScoredActor,action:ActiveScoreAction){if(actor.achievements.has(action))return false;actor.achievements.add(action);return true;}
export function achievementPoints(actions:Iterable<string>){let total=0;for(const action of actions)total+=action==='millQuest'?6:3;return total;}
export function scoreOf(actor:ScoredActor){return actor.fruitsEaten+achievementPoints(actor.achievements)+(actor.bonusPoints??0);}
/** Equal scores share a place; only strictly higher scores outrank a player. */
export function placeOf(actor:ScoredActor,actors:ScoredActor[]){return 1+actors.filter(other=>scoreOf(other)>scoreOf(actor)).length;}
export function validAchievements(value:unknown):value is ScoreAction[]{return Array.isArray(value)&&value.every(v=>v==='swim'||v==='mill'||SCORE_ACTIONS.includes(v))&&new Set(value).size===value.length;}
