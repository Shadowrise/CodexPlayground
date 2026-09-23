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
   return {...state,p:from.p.map((v,j)=>v+(to.p[j]-v)*blend),s:from.s+(to.s-from.s)*blend,
    q:new Quaternion().fromArray(from.q).normalize().slerp(new Quaternion().fromArray(to.q).normalize(),blend).toArray()};
  });
 }
}
