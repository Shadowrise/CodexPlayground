import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SCORE_ACTIONS,type ScoreAction} from '../src/score';
import {sortedTasks,TASK_NAMES,taskDestination} from '../src/tasks';
import type {Destination} from '../src/navigation';
import {BALLOON_SITES} from '../src/balloon-sites';
test('task list includes every rewarded activity, incomplete first and Russian alphabetical order within groups',()=>{
 const done=new Set<ScoreAction>(['star','bench','coaster']);const tasks=sortedTasks(done);
 assert.equal(tasks.length,SCORE_ACTIONS.length);assert.equal(new Set(tasks.map(t=>t.id)).size,SCORE_ACTIONS.length);
 assert.deepEqual(tasks.slice(-3).map(t=>t.id),['star','bench','coaster']);
 const remaining=tasks.filter(t=>!t.done).map(t=>t.name);assert.deepEqual(remaining,[...remaining].sort(new Intl.Collator('ru').compare));
 assert(tasks.slice(0,-3).every(t=>!t.done));assert(tasks.slice(-3).every(t=>t.done));
});
test('adventures choose their existing destinations, without routes for benches, boats or fireflies',()=>{
 const pairs=[['skyStar','sky-trail'],['millQuest','mill'],['star','maze'],['treehouse','treehouse'],['centipede','boss-arena'],['swing','swing'],['fountain','fountain'],['sleep','home'],['coaster','depot'],['leaves','treehouse']] as const;
 const places:Destination[]=pairs.map(([,id],i)=>({id,name:id,x:i*20,z:i*30}));
 for(const [action,id] of pairs)assert.equal(taskDestination(action,places,{x:0,z:0})?.id,id);
 for(const action of ['bench','boat','firefly'] as const)assert.equal(taskDestination(action,places,{x:0,z:0}),undefined);
 assert.equal(taskDestination('star',[],{x:0,z:0}),undefined);
});
test('balloon route picks the nearest station at the time of selection and ignores other places',()=>{
 const places:Destination[]=[{id:'home',name:'House',x:0,z:0},...BALLOON_SITES.map((p,i)=>({...p,id:`balloon-${i}`}))];
 for(const [i,station] of BALLOON_SITES.entries()){
  assert.equal(taskDestination('balloon',places,{x:station.x+2,z:station.z+3})?.id,`balloon-${i}`);
 }
 assert.equal(taskDestination('balloon',places,{x:0,z:0})?.id,'balloon-0');
 assert.equal(taskDestination('balloon',places.slice(0,1),{x:0,z:0}),undefined);
});
test('completion moves task below unfinished tasks and restoring a save reconstructs the same list',()=>{
 const done=new Set<ScoreAction>();const initial=sortedTasks(done);assert(initial.every(t=>!t.done));
 done.add('millQuest');const after=sortedTasks(done);assert.equal(after.at(-1)!.id,'millQuest');assert(after.at(-1)!.done);
 const saved=JSON.parse(JSON.stringify([...done])) as ScoreAction[];assert.deepEqual(sortedTasks(new Set(saved)),after);
 assert(sortedTasks(new Set(SCORE_ACTIONS)).every(t=>t.done));assert.equal(Object.keys(TASK_NAMES).length,SCORE_ACTIONS.length);
});
