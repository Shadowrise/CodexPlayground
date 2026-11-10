import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newVisitProgress,recordVisitBattle,validVisitStats} from '../src/visit-stats';
import {startKnightBattle,type KnightActor} from '../src/meta-knight-battle';
import {SoloHistory} from '../src/solo-history';
import {deviceInfo,validSoloReport,type SoloReport} from '../src/history-types';

const actor:KnightActor={id:'solo',p:[0,0,-2],yaw:0,available:true};
test('encounters count once per boss, excluding choices, spectators, withdrawals and old results',()=>{
 const progress=newVisitProgress(),battle=startKnightBattle([actor],'solo',1000)!;
 assert(!recordVisitBattle(progress,battle,'spectator'));
 battle.stage='side-choice';assert(!recordVisitBattle(progress,battle,'solo'));
 battle.stage='intro';assert(recordVisitBattle(progress,battle,'solo'));
 assert(!recordVisitBattle(progress,battle,'solo'));
 battle.stage='won';assert(recordVisitBattle(progress,battle,'solo'));assert(!recordVisitBattle(progress,battle,'solo'));
 assert.deepEqual(progress.stats,{seals:0,feathers:0,knightStarted:1,knightWon:1,pidgeyStarted:0,pidgeyWon:0});
 const restored=structuredClone(progress);assert(!recordVisitBattle(restored,battle,'solo'),'persisted trackers deduplicate results after wakeup');
 assert(!recordVisitBattle(newVisitProgress(),battle,'solo'),'finished encounters cannot become a new visit');
 const pigeon=startKnightBattle([actor],'solo',2000,'metapidgie')!;
 recordVisitBattle(progress,pigeon,'solo');pigeon.stage='cancelled';pigeon.players.solo.withdrawn=true;
 assert(!recordVisitBattle(progress,pigeon,'solo'));pigeon.stage='won';assert(!recordVisitBattle(progress,pigeon,'solo'));
 const helper=startKnightBattle([actor],'solo',3000,'metapidgie')!;helper.players.solo.side='boss';
 recordVisitBattle(progress,helper,'solo');helper.stage='won';assert(!recordVisitBattle(progress,helper,'solo'));
 helper.stage='lost';assert(recordVisitBattle(progress,helper,'solo'));
 const defeated=startKnightBattle([actor],'solo',4000)!;recordVisitBattle(progress,defeated,'solo');defeated.players.solo.hp=0;defeated.stage='won';
 assert(!recordVisitBattle(progress,defeated,'solo'));
 assert.deepEqual(progress.stats,{seals:0,feathers:0,knightStarted:2,knightWon:1,pidgeyStarted:2,pidgeyWon:1});
 assert(validVisitStats(progress.stats));
 for(const stats of [null,[],{}, {...progress.stats,seals:4},{...progress.stats,feathers:6},{...progress.stats,knightWon:3},{...progress.stats,pidgeyStarted:-1},{...progress.stats,pidgeyWon:.5},{...progress.stats,seals:Infinity}])assert(!validVisitStats(stats));
});

test('actual solo reports carry personal rewards and encounters, and a loaded game starts fresh visit counters',async()=>{
 const globals=globalThis as any,oldDocument=globals.document,oldWindow=globals.window,oldFetch=globals.fetch;
 const document=Object.assign(new EventTarget(),{hidden:false}),window=new EventTarget(),reports:SoloReport[]=[];
 globals.document=document;globals.window=window;globals.fetch=async(_url:unknown,options:RequestInit)=>{reports.push(JSON.parse(String(options.body)));return new Response(null,{status:204});};
 let history:SoloHistory|undefined;
 try{
  const snapshot=()=>({name:'Тест',variant:0,score:40,tasksDone:3,tasksTotal:13});
  history=new SoloHistory('https://test',snapshot,()=>deviceInfo('Windows Chrome/130'));
  assert.deepEqual(reports[0].stats,newVisitProgress().stats);
  history.collect('seals');history.collect('feathers');history.collect('feathers');
  const battle=startKnightBattle([actor],'solo',1000,'metapidgie')!;
  history.battle(battle);history.battle(battle);battle.stage='won';history.battle(battle);history.stop();
  assert.deepEqual(reports.at(-1)!.stats,{seals:1,feathers:2,knightStarted:0,knightWon:0,pidgeyStarted:1,pidgeyWon:1});
  assert(reports.at(-1)!.end);assert(validSoloReport(reports.at(-1)));
  history=new SoloHistory('https://test',snapshot,()=>deviceInfo('Windows Chrome/130'));
  assert.deepEqual(reports.at(-1)!.stats,newVisitProgress().stats);history.stop();
  assert.notEqual(reports[0].id,reports.at(-1)!.id);
  await new Promise(resolve=>setImmediate(resolve));
 }finally{history?.stop();globals.document=oldDocument;globals.window=oldWindow;globals.fetch=oldFetch;}
});
