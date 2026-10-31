import test from 'node:test';
import assert from 'node:assert/strict';
import {startKnightBattle,advanceKnightBattle,knightAttack,type KnightActor} from '../src/meta-knight-battle';
import {startHelperAbility,helperPosition,helperLocked,helperShotExitAt,helperProjectile} from '../src/meta-knight-helper';
import {humanKnightFixture} from './knight-human-fixture';

function fixture(x=0,yaw=Math.PI/2){
 const actors:KnightActor[]=[{id:'hero',p:[0,0,-2],yaw:0,available:true},{id:'helper',p:[12,0,0],yaw,available:true,metaKnight:true,side:'boss'}];
 const s=humanKnightFixture(startKnightBattle(actors,'hero',100000)!);Object.assign(s,{stage:'rest',until:1e9,from:[-25,0,-25],to:[-25,0,-25]});actors[1].p=[x,0,0];assert(startHelperAbility(s,actors[1],1,100000));return {s,actors,h:s.players.helper.helper!,c:s.players.helper.helper!.cast!};
}
for(const [x,yaw] of [[0,0],[40,Math.PI/2],[40,-Math.PI/2],[20,.7]])test(`crescent releases movement exactly at the arena edge from ${x}/${yaw}`,()=>{
 const {h,c}=fixture(x,yaw),exit=helperShotExitAt(c),point=helperProjectile(c,exit)!;assert(Math.abs(Math.hypot(point[0],point[2])-46)<1e-8);
 assert(helperLocked(h,exit-.01));assert.equal(helperPosition(h,exit),undefined);assert.equal(helperPosition(h,exit+500),undefined);assert(!helperLocked(h,c.release+4500));
 assert(!helperLocked(structuredClone(h),exit));
});
test('an outgoing crescent past the edge cannot be reflected back or pin its sender',()=>{
 const {s,actors,h,c}=fixture(40),exit=helperShotExitAt(c);actors[0].p=[49,0,0];actors[0].yaw=-Math.PI/2;knightAttack(s,actors[0],exit+10);advanceKnightBattle(s,actors,exit+20);
 assert.equal(c.returned,undefined);assert.equal(c.resolved,true);assert.equal(s.players.helper.hp,5);assert(!helperLocked(h,exit+20));
 assert(startHelperAbility(s,actors[1],2,exit+30),'another ready ability is usable immediately');
});
test('a reflection before the edge still returns to and stuns its sender',()=>{
 const {s,actors,h,c}=fixture(40);actors[0].p=[44,0,0];actors[0].yaw=-Math.PI/2;knightAttack(s,actors[0],c.release+60);advanceKnightBattle(s,actors,c.release+80);assert(c.returned);
 assert(helperLocked(h,helperShotExitAt(c)+10),'a real return retains the sender for the hit');advanceKnightBattle(s,actors,c.returned.at+650);assert.equal(s.players.helper.hp,4);assert(h.stunnedUntil!>c.returned.at+650);
});
test('an unreflected contact just inside the edge still consumes a team life once',()=>{
 const {s,actors,c}=fixture(40),exit=helperShotExitAt(c),before=s.players.hero.hp;actors[0].p=[45.9,0,0];
 advanceKnightBattle(s,actors,exit);assert.equal(s.players.hero.hp,before-1);assert.equal(c.resolved,true);
 advanceKnightBattle(s,actors,exit+200);assert.equal(s.players.hero.hp,before-1);
});
