export const DAY_CYCLE_MS=600_000;
export function cyclePhase(start:number,epoch:number,now:number){return ((start+(now-epoch)/DAY_CYCLE_MS)%1+1)%1;}
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function daylight(phase:number){
 const angle=phase*Math.PI*2,elevation=Math.sin(angle),day=smooth(-.2,.35,elevation),twilight=Math.max(0,1-Math.abs(elevation)/.4)**2;
 const x=Math.cos(angle)*.85,z=Math.cos(angle)*.4,length=Math.hypot(x,elevation,z);
 const sunDirection:[number,number,number]=[x/length,elevation/length,z/length];
 // Shadow rays point away from whichever celestial body is above the horizon.
 const sign=elevation>=0?-1:1;
 const shadowDirection:[number,number,number]=sunDirection.map(v=>v*sign) as [number,number,number];
 // Fade direct light at the horizon so the sun/moon handoff never flips a visible shadow.
 const shadowStrength=smooth(.02,.16,Math.abs(elevation));
 return {phase,angle,elevation,day,night:1-day,twilight,sunDirection,shadowDirection,shadowStrength,label:elevation>.35?'День':elevation<-.2?'Ночь':Math.cos(angle)>0?'Рассвет':'Закат'};
}
export type Daylight=ReturnType<typeof daylight>;
