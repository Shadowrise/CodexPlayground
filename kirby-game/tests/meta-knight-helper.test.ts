import test from 'node:test';
import assert from 'node:assert/strict';
import {startKnightBattle,advanceKnightBattle,knightAttack,cancelKnightBattle,setKnightPhase,knightPartyMaximum,type KnightActor} from '../src/meta-knight-battle';
import {HELPER,helperChoiceAvailable,startHelperAbility,helperOrbs,helperProjectile,helperPosition,helperVulnerable} from '../src/meta-knight-helper';
import {hitKnightLifeFirefly,spawnKnightLifeFirefly,knightLifeFireflyPoint} from '../src/meta-knight-life-firefly';
import {knightCelebration} from '../src/meta-knight-celebration';

const epoch=100000;
function fixture(extraHero=false){
 const actors:KnightActor[]=[{id:'hero',p:[0,0,-2],yaw:0,available:true},{id:'helper',p:[12,0,0],yaw:0,available:true,metaKnight:true,side:'boss'}];
 if(extraHero)actors.push({id:'friend',p:[-20,0,0],yaw:0,available:true});
 const s=startKnightBattle(actors,'hero',epoch)!;s.stage='rest';s.since=epoch;s.until=epoch+1e9;return {s,actors,hero:actors[0],helper:actors[1],h:s.players.helper.helper!};
}
test('side choice requires a mixed arena roster and rejects an unanswered choice',()=>{
 const {actors}=fixture();assert(helperChoiceAvailable(actors));delete actors[1].side;assert.equal(startKnightBattle(actors,'hero',epoch),undefined);
 actors[0].metaKnight=true;assert(!helperChoiceAvailable(actors));assert.equal(startKnightBattle(actors,'hero',epoch)!.players.helper.hp,5);
});
test('helpers have five independent hearts and are never boss targets or Q attackers',()=>{
 const {s,actors,helper}=fixture(true);assert.equal(s.players.helper.hp,HELPER.hearts);assert.equal(s.teamHp,HELPER.opponentHearts);assert.equal(knightAttack(s,helper,epoch),false);
 s.teamHp=2;advanceKnightBattle(s,actors,epoch+20);assert.equal(s.players.hero.hp,2);assert.equal(s.players.helper.hp,HELPER.hearts);assert.notEqual(s.target,'helper');
});
test('choosing the players retains the ordinary shared five-heart fight',()=>{
 const {actors}=fixture();actors[1].side='players';const s=startKnightBattle(actors,'hero',epoch)!;assert.equal(s.players.helper.hp,5);assert.equal(s.players.helper.helper,undefined);assert.equal(s.teamHp,5);
});
test('eight starting hero hearts are captured only when a helper joins the boss and survive withdrawal',()=>{
 const {s,actors}=fixture();assert.equal(s.players.hero.hp,8);assert.equal(s.players.helper.hp,5);assert.equal(knightPartyMaximum(s),8);s.players.hero.hp=7;cancelKnightBattle(s,'helper',epoch+10);advanceKnightBattle(s,actors,epoch+20);assert.equal(s.players.hero.hp,7);assert.equal(knightPartyMaximum(s),8);
 actors[1].side='players';const next=startKnightBattle(actors,'hero',epoch+100)!;assert.equal(next.players.hero.hp,5);assert.equal(knightPartyMaximum(next),5);
});
test('old active snapshots cap helper hearts without healing heroes',()=>{
 const {s,actors}=fixture();delete s.teamMaxHp;s.players.helper.hp=6;s.players.hero.hp=4;advanceKnightBattle(s,actors,epoch+10);assert.equal(s.players.helper.hp,5);assert.equal(s.players.hero.hp,4);assert.equal(knightPartyMaximum(s),8);
});
test('hero parries remain usable when helper attacks overlap the cosmic planet mechanic',()=>{
 const {s,helper,hero}=fixture();s.phase=4;s.stage='cosmic-planet-sweep';assert(startHelperAbility(s,helper,1,epoch));assert(knightAttack(s,hero,epoch+100));
});
test('shared healing cannot change helper hearts or be collected by the helper',()=>{
 const {s,actors}=fixture(true);s.players.helper.hp=3;spawnKnightLifeFirefly(s,epoch);const point=knightLifeFireflyPoint(s,epoch+500)!;
 assert(!hitKnightLifeFirefly(s,'helper',point,0,epoch+500,4.8));assert(hitKnightLifeFirefly(s,'hero',point,0,epoch+500,4.8));assert.equal(s.players.helper.hp,3);assert.equal(s.teamHp,HELPER.opponentHearts+1);advanceKnightBattle(s,actors,epoch+500);assert.equal(s.players.helper.hp,3);
});
test('casts lock movement, use independent cooldowns, and cannot be queued or spoofed',()=>{
 const {s,helper,h,hero}=fixture();assert(!startHelperAbility(s,hero,1,epoch));assert(!startHelperAbility(s,helper,5 as 1,epoch));assert(startHelperAbility(s,helper,2,epoch));
 assert(!startHelperAbility(s,helper,3,epoch+100));assert.deepEqual(helperPosition(h,epoch+100),helper.p);
 assert.equal(h.cooldowns[1],epoch+8000);assert.equal(h.cooldowns[0],0);
 assert(startHelperAbility(s,helper,1,epoch+6000));assert.equal(h.cooldowns[0],epoch+16000);assert(!helperVulnerable(h,epoch+8000));
});
test('dash has its yellow warning before moving, and spin emits exactly six evenly spaced orbs',()=>{
 const {s,helper,h}=fixture();startHelperAbility(s,helper,2,epoch);const dash=h.cast!;assert.deepEqual(helperPosition(h,dash.release-1),dash.from);assert.deepEqual(helperPosition(h,dash.end),dash.to);
 assert(startHelperAbility(s,helper,3,dash.recoverUntil));const c=h.cast!;assert.equal(helperOrbs(c,c.release-1).length,0);const orbs=helperOrbs(c,c.release+1000);assert.equal(orbs.length,6);const radii=orbs.map(p=>Math.hypot(p[0]-c.from[0],p[2]-c.from[2]));assert(radii.every(r=>Math.abs(r-radii[0])<1e-8));assert(Math.abs(orbs.reduce((sum,p)=>sum+p[0]-c.from[0],0))<1e-8);
});
test('one melee hit per green window, including simultaneous attackers, and one second of dizziness',()=>{
 const {s,actors,helper,h,hero}=fixture(true);startHelperAbility(s,helper,2,epoch);const c=h.cast!,now=c.end+100;
 hero.p=[c.to[0],0,c.to[2]-2];hero.yaw=0;actors[2].p=[...hero.p];actors[2].yaw=0;
 knightAttack(s,hero,now);knightAttack(s,actors[2],now);advanceKnightBattle(s,actors,now+150);
 assert.equal(s.players.helper.hp,HELPER.hearts-1);assert.equal(h.stunnedUntil,now+1150);assert(!helperVulnerable(h,now+160));assert.equal(s.players.hero.hp,HELPER.opponentHearts);
 knightAttack(s,hero,now+1000);advanceKnightBattle(s,actors,now+1150);assert.equal(s.players.helper.hp,HELPER.hearts-1);
});
test('crescent recovery is seated but never green or melee vulnerable',()=>{
 const {s,actors,helper,h,hero}=fixture();startHelperAbility(s,helper,1,epoch);const c=h.cast!,now=c.end+200;hero.p=[helper.p[0],0,-2];hero.yaw=0;
 assert(!helperVulnerable(h,now));knightAttack(s,hero,now);advanceKnightBattle(s,actors,now+150);assert.equal(s.players.helper.hp,HELPER.hearts);
});
for(const phase of [1,4] as const)test(`phase ${phase}: reflected ${phase===4?'meteor':'crescent'} costs its sender exactly one heart`,()=>{
 const {s,actors,helper,h,hero}=fixture();s.phase=phase;helper.p[1]=hero.p[1]=phase===4?180:0;startHelperAbility(s,helper,1,epoch);const c=h.cast!,now=c.release+280,point=helperProjectile(c,now)!;
 hero.p=[point[0],helper.p[1],point[2]];hero.yaw=Math.PI;assert(knightAttack(s,hero,now-100));advanceKnightBattle(s,actors,now);assert(c.returned);assert.equal(c.meteor,phase===4);
 advanceKnightBattle(s,actors,now+HELPER.returnMs);assert.equal(s.players.helper.hp,HELPER.hearts-1);assert.equal(s.hp,12);assert.equal(s.players.hero.hp,HELPER.opponentHearts);advanceKnightBattle(s,actors,now+HELPER.returnMs+50);assert.equal(s.players.helper.hp,HELPER.hearts-1);
});
test('phase transitions clear hazards and retain helper health and cooldowns',()=>{
 const {s,actors,helper,h}=fixture();startHelperAbility(s,helper,1,epoch);s.players.helper.hp=2;const cooldowns=[...h.cooldowns];assert(setKnightPhase(s,2,actors,epoch+100));assert.equal(h.cast,undefined);assert.equal(s.players.helper.hp,2);assert.deepEqual(h.cooldowns,cooldowns);
});
test('helper withdrawal leaves the heroes fighting, final hero withdrawal cancels',()=>{
 const {s}=fixture();assert(cancelKnightBattle(s,'helper',epoch+10));assert.equal(s.stage,'rest');assert(cancelKnightBattle(s,'hero',epoch+20));assert.equal(s.stage,'cancelled');
});
test('defeated helpers cannot act, but join a deterministic boss victory celebration',()=>{
 const {s,actors,helper}=fixture();s.players.helper.hp=0;assert(!startHelperAbility(s,helper,1,epoch));s.players.hero.hp=0;advanceKnightBattle(s,actors,epoch+10);assert.equal(s.stage,'lost');assert(s.celebration);
 for(const t of [0,1100,2400,3400,4800,7000,10000,15000,21000]){const a=knightCelebration(s,'boss',epoch+10+t)!,b=knightCelebration(s,'helper',epoch+10+t)!;assert(a&&b);assert(a.p.every(Number.isFinite));assert(b.p.every(Number.isFinite));assert(Math.hypot(a.p[0],a.p[2])<41);assert(Math.hypot(b.p[0],b.p[2])<41);assert.deepEqual(b,knightCelebration(structuredClone(s),'helper',epoch+10+t));}
 assert(knightCelebration(s,'helper',epoch+10+3400)!.hug>.9);assert.equal(knightCelebration(s,'hero',epoch+10+3400),undefined);
 assert(cancelKnightBattle(s,'helper',epoch+22000));assert.equal(s.stage,'lost');assert.equal(knightCelebration(s,'helper',epoch+23000),undefined);
});
