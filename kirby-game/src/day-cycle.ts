export const DAY_CYCLE_MS=600_000;
const eastLength=Math.hypot(.85,.4),eastX=.85/eastLength,eastZ=.4/eastLength;
export const CELESTIAL_MAX_HEIGHT=Math.sin(35*Math.PI/180);
const orbitHeight=CELESTIAL_MAX_HEIGHT,orbitReach=Math.cos(35*Math.PI/180);
export const CELESTIAL_ORBIT_NORMAL:[number,number,number]=[eastZ*orbitHeight,orbitReach,-eastX*orbitHeight];
export function cyclePhase(start:number,epoch:number,now:number){return ((start+(now-epoch)/DAY_CYCLE_MS)%1+1)%1;}
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function daylight(phase:number){
 const angle=phase*Math.PI*2,elevation=Math.sin(angle),day=smooth(-.2,.35,elevation),twilight=Math.max(0,1-Math.abs(elevation)/.4)**2;
 // A tilted great circle keeps the visible light above the mountains at noon,
 // rather than directly overhead. The moon follows the opposite half of it.
 const across=Math.cos(angle),along=Math.sin(angle);
 const sunDirection:[number,number,number]=[eastX*across-eastZ*orbitReach*along,orbitHeight*along,eastZ*across+eastX*orbitReach*along];
 // Shadow rays point away from whichever celestial body is above the horizon.
 const sign=elevation>=0?-1:1;
 const shadowDirection:[number,number,number]=sunDirection.map(v=>v*sign) as [number,number,number];
 // Fade direct light at the horizon so the sun/moon handoff never flips a visible shadow.
 const shadowStrength=smooth(.02,.16,Math.abs(elevation));
 return {phase,angle,elevation,day,night:1-day,twilight,sunDirection,shadowDirection,shadowStrength,label:elevation>.35?'День':elevation<-.2?'Ночь':Math.cos(angle)>0?'Рассвет':'Закат'};
}
export type Daylight=ReturnType<typeof daylight>;
