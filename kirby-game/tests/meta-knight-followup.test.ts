import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceKnightSideChoices,knightSideChoiceDeadline,KNIGHT_SIDE_CHOICE_MS,type KnightSideChoices} from '../src/meta-knight-side-choice';
import {startKnightBattle,setKnightPhase,advanceKnightBattle,cancelKnightBattle,knightArenaSide,type KnightActor} from '../src/meta-knight-battle';
import {startHelperAbility} from '../src/meta-knight-helper';
import {knightCosmicAlly} from '../src/meta-knight-cosmic-ally';
import {COSMIC,cosmicPlayerPush,cosmicVictoryDescent} from '../src/meta-knight-cosmic';
import {cosmicTravel} from '../src/meta-knight-cosmic-world';
import {knightCelebration} from '../src/meta-knight-celebration';
import {knightAnnexPoint} from '../src/meta-knight-arena-site';

function fixture(side:'players'|'boss'='boss'){
 const actors:KnightActor[]=[{id:'hero',p:[0,0,-2],yaw:0,available:true},{id:'helper',p:[14,0,9],yaw:1,available:true,metaKnight:true,side}];
 const s=startKnightBattle(actors,'hero',1000)!;for(const id of Object.keys(s.opponents??{}))delete s.players[id];delete s.opponents;delete s.teamHp;return {actors,s};
}
test('selection starts with the duel, persists for fifteen seconds and then continues automatically with the players',()=>{
 const {actors}=fixture();delete actors[1].side;let room:KnightSideChoices={};assert(!advanceKnightSideChoices(room,actors,500),'entering the arena alone does not open a choice');assert.equal(knightSideChoiceDeadline(room),Infinity);
 room.knightBattle=startKnightBattle(actors,'hero',1000);assert.equal(room.knightBattle!.stage,'side-choice');assert.equal(knightSideChoiceDeadline(room),1000+KNIGHT_SIDE_CHOICE_MS);
 assert.equal(advanceKnightSideChoices(room,actors,5000),false,'ordinary frames never restart the timer');room=JSON.parse(JSON.stringify(room));assert(!advanceKnightSideChoices(room,actors,15999));assert.equal(room.knightSides,undefined);
 assert(advanceKnightSideChoices(room,actors,16000));assert.deepEqual(room.knightSides,{helper:'players'});assert.equal(knightSideChoiceDeadline(room),Infinity);assert.equal(room.knightBattle!.stage,'intro');assert.equal(room.knightBattle!.since,16000);assert.equal(room.knightBattle!.teamHp,5);
 const manual:KnightSideChoices={knightBattle:startKnightBattle(actors,'hero',20000),knightSides:{helper:'boss'}};assert(advanceKnightSideChoices(manual,actors,21000));assert.equal(manual.knightBattle!.stage,'intro');assert.equal(manual.knightBattle!.players.helper.side,'boss');assert.equal(manual.knightBattle!.players.hero.hp,8);
});
test('spectators never get a choice, and the remaining lone Meta Knight keeps their choice',()=>{
 const {actors}=fixture();delete actors[1].side;const room:KnightSideChoices={};assert(!advanceKnightSideChoices(room,[actors[1]],1000));const annex=knightAnnexPoint(0,64);actors[1].p=[annex.x,0,annex.z];room.knightBattle=startKnightBattle(actors,'hero',2000);assert.equal(room.knightBattle!.stage,'intro');assert.equal(knightSideChoiceDeadline(room),Infinity);
 actors[1].p=[12,0,0];room.knightBattle=startKnightBattle(actors,'hero',3000);assert.equal(knightSideChoiceDeadline(room),18000);actors[0].available=false;assert(!advanceKnightSideChoices(room,actors,4000));assert.equal(room.knightBattle!.stage,'side-choice');assert.equal(knightSideChoiceDeadline(room),18000);
});
for(const side of ['players','boss'] as const)test(`${side}: only a boss ally gathers in the centre and avoids the cosmic player recoil`,()=>{
 const {actors,s}=fixture(side);assert(setKnightPhase(s,4,actors,10000));
 assert.equal(!!knightCosmicAlly(s,'helper',10500),side==='boss');
 if(side==='boss'){assert(Math.hypot(...knightCosmicAlly(s,'helper',s.until)!.p.map((v,i)=>v-[4.8,0,0][i]))<1e-8);assert(!startHelperAbility(s,actors[1],4,10500));}
 advanceKnightBattle(s,actors,s.until);assert.equal(s.stage,'cosmic-charge');
 if(side==='boss')for(const slot of [1,2,3,4] as const)assert(!startHelperAbility(s,actors[1],slot,s.since+100));
 for(let i=0;i<2;i++)advanceKnightBattle(s,actors,s.until);assert.equal(s.stage,'cosmic-surge');
 assert(s.cosmicLaunch!.players.hero);assert.equal(!!s.cosmicLaunch!.players.helper,side==='players');assert.equal(!!cosmicPlayerPush(s,'helper',s.since+1500),side==='players');
 advanceKnightBattle(s,actors,s.until);advanceKnightBattle(s,actors,s.until);assert.equal(s.stage,'cosmic-rise');
 const pose=knightCosmicAlly(JSON.parse(JSON.stringify(s)),'helper',s.since+COSMIC.riseMs/2);
 if(side==='boss'){assert.equal(pose!.p[0],4.8);assert.equal(pose!.p[1],90);assert.equal(pose!.p[2],0);}else assert.equal(pose,undefined);
 if(side==='boss'){s.players.helper.hp=0;assert.equal(knightCosmicAlly(s,'helper',s.since+200),undefined,'a defeated helper remains dazed');}
});
test('a fourth-phase boss victory returns continuously to the arena before running, smiling or dancing',()=>{
 const {actors,s}=fixture();setKnightPhase(s,4,actors,10000);Object.assign(s,{stage:'cosmic-spin-warn',since:12000,until:20000,checked:12000});
 actors[1].p=[15,180,-12];s.players.hero.hp=0;advanceKnightBattle(s,actors,13000);assert.equal(s.stage,'lost');
 const c=s.celebration!;assert(c.landAt!>c.at);const middle=(c.landAt!+c.at)/2;
 for(const id of ['boss','helper']){const pose=knightCelebration(s,id,middle)!;assert.equal(pose.phase,'descent');assert.equal(pose.p[1],90);assert.equal(pose.hug,0);assert.equal(pose.jump,0);const landed=knightCelebration(s,id,c.landAt!)!;assert.equal(landed.phase,'run');assert.equal(landed.p[1],0);}
 assert.equal(cosmicVictoryDescent(s,middle)!.height,90);assert(Math.abs(Math.hypot(...cosmicTravel(s,middle,c.heading!))-120)<1e-8);
 assert.equal(Math.hypot(...cosmicTravel(s,c.landAt!,c.heading!)),0);
 const later=knightCelebration(s,'helper',c.landAt!+3400)!;assert.equal(later.phase,'hug');assert(later.p[1]<1);
});

test('leaving during the choice preserves the gate side and lets a distant surviving fighter continue',()=>{
 const {actors}=fixture();delete actors[1].side;actors.push({id:'friend',p:[30,0,0],yaw:0,available:true});const room:KnightSideChoices={knightBattle:startKnightBattle(actors,'hero',1000)};
 cancelKnightBattle(room.knightBattle,'hero',1100);room.knightSides={helper:'boss'};assert(advanceKnightSideChoices(room,actors,1200));assert.equal(room.knightBattle!.stage,'intro');assert.equal(room.knightBattle!.target,'friend');assert(room.knightBattle!.players.hero.withdrawn);assert.equal(knightArenaSide(room.knightBattle,'hero'),'arena');assert.deepEqual(actors[2].p,[30,0,0],'continuing does not teleport the new initiator');
 const next:KnightSideChoices={knightBattle:startKnightBattle(actors,'hero',2000)};cancelKnightBattle(next.knightBattle,'helper',2100);assert(advanceKnightSideChoices(next,actors,2200));assert(next.knightBattle!.players.helper.withdrawn);assert.equal(knightArenaSide(next.knightBattle,'helper'),'arena');
});
