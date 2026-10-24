import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KNIGHT,startKnightBattle,advanceKnightBattle,knightAttack,cancelKnightBattle,knightPartyHearts,knightPlayerVisible,knightShotOrigin,type KnightActor} from '../src/meta-knight-battle';

function fixture(count=2){
 const actors:KnightActor[]=Array.from({length:count},(_,i)=>({id:String(i),p:[i,0,-2],yaw:Math.PI,available:true}));
 const s=startKnightBattle(actors,'0',1000)!;
 Object.assign(s,{stage:'slash',pattern:'sword',since:4000,until:20000,checked:4000,from:[0,0,0],to:[0,0,0],yaw:0});
 for(const a of actors)a.p=[20,0,20];
 return {s,actors};
}

test('a party starts with five shared lives; each hit drains the bank while immunity remains personal',()=>{
 const {s,actors:[a,b]}=fixture();assert.equal(s.teamHp,5);
 a.p=[0,0,8];advanceKnightBattle(s,[a,b],4001);
 assert.equal(knightPartyHearts(s),4);assert.equal(s.players[a.id].hp,4);assert.equal(s.players[b.id].hp,4);
 assert.equal(s.players[b.id].invulnerable,0);assert(s.players[a.id].invulnerable>4001);
 assert.equal(knightPlayerVisible(s,a.id,4085),false);assert.equal(knightPlayerVisible(s,b.id,4085),true);
 advanceKnightBattle(s,[a,b],4100);assert.equal(s.teamHp,4,'the same contact respects hit immunity');
 b.p=[0,0,8];advanceKnightBattle(s,[a,b],4200);assert.equal(s.teamHp,3,'a teammate has independent immunity');
 assert(Object.values(s.players).every(p=>p.hp===3));assert(knightAttack(s,a,4300));assert(knightAttack(s,b,4300));
});

test('the fifth team hit defeats everyone and cannot underflow even when six players are struck together',()=>{
 const {s,actors}=fixture(6);for(const a of actors)a.p=[0,0,8];
 advanceKnightBattle(s,actors,4001);assert.equal(s.teamHp,0);assert.equal(s.stage,'lost');
 assert(Object.values(s.players).every(p=>p.hp===0));assert(actors.every(a=>!knightAttack(s,a,4200)));
 const retry=startKnightBattle(actors.map(a=>({...a,p:[0,0,-2]})),'0',5000)!;
 assert.equal(retry.teamHp,5);assert(Object.values(retry.players).every(p=>p.hp===5));
});

test('the last team hit takes precedence over a pending counterattack',()=>{
 const {s,actors:[a,b]}=fixture();s.teamHp=1;
 Object.assign(s,{stage:'open',pattern:'leap',since:4000,checked:4000});a.p=[0,0,2];b.p=[0,0,3];
 s.players[a.id].attackAt=3800;s.players[a.id].handled=0;
 advanceKnightBattle(s,[a,b],4001);assert.equal(s.stage,'lost');assert.equal(s.hp,12);assert.equal(s.teamHp,0);
});

test('unreflected crescent contacts consume the same pool once per struck player',()=>{
 const {s,actors}=fixture();Object.assign(s,{stage:'shot',pattern:'crescent',height:0});
 const origin=knightShotOrigin(s);for(const a of actors)a.p=[origin[0],0,origin[2]+4];
 advanceKnightBattle(s,actors,4300);assert.equal(s.teamHp,5,'contact grace allows a parry first');
 advanceKnightBattle(s,actors,4300+KNIGHT.parryGraceMs);assert.equal(s.teamHp,3);
 advanceKnightBattle(s,actors,4500);assert.equal(s.teamHp,3,'the projectile cannot charge twice for the same contact');
});

test('withdrawing and missing actors never refund lives or remove the shared pool',()=>{
 const {s,actors:[a,b]}=fixture();a.p=[0,0,8];advanceKnightBattle(s,[a,b],4001);
 assert(cancelKnightBattle(s,a.id,4100));assert.equal(s.teamHp,4);assert.equal(s.stage,'slash');
 b.p=[0,0,8];advanceKnightBattle(s,[b],4200);assert.equal(s.teamHp,3);assert.equal(s.players[a.id].hp,3);
 const restored=JSON.parse(JSON.stringify(s));advanceKnightBattle(restored,[b],4300);assert.equal(restored.teamHp,3);
});

test('old multiplayer snapshots migrate without healing, and solo keeps its five personal lives',()=>{
 const {s,actors}=fixture();delete s.teamHp;s.players['0'].hp=2;s.players['1'].hp=4;
 advanceKnightBattle(s,actors,4001);assert.equal(s.teamHp,2);assert(Object.values(s.players).every(p=>p.hp===2));
 const {s:solo,actors:[a]}=fixture(1);assert.equal(solo.teamHp,undefined);a.p=[0,0,8];
 advanceKnightBattle(solo,[a],4001);assert.equal(solo.players[a.id].hp,4);assert.equal(knightPartyHearts(solo),4);
});
