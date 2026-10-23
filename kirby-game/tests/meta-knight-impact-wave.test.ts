import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startKnightBattle,advanceKnightBattle,knightAttack,knightPressureWave,knightDanger,cancelKnightBattle,setKnightPhase,type KnightActor} from '../src/meta-knight-battle';

function fixture(hp=8){
 const a:KnightActor={id:'a',p:[0,1.2,3],yaw:Math.PI,available:true},b:KnightActor={id:'b',p:[0,0,41.7],yaw:0,available:true};
 const s=startKnightBattle([{...a,p:[0,0,-2]},b],'a',1000)!;
 Object.assign(s,{phase:2,hp,pattern:'dive',stage:'dive',step:1,cycle:2,since:2000,until:2450,checked:2425,from:[0,0,-9],to:[0,0,0]});
 advanceKnightBattle(s,[a,b],2450);return {s,a,b,landing:2450};
}

test('a dive opens at impact, accepts an immediate counter, and leaves its wave alive through the next attack',()=>{
 const {s,a,b,landing}=fixture();assert.equal(s.stage,'open');assert.equal(s.until-landing,3000);
 const wave=structuredClone(s.impactWave);assert(wave);assert(knightAttack(s,a,landing));advanceKnightBattle(s,[a,b],landing+140);
 assert.equal(s.hp,7);assert.equal(s.stage,'stunned');assert.deepEqual(s.impactWave,wave);
 advanceKnightBattle(s,[a,b],s.until);assert.equal(s.stage,'get-up');advanceKnightBattle(s,[a,b],s.until);assert.equal(s.stage,'approach');
 assert(knightPressureWave(s,s.since));assert.deepEqual(JSON.parse(JSON.stringify(s)).impactWave,wave,'room snapshots retain the independent launch');
 const contact=landing+41.7/.014;advanceKnightBattle(s,[a,b],contact-25);advanceKnightBattle(s,[a,b],contact);
 assert.equal(s.players.b.hp,4,'the far player still takes wave damage after the boss resumes');assert.deepEqual(s.impactWave,wave);
 const end=knightPressureWave(s,contact)!.until;s.players.a.invulnerable=s.players.b.invulnerable=1e12;advanceKnightBattle(s,[a,b],end);
 assert.equal(s.impactWave,undefined);assert(!knightPressureWave(s,end));
});

test('the outgoing ring keeps its ground contact after a hit advances the boss into phase three',()=>{
 const {s,a,b,landing}=fixture(5);assert(knightAttack(s,a,landing));advanceKnightBattle(s,[a,b],landing+140);
 advanceKnightBattle(s,[a,b],s.until);advanceKnightBattle(s,[a,b],s.until);assert.equal(s.stage,'transition');advanceKnightBattle(s,[a,b],s.until);
 assert.equal(s.phase,3);assert.equal(s.stage,'star-rise');const contact=landing+41.7/.014;
 assert(knightDanger(s,b,contact,contact-25));assert(!knightDanger(s,{...b,p:[0,1.2,41.7]},contact,contact-25));
 advanceKnightBattle(s,[a,b],contact-25);advanceKnightBattle(s,[a,b],contact);assert.equal(s.players.b.hp,4);
});

test('a counter by the first fighter cannot skip a second fighter hit by the ring on the same tick',()=>{
 const {s,a,b,landing}=fixture();b.p=[0,0,4.2];assert(knightAttack(s,a,landing+160));advanceKnightBattle(s,[a,b],landing+300);
 assert.equal(s.hp,7);assert.equal(s.stage,'stunned');assert.equal(s.players.b.hp,4);
});

test('cancellation, terminal outcomes and explicit phase resets clear the outgoing hazard',()=>{
 const {s,a,b,landing}=fixture();for(const stage of ['won','lost','cancelled'] as const){const copy=structuredClone(s);copy.stage=stage;assert(!knightPressureWave(copy,landing+200));}
 const reset=structuredClone(s);assert(setKnightPhase(reset,2,[a,b],landing+200));assert.equal(reset.impactWave,undefined);
 assert(cancelKnightBattle(s,'a',landing+200));assert(knightPressureWave(s,landing+200));assert(cancelKnightBattle(s,'b',landing+200));assert(!knightPressureWave(s,landing+200));
});
