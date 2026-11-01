import {humanKnightFixture} from './knight-human-fixture';
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
 const s=humanKnightFixture(startKnightBattle(actors,'hero',epoch)!);s.stage='rest';s.since=epoch;s.until=epoch+1e9;return {s,actors,hero:actors[0],helper:actors[1],h:s.players.helper.helper!};
}
test('side choice includes an arena containing only Meta Knights and pauses the duel until answered',()=>{
 const {actors}=fixture();assert(helperChoiceAvailable(actors));delete actors[1].side;assert.equal(startKnightBattle(actors,'hero',epoch)!.stage,'side-choice');
 actors[0].metaKnight=true;assert(helperChoiceAvailable(actors));assert.equal(startKnightBattle(actors,'hero',epoch)!.players.helper.hp,5);
});
test('helpers start with five independent hearts and never become boss targets',()=>{
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
test('a hero collecting shared healing cannot change helper hearts',()=>{
 const {s,actors}=fixture(true);s.players.helper.hp=3;spawnKnightLifeFirefly(s,epoch);const point=knightLifeFireflyPoint(s,epoch+500)!;
 assert(hitKnightLifeFirefly(s,'hero',point,0,epoch+500,4.8));assert.equal(s.players.helper.hp,3);assert.equal(s.teamHp,HELPER.opponentHearts+1);advanceKnightBattle(s,actors,epoch+500);assert.equal(s.players.helper.hp,3);
});

test('a helper can melee the firefly in every phase and keep one personal heart after restoring the snapshot',()=>{
 for(const phase of [1,2,3,4] as const)for(const hp of [3,5]){
  const {s,actors,helper,h}=fixture(true),height=phase===4?180:0;
  Object.assign(s,{phase,hp:phase===3?3:12,from:[0,height,0],to:[0,height,0]});h.phase=phase;
  for(const a of actors)a.p[1]=height;
  actors.push({...helper,id:'other-helper',p:[-30,height,0]});s.players['other-helper']={...s.players.helper,helper:{cooldowns:[0,0,0],phase}};
  s.players.helper.hp=hp;spawnKnightLifeFirefly(s,epoch);
  const point=knightLifeFireflyPoint(s,epoch+660)!;helper.p=[point[0],height,point[2]-2];helper.yaw=0;
  assert(knightAttack(s,helper,epoch+500));assert(!knightAttack(s,helper,epoch+550),'repeated packets respect the attack cooldown');advanceKnightBattle(s,actors,epoch+660);
  assert.equal(s.lifeFirefly!.hit?.by,'helper');assert.equal(s.players.helper.hp,hp+1);assert.equal(s.players['other-helper'].hp,5);
  assert.equal(s.teamHp,HELPER.opponentHearts);assert.equal(s.players.hero.hp,HELPER.opponentHearts);assert.equal(s.players.friend.hp,HELPER.opponentHearts);assert.equal(s.hp,phase===3?3:12);
  const restored=JSON.parse(JSON.stringify(s));advanceKnightBattle(restored,actors,epoch+800);advanceKnightBattle(restored,actors,epoch+1200);
  assert.equal(restored.players.helper.hp,hp+1,'wakeup neither removes nor duplicates the collected heart');assert(!hitKnightLifeFirefly(restored,'hero',helper.p,0,epoch+1200,4.8));
 }
});

test('helper firefly strikes require a fresh, available melee attack in range and facing the carrier',()=>{
 for(const mode of ['dead','withdrawn','unavailable','stunned','cast','stale','facing','distance','height'] as const){
  const {s,actors,helper,h}=fixture();spawnKnightLifeFirefly(s,epoch);const point=knightLifeFireflyPoint(s,epoch+660)!;
  helper.p=[point[0],0,point[2]-2];helper.yaw=0;
  if(mode==='dead')s.players.helper.hp=0;if(mode==='withdrawn')s.players.helper.withdrawn=true;if(mode==='unavailable')helper.available=false;
  if(mode==='stunned'){h.stunnedUntil=epoch+2000;h.anchor=[...helper.p];}if(mode==='cast')assert(startHelperAbility(s,helper,2,epoch+400));
  if(mode==='facing')helper.yaw=Math.PI;if(mode==='distance')helper.p[0]+=12;if(mode==='height')helper.p[1]=10;
  const before=s.players.helper.hp;knightAttack(s,helper,mode==='stale'?epoch:epoch+500);advanceKnightBattle(s,actors,epoch+660);
  assert.equal(s.lifeFirefly!.hit,undefined,mode);assert.equal(s.players.helper.hp,before,mode);
 }
});

test('a helper melee press for the firefly cannot damage the allied boss or break its shield crystal',()=>{
 for(const stage of ['open','shield'] as const){
  const {s,actors,helper}=fixture();s.stage=stage;if(stage==='shield'){s.phase=3;s.hp=3;s.activeCrystal=0;helper.p=[0,0,40];helper.yaw=0;}else{helper.p=[0,0,3];helper.yaw=Math.PI;}
  spawnKnightLifeFirefly(s,epoch);const hp=s.hp;assert(knightAttack(s,helper,epoch+500));advanceKnightBattle(s,actors,epoch+660);
  assert.equal(s.hp,hp);assert.equal(s.activeCrystal,stage==='shield'?0:undefined);assert.equal(s.players.helper.hits,0);
 }
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

test('the wider and longer player dash damages a fighter beyond the former corridor and reach',()=>{
 const {s,actors,helper,hero}=fixture();helper.p=[0,0,0];hero.p=[3.4,0,20];const hp=s.players.hero.hp;
 assert(startHelperAbility(s,helper,2,epoch));const c=s.players.helper.helper!.cast!;
 advanceKnightBattle(s,actors,c.release+410);assert.equal(s.players.hero.hp,hp-1);
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
test('phase transitions clear hazards, retain health and refund the cancelled windup',()=>{
 const {s,actors,helper,h}=fixture();startHelperAbility(s,helper,1,epoch);s.players.helper.hp=2;const cooldowns=[...h.cooldowns];assert(setKnightPhase(s,2,actors,epoch+100));assert.equal(h.cast,undefined);assert.equal(s.players.helper.hp,2);assert.equal(h.cooldowns[0],epoch+100);assert.deepEqual(h.cooldowns.slice(1),cooldowns.slice(1));
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
