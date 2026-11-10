import test from 'node:test';
import assert from 'node:assert/strict';
import {KNIGHT,startKnightBattle,advanceKnightBattle,type KnightActor} from '../src/meta-knight-battle';
import {advanceKnightOpponents} from '../src/meta-knight-opponents';
import {SHIELD,crystalPoint} from '../src/meta-knight-shield';
import {KNIGHT_CONTACT} from '../src/meta-knight-opponents-contact';
import {TURN_RATE} from '../src/movement-input';

function fixture(crystal=0){
 const actor:KnightActor={id:'solo',p:[0,0,-2],yaw:0,available:true,metaKnight:true,side:'boss',variant:18};
 const s=startKnightBattle([actor],actor.id,100000)!;
 actor.p=[-30,0,-25];
 Object.assign(s,{phase:3,hp:3,pattern:'star',stage:'shield',since:100000,checked:100000,until:1e12,from:[0,0,0],to:[0,0,0],activeCrystal:crystal});
 const bots=Object.values(s.opponents!),angle=crystal*Math.PI/4;
 bots.forEach((b,i)=>{
  const a=angle+(i===2?0:Math.PI+(i===0?-.23:.23)),r=i===2?30:SHIELD.radius+KNIGHT.bodyRadius;
  b.p=[Math.sin(a)*r,0,Math.cos(a)*r];b.yaw=Math.atan2(-b.p[0],-b.p[2]);b.goal=[...b.p];b.thinkAt=s.since;b.shoveReady=1e12;
 });
 return {s,actor,bots};
}

for(const fps of [30,60,120])test(`all three NPCs route around the dome to any active crystal at ${fps} FPS`,()=>{
 for(let crystal=0;crystal<8;crystal++){
 const {s,actor,bots}=fixture(crystal),target=crystalPoint(crystal,undefined,0),struck=new Set<string>(),dt=1000/fps;
 // Retire each attacker after its hit; keep the dome up to expose stalled teammates.
 for(let now=s.since+dt;now<=s.since+45000;now+=dt){
  const before=new Map(Object.values(s.opponents!).map(b=>[b.id,{p:[...b.p],yaw:b.yaw}]));
  advanceKnightOpponents(s,[actor],now);s.checked=now;
  for(const b of Object.values(s.opponents!)){
   assert(Math.hypot(b.p[0],b.p[2])>=SHIELD.radius+KNIGHT.bodyRadius-.001,'no penetration through the dome');
   const old=before.get(b.id)!,dx=b.p[0]-old.p[0],dz=b.p[2]-old.p[2];
   assert(Math.abs(dx*Math.cos(b.yaw)-dz*Math.sin(b.yaw))<.002,'no sideways walking');
   assert(Math.abs(Math.atan2(Math.sin(b.yaw-old.yaw),Math.cos(b.yaw-old.yaw)))<=TURN_RATE*dt/1000+1e-8,'normal turn speed');
  }
  for(const b of bots)if(s.players[b.id].attackAt===now&&Math.hypot(b.p[0]-target[0],b.p[2]-target[2])<KNIGHT.meleeReach){
   struck.add(b.id);delete s.opponents![b.id];
  }
  if(struck.size===bots.length)break;
 }
 assert.deepEqual([...struck].sort(),bots.map(b=>b.id).sort(),JSON.stringify({crystal,bots:bots.map(b=>({id:b.id,p:b.p,goal:b.goal}))}));
 }
});

test('NPCs caught inside a newly formed dome escape and restored snapshots follow the same route',()=>{
 const {s,actor,bots}=fixture(4);
 bots.forEach((b,i)=>{b.p=[i*3,0,0];b.goal=[...b.p];b.thinkAt=1e12;});
 const copy=JSON.parse(JSON.stringify(s));
 for(let now=s.since+50;now<=s.since+20000;now+=50){
  advanceKnightOpponents(s,[actor],now);advanceKnightOpponents(copy,[actor],now);s.checked=copy.checked=now;
  assert.deepEqual(s,copy);
  for(const b of bots)assert(Math.hypot(b.p[0],b.p[2])>=SHIELD.radius+KNIGHT.bodyRadius-.001);
 }
 for(const b of bots)assert(b.p[2]<-20,'every fighter leaves the dome towards the crystal');
});

test('a real shield cycle advances after a crystal hit while every NPC makes progress around the dome',()=>{
 const {s,actor,bots}=fixture(0);
 bots[2].p=[0,0,-14];bots[2].goal=[...bots[2].p];
 const travelled=new Map(bots.map(b=>[b.id,0]));
 for(let now=s.since+50;now<=100000+30000&&s.stage==='shield';now+=50){
  const before=bots.map(b=>[...b.p]);advanceKnightBattle(s,[actor],now);
  bots.forEach((b,i)=>travelled.set(b.id,travelled.get(b.id)!+Math.hypot(b.p[0]-before[i][0],b.p[2]-before[i][2])));
  for(let i=0;i<bots.length;i++)for(let j=i+1;j<bots.length;j++)assert(Math.hypot(bots[i].p[0]-bots[j].p[0],bots[i].p[2]-bots[j].p[2])>=KNIGHT_CONTACT.radius*2+KNIGHT_CONTACT.clearance-.002);
 }
 assert.equal(s.stage,'crystal-break');assert.equal(s.hp,2);assert.equal(s.brokenCrystals,1);
 for(const b of bots)assert(travelled.get(b.id)!>20,`${b.id} must help approach the crystal`);
});
