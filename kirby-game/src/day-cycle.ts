export const DAY_CYCLE_MS=600_000;
export function cyclePhase(start:number,epoch:number,now:number){return ((start+(now-epoch)/DAY_CYCLE_MS)%1+1)%1;}
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function daylight(phase:number){
 const angle=phase*Math.PI*2,elevation=Math.sin(angle),day=smooth(-.2,.35,elevation),twilight=Math.max(0,1-Math.abs(elevation)/.4)**2;
 return {phase,angle,elevation,day,night:1-day,twilight,label:elevation>.35?'День':elevation<-.2?'Ночь':Math.cos(angle)>0?'Рассвет':'Закат'};
}
export type Daylight=ReturnType<typeof daylight>;
