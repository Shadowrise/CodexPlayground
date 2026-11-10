import {TURN_RATE} from '../src/movement-input';
import test from 'node:test';
import assert from 'node:assert/strict';
import {startKnightBattle,advanceKnightBattle,knightPartyHearts,type KnightActor,type KnightPoint} from '../src/meta-knight-battle';
import {KNIGHT_CONTACT,constrainKnightCrowd,pushKnightOpponent,knightBumpActive,startKnightBump} from '../src/meta-knight-opponents-contact';
import {startHelperAbility} from '../src/meta-knight-helper';
import {knightPlayerPushable} from '../src/meta-knight-push';
import {knightLifeFireflyPoint} from '../src/meta-knight-life-firefly';

const min=KNIGHT_CONTACT.radius*2+KNIGHT_CONTACT.clearance;
function fixture(){const actor:KnightActor={id:'solo',p:[0,0,-2],yaw:0,available:true,metaKnight:true,side:'boss',variant:18},s=startKnightBattle([actor],actor.id,100000)!;Object.assign(s,{stage:'rest',since:100000,checked:100000,until:1000000,from:[25,0,20],to:[25,0,20]});return {s,actor,bots:Object.values(s.opponents!)};}
function spacing(bots:readonly {p:readonly number[]}[]){for(let i=0;i<bots.length;i++)for(let j=i+1;j<bots.length;j++)if(Math.abs(bots[i].p[1]-bots[j].p[1])<2.4)assert(Math.hypot(bots[i].p[0]-bots[j].p[0],bots[i].p[2]-bots[j].p[2])>=min-.002);}

test('swept body collision stops a fast dash through another NPC and allows tangential motion',()=>{
 const bodies=[{id:'other',p:[0,0,0]}],from:KnightPoint=[-7,0,0],to:KnightPoint=[7,0,0];constrainKnightCrowd(to,from,bodies,'me');assert(to[0]<=-min+.001);
 const slide:KnightPoint=[-1,0,4];constrainKnightCrowd(slide,[-3,0,0],bodies,'me');assert(slide[2]>0);assert(Math.hypot(slide[0],slide[2])>=min-.001);
 const flying:KnightPoint=[7,5,0];constrainKnightCrowd(flying,[-7,5,0],bodies,'me');assert.equal(flying[0],7,'different height planes do not block one another');
});
test('one shared pool keeps every NPC fighting until the final life is lost',()=>{
 const {s,actor,bots}=fixture();actor.p=[-30,0,-25];s.teamHp=2;
 Object.assign(s,{stage:'slash',since:100000,until:200000,from:[0,0,0],to:[0,0,0],yaw:0});
 bots.forEach((b,i)=>{b.p=i===0?[0,0,7]:[-20,0,i*10];b.goal=[...b.p];b.thinkAt=200000;b.shoveReady=200000;});
 advanceKnightBattle(s,[actor],100050);assert.equal(knightPartyHearts(s),1);assert.notEqual(s.stage,'lost');for(const b of bots)assert.equal(s.players[b.id].hp,1,'no fighter is individually eliminated');
 advanceKnightBattle(s,[actor],101350);assert.equal(s.stage,'lost');assert.equal(s.teamHp,0);for(const b of bots)assert.equal(s.players[b.id].hp,0);assert.equal(s.players.solo.hp,5);
});
test('legacy independent snapshots merge remaining lives without healing the team',()=>{
 const {s,actor,bots}=fixture();delete s.sharedOpponents;delete s.teamHp;bots.forEach((b,i)=>s.players[b.id].hp=[0,5,7][i]);
 advanceKnightBattle(s,[actor],100050);assert.equal(s.sharedOpponents,true);assert.equal(s.teamHp,12);for(const b of bots)assert.equal(s.players[b.id].hp,12,'the old defeated NPC returns while the shared pool remains positive');assert.equal(s.players.solo.hp,5);
});
test('NPCs turn at player speed, then walk forwards, including while reacting to crescents',()=>{
 const {s,actor,bots}=fixture();actor.p=[-30,0,-25];let moving=0,total=0,turns=0;
 for(let now=100050;now<106900;now+=50){
  if(now===105000)Object.assign(s,{stage:'shot-warn',since:105000,until:107000,from:[0,0,0],to:[0,0,30],yaw:0});
  const before=bots.map(b=>({p:[...b.p],yaw:b.yaw}));advanceKnightBattle(s,[actor],now);
  for(const [i,b] of bots.entries()){
   const angle=Math.abs(Math.atan2(Math.sin(b.yaw-before[i].yaw),Math.cos(b.yaw-before[i].yaw)));assert(angle<=TURN_RATE*.05+1e-8,'no instant heading changes');
   const dx=b.p[0]-before[i].p[0],dz=b.p[2]-before[i].p[2];if(Math.hypot(dx,dz)>.001){assert(Math.abs(dx*Math.cos(b.yaw)-dz*Math.sin(b.yaw))<.002,'walking has no sideways component');assert(dx*Math.sin(b.yaw)+dz*Math.cos(b.yaw)>=0,'no backwards walking');}
   if(b.turning&&!b.moving)turns++;moving+=Number(b.moving);total++;
  }
 }assert(moving/total>.40,'turning still leaves time for active movement');assert(turns>0,'large turns happen on the spot');
});

test('NPCs sometimes leave a vulnerable helper alone and save that decision across snapshots',()=>{
 let hit=0,spared=0;
 for(let seed=0;seed<24;seed++){
  const {s,actor,bots}=fixture();actor.p=[0,0,0];actor.yaw=0;assert(startHelperAbility(s,actor,3,100000));const c=s.players.solo.helper!.cast!;
  bots[0].p=[0,0,-3.5];bots[0].yaw=0;bots[0].goal=[...bots[0].p];bots[0].seed=seed;bots[0].thinkAt=c.end;bots[0].shoveReady=1e9;
  for(const [i,b] of bots.slice(1).entries()){b.p=[-30,0,10+i*8];b.thinkAt=1e9;b.shoveReady=1e9;b.goal=[...b.p];}
  s.checked=c.end;const copy=structuredClone(s);
  for(let now=c.end+50;now<c.recoverUntil;now+=50){advanceKnightBattle(s,[actor],now);advanceKnightBattle(copy,[actor],now);}
  assert.deepEqual(s,copy);if(s.players.solo.hp<5)hit++;else spared++;
 }assert(hit>0);assert(spared>0);
});

test('coincident NPCs and crowds at the arena edge separate and stay apart during movement',()=>{
 for(const edge of [false,true]){
  const {s,actor,bots}=fixture();actor.p=[-25,0,-25];for(const b of bots){b.p=[edge?42:0,0,0];b.goal=[...b.p];}
  for(let now=100050;now<103000;now+=50){advanceKnightBattle(s,[actor],now);spacing(bots);for(const b of bots)assert(Math.hypot(b.p[0],b.p[2])<=43.001);}
 }
});
test('V pushes exactly one NPC in front, moves it with a roll, and never changes health',()=>{
 const {s,actor,bots}=fixture();actor.p=[-12,0,0];actor.yaw=Math.PI/2;bots[0].p=[-9,0,0];bots[1].p=[-15,0,0];bots[2].p=[0,0,20];
 const before=Object.fromEntries(Object.entries(s.players).map(([id,p])=>[id,p.hp]));assert.equal(pushKnightOpponent(s,actor,100050),bots[0].id);assert(knightBumpActive(s,bots[0].id,100100));assert.equal(pushKnightOpponent(s,actor,100100),undefined,'a rolling target cannot be repeatedly stunned');
 for(let now=100100;now<=101000;now+=50)advanceKnightBattle(s,[actor],now);
 assert(bots[0].p[0]>-6);spacing(bots);assert.deepEqual(Object.fromEntries(Object.entries(s.players).map(([id,p])=>[id,p.hp])),before);
});
test('a pushed NPC cannot tunnel into its neighbour and snapshots reproduce the same movement',()=>{
 const {s,actor,bots}=fixture();actor.p=[-20,0,-20];bots[0].p=[-5,0,0];bots[1].p=[-2,0,0];bots[2].p=[3,0,0];for(const b of bots){b.thinkAt=200000;b.shoveReady=200000;b.goal=[...b.p];}
 assert(startKnightBump(s,bots[0].id,1,0,100010));const copy=structuredClone(s);
 for(let now=100060;now<101300;now+=50){advanceKnightBattle(s,[actor],now);advanceKnightBattle(copy,[actor],now);spacing(Object.values(s.opponents!));assert.deepEqual(s,copy);}
 assert(bots[0].p[0]<bots[1].p[0]);
});
test('NPC counterpushes have a visible windup, avoid stun locks, and respect locked helper casts',()=>{
 const {s,actor,bots}=fixture();actor.p=[-12,0,0];bots[0].p=[-9,0,0];bots[0].yaw=-Math.PI/2;bots[1].p=[10,0,20];bots[2].p=[20,0,0];for(const b of bots){b.shoveReady=100000;b.thinkAt=200000;b.goal=[...b.p];}
 let now=100050;while(!bots[0].shove&&now<108000){advanceKnightBattle(s,[actor],now);now+=50;}assert(bots[0].shove,'a nearby NPC occasionally chooses a counterpush');
 const release=bots[0].shove!.release;assert.equal(s.players.solo.bump,undefined);advanceKnightBattle(s,[actor],release-1);assert.equal(s.players.solo.bump,undefined);advanceKnightBattle(s,[actor],release);assert(knightBumpActive(s,'solo',release));
 assert.equal(s.players.solo.hp,5);assert(!knightPlayerPushable(s,'solo',release+100));assert(!startHelperAbility(s,actor,2,release+100));assert(!startKnightBump(s,'solo',1,0,release+1000));
 assert(bots[0].shoveReady!>=bots[0].shove!.at+6500);
 const locked=fixture();assert(startHelperAbility(locked.s,locked.actor,2,100050));assert(!startKnightBump(locked.s,'solo',1,0,100100),'a fixed ability is never interrupted by a shove');
});
for(const phase of [1,4] as const)test(`phase ${phase}: NPCs sometimes strike the heart firefly, using normal attacks and shared healing`,()=>{
 let collected=0,ignored=0;
 for(let seed=0;seed<32;seed++){
  const {s,actor,bots}=fixture(),height=phase===4?180:0;s.phase=phase;s.stage=phase===4?'cosmic-flight':'rest';s.lifeFirefly={phase,at:100000,angle:Math.PI,side:1,color:.5};
  s.from=s.to=[25,height,20];actor.p=[-20,height,15];bots[0].p=[-.5,height,-41];bots[0].goal=[...bots[0].p];bots[0].seed=seed;bots[0].shoveReady=200000;
  for(const [i,b] of bots.slice(1).entries()){b.p=[20+i*10,height,20];b.goal=[...b.p];b.thinkAt=200000;b.shoveReady=200000;}
  s.teamHp=8;for(const b of bots)s.players[b.id].hp=8;const copy=structuredClone(s);
  for(let now=100500;now<=101500;now+=50){advanceKnightBattle(s,[actor],now);advanceKnightBattle(copy,[actor],now);}
  assert.deepEqual(s,copy,'the decision and strike survive snapshots');
  if(s.lifeFirefly.hit){collected++;assert.equal(s.lifeFirefly.hit.by,bots[0].id);assert.equal(s.players[bots[0].id].hp,9);assert(s.players[bots[0].id].attackAt>100000);assert.equal(knightLifeFireflyPoint(s,101500),undefined,'one heart cannot be taken twice');}
  else{ignored++;assert.equal(s.players[bots[0].id].hp,8);}
  assert.equal(s.players.solo.hp,5);for(const b of bots)assert.equal(s.players[b.id].hp,s.teamHp,'the entire team receives the same single shared heart');
 }
 assert(collected>0,'some NPCs should pursue and hit the visitor');assert(ignored>0,'they must also sometimes leave the visitor alone');
});
