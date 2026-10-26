import {COSMIC,easeCosmic} from './meta-knight-cosmic';

const geometry={orbit:COSMIC.rim*.5,starSpeed:.08,domeRadius:5.2,planetOrbit:22.5,planetRadius:19} as const;
export const refugeContactAngle=Math.acos((geometry.orbit**2+geometry.planetOrbit**2-(geometry.domeRadius+geometry.planetRadius+.05)**2)/(2*geometry.orbit*geometry.planetOrbit));
const sweepAngle=2*Math.PI-2*refugeContactAngle;
// Increase actual world-space angular speed by 20%, including the moving star's drift.
const sweepMs=1000*sweepAngle/((geometry.starSpeed+sweepAngle/9)*1.2-geometry.starSpeed);
export const COSMIC_REFUGE={drawMs:1200,openMs:5000,pullMs:2400,sweepMs,breakMs:2200,strikeMs:650,stunMs:1000,retreatMs:1800,...geometry,starHeight:COSMIC.height+1.25} as const;
export type CosmicRefuge={at:number;angle:number;world:number;activatedAt?:number;activator?:string;counterBy?:string[];impactAt?:number;hitAt?:number;contacts:Record<string,number>;partyDamaged?:boolean};
type State={phase:number;stage:string;since:number;until:number;cosmicRefuge?:CosmicRefuge};
type Point=[number,number,number];
export const REFUGE_WORLDS=[0,2,3,4,5,6,7,8,9,10] as const;
export function cosmicRefugeStage(s:Pick<State,'phase'|'stage'>|undefined){return s?.phase===4&&['cosmic-star-draw','cosmic-star-open','cosmic-planet-draw','cosmic-planet-sweep','cosmic-planet-break','cosmic-star-strike','cosmic-star-stun','cosmic-star-retreat','cosmic-planet-release'].includes(s.stage);}
export function refugeAngle(s:State,now:number){const r=s.cosmicRefuge!;return r.angle+Math.max(0,now-r.at-COSMIC_REFUGE.drawMs)/1000*COSMIC_REFUGE.starSpeed;}
export function refugeStar(s:State,now:number):Point{const a=refugeAngle(s,now);return [Math.sin(a)*COSMIC_REFUGE.orbit,COSMIC_REFUGE.starHeight,Math.cos(a)*COSMIC_REFUGE.orbit];}
export function refugeActive(s:Pick<State,'cosmicRefuge'>|undefined){return s?.cosmicRefuge?.activatedAt!==undefined;}
export function refugeOpen(s:State|undefined){return s?.stage==='cosmic-star-open'&&!!s.cosmicRefuge&&!refugeActive(s);}
export function insideRefuge(s:State,p:readonly number[],now:number,padding=.65){if(!refugeActive(s)||!['cosmic-star-open','cosmic-planet-draw','cosmic-planet-sweep'].includes(s.stage))return false;const star=refugeStar(s,now);return Math.abs(p[1]-COSMIC.height)<2.4&&Math.hypot(p[0]-star[0],p[2]-star[2])<=COSMIC_REFUGE.domeRadius-padding;}
/** A sphere fills the radial band from the boss's silhouette to the outer rim. */
export function refugePlanetAngle(s:State,now:number){const f=s.stage==='cosmic-planet-sweep'?Math.max(0,Math.min(1,(now-s.since)/Math.max(1,s.until-s.since))):['cosmic-planet-break','cosmic-star-strike','cosmic-star-stun','cosmic-star-retreat','cosmic-planet-release'].includes(s.stage)?1:0;return refugeAngle(s,now)+refugeContactAngle+(2*Math.PI-2*refugeContactAngle)*f;}
export function refugePlanet(s:State,now:number):Point{const a=refugePlanetAngle(s,now);return [Math.sin(a)*COSMIC_REFUGE.planetOrbit,COSMIC_REFUGE.starHeight,Math.cos(a)*COSMIC_REFUGE.planetOrbit];}
export function refugeForehead(s:State):Point{const a=refugeAngle(s,s.cosmicRefuge?.impactAt??s.since);return [Math.sin(a)*2.38,COSMIC.height+5.24,Math.cos(a)*2.38];}
function bezier(a:readonly number[],b:readonly number[],c:readonly number[],d:readonly number[],t:number):Point{return [0,1,2].map(i=>(1-t)**3*a[i]+3*(1-t)**2*t*b[i]+3*(1-t)*t*t*c[i]+t**3*d[i]) as Point;}
/** The collision launches the star immediately; the last point is the mask's forehead. */
export function refugeStrike(s:State,now:number):Point{
 const at=s.cosmicRefuge?.impactAt??s.since,t=Math.max(0,Math.min(1,(now-at)/COSMIC_REFUGE.strikeMs)),star=refugeStar(s,at),hit=refugeForehead(s),a=refugeAngle(s,at);
 return bezier(star,[star[0]-Math.sin(a)*4+Math.cos(a)*2,star[1]+1.1,star[2]-Math.cos(a)*4-Math.sin(a)*2],[hit[0]+Math.sin(a)*4,hit[1]+.6,hit[2]+Math.cos(a)*4],hit,t);
}
/** A reflected initial velocity bends into a rising arc and settles back into the background. */
export function refugeRebound(s:State,now:number,destination:readonly number[]):Point{
 const hit=refugeForehead(s),a=refugeAngle(s,s.cosmicRefuge?.impactAt??s.since),t=Math.max(0,Math.min(1,(now-(s.cosmicRefuge?.hitAt??s.since))/(COSMIC_REFUGE.stunMs+COSMIC_REFUGE.retreatMs)));
 return bezier(hit,[hit[0]+Math.sin(a)*16-Math.cos(a)*3,hit[1]+12,hit[2]+Math.cos(a)*16+Math.sin(a)*3],destination,destination,t);
}
export function refugeDanger(s:State,p:readonly number[],now:number,previous=now){
 if(s.stage!=='cosmic-planet-sweep'||!s.cosmicRefuge||Math.abs(p[1]-COSMIC.height)>2.4||insideRefuge(s,p,now))return false;
 const start=Math.max(s.since,previous),end=Math.min(now,s.until),steps=Math.max(1,Math.ceil((end-start)/30));
 for(let i=0;i<=steps;i++){const planet=refugePlanet(s,start+(end-start)*i/steps);if(Math.hypot(p[0]-planet[0],p[1]+1.25-planet[1],p[2]-planet[2])<COSMIC_REFUGE.planetRadius+.65)return true;}return false;
}
