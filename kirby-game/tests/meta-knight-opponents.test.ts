import test from 'node:test';
import assert from 'node:assert/strict';
import {startKnightBattle,advanceKnightBattle,cancelKnightBattle,knightPartyHearts,knightPartyMaximum,type KnightActor} from '../src/meta-knight-battle';
import {advanceKnightSideChoices,type KnightSideChoices} from '../src/meta-knight-side-choice';
import {createKnightOpponents,OPPONENTS} from '../src/meta-knight-opponents';
import {KIRBY_VARIANTS,isPigeonVariant} from '../src/variant-palette';
import {simulate} from '../scripts/meta-knight-opponents-balance';

const knight=(side?:'boss'|'players'):KnightActor=>({id:'solo',p:[0,0,-2],yaw:0,available:true,metaKnight:true,variant:18,side});
test('a lone Meta Knight is asked at every duel start; either answer starts the correct fight',()=>{
 for(const side of ['boss','players'] as const){
  const a=knight(),room:KnightSideChoices={knightBattle:startKnightBattle([a],a.id,1000)};
  assert.equal(room.knightBattle!.stage,'side-choice');assert.equal(room.knightBattle!.choice!.until,16000);
  assert.equal(advanceKnightSideChoices(room,[a],1100),false);room.knightSides={solo:side};assert(advanceKnightSideChoices(room,[a],1200));
  const s=room.knightBattle!;assert.equal(s.stage,'intro');assert.equal(Object.keys(s.opponents??{}).length,side==='boss'?3:0);assert.equal(s.players.solo.side,side==='boss'?'boss':undefined);
  assert.equal(s.players.solo.hp,5);assert(s.players[s.target]);
  cancelKnightBattle(s,'solo',1300);assert.equal(s.stage,'cancelled');assert.equal(startKnightBattle([a],a.id,2000)!.stage,'side-choice');
 }
});
test('the solo deadline defaults to the player team without creating bots',()=>{
 const a=knight(),room:KnightSideChoices={knightBattle:startKnightBattle([a],a.id,1000)};
 advanceKnightSideChoices(room,[a],16000);assert.equal(room.knightSides!.solo,'players');assert.equal(room.knightBattle!.opponents,undefined);assert.equal(room.knightBattle!.stage,'intro');
});
test('three unique opponents use the complete palette including pigeons and variants outside ambient NPC slots',()=>{
 const seen=new Set<number>();
 for(let seed=1000;seed<50000;seed+=101){const bots=Object.values(createKnightOpponents(seed,[0,18]));assert.equal(bots.length,3);assert.equal(new Set(bots.map(b=>b.variant)).size,3);for(const b of bots){assert.notEqual(b.variant,0);assert.notEqual(KIRBY_VARIANTS[b.variant][0],'Meta Knight');seen.add(b.variant);}}
 assert([...seen].some(i=>isPigeonVariant(KIRBY_VARIANTS[i][0])));assert(seen.has(15));assert(seen.has(16));assert(seen.has(22));
});
test('bots exist with human opponents too; movement is bounded, authoritative and survives snapshots',()=>{
 const a=knight('boss'),human:KnightActor={id:'hero',p:[12,0,4],yaw:0,available:true,variant:0},s=startKnightBattle([a,human],'solo',1000)!;
 assert.equal(Object.keys(s.opponents!).length,3);assert.equal(s.players.hero.hp,8);assert.equal(knightPartyHearts(s),44);assert.equal(knightPartyMaximum(s),44);
 s.stage='open';s.until=100000;const copy=structuredClone(s),before=Object.values(s.opponents!).map(b=>[...b.p]);
 advanceKnightBattle(s,[a,human],5100);advanceKnightBattle(copy,[a,human],5100);assert.deepEqual(s,copy);
 Object.values(s.opponents!).forEach((b,i)=>assert(Math.hypot(b.p[0]-before[i][0],b.p[2]-before[i][2])<=OPPONENTS.speed*.15+.001));
 assert.equal(cancelKnightBattle(s,'solo',5200),true);assert.notEqual(s.stage,'cancelled','a human opponent can continue');
});
test('the same roster can defeat idle Meta Knight and lose when the player helps the boss',()=>{
 const idle=simulate(107919,'idle'),active=simulate(107919,'aimed');
 assert.equal(idle.result,'won','the AI can defeat the big boss through all four phases');
 assert.equal(active.result,'lost','player abilities can change that outcome');
 assert(active.casts>0);assert.equal(idle.phase,4);assert.equal(idle.boss,0);
});
test('AI uses real counterattack windows and stopping the last human cancels an AI-only battle',()=>{
 const a=knight('boss'),s=startKnightBattle([a],'solo',1000)!;
 Object.assign(s,{stage:'open',since:1100,until:100000,from:[0,0,0],to:[0,0,0]});
 for(let now=1500;now<6000;now+=50)advanceKnightBattle(s,[a],now);
 assert(s.hp<12,'the AI must land an ordinary melee counterattack');assert(Object.values(s.players).some(p=>p.hits>0));
 cancelKnightBattle(s,'solo',6000);assert.equal(s.stage,'cancelled');
});
