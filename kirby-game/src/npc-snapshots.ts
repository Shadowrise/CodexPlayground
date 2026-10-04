import {Quaternion} from 'three';
import type {ActorState} from './network-protocol';
/** Render between received states instead of repeatedly chasing each 5 Hz packet. */
export class NpcSnapshots {
 private frames:{time:number;actors:ActorState[]}[]=[];
 constructor(private delay=250){}
 clear(){this.frames=[];}
 push(time:number,actors:ActorState[]){this.frames.push({time,actors});if(this.frames.length>12)this.frames.shift();}
 sample(now:number){
  if(!this.frames.length)return undefined;
  const time=now-this.delay;
  while(this.frames.length>2&&this.frames[1].time<=time)this.frames.shift();
  const a=this.frames[0],b=this.frames[1];
  if(!b||time<=a.time)return a.actors;
  const blend=Math.min(1,(time-a.time)/Math.max(1,b.time-a.time));
  return a.actors.map((from,i)=>{
   const to=b.actors[i]??from;
   // Teleports (respawning/boarding) should not sweep across the meadow.
   if(Math.hypot(...to.p.map((v,j)=>v-from.p[j]))>30)return blend<1?from:to;
   const state=blend<1?from:to;
   const pose=from.state===to.state&&from.pose.length===to.pose.length?from.pose.map((v,i)=>{
    const end=to.pose[i],q=new Quaternion().fromArray(v.slice(3,7)).normalize().slerp(new Quaternion().fromArray(end.slice(3,7)).normalize(),blend).toArray();
    return [...v.slice(0,3).map((n,j)=>n+(end[j]-n)*blend),...q,...v.slice(7).map((n,j)=>n+(end[j+7]-n)*blend)];
   }):state.pose;
   const roll=from.roll&&to.roll&&from.state==='Roll'&&to.state==='Roll'?from.roll.map((v,j)=>v+(to.roll![j]-v)*blend):state.roll;
   return {...state,roll,pose,fit:(from.fit??1)+((to.fit??1)-(from.fit??1))*blend,p:from.p.map((v,j)=>v+(to.p[j]-v)*blend),s:from.s+(to.s-from.s)*blend,
    q:new Quaternion().fromArray(from.q).normalize().slerp(new Quaternion().fromArray(to.q).normalize(),blend).toArray()};
  });
 }
}
