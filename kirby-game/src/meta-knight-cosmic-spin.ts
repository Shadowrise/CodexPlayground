import {COSMIC,COSMIC_DESCENT,easeCosmic} from './meta-knight-cosmic';

/** World-space metres, seconds for ballistics; encounter timestamps remain ms. */
export const COSMIC_SPIN={warnMs:2800,spinMs:12000,openMs:12000,hitMs:1000,recoverMs:800,descentMs:COSMIC_DESCENT.durationMs,
 startTurns:.20,endTurns:.85,stepAngle:15.4*Math.PI/180,speed:13.5,orbRadius:.72,orbHeight:1.5,
 hiltZ:1.10,emitRadius:(1.10+Math.hypot(.315,2.05))*3.3,outerRadius:48,capacity:160} as const;
export type CosmicSpin={at:number;yaw:number};
type State={phase:number;stage:string;since:number;until:number;cosmicSpin?:CosmicSpin;cosmicPart?:1|2|3};
type Point=[number,number,number];
export type CosmicOrb={id:number;at:number;angle:number;p:Point;from:Point;distance:number};
export const cosmicSpinDuration=COSMIC_SPIN.spinMs/1000;
/** Integrating a steadily increasing angular speed avoids FPS-dependent rotation. */
export function cosmicSpinAngle(seconds:number){
 const t=Math.max(0,Math.min(cosmicSpinDuration,seconds));
 return 2*Math.PI*(COSMIC_SPIN.startTurns*t+(COSMIC_SPIN.endTurns-COSMIC_SPIN.startTurns)*t*t/(2*cosmicSpinDuration));
}
export function cosmicSpinSpeed(seconds:number){return 2*Math.PI*(COSMIC_SPIN.startTurns+(COSMIC_SPIN.endTurns-COSMIC_SPIN.startTurns)*Math.max(0,Math.min(1,seconds/cosmicSpinDuration)));}
export function cosmicOrbBirth(index:number){
 const turns=index*COSMIC_SPIN.stepAngle/(2*Math.PI),b=(COSMIC_SPIN.endTurns-COSMIC_SPIN.startTurns)/(2*cosmicSpinDuration);
 return 2*turns/(COSMIC_SPIN.startTurns+Math.sqrt(COSMIC_SPIN.startTurns**2+4*b*turns));
}
export const cosmicOrbCount=Math.floor(cosmicSpinAngle(cosmicSpinDuration)/COSMIC_SPIN.stepAngle)+1;
export const cosmicOrbLife=(COSMIC_SPIN.outerRadius-COSMIC_SPIN.emitRadius)/COSMIC_SPIN.speed;
/** The visible crouch and the solid torso use the same exhaustion envelope. */
export function cosmicSpinFatigue(s:State,now:number){
 if(s.phase!==4||s.stage==='cosmic-spin'||s.stage==='cosmic-spin-warn'||s.stage.startsWith('cosmic-meteor-')||s.stage.startsWith('cosmic-star-')||s.stage.startsWith('cosmic-planet-'))return 0;
 if(s.cosmicPart===2&&s.stage==='cosmic-hit')return easeCosmic((now-s.since)/200);
 return s.stage==='cosmic-recover'?1-easeCosmic((now-s.since)/(s.until-s.since)):easeCosmic((now-(s.cosmicSpin?.at??s.since)-COSMIC_SPIN.spinMs)/650);
}
/** A snapshot reproduces every outgoing ball, including the last ones during rest. */
export function cosmicOrbs(s:State|undefined,now:number,previous=now):CosmicOrb[]{
 if(s?.phase!==4||!s.cosmicSpin||!['cosmic-spin','cosmic-open'].includes(s.stage))return [];
 const spin=s.cosmicSpin,time=(now-spin.at)/1000,before=(previous-spin.at)/1000;
 if(time<0||before>cosmicSpinDuration+cosmicOrbLife)return [];
 const first=Math.max(0,Math.ceil(cosmicSpinAngle(Math.max(0,before-cosmicOrbLife))/COSMIC_SPIN.stepAngle)-1),last=Math.min(cosmicOrbCount-1,Math.floor(cosmicSpinAngle(Math.min(time,cosmicSpinDuration))/COSMIC_SPIN.stepAngle+1e-9));
 const shots:CosmicOrb[]=[];
 for(let id=first;id<=last;id++){
  const birth=cosmicOrbBirth(id);if(birth>time+1e-9||before-birth>cosmicOrbLife)continue;
  const angle=spin.yaw+id*COSMIC_SPIN.stepAngle,d=COSMIC_SPIN.emitRadius+Math.max(0,time-birth)*COSMIC_SPIN.speed;
  const old=COSMIC_SPIN.emitRadius+Math.max(0,before-birth)*COSMIC_SPIN.speed,x=Math.sin(angle),z=Math.cos(angle),y=COSMIC.height+COSMIC_SPIN.orbHeight;
  shots.push({id,at:spin.at+birth*1000,angle,p:[x*d,y,z*d],from:[x*old,y,z*old],distance:d});
 }return shots;
}
export function cosmicSpinDanger(s:State,p:readonly number[],now:number,previous=now,bodyRadius=.65){
 if(s.phase!==4||!s.cosmicSpin||Math.abs(p[1]-COSMIC.height)>2.4)return false;
 const radius=COSMIC_SPIN.orbRadius+bodyRadius;
 for(const shot of cosmicOrbs(s,now,previous)){
  const dx=shot.p[0]-shot.from[0],dz=shot.p[2]-shot.from[2],n=dx*dx+dz*dz;
  const t=n?Math.max(0,Math.min(1,((p[0]-shot.from[0])*dx+(p[2]-shot.from[2])*dz)/n)):0;
  if(Math.hypot(p[0]-shot.from[0]-dx*t,p[2]-shot.from[2]-dz*t)<radius)return true;
 }
 // The visibly electrified blade sweeps the inner blind spot of the emitters.
 if(s.stage==='cosmic-spin'){
  const r=Math.hypot(p[0],p[2]),inner=2.9-bodyRadius,outer=COSMIC_SPIN.emitRadius+bodyRadius;
  if(r<inner||r>outer)return false;
  const angle=Math.atan2(p[0],p[2]),a=s.cosmicSpin.yaw+cosmicSpinAngle((Math.max(s.since,previous)-s.cosmicSpin.at)/1000),b=s.cosmicSpin.yaw+cosmicSpinAngle((now-s.cosmicSpin.at)/1000),half=Math.asin(Math.min(1,(.22+bodyRadius)/r));
  const wrapped=angle+Math.ceil((a-half-angle)/(2*Math.PI))*2*Math.PI;
  return wrapped<=b+half;
 }return false;
}
