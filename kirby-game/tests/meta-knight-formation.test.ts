import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {startKnightBattle,setKnightPhase,advanceKnightBattle,type KnightActor} from '../src/meta-knight-battle';
import {knightCosmicAlly,knightCosmicFormationYaw} from '../src/meta-knight-cosmic-ally';
import {knightDefeatPose,prepareKnightDefeat} from '../src/meta-knight-defeat';
import {knightFormationFrame,fitKnightFormationCamera} from '../src/meta-knight-formation-camera';
import {startHelperAbility} from '../src/meta-knight-helper';
import {refugeAngle} from '../src/meta-knight-cosmic-refuge';

function fixture(){const actors:KnightActor[]=[{id:'hero',p:[0,0,-2],yaw:0,available:true},{id:'helper',p:[14,0,9],yaw:.7,available:true,metaKnight:true,side:'boss'}],s=startKnightBattle(actors,'hero',1000)!;for(const id of Object.keys(s.opponents??{}))delete s.players[id];delete s.opponents;delete s.teamHp;actors[0].p=[-28,180,18];actors[1].p=[38,180,-10];return {actors,s};}
test('planet helper gathers continuously, conducts beside the boss, queues slot four and is released afterwards',()=>{
 const {actors,s}=fixture();setKnightPhase(s,4,actors,10000,3);const h=s.players.helper.helper!,g=h.planet!;assert(g);assert.deepEqual(knightCosmicAlly(s,'helper',g.at)!.p,actors[1].p);assert(g.arrival<10000+6200);const at=(g.at+g.arrival)/2;assert(knightCosmicAlly(s,'helper',at)!.gather);const before=knightCosmicAlly(s,'helper',g.arrival-1)!,after=knightCosmicAlly(s,'helper',g.arrival+1)!;assert(Math.hypot(...after.p.map((p,i)=>p-before.p[i]))<.01);
 const settled=knightCosmicAlly(s,'helper',g.arrival+1)!,yaw=refugeAngle(s,g.arrival+1);assert.equal(settled.yaw,yaw);assert(Math.abs(settled.p[0]*Math.sin(yaw)+settled.p[2]*Math.cos(yaw))<1e-8);assert.equal(settled.p[1],180);assert(Math.abs(Math.hypot(settled.p[0],settled.p[2])-4.8)<1e-8);assert.equal(knightCosmicFormationYaw(s,g.arrival+1),yaw);
 assert.deepEqual(knightCosmicAlly(JSON.parse(JSON.stringify(s)),'helper',g.arrival+1),settled);for(const slot of [1,2,3] as const)assert(!startHelperAbility(s,actors[1],slot,g.arrival+1));assert(startHelperAbility(s,actors[1],4,g.arrival+1));assert.equal(s.duet?.stage,'queued');
 for(const stage of ['cosmic-star-open','cosmic-planet-draw','cosmic-planet-sweep']){advanceKnightBattle(s,actors,s.until,'hero');assert.equal(s.stage,stage);assert(knightCosmicAlly(s,'helper',s.since+100));assert.equal(h.planet!.at,g.at);}
 advanceKnightBattle(s,actors,s.until,'hero');assert(['cosmic-planet-release','cosmic-planet-break','cosmic-star-strike'].includes(s.stage));assert.equal(knightCosmicAlly(s,'helper',s.since),undefined);assert.equal(h.planet,undefined);assert.equal(s.duet?.stage,'queued');
});
test('planet assist preserves the existing stun and health, excludes withdrawn or ordinary allies, and resumes saved encounters once',()=>{
 const {actors,s}=fixture(),h=s.players.helper.helper!;h.cooldowns=[20000,30000,40000,0];s.players.helper.hp=3;setKnightPhase(s,4,actors,10000,3);delete h.planet;h.stunnedUntil=11200;h.anchor=[12,180,6];advanceKnightBattle(s,actors,10100,'hero');const g=h.planet!;assert.equal(g.at,11200);assert.deepEqual(g.from,[12,180,6]);assert(knightCosmicAlly(s,'helper',11000)!.waiting);assert.equal(s.players.helper.hp,3);const revision=s.revision;advanceKnightBattle(s,actors,10200,'hero');assert.equal(h.planet,g);assert.equal(s.revision,revision);assert.deepEqual(h.cooldowns.slice(0,3),[20000,30000,40000]);
 s.players.helper.withdrawn=true;assert.equal(knightCosmicAlly(s,'helper',12000),undefined);delete s.players.helper.withdrawn;s.players.helper.hp=0;assert.equal(knightCosmicAlly(s,'helper',12000),undefined);s.players.helper.hp=3;s.players.helper.side='players';assert.equal(knightCosmicAlly(s,'helper',12000),undefined);
});
test('defeated knights gather on the fall, land side by side with a common heading and preserve the result in snapshots',()=>{
 const {actors,s}=fixture();setKnightPhase(s,4,actors,10000,3);s.stage='cosmic-star-stun';s.hp=0;s.until=15000;advanceKnightBattle(s,actors,15000,'hero');assert.equal(s.stage,'cosmic-descent');const d=s.defeat!;assert(d);assert.deepEqual(knightDefeatPose(s,'helper',15000)!.p,actors[1].p);
 const first=knightDefeatPose(s,'helper',16000)!,next=knightDefeatPose(s,'helper',16001)!;assert(Math.hypot(...next.p.map((p,i)=>p-first.p[i]))<.3);assert.equal(first.p[1],knightDefeatPose(s,'boss',16000)!.p[1]);
 advanceKnightBattle(s,actors,s.until,'hero');assert.equal(s.stage,'won');const boss=knightDefeatPose(s,'boss',s.since)!,little=knightDefeatPose(s,'helper',s.since)!;assert.equal(boss.yaw,little.yaw);assert.equal(boss.p[1],0);assert.equal(little.p[1],0);const delta=little.p.map((v,i)=>v-boss.p[i]);assert(Math.abs(Math.hypot(...delta)-9.5)<1e-8);assert(Math.abs(delta[0]*Math.sin(boss.yaw)+delta[2]*Math.cos(boss.yaw))<1e-8);assert.deepEqual(knightDefeatPose(JSON.parse(JSON.stringify(s)),'helper',s.since+500),little);assert.equal(s.players.helper.hp,5);
});
for(const [width,height] of [[1280,800],[390,844],[844,390]])test(`shared camera includes every combatant and both raised swords at ${width}x${height}`,()=>{
 const {actors,s}=fixture();setKnightPhase(s,4,actors,10000,3);
 for(const stage of ['cosmic-star-draw','cosmic-star-open','cosmic-planet-draw','cosmic-planet-sweep','duet-charge','won'] as const){s.stage=stage;if(stage==='duet-charge')s.duet={owner:'helper',requestedAt:1,stage:'charge',round:0,at:10000,gatherUntil:10000,floor:180,bossFrom:[0,180,0],helperFrom:actors[1].p,spots:[],contacts:{}};if(stage==='won'){delete s.duet;prepareKnightDefeat(s,actors,[0,0,0],10000);}
  const frame=knightFormationFrame(s,actors,18000)!;assert(frame);for(const yaw of [frame.yaw,frame.yaw+1.5])for(const inset of [0,width*.28])for(const top of [Math.min(120,height*.20),height*.48]){const fit=fitKnightFormationCamera(frame,width,height,yaw,inset,top),camera=new PerspectiveCamera(fit.fov,width/height,.25,3000);camera.position.fromArray(fit.position);camera.lookAt(new Vector3().fromArray(fit.focus));camera.updateMatrixWorld();for(const p of frame.points){const q=new Vector3().fromArray(p).project(camera);assert(q.x>-.90&&q.x<Math.min(.90,1-2*inset/width)&&q.y<1-2*top/height&&q.y>-.92&&q.z<1,`${stage}: ${q.toArray()}`);}}
 }
 s.stage='cosmic-spin-warn';delete s.defeat;assert.equal(knightFormationFrame(s,actors,19000),undefined,'ordinary combat keeps its native camera');
});
