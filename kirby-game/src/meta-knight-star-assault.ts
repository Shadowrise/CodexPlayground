import type {KnightBattle,KnightPoint,KnightStage,KnightCross} from './meta-knight-battle';
import {SHIELD,shieldDanger,crystalPoint,crystalBroken} from './meta-knight-shield';
import {META_KNIGHT_ARENA} from './meta-knight-arena-site';
export {crystalPoint} from './meta-knight-shield';

/** Shared phase-three choreography and geometry, in arena metres/ms. */
export const STAR_ASSAULT={crystalRadius:SHIELD.crystalRadius,ricochetRadius:35,beamHalfWidth:2.0,crossWarningMinMs:3000,routeHalfWidth:4.5,impactRadius:SHIELD.radius,hover:1.2,peak:9} as const;
export const STAR_FLIGHTS=3,STAR_FLIGHT_STEP=3,STAR_LANDING_STEP=STAR_FLIGHT_STEP+STAR_FLIGHTS*2,STAR_FALL_STEP=STAR_LANDING_STEP+1,STAR_SHIELD_STEP=STAR_LANDING_STEP+2;
export const STAR_SEQUENCE:[KnightStage,number][]=[
 // The cross warning duration is calculated from the players' positions on entry.
 ['star-rise',1200],['cross-warn',STAR_ASSAULT.crossWarningMinMs],['cross',450],
 ['ricochet-warn',1550],['ricochet',950],['ricochet-warn',1000],['ricochet',950],['ricochet-warn',1000],['ricochet',950],
 ['star-warn',1550],['star-fall',1100],['shield',1e12],
];
export const starFlightCount=(_s:KnightBattle)=>STAR_FLIGHTS;
export const starSequence=(_s:KnightBattle)=>STAR_SEQUENCE;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{v=clamp(v);return v*v*(3-2*v);};
export const starProgress=(s:KnightBattle,now:number)=>clamp((now-s.since)/Math.max(1,s.until-s.since));
export const starOpening=(s:KnightBattle)=>s.pattern==='star'&&(s.stage==='shield'||s.stage==='crystal-break');
export function crossPairs(s:KnightBattle):[[number,number],[number,number]]{if(s.starCross)return s.starCross.pairs;const available=Array.from({length:8},(_,i)=>i).filter(i=>!crystalBroken(s,i)),n=available.length,base=((s.cycle-1)+80)%n,at=(i:number)=>available[(base+i)%n];return [[at(0),at(Math.floor(n/2))],[at(Math.floor(n/4)),at(n-1)]];}
export const crossCrystal=(s:KnightBattle)=>crossPairs(s)[0][0];
/** Continue the crystal beams to the arena rim, including beyond shattered gems. */
export function crossLines(s:KnightBattle):[KnightPoint,KnightPoint][]{return crossPairs(s).map(([a,b])=>{const from=crystalPoint(a),to=crystalPoint(b);return [rimPoint(from,to,from[1]),rimPoint(to,from,to[1])];});}
export function crossLine(s:KnightBattle):[KnightPoint,KnightPoint]{return crossLines(s)[0];}
type Triangle=[KnightPoint,KnightPoint,KnightPoint];
const side=(a:KnightPoint,b:KnightPoint,p:KnightPoint)=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
function contains([a,b,c]:Triangle,p:KnightPoint){const x=side(a,b,p),y=side(b,c,p),z=side(c,a,p);return !(Math.min(x,y,z)<-1e-7&&Math.max(x,y,z)>1e-7);}
function triangleDistance(t:Triangle,p:KnightPoint){return contains(t,p)?0:Math.min(...t.map((a,i)=>segmentDistance(a,t[(i+1)%3],p)));}
function rimPoint(centre:KnightPoint,toward:KnightPoint,height=0):KnightPoint{
 const dx=toward[0]-centre[0],dz=toward[2]-centre[2],length=Math.hypot(dx,dz),x=dx/length,z=dz/length,b=centre[0]*x+centre[2]*z,r=META_KNIGHT_ARENA.radius,t=-b+Math.sqrt(Math.max(0,b*b+r*r-centre[0]**2-centre[2]**2));
 return [centre[0]+x*t,height,centre[2]+z*t];
}
function crossTrianglesFor({pairs:[[ai,ci],[bi,di]],side:orientation}:KnightCross):[Triangle,Triangle]{
 const a=crystalPoint(ai),b=crystalPoint(bi),c=crystalPoint(ci),d=crystalPoint(di),x=c[0]-a[0],z=c[2]-a[2],u=d[0]-b[0],v=d[2]-b[2],t=((b[0]-a[0])*v-(b[2]-a[2])*u)/(x*v-z*u),centre:KnightPoint=[a[0]+x*t,0,a[2]+z*t];
 const triangles:[Triangle,Triangle]=orientation?[[centre,b,c],[centre,d,a]]:[[centre,a,b],[centre,c,d]];
 // Put each base outside the floor. The view clips it to the circular rim;
 // intact crystal chords alone leave safe pockets near broken crystals.
 return triangles.map(([o,a,b])=>{const depth=Math.abs(side(a,b,o))/Math.hypot(b[0]-a[0],b[2]-a[2]),scale=(META_KNIGHT_ARENA.radius+Math.hypot(o[0],o[2])+1)/depth;return [o,[o[0]+(a[0]-o[0])*scale,0,o[2]+(a[2]-o[2])*scale],[o[0]+(b[0]-o[0])*scale,0,o[2]+(b[2]-o[2])*scale]];}) as [Triangle,Triangle];
}
/** Two opposite wedges meet at the crossing and cover their sectors to the rim. */
export const crossTriangles=(s:KnightBattle)=>crossTrianglesFor(s.starCross??{pairs:crossPairs(s),side:0});
/** Visible perimeter: two straight sides and the circular arena edge between them. */
export function crossBoundaries(s:KnightBattle){return crossTriangles(s).map(([centre,a,b])=>{
 const start=rimPoint(centre,a),end=rimPoint(centre,b),begin=Math.atan2(start[2],start[0]),finish=Math.atan2(end[2],end[0]),positive=(finish-begin+Math.PI*2)%(Math.PI*2),mid=begin+positive/2,p:KnightPoint=[Math.cos(mid)*META_KNIGHT_ARENA.radius,0,Math.sin(mid)*META_KNIGHT_ARENA.radius];
 return {centre,start,end,sweep:contains([centre,a,b],p)?positive:positive-Math.PI*2};
});}
/** Closest point in either unlit wedge, with full body clearance and inside the rim. */
function closestCrossEscape([o,a,b]:Triangle,p:KnightPoint):KnightPoint|undefined{
 const radius=META_KNIGHT_ARENA.walkRadius-1.4,clearance=STAR_ASSAULT.beamHalfWidth+.65+.2;
 const normal=(edge:KnightPoint,inside:KnightPoint)=>{const dx=edge[0]-o[0],dz=edge[2]-o[2],length=Math.hypot(dx,dz),sign=(-dz*(inside[0]-o[0])+dx*(inside[2]-o[2]))>=0?1:-1;return {x:-dz/length*sign,z:dx/length*sign};};
 const normals=[normal(a,b),normal(b,a)];let best:KnightPoint|undefined,distance=Infinity;
 for(const sign of [-1,1]){
  const planes=normals.map((n,i)=>{const x=n.x*sign*(i?-1:1),z=n.z*sign*(i?-1:1);return {x,z,b:x*o[0]+z*o[2]+clearance};}),candidates:KnightPoint[]=[[p[0],0,p[2]]];
  for(const n of planes){
   const shift=n.b-n.x*p[0]-n.z*p[2];candidates.push([p[0]+n.x*shift,0,p[2]+n.z*shift]);
   if(Math.abs(n.b)<=radius){const along=Math.sqrt(radius*radius-n.b*n.b);for(const direction of [-1,1])candidates.push([n.x*n.b-n.z*along*direction,0,n.z*n.b+n.x*along*direction]);}
  }
  const [u,v]=planes,det=u.x*v.z-u.z*v.x;candidates.push([(u.b*v.z-u.z*v.b)/det,0,(u.x*v.b-u.b*v.x)/det]);
  for(const q of candidates){if(Math.hypot(q[0],q[2])>radius+.00001||planes.some(n=>n.x*q[0]+n.z*q[2]<n.b-.00001))continue;const d=Math.hypot(q[0]-p[0],q[2]-p[2]);if(d<distance){distance=d;best=q;}}
 }
 return best;
}
export const crossEscapePoint=(s:KnightBattle,p:KnightPoint)=>closestCrossEscape(crossTriangles(s)[0],p);
/** Aim both beams near the player and choose the opposite triangle pair facing them. */
export function lockStarCross(s:KnightBattle,p:KnightPoint){
 const available=Array.from({length:8},(_,i)=>i).filter(i=>!crystalBroken(s,i));let best:KnightCross|undefined,score=Infinity;
 for(let a=0;a<available.length-3;a++)for(let b=a+1;b<available.length-2;b++)for(let c=b+1;c<available.length-1;c++)for(let d=c+1;d<available.length;d++){
  const pairs:KnightCross['pairs']=[[available[a],available[c]],[available[b],available[d]]],distances=pairs.map(([a,b])=>segmentDistance(crystalPoint(a),crystalPoint(b),p));
  for(const orientation of [0,1] as const){const candidate={pairs,side:orientation},triangles=crossTrianglesFor(candidate),zone=Math.min(...triangles.map(t=>triangleDistance(t,p)));if(zone>=.001)continue;const escape=closestCrossEscape(triangles[0],p);if(!escape)continue;
   const value=Math.max(...distances)+.35*(distances[0]+distances[1])+Math.hypot(escape[0]-p[0],escape[2]-p[2])*.75;if(value<score-.001){best=candidate;score=value;}
  }
 }
 if(best)s.starCross=best;
}
/** Allow at least three seconds, or the 6.8 m/s escape time plus 20% when longer. */
export function crossWarningDuration(s:KnightBattle,p:KnightPoint){
 const escape=crossEscapePoint(s,p),distance=escape?Math.hypot(escape[0]-p[0],escape[2]-p[2]):META_KNIGHT_ARENA.radius*2;
 return Math.max(STAR_ASSAULT.crossWarningMinMs,Math.ceil(distance/6.8*1000*1.2));
}
export const ricochetIndex=(s:KnightBattle)=>Math.max(0,Math.min(starFlightCount(s)-1,Math.floor((s.step-STAR_FLIGHT_STEP)/2)));
/** Pick the closest chord to the player's locked position; prefer a long chord on ties. */
export function nearestCrystalChord(s:KnightBattle,p:KnightPoint,begin?:number):[number,number]{
 const available=Array.from({length:8},(_,i)=>i).filter(i=>!crystalBroken(s,i));let best:[number,number]=[available[0],available[1]],distance=Infinity,length=0;
 for(const a of begin===undefined?available:[begin])for(const b of available){if(a===b)continue;const from=crystalPoint(a,STAR_ASSAULT.ricochetRadius),to=crystalPoint(b,STAR_ASSAULT.ricochetRadius),d=segmentDistance(from,to,p),l=Math.hypot(to[0]-from[0],to[2]-from[2]);if(d<distance-.001||Math.abs(d-distance)<.001&&l>length){best=[a,b];distance=d;length=l;}}
 return best;
}
export function planStarRoute(s:KnightBattle,p:KnightPoint){
 const pair=nearestCrystalChord(s,p),a=crystalPoint(pair[0],STAR_ASSAULT.ricochetRadius),b=crystalPoint(pair[1],STAR_ASSAULT.ricochetRadius);
 if(Math.hypot(s.from[0]-a[0],s.from[2]-a[2])>Math.hypot(s.from[0]-b[0],s.from[2]-b[2]))pair.reverse();
 s.starRoute=pair;s.starAims=Array.from({length:STAR_FLIGHTS},()=>[p[0],0,p[2]]);for(let i=1;i<STAR_FLIGHTS;i++)s.starRoute.push(nextFlightCrystal(s,p,s.starRoute));
}
/** Visit different distant intact crystals; the curve itself guarantees the aim. */
function nextFlightCrystal(s:KnightBattle,p:KnightPoint,route:number[]){
 const begin=crystalPoint(route.at(-1)!,STAR_ASSAULT.ricochetRadius),available=Array.from({length:8},(_,i)=>i).filter(i=>!crystalBroken(s,i)&&!route.includes(i));
 const length=(i:number)=>{const end=crystalPoint(i,STAR_ASSAULT.ricochetRadius);return Math.hypot(end[0]-begin[0],end[2]-begin[2]);},longest=Math.max(...available.map(length));
 return available.filter(i=>length(i)>=longest*.8).sort((a,b)=>segmentDistance(begin,crystalPoint(a,STAR_ASSAULT.ricochetRadius),p)-segmentDistance(begin,crystalPoint(b,STAR_ASSAULT.ricochetRadius),p)||a-b)[0];
}
/** Re-aim only at the start of each warning. Never move a displayed attack lane. */
export function lockStarFlight(s:KnightBattle,p:KnightPoint){
 if(!s.starRoute)planStarRoute(s,p);const i=ricochetIndex(s),route=s.starRoute!.slice(0,i+1);s.starAims??=[];for(let j=i;j<STAR_FLIGHTS;j++){route.push(nextFlightCrystal(s,p,route));s.starAims[j]=[p[0],0,p[2]];}s.starRoute=route;
}
export function ricochetCrystal(s:KnightBattle,index:number){
 if(s.starRoute)return s.starRoute[index+1];
 const available=Array.from({length:8},(_,i)=>i).filter(i=>!crystalBroken(s,i)),visited=[available[(s.cycle-1+80)%available.length]??0];
 for(let j=1;j<=index;j++){const previous=visited[j-1],candidates=available.filter(i=>!visited.includes(i));candidates.sort((a,b)=>Math.cos((a-previous)*Math.PI/4)-Math.cos((b-previous)*Math.PI/4));visited.push(candidates[0]??previous);}
 return visited[index];
}
export function ricochetCurve(s:KnightBattle,index:number,t:number):KnightPoint{
 const end=crystalPoint(ricochetCrystal(s,index),STAR_ASSAULT.ricochetRadius,STAR_ASSAULT.hover);
 const begin=crystalPoint(s.starRoute?.[index]??(index?ricochetCrystal(s,index-1):ricochetCrystal(s,1)),STAR_ASSAULT.ricochetRadius,STAR_ASSAULT.hover);
 const aim=s.starAims?.[index],bend=4*t*(1-t);
 return [begin[0]+(end[0]-begin[0])*t+(aim?aim[0]-(begin[0]+end[0])/2:0)*bend,STAR_ASSAULT.hover+Math.sin(t*Math.PI)*.25,begin[2]+(end[2]-begin[2])*t+(aim?aim[2]-(begin[2]+end[2])/2:0)*bend];
}
export function starImpactProgress(s:KnightBattle,now:number){
 const warning=STAR_SEQUENCE[STAR_LANDING_STEP][1],fall=STAR_SEQUENCE[STAR_FALL_STEP][1];
 if(s.stage==='star-warn')return starProgress(s,now)*warning/(warning+fall);
 if(s.stage==='star-fall')return (warning+starProgress(s,now)*fall)/(warning+fall);
 return starOpening(s)?1:0;
}
export function ricochetCountdown(s:KnightBattle,now:number,index:number){
 return index===ricochetIndex(s)?s.stage==='ricochet'?1:starProgress(s,now):0;
}
export function starPosition(s:KnightBattle,now:number):KnightPoint|undefined{
 const f=starProgress(s,now),t=smooth(f);
 if(s.stage==='star-rise')return [s.from[0]+(s.to[0]-s.from[0])*t,s.from[1]+(STAR_ASSAULT.hover-s.from[1])*t,s.from[2]+(s.to[2]-s.from[2])*t];
 if(s.stage==='ricochet')return ricochetCurve(s,ricochetIndex(s),f);
 if(s.stage==='star-warn'){
  const a=s.yaw+f*Math.PI*2,r=Math.sin(Math.PI*f)*3;
  return [s.from[0]*(1-t)+Math.sin(a)*r,s.from[1]+(STAR_ASSAULT.peak-s.from[1])*t,s.from[2]*(1-t)+Math.cos(a)*r];
 }
 if(s.stage==='star-fall'){
  const a=s.yaw+Math.PI*4*t,r=Math.sin(Math.PI*f)*(1-f)*4;
  return [Math.sin(a)*r,STAR_ASSAULT.peak*(1-t),Math.cos(a)*r];
 }
 if(s.stage==='shield'||s.stage==='crystal-break')return [0,0,0];
}
export function starFacing(s:KnightBattle,now:number){
 const f=starProgress(s,now);
 const turn=(a:number,b:number,t:number)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*smooth(t);
 if(s.stage==='cross-warn'||s.stage==='cross'){const centre=crossTriangles(s)[0][0],end=Math.atan2(centre[0]-s.from[0],centre[2]-s.from[2]),begin=s.step===1?s.yaw:end-Math.PI/2;return s.stage==='cross'?end:turn(begin,end,f/.35);}
 if(s.stage==='ricochet'||s.stage==='ricochet-warn'){
  const i=ricochetIndex(s),t=s.stage==='ricochet'?f:0,a=ricochetCurve(s,i,Math.max(0,t-.005)),b=ricochetCurve(s,i,Math.min(1,t+.005));
  const centre=crossTriangles(s)[0][0],end=Math.atan2(b[0]-a[0],b[2]-a[2]),lastA=i?ricochetCurve(s,i-1,.995):undefined,lastB=i?ricochetCurve(s,i-1,1):undefined,begin=lastA&&lastB?Math.atan2(lastB[0]-lastA[0],lastB[2]-lastA[2]):Math.atan2(centre[0]-s.from[0],centre[2]-s.from[2]);
  return s.stage==='ricochet'?end:turn(begin,end,f/.35);
 }
 if(s.stage==='star-warn')return s.yaw+Math.PI*2*smooth(f);
 if(s.stage==='star-fall')return s.yaw+Math.PI*4*smooth(f);
 return s.yaw;
}
function segmentDistance(a:KnightPoint,b:KnightPoint,p:KnightPoint){const x=b[0]-a[0],z=b[2]-a[2],n=x*x+z*z,t=n?clamp(((p[0]-a[0])*x+(p[2]-a[2])*z)/n):0;return Math.hypot(p[0]-a[0]-x*t,p[2]-a[2]-z*t);}
export function starDanger(s:KnightBattle,p:KnightPoint,now:number,previous:number,bodyRadius:number){
 if(s.stage==='cross')return Math.hypot(p[0],p[2])<=META_KNIGHT_ARENA.radius+bodyRadius&&(crossLines(s).some(line=>segmentDistance(...line,p)<STAR_ASSAULT.beamHalfWidth+bodyRadius)||crossTriangles(s).some(t=>triangleDistance(t,p)<=bodyRadius));
 if(s.stage==='ricochet'){
  const index=ricochetIndex(s),before=starProgress(s,Math.max(s.since,previous)),end=starProgress(s,now);
  let a=ricochetCurve(s,index,before);for(let i=1;i<=8;i++){const b=ricochetCurve(s,index,before+(end-before)*i/8);if(segmentDistance(a,b,p)<STAR_ASSAULT.routeHalfWidth+bodyRadius)return true;a=b;}
 }
 if(s.stage==='shield'&&previous<=s.since&&now-s.since<150){
  if(Math.hypot(p[0],p[2])<STAR_ASSAULT.impactRadius+bodyRadius)return true;
 }
 return shieldDanger(s,p,now,previous,bodyRadius);
}
