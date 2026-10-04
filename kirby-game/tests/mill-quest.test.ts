import {allTasks} from '../src/starfall';
import {SCORE_ACTIONS} from '../src/score';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newMillQuest,applyMill,advanceMill,millPushTarget,MILL_BRANCHES,MILL_BAGS,MILL_HOPPER,MILL_QUEST_LEVER,MILL_IDLE_MS,MILL_RUN_MS,type MillActor,type MillQuest} from '../src/mill-quest';
import {awardFirst,scoreOf,validAchievements,type ScoreAction} from '../src/score';
import {Watermill} from '../src/watermill';
import {Vector3} from 'three';
import {dryGround} from '../src/pond-layout';
const actor=(p:readonly number[]=MILL_QUEST_LEVER,id='a'):MillActor=>({id,p,yaw:0,size:1});
const clear=(start=1000)=>{let q=applyMill(newMillQuest(),{kind:'start'},actor(),start);for(let i=0;i<3;i++)q=applyMill(q,{kind:'push',index:i},actor(MILL_BRANCHES[i]),start+200+i);return q;};
const bags=()=>{let q=clear();q=applyMill(q,{kind:'gate'},actor(),2000);q=applyMill(q,{kind:'gate'},actor(),3000);return advanceMill(q,6000);};

test('quest requires nearby lever, owner, three directed pushes and stable correct flow',()=>{
 let q=newMillQuest();assert.equal(applyMill(q,{kind:'start'},actor([0,0,0]),1000),q);
 q=applyMill(q,{kind:'start'},actor(),1000);assert.equal(q.stage,'clear');
 assert.equal(applyMill(q,{kind:'push',index:0},actor(MILL_BRANCHES[0],'b'),1100),q);
 const behind=actor([42.8,0,32.5]);behind.yaw=Math.PI;assert.equal(millPushTarget(q,behind),-1);
 q=clear();assert.equal(q.stage,'flow');assert.equal(advanceMill(q,4000).stage,'flow');
 q=applyMill(q,{kind:'gate'},actor(),4000);assert.equal(q.gate,2);assert.equal(advanceMill(q,8000).stage,'flow');
 q=applyMill(q,{kind:'gate'},actor(),8100);assert.equal(q.gate,1);assert.equal(advanceMill(q,11099).stage,'flow');assert.equal(advanceMill(q,11100).stage,'bags');
});

test('automatic bag pickup, wrong colour returns, and ordered delivery awards six only once',()=>{
 let q=bags();assert.equal(q.stage,'bags');const wrong=(q.order[0]+1)%3;
 q=applyMill(q,{kind:'pick',index:wrong},actor(MILL_BAGS[wrong]),6100);assert.equal(q.carried,wrong);
 q=applyMill(q,{kind:'deliver'},actor(MILL_HOPPER),6200);assert.equal(q.carried,-1);assert.equal(q.delivered,0);assert.equal(q.rejected,wrong);
 const earned={fruitsEaten:0,achievements:new Set<ScoreAction>()};let now=8000;
 for(const index of q.order){q=applyMill(q,{kind:'pick',index},actor(MILL_BAGS[index]),now++);q=applyMill(q,{kind:'deliver'},actor(MILL_HOPPER),now++);}
 assert.equal(q.stage,'running');assert.equal(q.delivered,3);assert(awardFirst(earned,'millQuest'));assert.equal(scoreOf(earned),6);assert(!awardFirst(earned,'millQuest'));assert.equal(scoreOf(earned),6);
 assert.equal(advanceMill(q,q.runningUntil-1),q);const idle=advanceMill(q,q.runningUntil);assert.equal(idle.stage,'idle');assert.equal(applyMill(idle,{kind:'start'},actor(MILL_QUEST_LEVER,'b'),q.runningUntil+1).owner,'b');
 assert.equal(q.runningUntil,q.updatedAt+MILL_RUN_MS);
});

test('abandonment/disconnection releases quest; duplicate/out-of-order actions cannot skip stages',()=>{
 const q=applyMill(newMillQuest(),{kind:'start'},actor(),1000);
 assert.equal(advanceMill(q,2000,false).stage,'idle');assert.equal(advanceMill(q,1000+MILL_IDLE_MS).stage,'idle');
 assert.equal(applyMill(q,{kind:'deliver'},actor(MILL_HOPPER),2000),q);assert.equal(applyMill(q,{kind:'pick',index:0},actor(MILL_BAGS[0]),2000),q);
 assert.equal(applyMill(q,{kind:'start'},actor(MILL_QUEST_LEVER,'b'),2000),q);
 const b=bags(),picked=applyMill(b,{kind:'pick',index:0},actor(MILL_BAGS[0]),9000);assert.equal(applyMill(picked,{kind:'pick',index:1},actor(MILL_BAGS[1]),9100),picked);
 assert.equal(applyMill(b,{kind:'pick',index:NaN},actor(),9000),b);
 assert(!allTasks(SCORE_ACTIONS.map(id=>id==='millQuest'?'mill':id)));
 assert(validAchievements(['mill','millQuest']));assert.equal(scoreOf({fruitsEaten:0,achievements:new Set<ScoreAction>(['mill'])}),3);
});

test('quest pickup and delivery locations stand on dry banks; solo and server share deterministic state',()=>{
 for(const p of [...MILL_BAGS,MILL_HOPPER,MILL_QUEST_LEVER])assert(dryGround(p[0],p[2],.7),`dry bank ${p}`);
 const a=JSON.parse(JSON.stringify(bags())) as MillQuest,b=bags();assert.deepEqual(a,b);
 for(const size of [1,7,20]){const mill=new Watermill(),position=new Vector3(...MILL_QUEST_LEVER);mill.constrain(position,size);assert(mill.action({...actor(position.toArray()),size}),'enlarged Kirby can reach the lever outside the wall');}
 for(const size of [1,7,20])assert(applyMill(a,{kind:'pick',index:0},{...actor(MILL_BAGS[0]),size},9000).carried===0);
});

// A rejected blue sack must not count toward the following yellow delivery.
test('blue instead of yellow, then yellow, advances by exactly one sack',()=>{
 let q={...bags(),order:[1,2,0]};
 q=applyMill(q,{kind:'pick',index:2},actor(MILL_BAGS[2]),8000);
 q=applyMill(q,{kind:'deliver'},actor(MILL_HOPPER),8100);
 assert.equal(q.delivered,0);assert.equal(q.stage,'bags');assert.equal(q.carried,-1);
 q=applyMill(q,{kind:'deliver'},actor(MILL_HOPPER),8200);
 assert.equal(q.delivered,0);
 q=applyMill(q,{kind:'pick',index:1},actor(MILL_BAGS[1]),9500);
 q=applyMill(q,{kind:'deliver'},actor(MILL_HOPPER),9600);
 assert.equal(q.delivered,1);assert.equal(q.stage,'bags');assert.equal(q.order[q.delivered],2);
 q=applyMill(q,{kind:'deliver'},actor(MILL_HOPPER),9700);
 assert.equal(q.delivered,1);
});
