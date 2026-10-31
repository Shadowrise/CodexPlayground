import {cosmicDescent} from '../src/meta-knight-cosmic';
import test from 'node:test';
import assert from 'node:assert/strict';
import {startKnightBattle,advanceKnightBattle,setKnightPhase,cancelKnightBattle,type KnightActor} from '../src/meta-knight-battle';
import {knightFighterFinale,prepareKnightFightersFinale} from '../src/meta-knight-fighters-finale';
import {HELPER,startHelperAbility} from '../src/meta-knight-helper';
import {constrainKnightPlanetCamera} from '../src/meta-knight-planet-camera';
import {refugePlanet,COSMIC_REFUGE} from '../src/meta-knight-cosmic-refuge';

function fixture(phase:1|4=4){
 const actors:KnightActor[]=[{id:'helper',p:[0,0,-2],yaw:0,available:true,metaKnight:true,side:'boss'},{id:'human',p:[20,0,10],yaw:1,available:true}],s=startKnightBattle(actors,'helper',100000)!;
 s.phase=phase;if(phase===4)s.cosmicRefuge={at:100000,angle:0,world:0,contacts:{}};const y=phase===4?180:0;actors.forEach(a=>a.p[1]=y);Object.values(s.opponents!).forEach((a,i)=>{a.p=[-20+i*10,y,20];a.goal=[...a.p];});Object.assign(s,{stage:phase===4?'cosmic-star-stun':'rest',from:[0,y,0],to:[0,y,0],since:101000,checked:101000,until:102000});return {s,actors};
}
for(const phase of [1,4] as const)for(const won of [false,true])test(`phase ${phase}: every fighter lands, then ${won?'celebrates repeatedly':'sits dazed'} until finish/retry`,()=>{
 const {s,actors}=fixture(phase);
 if(won&&phase===4){s.hp=0;advanceKnightBattle(s,actors,102000);assert.equal(s.stage,'cosmic-descent');}
 else if(won){s.stage='won';prepareKnightFightersFinale(s,actors,102000);}
 else{s.teamHp=0;advanceKnightBattle(s,actors,101100);assert.equal(s.stage,'lost');}
 const f=s.fightersFinale!;assert(f);assert.equal(Object.keys(f.actors).length,4,'three AI plus a human');assert(!f.actors.helper);
 for(const id of Object.keys(f.actors)){
  const first=knightFighterFinale(s,id,f.at)!;assert.equal(first.won,won);assert.deepEqual(first.p,f.actors[id].from);
  if(phase===4){const middle=knightFighterFinale(s,id,(f.at+f.landAt)/2)!;assert(middle.p[1]>0&&middle.p[1]<180);assert(!middle.landed);assert(!middle.joy);if(won)assert.equal(middle.p[1],cosmicDescent(s,(f.at+f.landAt)/2)!.height,'the returning fighter stays at the camera and boss descent altitude');}
  const landed=knightFighterFinale(s,id,f.landAt)!;assert(landed.landed);assert.equal(landed.p[1],0);
  assert.deepEqual(knightFighterFinale(structuredClone(s),id,f.landAt+777),knightFighterFinale(s,id,f.landAt+777));
  const poses=Array.from({length:70},(_,i)=>knightFighterFinale(s,id,f.landAt+i*200)!);assert(poses.every(p=>p.p[1]===0));assert.equal(poses.some(p=>p.joy),won);assert(poses.some(p=>!p.joy));
 }
 advanceKnightBattle(s,actors,f.landAt+14000);for(const a of Object.values(s.opponents!)){assert.equal(a.p[1],0);assert.equal(a.moving,false);}
 cancelKnightBattle(s,'human',f.landAt+15000);assert.equal(knightFighterFinale(s,'human',f.landAt+15000),undefined);actors.forEach(a=>a.p[1]=0);const next=startKnightBattle(actors,'helper',f.landAt+16000)!;assert.equal(next.fightersFinale,undefined);
});
for(const ability of [1,2,3] as const)test(`unreleased ability ${ability} is refunded on a phase transition; a released ability keeps its cooldown`,()=>{
 for(const released of [false,true]){
  const {s,actors}=fixture(1);assert(startHelperAbility(s,actors[0],ability,101000));const h=s.players.helper.helper!,c=h.cast!,cooldown=h.cooldowns[ability-1],at=c.release+(released?1:-1);assert(setKnightPhase(s,2,actors,at));assert.equal(h.cast,undefined);
  assert.equal(h.cooldowns[ability-1],released?cooldown:at);assert.equal(s.players.helper.hp,5);
 }
});
test('entering planetary support also refunds a windup without resetting other cooldowns',()=>{
 const {s,actors}=fixture(4);s.stage='cosmic-open';assert(startHelperAbility(s,actors[0],3,101000));const h=s.players.helper.helper!;h.cooldowns[0]=130000;assert(setKnightPhase(s,4,actors,101100,3));assert.equal(h.cast,undefined);assert(h.cooldowns[2]<=101100);assert.equal(h.cooldowns[0],130000);
});
test('player knight dash doubles its damage corridor, warning width and travel, bounded by the arena',()=>{
 const {s,actors}=fixture(1);actors[0].p=[0,0,0];assert(startHelperAbility(s,actors[0],2,101000));const c=s.players.helper.helper!.cast!;assert.equal(HELPER.dashHalfWidth,3.6);assert.equal(HELPER.dashDistance,36);assert.equal(Math.hypot(c.to[0]-c.from[0],c.to[2]-c.from[2]),36);
 const other=fixture(1);other.actors[0].p=[0,0,39];assert(startHelperAbility(other.s,other.actors[0],2,101000));assert.equal(other.s.players.helper.helper!.cast!.to[2],41);
});
test('the moving planet cannot enclose the camera, even at its centre or as its radius changes',()=>{
 const {s,actors}=fixture();setKnightPhase(s,4,actors,102000,3);s.stage='cosmic-planet-sweep';
 for(let now=102000;now<114000;now+=125){const p=refugePlanet(s,now),centre={x:p[0],y:p[1],z:p[2]};for(const radius of [COSMIC_REFUGE.planetRadius,75,100])for(const offset of [0,1,15,19,50]){const camera={x:p[0]+offset,y:p[1],z:p[2]};constrainKnightPlanetCamera(camera,centre,radius);assert(Math.hypot(camera.x-centre.x,camera.y-centre.y,camera.z-centre.z)>=radius+1.5-1e-7);assert(!constrainKnightPlanetCamera(camera,centre,radius),'the corrected position is stable');}}
});
