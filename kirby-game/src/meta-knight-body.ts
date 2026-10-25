import {KNIGHT,knightBattleActive,knightPosition,knightProgress,type KnightBattle,type KnightPoint} from './meta-knight-battle';
import {starFacing} from './meta-knight-star-assault';
import {META_KNIGHT_ARENA} from './meta-knight-arena-site';
import {cosmicCombat,cosmicDescent} from './meta-knight-cosmic';
import {cosmicSpinFatigue} from './meta-knight-cosmic-spin';

const smooth=(v:number)=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
/** The solid torso follows the rig; wings, sword and warnings stay non-solid. */
export function knightBody(s:KnightBattle,now:number){
 const fall=cosmicDescent(s,now);if(fall){const yaw=s.cosmicFall?.yaw??s.yaw;return {x:Math.sin(yaw)*fall.bodyZ*KNIGHT.modelScale,y:fall.height+fall.bodyY*KNIGHT.modelScale,z:Math.cos(yaw)*fall.bodyZ*KNIGHT.modelScale,radius:.91*KNIGHT.modelScale};}
 const p=knightPosition(s,now),f=knightProgress(s,now),seated=['open','stunned','crystal-break'].includes(s.stage),yaw=starFacing(s,now);
 const plunge=['jump','dive','star-fall'].includes(s.stage)?smooth((f-.4)/.54):s.stage==='slam'?1:s.stage==='wave'?1-smooth((now-s.since)/350):0;
 const seat=s.stage==='jump'||s.stage==='dive'?smooth((f-.82)/.18):0,back=-1.04*plunge*(1-seat)-(seated?.18:0);
 const crouch=s.stage==='jump-warn'||s.stage==='dive-warn'?smooth((f-.12)/.73):['jump','dive','star-fall','slam'].includes(s.stage)?1:plunge;
 const height=cosmicCombat(s)||s.stage==='cosmic-descent'?1.14-.16*cosmicSpinFatigue(s,now):seated?.92:s.stage==='get-up'?.92+.25*smooth(f):s.stage==='slash'||s.stage==='slash-warn'?.95:s.stage==='shot'||s.stage==='shot-warn'?1.14:1.17-.22*crouch-.03*seat;
 return {x:p[0]+Math.sin(yaw)*back*KNIGHT.modelScale,y:p[1]+height*KNIGHT.modelScale,z:p[2]+Math.cos(yaw)*back*KNIGHT.modelScale,radius:.91*KNIGHT.modelScale};
}
/** Shared by client movement and Worker validation; only positions are changed. */
export function constrainKnightBody(s:KnightBattle|undefined,p:KnightPoint,now:number,previous?:KnightPoint,size=1){
 if(!knightBattleActive(s))return false;
 const body=knightBody(s!,now),padding=KNIGHT.bodyRadius*size;
 const nearestY=Math.max(p[1]+padding,Math.min(p[1]+2.2*size-padding,body.y)),dy=nearestY-body.y,total=body.radius+padding;
 if(Math.abs(dy)>=total)return false;
 const radius=Math.sqrt(total*total-dy*dy),x=p[0]-body.x,z=p[2]-body.z,d=Math.hypot(x,z);
 if(previous){
  const ax=previous[0]-body.x,az=previous[2]-body.z,vx=p[0]-previous[0],vz=p[2]-previous[2],a=vx*vx+vz*vz,b=2*(ax*vx+az*vz),c=ax*ax+az*az-radius*radius,disc=b*b-4*a*c;
  if(c>=-.0001&&a>.00001&&disc>0&&(d>=radius||x*ax+z*az<0)){
   const hit=(-b-Math.sqrt(disc))/(2*a);if(hit>=0&&hit<1){const t=Math.max(0,hit-.0001);p[0]=previous[0]+vx*t;p[2]=previous[2]+vz*t;return true;}
  }
 }
 if(d>=radius-1e-6)return false;
 let angle=d>.0001?Math.atan2(x,z):previous?Math.atan2(previous[0]-body.x,previous[2]-body.z):s!.yaw+Math.PI;
 // Keep the separation on the arena side of the rim. Clamping an outward
 // push afterwards would otherwise put the player straight back in the torso.
 const limit=Math.max(12,META_KNIGHT_ARENA.walkRadius-size),centre=Math.hypot(body.x,body.z);
 if(Math.hypot(p[0],p[2])<=limit+.001&&centre>.001){
  const inward=Math.atan2(-body.x,-body.z),half=Math.acos(Math.max(-1,Math.min(1,(centre*centre+radius*radius-limit*limit)/(2*centre*radius)))),turn=Math.atan2(Math.sin(angle-inward),Math.cos(angle-inward));
  angle=inward+Math.max(-half,Math.min(half,turn));
 }
 p[0]=body.x+Math.sin(angle)*radius;p[2]=body.z+Math.cos(angle)*radius;return true;
}
