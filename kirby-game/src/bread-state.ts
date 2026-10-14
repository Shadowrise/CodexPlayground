import {MOUNTAIN_STEPS,MOUNTAIN_SUMMIT,LEDGE_RETRACT_DISTANCE,LEDGE_RETRACT_SECONDS,LEDGE_EXTEND_SECONDS,mountainLocal,mountainWorld} from './mountain-ledges-layout';
import {mountainSurfaceHeight} from './mountain-surface';

type Point=[number,number,number];
export type BreadOffering={by:string;at:number;bird:Point;bread:Point};
export type BreadActor={id:string;p:readonly number[];yaw:number;size:number;available:boolean};
export type BreadState={owner:string;p:Point;scale:number;yaw:number;pickupAt:number;drop?:{from:Point;at:number;duration:number;speed?:number};offering?:BreadOffering};
export type BreadAction={kind:'pick'|'drop'|'feed'};
export type BreadBird={phase:string;p:readonly number[]};
export function canFeedPidgie(b:BreadState,a:BreadActor,bird?:BreadBird){
 if(!bird||!a.available||b.owner!==a.id||b.offering||!['wander','follow'].includes(bird.phase)||Math.abs(a.p[1]-bird.p[1])>1.3)return false;
 const dx=bird.p[0]-a.p[0],dz=bird.p[2]-a.p[2],distance=Math.hypot(dx,dz);
 return distance<=5.5+Math.min(2,a.size*.7)&&(distance<.1||(dx*Math.sin(a.yaw)+dz*Math.cos(a.yaw))/distance>=.8);
}
const spawn=mountainWorld(MOUNTAIN_SUMMIT.tangent,MOUNTAIN_SUMMIT.radial-.5);
export const BREAD_SPAWN:readonly number[]=[spawn.x,MOUNTAIN_SUMMIT.y,spawn.z];
const gravity=14,upwardSpeed=2.2;
export function newBread():BreadState{return {owner:'',p:[...BREAD_SPAWN] as Point,scale:1,yaw:Math.PI/4,pickupAt:0};}
export function breadCarryScale(size:number){return Math.max(.65,size*.65);}
export function breadPosition(b:BreadState,now:number):Point{
 if(!b.drop)return [...b.p];
 const t=Math.max(0,Math.min(b.drop.duration,(now-b.drop.at)/1000)),u=t/b.drop.duration;
 if(t>=b.drop.duration)return [...b.p];
 return [b.drop.from[0]+(b.p[0]-b.drop.from[0])*u,b.drop.from[1]+(b.drop.speed??upwardSpeed)*t-gravity*t*t/2,b.drop.from[2]+(b.p[2]-b.drop.from[2])*u];
}
export function canPickBread(b:BreadState,a:BreadActor,now:number){
 return !b.owner&&!b.offering&&a.available&&now>=b.pickupAt&&Math.abs(a.p[1]-b.p[1])<1.3&&Math.hypot(a.p[0]-b.p[0],a.p[2]-b.p[2])<1.4+Math.min(14,a.size*.7);
}
/** The same exposed mountain surfaces are used by solo and the authoritative room. */
export function breadFloor(x:number,z:number,ceiling:number,steps?:number[][]){
 let floor=Math.max(0,mountainSurfaceHeight(x,z));
 const local=mountainLocal(x,z);
 for(const [i,p] of [...MOUNTAIN_STEPS,MOUNTAIN_SUMMIT].entries()){
  if(p.y>ceiling+.01)continue;
  const state=steps?.[i];if(state?.[0]===2)continue;
  const ease=(t:number)=>t*t*(3-2*t);
  const slide=state?.[0]===1?LEDGE_RETRACT_DISTANCE*ease(state[1]/LEDGE_RETRACT_SECONDS):state?.[0]===3?LEDGE_RETRACT_DISTANCE*(1-ease(state[1]/LEDGE_EXTEND_SECONDS)):0;
  const back=p.radial+p.depth/2+slide,dx=local.tangent-p.tangent,dz=local.radial-back;
  if(dz<=0&&dx*dx+dz*dz<=(p.width/2)**2&&(!state||local.radial<=p.radial+p.depth/2))floor=Math.max(floor,p.y);
 }
 return floor;
}
export function advanceBread(b:BreadState,now:number,steps?:number[][]):BreadState{
 if(b.owner||b.drop&&now<b.drop.at+b.drop.duration*1000)return b;
 const from=breadPosition(b,now),floor=breadFloor(from[0],from[2],from[1],steps);
 if(floor>=from[1]-.03)return b;
 const duration=Math.sqrt(2*(from[1]-floor)/gravity);
 return {...b,p:[from[0],floor,from[2]],pickupAt:now+duration*1000+500,drop:{from,at:now,duration,speed:0}};
}
export function applyBread(b:BreadState,action:BreadAction,a:BreadActor,now:number,steps?:number[][],bird?:BreadBird):BreadState{
 if(action?.kind==='pick')return canPickBread(b,a,now)?{...b,owner:a.id,drop:undefined}:b;
 if(action?.kind==='feed'&&!canFeedPidgie(b,a,bird))return b;
 if(!['drop','feed'].includes(action?.kind)||b.owner!==a.id||b.offering)return b;
 const sx=Math.sin(a.yaw),sz=Math.cos(a.yaw),distance=2+1.4*a.size;
 let x=a.p[0],z=a.p[2],floor=a.p[1];
 // Shorten a toss toward a wall rather than put the loaf inside the mountain.
 for(let i=10;i>=0;i--){
  x=a.p[0]+sx*distance*i/10;z=a.p[2]+sz*distance*i/10;
  floor=breadFloor(x,z,a.p[1]+.1,steps);
  if(floor<=a.p[1]+.1)break;
 }
 if(action.kind==='feed'&&bird){x=(a.p[0]+bird.p[0])/2;z=(a.p[2]+bird.p[2])/2;floor=breadFloor(x,z,a.p[1]+.1,steps);}
 const from:Point=[a.p[0]+sx*.35,a.p[1]+Math.max(.6,a.size*1.1),a.p[2]+sz*.35];
 floor=Math.min(floor,from[1]);
 const duration=(upwardSpeed+Math.sqrt(upwardSpeed**2+2*gravity*(from[1]-floor)))/gravity;
 return {owner:'',p:[x,floor,z],scale:breadCarryScale(a.size),yaw:a.yaw,pickupAt:now+duration*1000+800,drop:{from,at:now,duration},...(action.kind==='feed'&&bird?{offering:{by:a.id,at:now,bird:[...bird.p] as Point,bread:[x,floor,z] as Point}}:{})};
}
export function validBreadOffering(value:unknown):value is BreadOffering{
 const f=value as BreadOffering,point=(p:unknown)=>Array.isArray(p)&&p.length===3&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=512);
 return !!f&&typeof f.by==='string'&&f.by.length>0&&f.by.length<=64&&!/[\u0000-\u001f\u007f]/.test(f.by)&&Number.isFinite(f.at)&&f.at>=0&&point(f.bird)&&point(f.bread);
}
export function validBread(value:unknown):value is BreadState{
 const b=value as BreadState,point=(p:unknown)=>Array.isArray(p)&&p.length===3&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<10000);
 if(b?.offering!==undefined&&(!validBreadOffering(b.offering)||b.owner!==''))return false;
 return !!b&&typeof b.owner==='string'&&b.owner.length<=80&&point(b.p)&&Number.isFinite(b.scale)&&b.scale>=.1&&b.scale<=20&&Number.isFinite(b.yaw)&&Number.isFinite(b.pickupAt)&&b.pickupAt>=0&&(!b.drop||point(b.drop.from)&&Number.isFinite(b.drop.at)&&b.drop.at>=0&&Number.isFinite(b.drop.duration)&&b.drop.duration>0&&b.drop.duration<60&&(b.drop.speed===undefined||Number.isFinite(b.drop.speed)&&Math.abs(b.drop.speed)<30));
}
