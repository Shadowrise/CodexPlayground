import test from 'node:test';
import assert from 'node:assert/strict';
import {knightHealthPhases} from '../src/meta-knight-health';
import {startKnightBattle,advanceKnightBattle,type KnightBattle} from '../src/meta-knight-battle';

test('four visible phase sections count the actual hits: four, four, three and six',()=>{
 const phases=knightHealthPhases(undefined);assert.deepEqual(phases.map(p=>p.maximum),[4,4,3,6]);assert.deepEqual(phases.map(p=>p.remaining),[4,4,3,6]);
 for(const [phase,hp,expected] of [[1,12,[4,4,3,6]],[1,9,[1,4,3,6]],[1,8,[0,4,3,6]],[2,8,[0,4,3,6]],[2,4,[0,0,3,6]],[3,3,[0,0,3,6]],[3,1,[0,0,1,6]],[3,0,[0,0,0,6]],[4,6,[0,0,0,6]],[4,1,[0,0,0,1]],[4,0,[0,0,0,0]]] as const){
  const view=knightHealthPhases({phase,hp});assert.deepEqual(view.map(p=>p.remaining),expected,`phase ${phase}, hp ${hp}`);assert.equal(view.filter(p=>p.state==='current').length,1);assert.equal(view.find(p=>p.state==='current')!.phase,phase);
 }
});
test('entering the crystal phase and cosmic phase never refills the overall boss meter',()=>{
 const a={id:'a',p:[0,0,-2] as [number,number,number],yaw:0,available:true},s=startKnightBattle([a],'a',1000)!,total=(s:KnightBattle)=>knightHealthPhases(s).reduce((n,p)=>n+p.remaining,0);
 Object.assign(s,{phase:2,hp:4,stage:'get-up',since:2000,until:2260});const before=total(s);advanceKnightBattle(s,[a],2260);assert.equal(s.phase,3);assert.equal(s.hp,3);assert.equal(total(s),before);
 Object.assign(s,{hp:0,brokenCrystals:7,stage:'crystal-break',since:3000,until:4000});const remaining=total(s);advanceKnightBattle(s,[a],4000);assert.equal(s.phase,4);assert.equal(s.hp,6);assert.equal(total(s),remaining);
});
test('old third-phase snapshots preserve broken crystals and finish after three, without a fourth target',()=>{
 const a={id:'a',p:[0,0,-2] as [number,number,number],yaw:0,available:true};
 for(let hits=0;hits<=3;hits++){
  const s=startKnightBattle([a],'a',1000)!;Object.assign(s,{phase:3,hp:4-hits,brokenCrystals:(1<<hits)-1,stage:'crystal-break',since:2000,until:3000});advanceKnightBattle(s,[a],2100);assert.equal(s.hp,3-hits);assert.equal(s.stage,'crystal-break');
  const restored=structuredClone(s);advanceKnightBattle(restored,[a],3000);assert.equal(restored.phase,hits===3?4:3);if(hits===3)assert.equal(restored.hp,6);
 }
});
