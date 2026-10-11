import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BOSS_ARENA as A} from '../src/boss-arena-site';
import type {CentipedeActor,CentipedeEvent,CentipedeStage} from '../src/centipede-event';
import {centipedeWaves} from '../src/centipede-event';
import {CHASERS,advanceChasers,bumpChaser,pushChaser,hasChasers,chaseSnapshot,applyChaseSnapshot,ChasePlayback,chaseBallHeight} from '../src/centipede-chasers';
import {CentipedeBallsView} from '../src/centipede-balls-view';

const actor=(id='a'):CentipedeActor=>({id,p:[A.x,0,A.z],yaw:0,size:1,available:true,done:false,points:0});
function event(stage:CentipedeStage='gather'):CentipedeEvent{
 return {startedAt:1,stage,stageAt:1000,cycle:1,hits:3,phase:2,trail:[],from:[A.x,A.z],control:[A.x,A.z],to:[A.x,A.z],players:{a:{first:true,base:0,points:0,hits:0,dodges:0,origin:[A.x,A.z],bumpedCycle:-1}}};
}
function nearBall(){const a=actor(),q=event();advanceChasers(q,[a],1000);const b=q.chasers!.balls[0];b.x=A.x;b.z=A.z+2;b.vx=0;b.vz=-CHASERS.speed;return {a,q,b};}

test('pursuers approach their player, remain bounded and preserve existing points across connected transitions',()=>{
 const a=actor(),q=event();advanceChasers(q,[a],1000);assert.equal(q.chasers!.balls.length,3);
 const initial=q.chasers!.balls.map(b=>Math.hypot(b.x-a.p[0],b.z-a.p[2]));
 for(let now=1100;now<=4000;now+=100)advanceChasers(q,[a],now);
 q.chasers!.balls.forEach((b,i)=>assert(Math.hypot(b.x-a.p[0],b.z-a.p[2])<initial[i]-8));
 assert.equal(q.players.a.points,0);assert.equal(q.hits,3);
 const first=q.chasers;q.stage='coil';q.stageAt=4000;advanceChasers(q,[a],4000);assert.equal(q.chasers,first,'connected transitions continue the same balls');
 for(const stage of ['invite','warning','balls','stomp','back','dizzy','uncurl','celebrate','rest'] as const){q.stage=stage;advanceChasers(q,[a],5000);assert(!q.chasers);assert(!hasChasers(q));}
});

test('third-phase pursuers continue through wheel warning and roll alongside rings, then clear for the rainbow ball',()=>{
 const a=actor(),q=event('wheelWarning');q.phase=3;q.hits=6;
 advanceChasers(q,[a],1000);const state=q.chasers!;assert(hasChasers(q));
 for(let now=1100;now<=2700;now+=100)advanceChasers(q,[a],now);
 q.stage='wheelRoll';q.stageAt=2800;advanceChasers(q,[a],2800);
 assert.equal(q.chasers,state,'do not replace the balls when the wheel starts');
 advanceChasers(q,[a],4800);assert(centipedeWaves(q,4800).length>0);
 const view=new CentipedeBallsView();view.update(q,4800);assert(view.group.visible);assert.equal(view.balls.count,3);assert(!view.warnings.visible);
 const copy:CentipedeEvent={...structuredClone(q),chasers:undefined},snapshot=chaseSnapshot(q)!;applyChaseSnapshot(copy,snapshot);
 assert.deepEqual(copy.chasers,snapshot.state,'third-phase snapshots use the existing protocol');
 copy.chasers!.balls.forEach((b,i)=>assert(Math.hypot(b.x-q.chasers!.balls[i].x,b.z-q.chasers!.balls[i].z)<.001,'snapshot rounding stays visually negligible'));
 assert.equal(q.players.a.points,0);assert.equal(q.hits,6);
 q.stage='dizzy';q.stageAt=5000;advanceChasers(q,[a],5000);view.update(q,5000);
 assert(!q.chasers);assert(!view.group.visible,'clear pursuers while aiming the rainbow ball');
});

test('contact rebounds both sides; a proactive push rebounds only the ball, then pursuit resumes',()=>{
 const {a,q,b}=nearBall();a.p=[b.x,0,b.z+.5];const direction=bumpChaser(q,a,2200)!;
 assert.deepEqual(direction,[0,1]);assert(b.vz<0);assert.equal(b.serial,1);
 assert(!bumpChaser(q,a,2201),'no immediate repeated bump');
 const next=nearBall();assert(pushChaser(next.q,next.a,2200));assert(next.b.vz>0);
 next.a.p=[next.b.x,0,next.b.z+.3];assert(!bumpChaser(next.q,next.a,2200),'the pushed ball cannot also push the player');
 const kicked=next.b.z;
 for(let now=2300;now<=4200;now+=100)advanceChasers(next.q,[next.a],now);
 assert(next.b.z<kicked+9,'returns after its springy recoil');assert(next.b.vz<0,'chases the player again');
 // Recoil stays on the arena when the player is at its edge.
 next.b.x=A.x+34;next.b.z=A.z;next.b.vx=18;next.b.vz=0;next.b.kickUntil=8000;
 for(let now=6100;now<=7500;now+=100){advanceChasers(next.q,[next.a],now);assert(Math.hypot(next.b.x-A.x,next.b.z-A.z)<=A.playRadius-CHASERS.radius+.00001);}
});

test('spawn warning, height, facing and player recovery avoid unfair bumps',()=>{
 const {a,q,b}=nearBall();a.p=[b.x,0,b.z];assert(!bumpChaser(q,a,1100));assert(!pushChaser(q,a,1100));
 assert(!bumpChaser(q,{...a,p:[b.x,6,b.z]},2200),'flying can clear the ball');
 a.p=[b.x,0,b.z-2];a.yaw=Math.PI;assert(!pushChaser(q,a,2200),'a ball behind cannot be pushed');
 a.yaw=0;assert(pushChaser(q,a,2200));
 const contact=nearBall();contact.a.p=[contact.b.x,0,contact.b.z];assert(bumpChaser(contact.q,contact.a,2200));
 Object.assign(contact.q.chasers!.balls[1],{x:contact.b.x,z:contact.b.z,contactAfter:0});
 assert(!bumpChaser(contact.q,contact.a,2201),'other balls respect the player recovery too');
 assert(!pushChaser(contact.q,{...contact.a,available:false},2200),'a tumbling rider cannot push');
});

test('targets cover multiple participants and retarget only after their player becomes unavailable',()=>{
 const a=actor(),b=actor('b'),q=event();q.players.b={...q.players.a,origin:[A.x+12,A.z]};b.p=[A.x+12,0,A.z];
 advanceChasers(q,[b,a],1000);assert.equal(q.chasers!.balls.length,4);assert.deepEqual(q.chasers!.balls.map(b=>b.target),['a','b','a','b']);
 advanceChasers(q,[a,{...b,available:false}],2000);assert(q.chasers!.balls.every(b=>b.target==='a'));
 const clone=structuredClone(q);advanceChasers(q,[a],2100);advanceChasers(clone,[a],2100);assert.deepEqual(q.chasers,clone.chasers,'solo/server and wire roundtrips share the exact rules');
});

test('wire snapshots reject old stages, playback moves between packets, rendering adds just the existing ball draw',()=>{
 const a=actor(),q=event();advanceChasers(q,[a],1000);advanceChasers(q,[a],2200);
 const first=chaseSnapshot(q)!,copy=event();applyChaseSnapshot(copy,first);assert(copy.chasers);
 const playback=new ChasePlayback(),start=playback.sample(copy,first.state.at+200,200);
 advanceChasers(q,[a],2400);const second=chaseSnapshot(q)!;applyChaseSnapshot(copy,second);
 const middle=playback.sample(copy,2500,200),end=playback.sample(copy,2600,200);
 assert(middle.some((p,i)=>p.x!==start[i].x||p.z!==start[i].z));
 middle.forEach((p,i)=>{assert(Math.abs(p.x-(start[i].x+end[i].x)/2)<.002);assert(Math.abs(p.z-(start[i].z+end[i].z)/2)<.002);});
 applyChaseSnapshot(copy,first);assert.equal(copy.chasers!.at,second.state.at);
 applyChaseSnapshot(copy,{...second,startedAt:999});assert.equal(copy.chasers!.at,second.state.at);
 assert(JSON.stringify(second).length<1300,'four-ball update is compact');
 const view=new CentipedeBallsView();view.update(q,2400);assert.equal(view.balls.count,3);assert(!view.warnings.visible);assert(view.balls.visible);
 for(let i=0;i<view.balls.count*16;i++)assert(Number.isFinite(view.balls.instanceMatrix.array[i]));
 q.stage='stomp';view.update(q,2500);assert(!view.group.visible);
});

test('meeting balls exchange momentum, separate and remain pushable while bouncing off each other',()=>{
 const a=actor(),q=event();advanceChasers(q,[a],1000);q.chasers!.at=2200;q.chasers!.balls.length=2;
 const [left,right]=q.chasers!.balls;
 Object.assign(left,{x:A.x-1.4,z:A.z,vx:8,vz:0});Object.assign(right,{x:A.x+1.4,z:A.z,vx:-8,vz:0});
 advanceChasers(q,[{...a,available:false}],2400);
 assert(left.vx<0&&right.vx>0,'equal rubber balls recoil in opposite directions');
 assert(left.bounceUntil!>2400&&right.bounceUntil!>2400,'steering does not immediately cancel recoil');
 const distance=Math.hypot(left.x-right.x,left.z-right.z,chaseBallHeight(q.chasers!,0,2400)-chaseBallHeight(q.chasers!,1,2400));
 assert(distance>=CHASERS.radius*2);
 assert.equal(left.contactAfter,1900,'ball-to-ball contact does not grant protection from the player');
 a.p=[left.x,0,left.z-2];a.yaw=0;assert(pushChaser(q,a,2400),'a ball rebounding from another can still be pushed');
 assert.equal(q.players.a.points,0);assert.equal(q.hits,3);
 const clone=structuredClone(q);advanceChasers(q,[a],2500);advanceChasers(clone,[a],2500);assert.deepEqual(q.chasers,clone.chasers,'server and solo resolve the same pair contact');
});

test('a cluster of four balls cannot stack inside one another or escape through the arena boundary',()=>{
 const a=actor(),q=event();q.players.b={...q.players.a};advanceChasers(q,[a,actor('b')],1000);
 for(const b of q.chasers!.balls)Object.assign(b,{x:A.x+A.playRadius-CHASERS.radius-.1,z:A.z,vx:0,vz:0});
 for(let now=2000;now<=5000;now+=100){
  advanceChasers(q,[{...a,available:false}],now);
  q.chasers!.balls.forEach((b,i)=>{
   assert(Number.isFinite(b.vx)&&Number.isFinite(b.vz));assert(Math.hypot(b.x-A.x,b.z-A.z)<=A.playRadius-CHASERS.radius+.00001);
   for(let j=i+1;j<q.chasers!.balls.length;j++){
    const other=q.chasers!.balls[j],dy=chaseBallHeight(q.chasers!,i,now)-chaseBallHeight(q.chasers!,j,now);
    assert(Math.hypot(b.x-other.x,b.z-other.z,dy)>=CHASERS.radius*2-.002,'no interpenetration even at the arena edge');
   }
  });
 }
});

test('online interpolation separates drawn balls without changing authoritative snapshots',()=>{
 const a=actor(),q=event();advanceChasers(q,[a],1000);q.chasers!.at=2200;q.chasers!.balls.length=2;
 Object.assign(q.chasers!.balls[0],{x:A.x-2,z:A.z,vx:0,vz:0});Object.assign(q.chasers!.balls[1],{x:A.x+2,z:A.z,vx:0,vz:0});
 const playback=new ChasePlayback();playback.sample(q,2300,100);
 q.chasers=structuredClone(q.chasers!);q.chasers.at=2400;
 q.chasers.balls[0].x=A.x+2;q.chasers.balls[1].x=A.x-2;
 const before=JSON.stringify(q.chasers),drawn=playback.sample(q,2400,100);
 assert(Math.hypot(drawn[0].x-drawn[1].x,drawn[0].z-drawn[1].z,drawn[0].y-drawn[1].y)>=CHASERS.radius*2);
 assert.equal(JSON.stringify(q.chasers),before);
});
