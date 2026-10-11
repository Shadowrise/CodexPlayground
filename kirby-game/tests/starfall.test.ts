import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allTasks,createStarfall,collectStar,finishStarfall,starfallPhase,starfallAwards,PREPARE_MS,COLLECT_MS,CELEBRATE_MS,STAR_INTERVAL,validStarfall} from '../src/starfall';
import {SCORE_ACTIONS,scoreOf} from '../src/score';
const player=()=>({name:'Кирби',variant:0,base:36,fruits:4,size:1.4,bonus:0,collected:[] as number[]});
test('all fifteen current tasks are required, including fountain but not the retired lake task',()=>{assert.equal(SCORE_ACTIONS.length,15);assert(allTasks(SCORE_ACTIONS));assert(!allTasks([...SCORE_ACTIONS.filter(a=>a!=='fountain'),'swim']));for(const missing of SCORE_ACTIONS)assert(!allTasks(SCORE_ACTIONS.filter(a=>a!==missing)));});
test('one shared timeline covers countdown, collection, celebration and results',()=>{const s=createStarfall(100,'Кирби');assert.equal(starfallPhase(s,100),'countdown');assert.equal(starfallPhase(s,100+PREPARE_MS),'collect');assert.equal(starfallPhase(s,100+PREPARE_MS+COLLECT_MS),'celebrate');assert.equal(starfallPhase(s,s.endsAt+CELEBRATE_MS),'done');});
test('stars are personal, duplicate safe, time limited, with a strict 30 point cap',()=>{const s=createStarfall(0,'Кирби');s.players.a=player();s.players.b=player();assert(!collectStar(s,'a',0,0));assert(!collectStar(s,'unknown',0,s.startsAt+3000));assert(!collectStar(s,'a',NaN,s.startsAt+3000));assert(collectStar(s,'a',0,s.startsAt+3000));assert(collectStar(s,'b',0,s.startsAt+3000));assert(!collectStar(s,'a',0,s.startsAt+3000));assert(!collectStar(s,'a',4,s.startsAt+3000));for(let i=1;i<60;i++)collectStar(s,'a',i,s.startsAt+i*STAR_INTERVAL+3000);assert.equal(s.players.a.bonus,30);assert.equal(s.players.b.bonus,1);assert(!collectStar(s,'b',59,s.endsAt));assert(validStarfall(s));});
test('results freeze exactly once and bonus does not change fruit count or size',()=>{const s=createStarfall(0,'Кирби');s.players.a=player();s.players.b={...player(),base:40};collectStar(s,'a',4,s.startsAt+4*STAR_INTERVAL+3000);assert.equal(s.players.a.bonus,3);assert(!finishStarfall(s,s.endsAt-1));assert(finishStarfall(s,s.endsAt));assert.equal(s.results?.[0].id,'b');assert.equal(s.results?.[1].points,39);s.players.b.base=0;assert(!finishStarfall(s,s.endsAt+1));assert.equal(s.results?.[0].points,40);assert.equal(scoreOf({fruitsEaten:4,achievements:new Set(SCORE_ACTIONS),bonusPoints:3}),SCORE_ACTIONS.length*3+10);assert.equal(s.players.a.fruits,4);assert.equal(s.players.a.size,1.4);});

test('collection continues after the score cap without awarding more points',()=>{
 const s=createStarfall(0,'Кирби');s.players.a={...player(),bonus:30};
 assert(collectStar(s,'a',20,s.startsAt+20*STAR_INTERVAL+3000));
 assert.equal(s.players.a.bonus,30);assert.deepEqual(s.players.a.collected,[20]);
 assert(!collectStar(s,'a',20,s.startsAt+20*STAR_INTERVAL+3100));
 assert(collectStar(s,'a',64,s.startsAt+64*STAR_INTERVAL+3000));
 assert.equal(s.players.a.bonus,30);
});

test('every minimum-size finisher earns Tiny Tot alongside existing nominations, without bonus points',()=>{
 const s=createStarfall(0,'Большой');
 s.players.big={...player(),name:'Большой',fruits:30,size:4,bonus:30};
 s.players.tiny={...player(),name:'Маленький',size:.3,bonus:30};
 s.players.other={...player(),name:'Ещё маленький',size:.3};
 s.players.near={...player(),name:'Почти',size:.301};
 s.players.npc={...player(),name:'Другие кирби',size:.3};
 finishStarfall(s,s.endsAt);const results=JSON.stringify(s.results),awards=starfallAwards(s.results!,s.initiator);
 assert.deepEqual(awards.get('big'),['Толстячок','Звёздный собиратель','Любитель приключений']);
 assert.deepEqual(awards.get('tiny'),['Малявка','Звёздный собиратель']);
 assert.deepEqual(awards.get('other'),['Малявка']);
 assert(!awards.get('near')?.includes('Малявка'));assert(!awards.has('npc'));
 assert.equal(JSON.stringify(s.results),results);assert.equal(s.results?.find(r=>r.id==='tiny')?.points,66);
});

test('Tiny Tot depends on size at the finish, not earlier shrinking or changes after results freeze',()=>{
 const s=createStarfall(0,'Большой');s.players.regrown={...player(),size:.3};s.players.tiny={...player(),size:.3};
 s.players.regrown.size=.4;finishStarfall(s,s.endsAt);
 s.players.regrown.size=.3;s.players.tiny.size=1;assert(!finishStarfall(s,s.endsAt+1));
 const awards=starfallAwards(s.results!,s.initiator);
 assert(!awards.get('regrown')?.includes('Малявка'));assert(awards.get('tiny')?.includes('Малявка'));
 assert.equal(starfallAwards([],s.initiator).size,0);
});
