import test from 'node:test';
import assert from 'node:assert/strict';
import {startKnightBattle,advanceKnightBattle,knightAttack,knightDanger,knightPosition,knightProjectile,type KnightActor,type KnightBattle} from '../src/meta-knight-battle';
import {metaKnightVictoryLog} from '../src/world-log';
import {CharacterUnlocks} from '../src/character-unlocks';
const actor=(id='a'):KnightActor=>({id,p:[0,0,-2],yaw:Math.PI,available:true});
function battle(){return startKnightBattle([actor()],'a',1000)!;}
function setStage(s:KnightBattle,stage:KnightBattle['stage'],now=2000){Object.assign(s,{stage,since:now,until:now+2000,checked:now,from:[0,0,0],to:[0,0,0],yaw:0,height:0,openHit:false});}
test('duel requires proximity and an available grounded player; fresh attempts restore both health pools',()=>{
 assert(!startKnightBattle([{...actor(),p:[30,0,30]}],'a',1000));assert(!startKnightBattle([{...actor(),available:false}],'a',1000));
 const s=battle();assert.equal(s.hp,12);assert.equal(s.players.a.hp,5);assert.equal(s.stage,'intro');
 s.hp=1;s.players.a.hp=0;const retry=battle();assert.equal(retry.hp,12);assert.equal(retry.players.a.hp,5);
});
test('warnings leave the boss stationary and lock destinations; actual jump/dash/dive use those destinations',()=>{
 const s=battle();setStage(s,'dash-warn');s.to=[10,0,0];s.height=2;
 assert.deepEqual(knightPosition(s,2900),[0,2,0]);s.stage='dash';assert.deepEqual(knightPosition(s,3000),[5,2,0]);
 s.stage='jump';s.height=0;assert.deepEqual(knightPosition(s,3000),[5,5,0]);
});
test('sword sectors, swept flight lanes, impact circles and low waves have distinct honest hit regions',()=>{
 const s=battle();setStage(s,'slash');const a=actor();a.p=[0,0,3];assert(knightDanger(s,a,2100));a.p=[4,0,0];assert(!knightDanger(s,a,2100));a.p=[0,2.9,3];assert(!knightDanger(s,a,2100));
 setStage(s,'dash');s.to=[10,0,0];a.p=[5,0,0];assert(knightDanger(s,a,3200,2800));a.p=[5,0,3];assert(!knightDanger(s,a,3200,2800));
 setStage(s,'slam');a.p=[0,0,1];assert(knightDanger(s,a,2100));a.p=[0,3,1];assert(!knightDanger(s,a,2100));
 setStage(s,'wave');a.p=[0,0,3.5];assert(knightDanger(s,a,2500,2450));a.p[1]=1.2;assert(!knightDanger(s,a,2500,2450));
});
test('one attack cannot drain multiple hearts; no hearts is a real loss',()=>{
 const s=battle(),a=actor();setStage(s,'slash');a.p=[0,0,2];advanceKnightBattle(s,[a],2001);assert.equal(s.players.a.hp,4);
 advanceKnightBattle(s,[a],2100);assert.equal(s.players.a.hp,4);
 s.players.a.hp=1;s.players.a.invulnerable=0;advanceKnightBattle(s,[a],2200);assert.equal(s.stage,'lost');assert.equal(s.hp,12);
});
test('early, repeated and held attacks do not create permanent reflection; accurate reflection opens a melee opportunity',()=>{
 const s=battle(),a=actor();setStage(s,'shot');s.to=[0,0,8];s.height=0;a.p=[0,0,6];a.yaw=Math.PI;
 assert(knightAttack(s,a,2050));assert(!knightAttack(s,a,2100));advanceKnightBattle(s,[a],2800);assert.equal(s.players.a.hp,4);assert.equal(s.stage,'shot');
 const good=battle();setStage(good,'shot');good.to=[0,0,8];good.height=0;
 assert(knightAttack(good,a,2600));advanceKnightBattle(good,[a],2800);assert.equal(good.stage,'return');assert.equal(good.players.a.reflects,1);assert.equal(good.hp,12);assert.equal(good.players.a.hp,5);
 assert(knightProjectile(good,2900));advanceKnightBattle(good,[a],3251);assert.equal(good.stage,'open');
});
test('all three phases are won through 12 valid melee openings; spam and distant hits fail',()=>{
 const s=battle(),a=actor();let now=2000;const phases=new Set<number>();
 for(let i=0;i<12;i++){
  setStage(s,'open',now);a.p=[0,0,2];a.yaw=Math.PI;assert(knightAttack(s,a,now+10));advanceKnightBattle(s,[a],now+160);phases.add(s.phase);
  const health=s.hp;advanceKnightBattle(s,[a],now+180);assert.equal(s.hp,health);now+=3000;
 }
 assert.deepEqual([...phases],[1,2,3]);assert.equal(s.hp,0);assert.equal(s.stage,'won');assert.equal(s.players.a.hits,12);
 const miss=battle();setStage(miss,'open');a.p=[0,0,12];knightAttack(miss,a,2010);advanceKnightBattle(miss,[a],2200);assert.equal(miss.hp,12);
});
test('complete attack schedules include sword, jumping, waves, flight, diving and crescents without invisible warning damage',()=>{
 for(const phase of [1,2,3] as const){const s=battle(),a=actor();s.phase=phase;s.players.a.invulnerable=1e12;const seen=new Set<string>();
  for(let now=1000;now<115000;now+=40){advanceKnightBattle(s,[a],now);seen.add(s.stage);if(s.stage.endsWith('-warn'))assert(!knightDanger(s,a,now));}
  for(const stage of phase===1?['slash','jump','wave','shot']:phase===2?['dash','dive','wave','shot']:['dash','slash','jump','dive','wave','shot'])assert(seen.has(stage),`phase ${phase} missing ${stage}`);
 }
});
test('disconnection and late spectators cannot award themselves a victory; loss does not unlock Meta Knight',()=>{
 const s=battle(),late=actor('late');setStage(s,'open');assert(!knightAttack(s,late,2100));advanceKnightBattle(s,[],2200);assert.equal(s.stage,'lost');
 const unlocks=new CharacterUnlocks();assert(unlocks.isLocked('Meta Knight'));assert(unlocks.unlockMetaKnight());assert(!unlocks.isLocked('Meta Knight'));
});
test('requested respect message has no player prefix, treats player names as text and supports literal replacement symbols',()=>{
 const entry=metaKnightVictoryLog('Саша $&');assert.equal(entry.name,'');assert.equal(entry.chat,false);assert.equal(entry.text,'Метакнайт с уважением смотрит на Саша $&.');
});
