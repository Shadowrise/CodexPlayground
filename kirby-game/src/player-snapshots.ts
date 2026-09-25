import {Quaternion} from 'three';
import type {ActorState} from './network-protocol';
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const vector=(a:number[],b:number[],t:number)=>a.map((v,i)=>mix(v,b[i],t));
const rotation=(a:number[],b:number[],t:number)=>new Quaternion().fromArray(a).normalize().slerp(new Quaternion().fromArray(b).normalize(),t).toArray();
/** A short presentation buffer smooths 10 Hz updates without extra network messages. */
export class PlayerSnapshots{
 private frames:{time:number;actor:ActorState}[]=[];
 constructor(private delay=150){}
 push(time:number,actor:ActorState){
  const last=this.frames.at(-1);
  if(last&&(time-last.time>1500||Math.hypot(...actor.p.map((v,i)=>v-last.actor.p[i]))>30))this.frames=[];
  if(this.frames.at(-1)?.time===time)this.frames.pop();
  this.frames.push({time,actor});if(this.frames.length>12)this.frames.shift();
 }
 sample(now:number):ActorState|undefined{
  const time=now-this.delay;
  while(this.frames.length>2&&this.frames[1].time<=time)this.frames.shift();
  const a=this.frames[0],b=this.frames[1];if(!a)return;
  if(!b||time<=a.time)return a.actor;if(time>=b.time)return b.actor;
  const t=(time-a.time)/(b.time-a.time),from=a.actor,to=b.actor;
  const pose=from.state===to.state&&from.pose.length===to.pose.length?from.pose.map((v,i)=>[...vector(v.slice(0,3),to.pose[i].slice(0,3),t),...rotation(v.slice(3,7),to.pose[i].slice(3,7),t),...vector(v.slice(7,10),to.pose[i].slice(7,10),t)]):from.pose;
  // Bug carrier and rider share the same presentation time, including changing seat height.
  let ride=from.ride;
  if(ride?.key.startsWith('bug:')&&ride.key===to.ride?.key){const data=[...ride.data];for(const i of [4,5,6,9])data[i]=mix(ride.data[i] as number,to.ride.data[i] as number,t);ride={key:ride.key,data};}
  return {...from,p:vector(from.p,to.p,t),q:rotation(from.q,to.q,t),s:mix(from.s,to.s,t),pose,ride};
 }
}
