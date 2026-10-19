import type {KnightBattle,KnightPoint} from './meta-knight-battle';

export const SHIELD={radius:10.5,height:11.5,crystalRadius:44.6,interval:3000,waveSpeed:.011,waveHalfWidth:.8,waveHeight:3.8,gapHalfAngle:Math.PI/8,breakMs:1000} as const;
const QUARTER=Math.PI/2,WAVE_LIFETIME=(SHIELD.crystalRadius-SHIELD.radius)/SHIELD.waveSpeed;
export const SHIELD_WAVE_SLOTS=Math.ceil(WAVE_LIFETIME/SHIELD.interval);
export function crystalPoint(index:number,radius:number=SHIELD.crystalRadius,y=2.5):KnightPoint{const a=index*Math.PI/4;return [Math.sin(a)*radius,y,Math.cos(a)*radius];}
export const crystalBroken=(s:KnightBattle,index:number)=>!!((s.brokenCrystals??0)&(1<<index));
function hash(seed:number){let n=seed|0;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;}
/** A repeatable random choice survives snapshots and Worker wakeups. */
export function chooseShieldCrystal(s:KnightBattle){const available=Array.from({length:8},(_,i)=>i).filter(i=>!crystalBroken(s,i));return available[hash((s.id|0)^Math.imul(s.cycle+1,0x9e3779b9)^(s.brokenCrystals??0))%available.length];}
/** Alternate the eight crystal-to-crystal sectors: four arcs, four clear passages. */
export function shieldWaveAngle(s:KnightBattle,index:number){return ((hash((s.id|0)^Math.imul(s.cycle+1,7919))+index)%2)*Math.PI/4;}
export const shieldCountdown=(s:KnightBattle,now:number)=>Math.max(0,(now-s.since)%SHIELD.interval)/SHIELD.interval;
export const shieldNextWave=(s:KnightBattle,now:number)=>Math.max(0,Math.floor((now-s.since)/SHIELD.interval));
export function shieldWaveGap(angle:number,base:number,radius:number,bodyRadius=0){const centre=base+3*Math.PI/8,local=Math.atan2(Math.sin((angle-centre)*4),Math.cos((angle-centre)*4))/4;return Math.abs(local)<SHIELD.gapHalfAngle-Math.asin(Math.min(1,bodyRadius/Math.max(1,radius)));}
export function shieldWaves(s:KnightBattle,now:number,previous=now){
 if(s.stage!=='shield')return [];
 const last=Math.floor((now-s.since)/SHIELD.interval)-1,result:{index:number;radius:number;angle:number;born:number}[]=[];
 for(let index=Math.max(0,last-SHIELD_WAVE_SLOTS);index<=last;index++){const born=s.since+(index+1)*SHIELD.interval,radius=Math.max(SHIELD.radius,SHIELD.crystalRadius-(now-born)*SHIELD.waveSpeed);if(born+WAVE_LIFETIME>=previous)result.push({index,radius,angle:shieldWaveAngle(s,index),born});}
 return result;
}
export function shieldDanger(s:KnightBattle,p:KnightPoint,now:number,previous:number,bodyRadius:number){
 if(s.stage!=='shield')return false;
 const r=Math.hypot(p[0],p[2]),a=Math.atan2(p[0],p[2]);
 const checked=Math.max(previous,now-150);
 return shieldWaves(s,now,checked).some(w=>{const before=SHIELD.crystalRadius-Math.max(0,checked-w.born)*SHIELD.waveSpeed;return r>=w.radius-SHIELD.waveHalfWidth-bodyRadius&&r<=before+SHIELD.waveHalfWidth+bodyRadius&&!shieldWaveGap(a,w.angle,r,bodyRadius);});
}
/** Solid hemisphere, including swept movement so a fast step cannot tunnel through. */
export function constrainKnightShield(s:KnightBattle|undefined,p:KnightPoint,previous?:KnightPoint,bodyRadius=.65){
 if(s?.stage!=='shield'||p[1]>SHIELD.height+bodyRadius)return false;
 const y=Math.max(0,p[1]-bodyRadius),radius=SHIELD.radius*Math.sqrt(Math.max(0,1-(y/SHIELD.height)**2))+bodyRadius,d=Math.hypot(p[0],p[2]);
 if(d<radius){const a=d>.001?Math.atan2(p[0],p[2]):previous?Math.atan2(previous[0],previous[2]):s.yaw;p[0]=Math.sin(a)*radius;p[2]=Math.cos(a)*radius;return true;}
 if(previous&&Math.hypot(previous[0],previous[2])>=radius-.001){const x=p[0]-previous[0],z=p[2]-previous[2],a=x*x+z*z,b=2*(previous[0]*x+previous[2]*z),c=previous[0]**2+previous[2]**2-radius**2,disc=b*b-4*a*c;if(a>.00001&&disc>0){const t=(-b-Math.sqrt(disc))/(2*a);if(t>=0&&t<1){p[0]=previous[0]+x*Math.max(0,t-.0001);p[2]=previous[2]+z*Math.max(0,t-.0001);return true;}}}
 return false;
}
