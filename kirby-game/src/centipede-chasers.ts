import {BOSS_ARENA as A} from './boss-arena-site';
import type {CentipedeActor,CentipedeEvent,Point} from './centipede-event';

/** Small, authoritative simulation shared by solo play and the room. */
export const CHASERS={count:4,radius:1.05,speed:6.8,kickSpeed:18,kickMs:1050,bounceMs:450,graceMs:1450,spawnMs:900,snapshotMs:200} as const;
export type ChaseBall={x:number;z:number;vx:number;vz:number;target:string;kickUntil:number;bounceUntil?:number;contactAfter:number;serial:number};
export type ChaseState={stageAt:number;at:number;bornAt:number;balls:ChaseBall[]};
export type ChaseSnapshot={startedAt:number;state:ChaseState};
export function hasChasers(q:CentipedeEvent|undefined){return !!q&&['gather','coil','lower','rise'].includes(q.stage);}
const participants=(q:CentipedeEvent,actors:readonly CentipedeActor[])=>actors.filter(a=>q.players[a.id]&&Math.hypot(a.p[0]-A.x,a.p[2]-A.z)<A.playRadius+2);
const targets=(q:CentipedeEvent,actors:readonly CentipedeActor[])=>participants(q,actors).filter(a=>a.available).sort((a,b)=>a.id.localeCompare(b.id));

function create(q:CentipedeEvent,actors:readonly CentipedeActor[],now:number):ChaseState{
 const players=targets(q,actors),count=Math.min(CHASERS.count,2+Math.max(1,players.length));
 const balls=Array.from({length:count},(_,i)=>{
  // Choose spaced perimeter spots, never materialise inside a participant.
  let angle=i*Math.PI*2/count+q.cycle*.61,x=0,z=0;
  for(let n=0;n<24;n++){
   x=A.x+Math.sin(angle)*29;z=A.z+Math.cos(angle)*29;
   if(players.every(a=>Math.hypot(x-a.p[0],z-a.p[2])>5+Math.min(8,a.size*.55)))break;
   angle+=Math.PI/12;
  }
  return {x,z,vx:0,vz:0,target:players[i%Math.max(1,players.length)]?.id??'',kickUntil:0,contactAfter:now+CHASERS.spawnMs,serial:0};
 });
 return {stageAt:q.stageAt,at:now,bornAt:now,balls};
}

// Include the slight sideways expansion when a rubber ball lands. The same
// separation is used for online interpolation so the drawn balls never overlap.
const ballDiameter=CHASERS.radius*2*1.08;
function keepInside(b:ChaseBall,bounce:boolean){
 const dx=b.x-A.x,dz=b.z-A.z,d=Math.hypot(dx,dz),limit=A.playRadius-CHASERS.radius*1.08;
 if(d<=limit)return;
 const nx=dx/d,nz=dz/d;b.x=A.x+nx*limit;b.z=A.z+nz*limit;
 const out=b.vx*nx+b.vz*nz;if(bounce&&out>0){b.vx-=1.8*out*nx;b.vz-=1.8*out*nz;}
}
/** Equal-mass rubber-ball contacts, with a short pause in steering. Heights
 * follow the existing jump arcs; only their intersecting horizontal slices
 * collide. Eight tiny passes also separate a cluster against the arena edge. */
function ballContacts(balls:ChaseBall[],heights:readonly number[],now:number,bounce:boolean){
 for(const b of balls)keepInside(b,bounce);
 for(let pass=0;pass<8;pass++){
  let touching=false;
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
   const a=balls[i],b=balls[j],dy=heights[j]-heights[i],radius2=ballDiameter*ballDiameter-dy*dy;
   if(radius2<=0)continue;
   const dx=b.x-a.x,dz=b.z-a.z,d2=dx*dx+dz*dz;if(d2>=radius2)continue;
   const distance=Math.sqrt(d2),gap=Math.sqrt(radius2)-distance;let nx:number,nz:number;
   if(distance>.00001){nx=dx/distance;nz=dz/distance;}
   else {const vx=a.vx-b.vx,vz=a.vz-b.vz,speed=Math.hypot(vx,vz),angle=(i*balls.length+j)*2.399;nx=speed>.001?vx/speed:Math.sin(angle);nz=speed>.001?vz/speed:Math.cos(angle);}
   const correction=(gap+.0001)*.5;a.x-=nx*correction;a.z-=nz*correction;b.x+=nx*correction;b.z+=nz*correction;touching=true;
   if(bounce){
    const closing=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;
    // Never reverse balls already moving apart. A coincident stationary pair
    // gets a gentle nudge instead of sticking together at the same target.
    if(closing<-.0001||(pass===0&&gap>.05&&Math.abs(closing)<.0001)){
     const impulse=Math.max(1.6,-closing*.925);
     a.vx-=nx*impulse;a.vz-=nz*impulse;b.vx+=nx*impulse;b.vz+=nz*impulse;
     a.bounceUntil=Math.max(a.bounceUntil??0,now+CHASERS.bounceMs);b.bounceUntil=Math.max(b.bounceUntil??0,now+CHASERS.bounceMs);
    }
   }
  }
  for(const b of balls)keepInside(b,bounce);
  if(!touching)break;
 }
}

/** Fixed small steps avoid different behaviour at 30/60 FPS and 5/10 Hz.
 * No timers, random values, world snapshots or storage writes are needed. */
export function advanceChasers(q:CentipedeEvent|undefined,actors:readonly CentipedeActor[],now:number){
 if(!q)return;
 if(!hasChasers(q)){delete q.chasers;return;}
 const state=q.chasers??=create(q,actors,now);state.stageAt=q.stageAt;
 if(now<=state.at)return;
 const players=targets(q,actors),dt=Math.min(.5,(now-state.at)/1000),steps=Math.max(1,Math.ceil(dt*60)),step=dt/steps,heights=new Array<number>(state.balls.length);
 for(let tick=1;tick<=steps;tick++){
  const at=now-dt*1000+tick*step*1000;
  state.balls.forEach((b,i)=>{
   let target=players.find(a=>a.id===b.target);
   if(!target){target=players[i%Math.max(1,players.length)];b.target=target?.id??'';}
   if(at<Math.max(b.kickUntil,b.bounceUntil??0)){const drag=Math.exp(-1.35*step);b.vx*=drag;b.vz*=drag;}
   else {
    const dx=target?target.p[0]-b.x:0,dz=target?target.p[2]-b.z:0,d=Math.hypot(dx,dz),ease=1-Math.exp(-4*step);
    const speed=target&&at>state.bornAt+CHASERS.spawnMs?CHASERS.speed:0;
    b.vx+=((d>.01?dx/d*speed:0)-b.vx)*ease;b.vz+=((d>.01?dz/d*speed:0)-b.vz)*ease;
   }
   b.x+=b.vx*step;b.z+=b.vz*step;
   keepInside(b,true);heights[i]=chaseBallHeight(state,i,at);
  });
  ballContacts(state.balls,heights,at,true);
 }
 state.at=now;
}

export function chaseBallHeight(state:ChaseState,index:number,now:number){
 const phase=((now-state.bornAt)/760+index*.23)%1;
 return CHASERS.radius+.13+Math.max(0,4*phase*(1-phase))*1.25;
}
function touchingHeight(state:ChaseState,b:ChaseBall,a:CentipedeActor,index:number,now:number){
 const y=chaseBallHeight(state,index,now);
 return a.p[1]<y+CHASERS.radius&&a.p[1]+1.9*a.size>y-CHASERS.radius;
}
function repel(b:ChaseBall,direction:Point,now:number){
 b.vx=direction[0]*CHASERS.kickSpeed;b.vz=direction[1]*CHASERS.kickSpeed;
 b.kickUntil=now+CHASERS.kickMs;b.contactAfter=now+CHASERS.graceMs;b.serial++;
}
/** One nearest ball in front, using the existing push button/size/facing. */
export function pushChaser(q:CentipedeEvent|undefined,a:CentipedeActor,now:number){
 const state=q?.chasers;if(!state||!hasChasers(q)||!a.available||!q!.players[a.id])return false;
 if(Math.hypot(a.p[0]-A.x,a.p[2]-A.z)>A.playRadius+2)return false;
 const fx=Math.sin(a.yaw),fz=Math.cos(a.yaw),reach=3.1*a.size;
 let best:ChaseBall|undefined,bestDistance=Infinity;
 state.balls.forEach((b,i)=>{
  if(now<state.bornAt+CHASERS.spawnMs||now<b.kickUntil||!touchingHeight(state,b,a,i,now))return;
  const dx=b.x-a.p[0],dz=b.z-a.p[2],forward=dx*fx+dz*fz,d=Math.hypot(dx,dz);
  if(forward<-.2||d>reach+CHASERS.radius)return;
  const t=Math.max(0,Math.min(reach,forward)),side=Math.hypot(dx-fx*t,dz-fz*t);
  if(side<CHASERS.radius+.6*a.size&&d<bestDistance){best=b;bestDistance=d;}
 });
 if(!best)return false;repel(best,[fx,fz],now);return true;
}
/** The ball rebounds too, then recovers and resumes pursuit. No damage/points. */
export function bumpChaser(q:CentipedeEvent|undefined,a:CentipedeActor,now:number):Point|undefined{
 const state=q?.chasers;if(!state||!hasChasers(q)||!a.available||!q!.players[a.id])return;
 if(now<(q!.players[a.id].chaserSafeUntil??0))return;
 if(Math.hypot(a.p[0]-A.x,a.p[2]-A.z)>A.playRadius+2)return;
 for(let i=0;i<state.balls.length;i++){
  const b=state.balls[i];if(now<b.contactAfter||!touchingHeight(state,b,a,i,now))continue;
  const dx=a.p[0]-b.x,dz=a.p[2]-b.z,d=Math.hypot(dx,dz);
  if(d>=CHASERS.radius+Math.min(8,a.size*.55))continue;
  const speed=Math.hypot(b.vx,b.vz),direction:Point=d>.01?[dx/d,dz/d]:speed>.01?[b.vx/speed,b.vz/speed]:[Math.sin(a.yaw),Math.cos(a.yaw)];
  repel(b,[-direction[0],-direction[1]],now);q!.players[a.id].chaserSafeUntil=now+1000;return direction;
 }
}

/** Tiny, rounded snapshots ride in existing WebSocket frames. */
export function chaseSnapshot(q:CentipedeEvent):ChaseSnapshot|undefined{
 if(!q.chasers||!hasChasers(q))return;
 const round=(n:number)=>Math.round(n*1000)/1000;
 return {startedAt:q.startedAt,state:{...q.chasers,balls:q.chasers.balls.map(b=>({...b,x:round(b.x),z:round(b.z),vx:round(b.vx),vz:round(b.vz)}))}};
}
export function applyChaseSnapshot(q:CentipedeEvent|undefined,snapshot:ChaseSnapshot){
 if(!q||!hasChasers(q)||q.startedAt!==snapshot.startedAt||q.stageAt!==snapshot.state.stageAt||(q.chasers?.at??-Infinity)>snapshot.state.at)return;
 q.chasers=snapshot.state;
}

/** Interpolate online balls locally; solo uses its live simulation directly. */
export class ChasePlayback{
 private key='';private samples:ChaseState[]=[];
 sample(q:CentipedeEvent,now:number,delay=0){
  const state=q.chasers;if(!state||!hasChasers(q)){this.samples=[];this.key='';return [];}
  if(!delay)return state.balls.map((b,i)=>({...b,y:chaseBallHeight(state,i,now)}));
  const key=`${q.startedAt}:${state.bornAt}`;
  if(this.key!==key){this.key=key;this.samples=[];}
  if(state.at>(this.samples.at(-1)?.at??-Infinity)){this.samples.push(state);if(this.samples.length>4)this.samples.shift();}
  const t=now-delay,first=this.samples[0],latest=this.samples.at(-1)!;
  let before=first,after=first;
  for(const sample of this.samples){if(sample.at<=t)before=sample;if(sample.at>=t){after=sample;break;}after=sample;}
  const u=after.at>before.at?Math.max(0,Math.min(1,(t-before.at)/(after.at-before.at))):0;
  const extrapolate=Math.max(0,Math.min(.1,(t-latest.at)/1000));
  const balls=before.balls.map((b,i)=>{const next=after.balls[i]??b;return {...b,x:b.x+(next.x-b.x)*u+next.vx*extrapolate,z:b.z+(next.z-b.z)*u+next.vz*extrapolate,y:chaseBallHeight(state,i,t)};});
  ballContacts(balls,balls.map(b=>b.y),t,false);return balls;
 }
}
