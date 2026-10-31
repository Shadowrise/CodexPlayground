import type {KnightBattle,KnightPoint} from './meta-knight-battle';
import {cosmicVictoryDescent,easeCosmic} from './meta-knight-cosmic';

const smooth=(n:number)=>{n=Math.max(0,Math.min(1,n));return n*n*(3-2*n);};
const mix=(a:KnightPoint,b:KnightPoint,t:number)=>a.map((v,i)=>v+(b[i]-v)*t) as KnightPoint;
/** One shared clock for every client: run together, a warm hug, then skipping in a circle. */
export function knightCelebration(s:KnightBattle|undefined,id:string,now:number){
 const c=s?.celebration;if(!s||s.stage!=='lost'||!c)return;
 const ids=Object.keys(c.helpers).filter(id=>!s.players[id]?.withdrawn).sort();if(!ids.length||id!=='boss'&&!ids.includes(id))return;
 const little=id!=='boss',index=little?ids.indexOf(id):0,first=c.helpers[ids[0]],y=c.landAt?0:c.boss[1];
 const centre:KnightPoint=[(c.boss[0]+first[0])/2,y,(c.boss[2]+first[2])/2],radius=Math.hypot(centre[0],centre[2]);if(radius>23){centre[0]*=23/radius;centre[2]*=23/radius;}
 const direction=Math.atan2(first[0]-c.boss[0],first[2]-c.boss[2]),offset=little?(index-(ids.length-1)/2)*.9:0;
 const destination:KnightPoint=[centre[0]+Math.sin(direction)*(little?1.9:-1.9)+Math.cos(direction)*offset,y,centre[2]+Math.cos(direction)*(little?1.9:-1.9)-Math.sin(direction)*offset];
 const origin=little?c.helpers[id]:c.boss,from:KnightPoint=[origin[0],c.landAt?0:origin[1],origin[2]],approach=Math.max(2.2,...[c.boss,...Object.values(c.helpers)].map(p=>Math.hypot(p[0]-centre[0],p[2]-centre[2])/7.2));
 const descent=cosmicVictoryDescent(s,now);if(descent&&!descent.landed)return {p:[origin[0],origin[1]*(1-easeCosmic(descent.progress)),origin[2]] as KnightPoint,yaw:0,hug:0,jump:0,sway:0,hopPhase:0,hopLift:0,travelled:0,phase:'descent' as const,little,elapsed:0,centre};
 const elapsed=Math.max(0,(now-(c.landAt??c.at))/1000),run=smooth(elapsed/approach);let p=mix(from,destination,run),hug=0,jump=0,sway=0,hopPhase=0,hopLift=0,phase:'run'|'greet'|'hug'|'circle'='run',yaw=Math.atan2(destination[0]-from[0],destination[2]-from[2]);
 if(elapsed>=approach){
  const t=elapsed-approach,cycle=t<4.5?t:(t-4.5)%11.2+4.5;
  yaw=direction+(little?Math.PI:0);phase='greet';
  if(cycle<4.5){
   hug=smooth(cycle/.65)*(1-smooth((cycle-3.6)/.9));phase=hug>.2?'hug':'greet';sway=Math.sin(cycle*3.4)*.045*hug;
   p[0]+=Math.cos(direction)*Math.sin(cycle*3.4)*.10*hug;p[2]-=Math.sin(direction)*Math.sin(cycle*3.4)*.10*hug;
   if(little)p[1]+=.62*hug+.12*Math.sin(cycle*3.4)**2*hug;
  }else if(cycle<11.7){
   const t=cycle-4.5,turn=t/7.2*Math.PI*2,angle=direction+(little?0:Math.PI)+turn,r=little?4.1:3.4,blend=smooth(t/.7)*(1-smooth((t-6.5)/.7));
   p=mix(destination,[centre[0]+Math.sin(angle)*r,y,centre[2]+Math.cos(angle)*r],blend);
   const beat=(t+(little?.07:0)+index*.10)%1,air=(beat-.20)/.55;hopPhase=beat;hopLift=(air>0&&air<1?Math.sin(Math.PI*air)**2:0)*blend;jump=hopLift*(little?.50:.32);p[1]+=jump;
   const base=direction+(little?Math.PI:0),target=angle+Math.PI/2;yaw=base+Math.atan2(Math.sin(target-base),Math.cos(target-base))*blend;phase='circle';sway=Math.sin(beat*Math.PI*2)*.10*blend;
  }else{
   const t=cycle-11.7;hug=smooth(t/.65)*(1-smooth((t-3.1)/.8));phase='hug';if(little)p[1]+=.62*hug;sway=Math.sin(t*3.4)*.045*hug;
  }
 }
 return {p,yaw,hug,jump,sway,hopPhase,hopLift,travelled:Math.hypot(destination[0]-from[0],destination[2]-from[2])*run,phase,little,elapsed,centre};
}
