import {PIGEON_CLIP_BY_NAME} from './pigeon-clips';
import type {PidgieState} from './pidgie-state';
import type {PigeonCheckpoint} from './pigeon-flock-state';
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));

/** Interpolate the host timeline; never chase or re-plan a guest's flock. */
export class PigeonSnapshots{
 private frames:{time:number;state:PidgieState}[]=[];
 push(c:PigeonCheckpoint,now:number){
  const time=c.at!==undefined&&Math.abs(c.at-now)<2000?c.at:now;
  if(time<(this.frames.at(-1)?.time??-Infinity))return;
  if(time===this.frames.at(-1)?.time)this.frames.pop();
  this.frames.push({time,state:c.bird});if(this.frames.length>10)this.frames.shift();
 }
 sample(now:number,delay:number):PidgieState|undefined{
  const time=now-delay;
  while(this.frames.length>2&&this.frames[1].time<=time)this.frames.shift();
  const a=this.frames[0],b=this.frames[1];if(!a)return;
  if(time<a.time)return;
  if(!b||time===a.time)return a.state;
  const t=Math.min(1,(time-a.time)/Math.max(1,b.time-a.time)),from=a.state,to=b.state;
  const state=t<1?from:to;
  let clipTime=state.clipTime;
  if(from.clip===to.clip){
   const clip=PIGEON_CLIP_BY_NAME[from.clip],duration=clip.duration;
   let delta=to.clipTime-from.clipTime;if(clip.loop&&delta<0)delta+=duration;
   clipTime=clip.loop?(from.clipTime+delta*t)%duration:mix(from.clipTime,to.clipTime,t);
  }
  return {...state,p:[mix(from.p[0],to.p[0],t),mix(from.p[1],to.p[1],t),mix(from.p[2],to.p[2],t)],yaw:from.yaw+wrap(to.yaw-from.yaw)*t,clipTime};
 }
}
