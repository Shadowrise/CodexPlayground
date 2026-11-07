import type {KnightBattle,KnightPoint} from './meta-knight-battle';
import {cosmicVictoryDescent,easeCosmic} from './meta-knight-cosmic';
export const PIDGEY_FEAST={breadScale:3,halfWidth:2.325,peckReach:1.4005,joySeconds:2.4,peckSeconds:3.2};
/** A shared victory clock: return, opposite approaches, then the familiar Joy/Peck loop. */
export function pidgeyFeast(s:KnightBattle|undefined,id:string,now:number){
 const c=s?.celebration;if(s?.boss!=='metapidgie'||s.stage!=='lost'||!c||id!=='boss'&&!c.pidgeyHelpers?.includes(id)||id!=='boss'&&s.players[id]?.withdrawn)return;
 const little=id!=='boss',scale=little?c.helperScales?.[id]??1:3.3,helpers=c.pidgeyHelpers??Object.keys(c.helpers),index=Math.max(0,helpers.indexOf(id)),direction=(c.facing??0)+Math.PI;
 const angle=direction+(little?0:Math.PI)+(little?(index-(helpers.length-1)/2)*.40:0),radius=PIDGEY_FEAST.halfWidth+PIDGEY_FEAST.peckReach*scale,origin=little?c.helpers[id]:c.boss;
 if(!origin)return;const target:KnightPoint=[Math.sin(angle)*radius,0,Math.cos(angle)*radius],from:KnightPoint=[origin[0],0,origin[2]],distance=Math.hypot(target[0]-from[0],target[2]-from[2]),duration=Math.max(2.2,...['boss',...helpers.filter(who=>!s.players[who]?.withdrawn)].map(who=>{const little=who!=='boss',at=little?c.helpers[who]:c.boss;if(!at)return 0;const i=Math.max(0,helpers.indexOf(who)),a=direction+(little?0:Math.PI)+(little?(i-(helpers.length-1)/2)*.40:0),r=PIDGEY_FEAST.halfWidth+PIDGEY_FEAST.peckReach*(little?c.helperScales?.[who]??1:3.3);return Math.hypot(Math.sin(a)*r-at[0],Math.cos(a)*r-at[2])/7.2;})),descent=cosmicVictoryDescent(s,now),centre:KnightPoint=[0,0,0];
 const base={hug:0,jump:0,sway:0,hopPhase:0,hopLift:0,little,centre};
 if(descent&&!descent.landed)return {...base,p:[origin[0],origin[1]*(1-easeCosmic(descent.progress)),origin[2]] as KnightPoint,yaw:c.facing??0,travelled:0,elapsed:0,phase:'descent' as const,birdClip:'Fly' as const,clipTime:descent.progress*.9};
 const elapsed=Math.max(0,(now-(c.landAt??c.at))/1000),u=Math.min(1,elapsed/duration),t=easeCosmic(u),p=from.map((v,i)=>v+(target[i]-v)*t) as KnightPoint;
 if(u<1)return {...base,p,yaw:Math.atan2(target[0]-from[0],target[2]-from[2]),travelled:distance*t,elapsed,phase:'run' as const,birdClip:'Run' as const,clipTime:(distance*t/Math.max(.25,scale*2.4)%1)*1.98};
 const cycle=(elapsed-duration)%(PIDGEY_FEAST.joySeconds+PIDGEY_FEAST.peckSeconds),joy=cycle<PIDGEY_FEAST.joySeconds;
 return {...base,p:target,yaw:angle+Math.PI,travelled:distance,elapsed,phase:joy?'greet' as const:'hug' as const,birdClip:joy?'Joy' as const:'Peck' as const,clipTime:joy?cycle:cycle-PIDGEY_FEAST.joySeconds};
}
