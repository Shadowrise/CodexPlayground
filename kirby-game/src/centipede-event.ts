import {BOSS_ARENA as A} from './boss-arena-site';

/** Dependency-free rules and paths shared by solo play and the Cloudflare room. */
export const CENTIPEDE_STEP=1.35*1.25, CENTIPEDE_PHASE_HITS=3, CENTIPEDE_HITS=9, CENTIPEDE_POINT_LIMIT=12;
export const CENTIPEDE_TIMES={invite:2500,warning:1800,charge:6000,balls:12500,exhausted:10000,tickle:2000,gather:5000,coil:2400,stomp:15000,lower:1800,back:16000,bell:1400,rise:1800,curl:2400,wheelWarning:1800,wheelRoll:8500,dizzy:16000,ballShot:1100,wheelHit:1200,uncurl:2400,celebrate:10000,rest:60000} as const;
export const CENTIPEDE_BALLS={waves:3,perWave:5,interval:2600,launch:1450,speed:12,radius:1.05,life:5500} as const;
export type CentipedeStage=keyof typeof CENTIPEDE_TIMES;
export type Point=[number,number];
export type CentipedeActor={id:string;p:readonly number[];yaw:number;size:number;available:boolean;done:boolean;points:number};
export type CentipedeParticipant={first:boolean;base:number;points:number;hits:number;dodges:number;origin:Point;bumpedCycle:number;ballBumps?:number;waveBumps?:number};
export type CentipedeEvent={startedAt:number;stage:CentipedeStage;stageAt:number;cycle:number;hits:number;phase?:1|2|3;trail:Point[];from:Point;control:Point;to:Point;route?:Point[];players:Record<string,CentipedeParticipant>};
export const centipedePhase=(q:CentipedeEvent)=>q.phase??1;
export const centipedePhaseHits=(q:CentipedeEvent)=>Math.max(0,Math.min(3,q.hits-(centipedePhase(q)-1)*3));
const length=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const blend=(a:Point,b:Point,t:number):Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const ground=(a:CentipedeActor):Point=>[a.p[0],a.p[2]];
const inside=(a:CentipedeActor)=>a.available&&Math.hypot(a.p[0]-A.x,a.p[2]-A.z)<A.playRadius+2;
function member(a:CentipedeActor):CentipedeParticipant{return {first:!a.done,base:a.points,points:a.points,hits:0,dodges:0,origin:ground(a),bumpedCycle:-1};}
function reward(p:CentipedeParticipant){if(p.first)p.points=Math.min(CENTIPEDE_POINT_LIMIT,p.base+p.hits*2+p.dodges);}
export function validCentipedeTrail(value:unknown):value is Point[]{
 return Array.isArray(value)&&value.length===12&&value.every((p,i)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.hypot(p[0]-A.x,p[1]-A.z)<A.playRadius-3&&(!i||length(p,value[i-1])>.9&&length(p,value[i-1])<2.3));
}
export function nearCentipede(a:CentipedeActor,trail:readonly Point[]){return a.available&&a.p[1]<3&&trail.some(p=>length(ground(a),p)<5+Math.min(3,a.size*.7));}
export function startCentipede(trail:unknown,a:CentipedeActor,now:number):CentipedeEvent|undefined{
 if(!validCentipedeTrail(trail)||!nearCentipede(a,trail))return;
 const from=[...trail.at(-1)!] as Point;
 return {startedAt:now,stage:'invite',stageAt:now,cycle:0,hits:0,phase:1,trail:trail.map(p=>[...p]),from,control:from,to:from,players:{[a.id]:member(a)}};
}
const curveCache=new WeakMap<Point[],{points:Point[];distances:number[];length:number}>();
const RUN_RADIUS=A.playRadius-4;
function bound(p:Point):Point{const r=Math.hypot(p[0]-A.x,p[1]-A.z);return r>RUN_RADIUS?[A.x+(p[0]-A.x)*RUN_RADIUS/r,A.z+(p[1]-A.z)*RUN_RADIUS/r]:p;}
/** Compact knots go over the wire; sample/cache the smooth arc-length curve once. */
function runCurve(q:CentipedeEvent){
 const knots=q.route??[q.from,q.control,q.to];let cached=curveCache.get(knots);if(cached)return cached;
 const points:Point[]=[knots[0]],distances=[0];let total=0;
 for(let i=0;i<knots.length-1;i++)for(let j=1;j<=16;j++){
  const a=knots[Math.max(0,i-1)],b=knots[i],c=knots[i+1],d=knots[Math.min(knots.length-1,i+2)],t=j/16,t2=t*t,t3=t2*t;
  const point=bound([0,1].map(axis=>.5*((2*b[axis])+(-a[axis]+c[axis])*t+(2*a[axis]-5*b[axis]+4*c[axis]-d[axis])*t2+(-a[axis]+3*b[axis]-3*c[axis]+d[axis])*t3)) as Point);
  total+=length(points.at(-1)!,point);points.push(point);distances.push(total);
 }
 cached={points,distances,length:total};if(q.route)curveCache.set(knots,cached);return cached;
}
function runProgress(u:number){u=Math.max(0,Math.min(1,u));return u<.15?u*u/(.15*1.7):u>.85?1-(1-u)**2/(.15*1.7):(u-.075)/.85;}
function curvePoint(curve:ReturnType<typeof runCurve>,distance:number):Point{
 const {points,distances}=curve;let lo=1,hi=distances.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(distances[mid]<distance)lo=mid+1;else hi=mid;}
 return blend(points[lo-1],points[lo],Math.max(0,Math.min(1,(distance-distances[lo-1])/Math.max(.00001,distances[lo]-distances[lo-1]))));
}
export function chargePoint(q:CentipedeEvent,u:number):Point{const curve=runCurve(q);return curvePoint(curve,curve.length*runProgress(u));}
function liveTrail(q:CentipedeEvent,now:number):Point[]{
 if(q.stage!=='charge')return q.trail;
 const curve=runCurve(q),distance=curve.length*runProgress((now-q.stageAt)/CENTIPEDE_TIMES.charge),points=q.trail.slice();
 for(let i=1;i<curve.points.length&&curve.distances[i]<distance;i++)points.push(curve.points[i]);
 if(distance>0)points.push(curvePoint(curve,distance));return points;
}
/** Follow the travelled path, rather than rotate the body around a pinned tail. */
export function trailingPoint(path:readonly Point[],distance:number):Point{
 for(let i=path.length-1;i>0;i--){const d=length(path[i],path[i-1]);if(d<.00001)continue;if(distance<=d)return blend(path[i],path[i-1],distance/d);distance-=d;}
 const a=path[0],b=path[1],d=Math.max(.001,length(a,b));return [a[0]+(a[0]-b[0])*distance/d,a[1]+(a[1]-b[1])*distance/d];
}
export function centipedeSegments(q:CentipedeEvent,now:number){
 const path=liveTrail(q,now);
 return Array.from({length:12},(_,i)=>{const distance=i*CENTIPEDE_STEP,p=trailingPoint(path,distance),ahead=trailingPoint(path,Math.max(0,distance-.12)),behind=trailingPoint(path,distance+.12);let yaw=Math.atan2(ahead[0]-behind[0],ahead[1]-behind[1]);
  if(q.stage==='gather'){const u=Math.max(0,Math.min(1,(now-q.stageAt)/CENTIPEDE_TIMES.gather)),t=u*u*(3-2*u),line:Point=[A.x,A.z+(5.5-i)*CENTIPEDE_STEP];p[0]+=(line[0]-p[0])*t;p[1]+=(line[1]-p[1])*t;yaw+=Math.atan2(Math.sin(-yaw),Math.cos(-yaw))*t;}
  return {x:p[0],z:p[1],yaw};});
}
export function centipedeTail(q:CentipedeEvent):Point{return trailingPoint(q.trail,11*CENTIPEDE_STEP+1.4);}
export type CentipedeBall={index:number;wave:number;x:number;y:number;z:number;dx:number;dz:number;age:number;active:boolean};
/** Three sneeze fans, derived from one stage clock on both client and server.
 * Preview positions give players 1.45 seconds to see each wave before it moves. */
export function centipedeBalls(q:CentipedeEvent,now:number):CentipedeBall[]{
 if(q.stage!=='balls')return [];
 const b=CENTIPEDE_BALLS,head=q.trail.at(-1)!,heading=Math.atan2(A.x-head[0],A.z-head[1]),elapsed=now-q.stageAt,balls:CentipedeBall[]=[];
 for(let wave=0;wave<b.waves;wave++){
  const age=elapsed-wave*b.interval-b.launch;
  if(age<-b.launch||age>b.life)continue;
  for(let lane=0;lane<b.perWave;lane++){
   // Alternating fans leave broad gaps rather than make an unavoidable wall.
   const angle=heading+(lane-2)*.34+(wave===1?.17:0),dx=Math.sin(angle),dz=Math.cos(angle),distance=2.6+Math.max(0,age)/1000*b.speed;
   const x=head[0]+dx*distance,z=head[1]+dz*distance;
   if(Math.hypot(x-A.x,z-A.z)>A.playRadius-b.radius)continue;
   balls.push({index:wave*b.perWave+lane,wave,x,y:b.radius+.15+Math.abs(Math.sin(Math.max(0,age)/1000*5.5+lane*.3))*.45,z,dx,dz,age,active:age>=0});
  }
 }
 return balls;
}
export type CentipedeWave={index:number;radius:number;gap:number;angle:number;age:number};
/** Pairs of foot stomps, then faster narrow-gap rings during the wheel finale. */
export function centipedeWaves(q:CentipedeEvent,now:number):CentipedeWave[]{
 if(q.stage!=='stomp'&&q.stage!=='wheelRoll')return [];
 const wheel=q.stage==='wheelRoll',count=wheel?3:6,interval=wheel?2600:2000,speed=wheel?13.5:10,initial=wheel?3:5,elapsed=now-q.stageAt,waves:CentipedeWave[]=[];
 for(let i=0;i<count;i++){
  const age=elapsed-1200-i*interval,radius=initial+Math.max(0,age)/1000*speed;
  if(age>=0&&radius<A.playRadius+1)waves.push({index:i,radius,gap:wheel?.82:1.15,angle:(q.cycle+i)*(wheel?1.35:Math.PI/2),age});
 }
 return waves;
}
export function centipedeWheel(q:CentipedeEvent,now:number){
 const curve=runCurve(q),u=q.stage==='wheelRoll'?Math.max(0,Math.min(1,(now-q.stageAt)/CENTIPEDE_TIMES.wheelRoll)):q.stage==='wheelWarning'?0:1,distance=curve.length*runProgress(u),p=curvePoint(curve,distance),a=curvePoint(curve,Math.max(0,distance-.2)),b=curvePoint(curve,Math.min(curve.length,distance+.2));
 return {x:p[0],z:p[1],yaw:Math.atan2(b[0]-a[0],b[1]-a[1]),distance};
}
/** Whole-model clips retain their accepted poses: no per-segment route override. */
export function centipedeRoot(q:CentipedeEvent,now:number):{x:number;z:number;yaw:number}{
 if(q.stage==='rest'){const t=Math.max(0,Math.min(1,(now-q.stageAt)/6000)),u=t*t*(3-2*t);return {x:A.x+16*u,z:A.z+11*u,yaw:Math.atan2(16,11)};}
 if(['wheelWarning','wheelRoll','dizzy','ballShot','wheelHit','uncurl'].includes(q.stage)){
  const p=centipedeWheel(q,now);
  if(q.stage==='uncurl'){const t=Math.max(0,Math.min(1,(now-q.stageAt)/CENTIPEDE_TIMES.uncurl)),u=t*t*(3-2*t);p.x+=(A.x-p.x)*u;p.z+=(A.z-p.z)*u;p.yaw*=1-u;}
  return p;
 }
 return {x:A.x,z:A.z,yaw:0};
}
/** A nearby ball is kicked toward the dizzy wheel; it is never a collectible. */
export function centipedePlayBall(q:CentipedeEvent):[number,number,number]{
 const p=centipedeWheel(q,q.stageAt),d=Math.max(.001,Math.hypot(A.x-p.x,A.z-p.z));
 return [p.x+(A.x-p.x)/d*7.5,1.1,p.z+(A.z-p.z)/d*7.5];
}
export function centipedeTarget(q:CentipedeEvent):[number,number,number]{
 if(centipedePhase(q)===1){const p=centipedeTail(q);return [p[0],.25,p[1]];}
 if(centipedePhase(q)===2)return [A.x,4.76,A.z+2.5*CENTIPEDE_STEP];
 return centipedePlayBall(q);
}
function resetHazards(q:CentipedeEvent,actors:readonly CentipedeActor[]){
 q.cycle++;for(const p of Object.values(q.players)){p.ballBumps=0;p.waveBumps=0;}
 for(const a of actors.filter(inside)){q.players[a.id]??=member(a);q.players[a.id].origin=ground(a);}
}
function aimWheel(q:CentipedeEvent,actors:readonly CentipedeActor[]){
 resetHazards(q,actors);const angle=q.cycle*.9,c=Math.cos(angle),s=Math.sin(angle),from=q.to;
 q.route=[from,...[[-22,-12],[21,-15],[-19,18],[24,9],[-23,-3],[14,-20]].map(([x,z])=>[A.x+x*c-z*s,A.z+x*s+z*c] as Point)];q.from=from;q.control=q.route[1];q.to=q.route.at(-1)!;
}
function dodgeReward(q:CentipedeEvent,actors:readonly CentipedeActor[],clean:(p:CentipedeParticipant)=>boolean){
 for(const a of actors){const p=q.players[a.id];if(p&&inside(a)&&clean(p)&&(length(p.origin,ground(a))>1.5||a.p[1]>1.2)){p.dodges++;reward(p);}}
}
function aim(q:CentipedeEvent,actors:readonly CentipedeActor[]){
 const candidates=actors.filter(inside).sort((a,b)=>a.id.localeCompare(b.id)),target=candidates[q.cycle%candidates.length];
 q.from=[...q.trail.at(-1)!];const behind=trailingPoint(q.trail,2),heading=length(q.from,behind),hx=(q.from[0]-behind[0])/Math.max(.01,heading),hz=(q.from[1]-behind[1])/Math.max(.01,heading);
 const angle=Math.atan2(q.from[0]-A.x,q.from[1]-A.z),direction=hx*Math.cos(angle)-hz*Math.sin(angle)>=0?1:-1;
 const targetRadius=target?Math.hypot(target.p[0]-A.x,target.p[2]-A.z):18;
 // A broad winding sweep: outward run, inward bend, then a second wide turn.
 // Alternating ends use the full arena; the first lead keeps the body's heading.
 for(const dip of [Math.max(17,Math.min(23,targetRadius)),25,29]){
  const lead=bound([q.from[0]+hx*7,q.from[1]+hz*7]);
  q.route=[q.from,lead,...[.62,1.3,2.05,2.85,3.55,4.25].map((turn,i)=>{const r=[30.5,31,dip,30.5,25,31][i],a=angle+direction*turn;return [A.x+Math.sin(a)*r,A.z+Math.cos(a)*r] as Point;})];
  q.control=lead;q.to=q.route.at(-1)!;
  const probe={...q,stage:'charge' as const};let safe=true;
  for(let step=1;step<=40&&safe;step++){
   const segments=centipedeSegments(probe,q.stageAt+step/40*CENTIPEDE_TIMES.charge);
   for(let i=0;i<12&&safe;i++)for(let j=i+3;j<12;j++)if(Math.hypot(segments[i].x-segments[j].x,segments[i].z-segments[j].z)<2.1){safe=false;break;}
  }
  if(safe)break;
 }
 for(const p of Object.values(q.players))p.ballBumps=0;
 for(const a of candidates){q.players[a.id]??=member(a);q.players[a.id].origin=ground(a);}
}
/** Mutates only when a participant joins or the phase changes; no per-frame wire state. */
export function advanceCentipede(q:CentipedeEvent|undefined,now:number,actors:readonly CentipedeActor[]):{event?:CentipedeEvent;changed:boolean}{
 if(!q)return {changed:false};
 if(q.stage==='rest'&&now-q.stageAt>=CENTIPEDE_TIMES.rest||q.stage!=='rest'&&q.stage!=='celebrate'&&now-q.startedAt>900000)return {changed:true};
 let changed=false;
 if(q.stage!=='celebrate'&&q.stage!=='rest')for(const a of actors)if(inside(a)&&!q.players[a.id]){q.players[a.id]=member(a);changed=true;}
 if(now-q.stageAt<CENTIPEDE_TIMES[q.stage])return {event:q,changed};
 if(q.hits<CENTIPEDE_HITS&&!actors.some(a=>Math.hypot(a.p[0]-A.x,a.p[2]-A.z)<A.playRadius+2))return {changed:true};
 const previous=q.stage;
 if(previous==='invite'||previous==='tickle'||previous==='exhausted'){
  if(q.hits>=CENTIPEDE_PHASE_HITS){q.phase=2;q.stage='gather';}
  else {q.cycle++;q.stageAt=now;aim(q,actors);q.stage='warning';}
 }else if(previous==='warning')q.stage='charge';
 else if(previous==='charge'){
  for(const a of actors){const p=q.players[a.id];if(p&&inside(a)&&p.bumpedCycle!==q.cycle&&(length(p.origin,ground(a))>1.5||a.p[1]>1.8)){p.dodges++;reward(p);}}
  const travelled=liveTrail(q,q.stageAt+CENTIPEDE_TIMES.charge);q.trail=Array.from({length:36},(_,i)=>trailingPoint(travelled,(35-i)*CENTIPEDE_STEP)).map(p=>p.map(v=>Math.round(v*100)/100) as Point);q.stage='balls';
  for(const a of actors){const p=q.players[a.id];if(p)p.origin=ground(a);}
 }else if(previous==='balls'){
  for(const a of actors){const p=q.players[a.id];if(p&&inside(a)&&!p.ballBumps&&(length(p.origin,ground(a))>1.5||a.p[1]>2.8)){p.dodges++;reward(p);}}
  q.stage='exhausted';
 }else if(previous==='gather')q.stage='coil';
 else if(previous==='coil'||previous==='rise'){resetHazards(q,actors);q.stage='stomp';}
 else if(previous==='stomp'){dodgeReward(q,actors,p=>!p.waveBumps);q.stage='lower';}
 else if(previous==='lower')q.stage='back';
 else if(previous==='back')q.stage='rise';
 else if(previous==='bell'){
  if(q.hits>=6){q.phase=3;q.from=q.to=[A.x,A.z];q.route=undefined;q.stage='curl';}
  else q.stage='rise';
 }else if(previous==='curl'){aimWheel(q,actors);q.stage='wheelWarning';}
 else if(previous==='wheelWarning')q.stage='wheelRoll';
 else if(previous==='wheelRoll'){dodgeReward(q,actors,p=>p.bumpedCycle!==q.cycle&&!p.waveBumps);q.stage='dizzy';}
 else if(previous==='dizzy'){aimWheel(q,actors);q.stage='wheelWarning';}
 else if(previous==='ballShot')q.stage='wheelHit';
 else if(previous==='wheelHit'){
  if(q.hits>=CENTIPEDE_HITS)q.stage='uncurl';else {aimWheel(q,actors);q.stage='wheelWarning';}
 }else if(previous==='uncurl')q.stage='celebrate';
 else if(previous==='celebrate')q.stage='rest';
 q.stageAt=now;return {event:q,changed:true};
}
export function pushCentipede(q:CentipedeEvent|undefined,a:CentipedeActor,now:number){
 if(!q||!['exhausted','back','dizzy'].includes(q.stage)||!inside(a))return false;
 const target=centipedeTarget(q),dx=target[0]-a.p[0],dz=target[2]-a.p[2],d=Math.hypot(dx,dz),reach=q.stage==='dizzy'?2.5:3;
 if(d>reach+Math.min(4,a.size*.75)||a.p[1]>(q.stage==='back'?8:3))return false;
 if(q.stage==='back'&&(a.p[1]<1.25||Math.abs(a.p[1]+Math.min(3,a.size*.95)-target[1])>2))return false;
 const facing=q.stage==='dizzy'?centipedeWheel(q,now):{x:target[0],z:target[2]},fx=facing.x-a.p[0],fz=facing.z-a.p[2],fd=Math.hypot(fx,fz);
 if(fd>.5&&(fx*Math.sin(a.yaw)+fz*Math.cos(a.yaw))/fd<(q.stage==='dizzy'?.5:.15))return false;
 const p=q.players[a.id]??=member(a);p.hits++;reward(p);q.hits++;q.stage=q.stage==='exhausted'?'tickle':q.stage==='back'?'bell':'ballShot';q.stageAt=now;return true;
}
export function centipedeContact(q:CentipedeEvent|undefined,a:CentipedeActor,now:number):{direction:Point;key:string;wave?:number;ring?:number}|undefined{
 if(!q||!inside(a))return;
 const p=q.players[a.id];if(!p)return;
 if(q.stage==='charge'){
  if(a.p[1]>2.6||p.bumpedCycle===q.cycle)return;
  const head=chargePoint(q,(now-q.stageAt)/CENTIPEDE_TIMES.charge),dx=a.p[0]-head[0],dz=a.p[2]-head[1],d=Math.hypot(dx,dz);
  if(d>2.1+Math.min(8,a.size*.55))return;
  return {direction:d>.1?[dx/d,dz/d]:[1,0],key:`${q.startedAt}:${q.cycle}:charge`};
 }
 if(q.stage==='balls')for(const b of centipedeBalls(q,now)){
  if(!b.active||((p.ballBumps??0)&(1<<b.wave))||a.p[1]>b.y+CENTIPEDE_BALLS.radius)continue;
  const dx=a.p[0]-b.x,dz=a.p[2]-b.z,d=Math.hypot(dx,dz);
  if(d<CENTIPEDE_BALLS.radius+Math.min(8,a.size*.55))return {direction:d>.1?[dx/d,dz/d]:[b.dx,b.dz],key:`${q.startedAt}:${q.cycle}:balls:${b.wave}`,wave:b.wave};
 }
 if(q.stage==='wheelRoll'&&a.p[1]<10&&p.bumpedCycle!==q.cycle){
  const wheel=centipedeWheel(q,now),dx=a.p[0]-wheel.x,dz=a.p[2]-wheel.z,s=Math.sin(wheel.yaw),c=Math.cos(wheel.yaw),side=dx*c-dz*s,front=dx*s+dz*c;
  if(Math.abs(side)<1.65+Math.min(4,a.size*.55)&&Math.abs(front)<4.9+Math.min(4,a.size*.55)){
   return {direction:side>=0?[c,-s]:[-c,s],key:`${q.startedAt}:${q.cycle}:wheel`};
  }
 }
 if(a.p[1]<.95)for(const wave of centipedeWaves(q,now)){
  if((p.waveBumps??0)&(1<<wave.index))continue;
  const dx=a.p[0]-A.x,dz=a.p[2]-A.z,d=Math.hypot(dx,dz),angle=Math.atan2(dz,dx),gap=Math.abs(Math.atan2(Math.sin(angle-wave.angle),Math.cos(angle-wave.angle)));
  // Keep the whole footprint inside the gap, so its painted safe sector is reliable.
  if(gap<wave.gap/2-Math.min(.22,a.size*.3/Math.max(1,d)))continue;
  if(Math.abs(d-wave.radius)<.65+Math.min(4,a.size*.4))return {direction:d>.1?[dx/d,dz/d]:[1,0],key:`${q.startedAt}:${q.cycle}:ring:${wave.index}`,ring:wave.index};
 }
}
export function bumpCentipede(q:CentipedeEvent|undefined,a:CentipedeActor,now:number,mark=true):Point|undefined{
 const hit=centipedeContact(q,a,now);if(!hit)return;
 if(mark){const p=q!.players[a.id];if(hit.ring!==undefined)p.waveBumps=(p.waveBumps??0)|(1<<hit.ring);else if(hit.wave===undefined)p.bumpedCycle=q!.cycle;else p.ballBumps=(p.ballBumps??0)|(1<<hit.wave);}
 return hit.direction;
}
export function completedCentipede(q:CentipedeEvent|undefined,id:string){const p=q?.players[id];return !!q&&q.hits>=CENTIPEDE_HITS&&['celebrate','rest'].includes(q.stage)&&!!p&&(p.hits>0||p.dodges>0);}
