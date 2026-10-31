import test from 'node:test';
import assert from 'node:assert/strict';
import {startKnightBattle,advanceKnightBattle,cancelKnightBattle,knightPosition,knightAttack,type KnightActor} from '../src/meta-knight-battle';
import {startHelperAbility,helperPosition,helperVulnerable} from '../src/meta-knight-helper';
import {DUET,duetActive,knightDuetOpening,duetBossDazed} from '../src/meta-knight-duet';
import {cosmicAirborne} from '../src/meta-knight-cosmic';

function fixture(phase:1|2|3|4=1){const y=phase===4?180:0,actors:KnightActor[]=[{id:'hero',p:[25,y,0],yaw:0,available:true},{id:'helper',p:[10,y,-15],yaw:0,available:true,metaKnight:true,side:'boss'}],s=startKnightBattle([{...actors[0],p:[0,0,-2]},actors[1]],'hero',100000)!;s.phase=phase;s.hp=phase===3?3:phase===4?6:phase===2?8:12;s.stage=phase===4?'cosmic-recover':'open';s.pattern='leap';s.cosmicPart=1;s.from=s.to=[0,y,0];s.since=100000;s.until=103000;return {s,actors,hero:actors[0],helper:actors[1],h:s.players.helper.helper!};}
function recovery(phase:1|2|3|4=1){const f=fixture(phase);startHelperAbility(f.s,f.helper,4,100000);let guard=0;while(f.s.stage!=='duet-recover'&&guard++<20)advanceKnightBattle(f.s,f.actors,f.s.until,'hero');assert(guard<20);return f;}
for(const phase of [1,2,3,4] as const)test(`phase ${phase}: both knights have independent single-hit recovery windows and one-second dizziness`,()=>{
 const {s,actors,hero,h}=recovery(phase),since=s.since,until=s.until,bossHp=s.hp,point=knightPosition(s,since+20);assert(knightDuetOpening(s));assert(helperVulnerable(h,since+20));
 hero.p=[point[0],point[1],point[2]-3.7];hero.yaw=0;assert(knightAttack(s,hero,since+20));advanceKnightBattle(s,actors,since+170);
 assert.equal(s.hp,bossHp-1);assert.equal(s.players.helper.hp,5);assert.equal(s.stage,'duet-recover');assert.equal(s.until,until);assert(!knightDuetOpening(s));assert(helperVulnerable(h,since+200));assert(duetBossDazed(s,since+1169));assert(!duetBossDazed(s,since+1170));
 hero.p=[3.3,point[1],-2];assert(knightAttack(s,hero,since+800));advanceKnightBattle(s,actors,since+950);assert.equal(s.players.helper.hp,4);assert.equal(s.hp,bossHp-1);assert.equal(h.stunnedUntil,since+1950);assert(!helperVulnerable(h,since+1000));
 const next=knightPosition(s,since+1500);hero.p=[next[0],next[1],next[2]-3.7];assert(knightAttack(s,hero,since+1500));advanceKnightBattle(s,actors,since+1650);assert.equal(s.hp,bossHp-1,'no repeated boss damage in the same opening');
 const restored=structuredClone(s);advanceKnightBattle(restored,actors,since+1800);assert.equal(restored.hp,bossHp-1);assert(!knightDuetOpening(restored));advanceKnightBattle(restored,actors,until);assert.equal(restored.duet,undefined);assert.equal(restored.hp,bossHp-1);
});
test('knocking out the helper first does not cancel the big knight recovery window',()=>{
 const {s,actors,hero,h}=recovery(),since=s.since;s.players.helper.hp=1;hero.p=[3.3,0,-2];hero.yaw=0;knightAttack(s,hero,since+20);advanceKnightBattle(s,actors,since+170);assert.equal(s.players.helper.hp,0);advanceKnightBattle(s,actors,since+300);assert.equal(s.stage,'duet-recover');assert(knightDuetOpening(s));assert(!helperVulnerable(h,since+300));
 const point=knightPosition(s,since+800);hero.p=[point[0],0,point[2]-3.7];knightAttack(s,hero,since+800);advanceKnightBattle(s,actors,since+950);assert.equal(s.hp,11);assert.equal(s.until,since+3000);
});
test('a late boss hit retains a full second of dizziness without extending the helper green window',()=>{
 const {s,actors,hero,h}=recovery(4),since=s.since,p=knightPosition(s,since+2650);hero.p=[p[0],p[1],p[2]-3.7];hero.yaw=0;knightAttack(s,hero,since+2650);advanceKnightBattle(s,actors,since+2800);assert.equal(s.until,since+3800);assert.equal(h.cast!.recoverUntil,since+3000);assert(helperVulnerable(h,since+2999));assert(!helperVulnerable(h,since+3000));advanceKnightBattle(s,actors,since+3300);assert(duetBossDazed(s,since+3799));const centre=knightPosition(s,since+3300);assert.equal(Math.hypot(centre[0],centre[1]-180,centre[2]),0);advanceKnightBattle(s,actors,since+3800);assert.equal(s.duet,undefined);
});
for(const phase of [3,4] as const)test(`phase ${phase}: the final boss hit completes the phase after both recovery windows finish`,()=>{
 const {s,actors,hero,h}=recovery(phase),since=s.since,until=s.until;s.hp=1;const p=knightPosition(s,since+20);hero.p=[p[0],p[1],p[2]-3.7];hero.yaw=0;knightAttack(s,hero,since+20);advanceKnightBattle(s,actors,since+170);assert.equal(s.hp,0);assert.equal(s.stage,'duet-recover');assert(helperVulnerable(h,since+200));advanceKnightBattle(s,actors,until);assert.equal(s.duet,undefined);assert.equal(s.phase,4);assert.equal(s.stage,phase===3?'transition':'cosmic-descent');
});
test('slot four queues once, starts after the current boss pattern, and has a ninety second cooldown',()=>{
 const {s,actors,helper,h}=fixture();assert(startHelperAbility(s,helper,4,100000));assert.equal(h.cooldowns[3],190000);assert.equal(s.duet?.stage,'queued');assert(!duetActive(s));assert(!startHelperAbility(s,helper,4,100100));
 advanceKnightBattle(s,actors,102999);assert.equal(s.stage,'open');advanceKnightBattle(s,actors,103000);assert.equal(s.stage,'duet-gather');assert(duetActive(s));
 const half=(s.since+s.until)/2,p=helperPosition(h,half)!;assert(p[0]<helper.p[0]&&p[0]>3.3);assert.deepEqual(knightPosition(s,s.until),[-3.3,0,0]);assert.deepEqual(helperPosition(h,s.until),[3.3,0,0]);assert.equal(s.players.helper.hp,5);
 assert.equal(h.cooldowns[3],s.duet!.at!+DUET.cooldownMs);
});
test('three disjoint yellow warnings alternate with red damage and completely cleared gaps',()=>{
 const {s,actors,hero,helper,h}=fixture();startHelperAbility(s,helper,4,100000);advanceKnightBattle(s,actors,s.until);advanceKnightBattle(s,actors,s.until);assert.equal(s.stage,'duet-charge');advanceKnightBattle(s,actors,s.until);
 for(let round=0;round<3;round++){
  assert.equal(s.stage,'duet-warn');assert.equal(s.duet!.round,round);assert(s.duet!.spots.length>=2);
  for(const [i,p] of s.duet!.spots.entries())for(const q of s.duet!.spots.slice(i+1))assert(Math.hypot(p[0]-q[0],p[2]-q[2])>DUET.radius*2);
  const locked=structuredClone(s.duet!.spots),before=s.players.hero.hp;hero.p=[...locked[0]];advanceKnightBattle(s,actors,s.until-1);assert.equal(s.players.hero.hp,before,'yellow never damages');assert.deepEqual(s.duet!.spots,locked);
  advanceKnightBattle(s,actors,s.until);assert.equal(s.stage,'duet-strike');assert.equal(s.players.hero.hp,before-1);advanceKnightBattle(s,actors,s.since+300);assert.equal(s.players.hero.hp,before-1,'a red wave only hits once');
  advanceKnightBattle(s,actors,s.until);assert.equal(s.duet!.spots.length,0);assert.equal(s.stage,round<2?'duet-gap':'duet-recover');
  if(round<2){hero.p=[-20+round*10,0,20];advanceKnightBattle(s,actors,s.until);}
 }
 assert.equal(s.players.hero.hp,5);assert(helperVulnerable(h,s.since+10));assert.equal(h.cast!.recoverUntil-s.since,3000);advanceKnightBattle(s,actors,s.until);assert.equal(s.duet,undefined);assert(!s.stage.startsWith('duet-'));assert.deepEqual(knightPosition(s,s.since),[-3.3,0,0],'the boss continues from the centre instead of teleporting to his old attack');assert(!startHelperAbility(s,helper,4,130000));
});
test('leaving a locked yellow disk before the red wave avoids damage, including jumping players',()=>{
 const {s,actors,helper,hero}=fixture();startHelperAbility(s,helper,4,100000);for(let i=0;i<3;i++)advanceKnightBattle(s,actors,s.until);assert.equal(s.stage,'duet-warn');hero.p=[-39,3,0];advanceKnightBattle(s,actors,s.until);assert.equal(s.players.hero.hp,8);
});
test('the crystal shield is completed before a queued duet can begin',()=>{
 const {s,actors,helper}=fixture(3);s.stage='shield';s.until=1e12;startHelperAbility(s,helper,4,100000);advanceKnightBattle(s,actors,110000);assert.equal(s.stage,'shield');assert.equal(s.duet!.stage,'queued');s.stage='get-up';s.until=110200;advanceKnightBattle(s,actors,s.until);assert.equal(s.stage,'duet-gather');
});
test('cosmic duets retain flight altitude and resume the next subphase instead of replaying ascent',()=>{
 const {s,actors,helper}=fixture(4);startHelperAbility(s,helper,4,100000);advanceKnightBattle(s,actors,s.until);assert.equal(s.stage,'duet-gather');assert.equal(s.duet!.resume,'cosmic-meteor-draw');assert(cosmicAirborne(s));assert.equal(knightPosition(s,s.until)[1],180);
 let guard=0;while(s.duet&&guard++<20){advanceKnightBattle(s,actors,s.until);assert(s.phase===4);if(s.duet)assert(cosmicAirborne(s));}assert(guard<20);assert.equal(s.stage,'cosmic-meteor-draw');assert.equal(s.players.helper.hp,5);
});
test('queued and active duets survive snapshots and abort cleanly when the helper leaves',()=>{
 const {s,actors,helper}=fixture();startHelperAbility(s,helper,4,100000);const restored=structuredClone(s);advanceKnightBattle(restored,actors,restored.until);assert.equal(restored.stage,'duet-gather');const mid=structuredClone(restored);advanceKnightBattle(mid,actors,mid.until);assert.equal(mid.stage,'duet-charge');cancelKnightBattle(mid,'helper',mid.since+50);advanceKnightBattle(mid,actors,mid.since+100);assert.equal(mid.duet,undefined);assert(!mid.stage.startsWith('duet-'));assert.equal(mid.players.hero.hp,8);
});
