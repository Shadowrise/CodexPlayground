import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SCORE_ACTIONS,awardFirst,scoreOf,placeOf,validAchievements,type ScoreAction} from '../src/score';
const actor=(fruitsEaten=0)=>({fruitsEaten,achievements:new Set<ScoreAction>()});
test('each fruit adds one, all interactions add three only the first time',()=>{
 const player=actor();assert.equal(scoreOf(player),0);player.fruitsEaten=4;assert.equal(scoreOf(player),4);
 for(const action of SCORE_ACTIONS){const before=scoreOf(player);assert(awardFirst(player,action));assert.equal(scoreOf(player),before+3);assert(!awardFirst(player,action));assert.equal(scoreOf(player),before+3);}
 const npc=actor(2);awardFirst(npc,'balloon');assert.equal(scoreOf(npc),5);
});
test('places use individual scores and tie fairly, never compare to aggregate NPC points',()=>{
 const player=actor(3),a=actor(4),b=actor(3),c=actor(1),all=[player,a,b,c];
 assert.equal(placeOf(player,all),2);assert.equal(placeOf(b,all),2);assert.equal(placeOf(a,all),1);
 awardFirst(player,'bench');assert.equal(placeOf(player,all),1);assert.equal(placeOf(a,all),2);
});
test('saved achievements reject duplicates and unknown action identifiers',()=>{
 assert(validAchievements(['bench','star']));assert(!validAchievements(['bench','bench']));assert(!validAchievements(['fake']));assert(!validAchievements(null));
});
