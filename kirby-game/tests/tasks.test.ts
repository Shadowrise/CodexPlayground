import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SCORE_ACTIONS,type ScoreAction} from '../src/score';
import {sortedTasks,TASK_NAMES} from '../src/tasks';
test('task list includes every rewarded activity, incomplete first and Russian alphabetical order within groups',()=>{
 const done=new Set<ScoreAction>(['star','bench','coaster']);const tasks=sortedTasks(done);
 assert.equal(tasks.length,SCORE_ACTIONS.length);assert.equal(new Set(tasks.map(t=>t.id)).size,SCORE_ACTIONS.length);
 assert.deepEqual(tasks.slice(-3).map(t=>t.id),['star','bench','coaster']);
 const remaining=tasks.filter(t=>!t.done).map(t=>t.name);assert.deepEqual(remaining,[...remaining].sort(new Intl.Collator('ru').compare));
 assert(tasks.slice(0,-3).every(t=>!t.done));assert(tasks.slice(-3).every(t=>t.done));
});
test('completion moves task below unfinished tasks and restoring a save reconstructs the same list',()=>{
 const done=new Set<ScoreAction>();const initial=sortedTasks(done);assert(initial.every(t=>!t.done));
 done.add('mill');const after=sortedTasks(done);assert.equal(after.at(-1)!.id,'mill');assert(after.at(-1)!.done);
 const saved=JSON.parse(JSON.stringify([...done])) as ScoreAction[];assert.deepEqual(sortedTasks(new Set(saved)),after);
 assert(sortedTasks(new Set(SCORE_ACTIONS)).every(t=>t.done));assert.equal(Object.keys(TASK_NAMES).length,SCORE_ACTIONS.length);
});
