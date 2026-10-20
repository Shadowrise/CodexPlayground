import {MOUNTAIN_STEPS,MOUNTAIN_SUMMIT,MOUNTAIN_SEAL_NICHE,LEDGE_RETRACT_DISTANCE,LEDGE_RETRACT_SECONDS,LEDGE_EXTEND_SECONDS,mountainLocal,mountainWorld,mountainLedgePose,mountainLedgeOutline,mountainOutlineContains} from './mountain-ledges-layout';
import {mountainSurfaceHeight} from './mountain-surface';
import {MILL_BAKERY_OVEN} from './mill-bakery-site';
import {isWildPigeonId,type WildPigeonId} from './wild-pigeons';

type Point=[number,number,number];
export type BreadOffering={by:string;at:number;bird:Point;bread:Point;target?:WildPigeonId};
export type BreadActor={id:string;p:readonly number[];yaw:number;size:number;available:boolean};
export type BreadLoaf={active?:boolean;owner:string;p:Point;scale:number;yaw:number;pickupAt:number;drop?:{from:Point;at:number;duration:number;speed?:number};offering?:BreadOffering};
export type BreadState=BreadLoaf&{others?:BreadLoaf[]};
export const breadLoaves=(b:BreadState|undefined):BreadLoaf[]=>{if(!b)return [];const {others,...first}=b;return [first,...(others??[])].filter(v=>v.active!==false);};
export const holdsBread=(b:BreadState|undefined,id:string)=>breadLoaves(b).some(v=>v.owner===id);
export const breadOffering=(b:BreadState|undefined,target:WildPigeonId='pidgie')=>breadLoaves(b).find(v=>v.offering&&(v.offering.target??'pidgie')===target)?.offering;
export function grantBread(b:BreadState,a:BreadActor,now:number):BreadState{
 if(holdsBread(b,a.id))return b;
 const loaf:BreadLoaf={active:true,owner:a.id,p:[...a.p] as Point,scale:breadCarryScale(a.size),yaw:a.yaw,pickupAt:now};
 const others=breadLoaves(b);return {...loaf,...(others.length?{others}:{})};
}
export type BreadAction={kind:'pick'|'drop'}|{kind:'feed';bird?:WildPigeonId};
export type BreadBird={phase:string;p:readonly number[];friend?:BreadOffering};
type BreadBirds=BreadBird|readonly BreadBird[];
const birdList=(birds?:BreadBirds):readonly BreadBird[]=>!birds?[]:'phase' in birds?[birds]:birds;
export const BREAD_PICKUP_DELAY_MS=2000;
export function canFeedPidgie(b:BreadState,a:BreadActor,bird?:BreadBird){
 b=breadLoaves(b).find(v=>v.owner===a.id)??b;
 if(b.active===false||!bird||!a.available||b.owner!==a.id||b.offering||!['wander','follow','greet'].includes(bird.phase)||Math.abs(a.p[1]-bird.p[1])>1.3)return false;
 const dx=bird.p[0]-a.p[0],dz=bird.p[2]-a.p[2],distance=Math.hypot(dx,dz);
 return distance<=8.5+Math.min(2,a.size*.7)&&(distance<.1||(dx*Math.sin(a.yaw)+dz*Math.cos(a.yaw))/distance>=.8);
}
export const BREAD_SPAWN:readonly number[]=[MILL_BAKERY_OVEN.x,0,MILL_BAKERY_OVEN.z+3];
const gravity=14,upwardSpeed=2.2;
export function newBread():BreadState{return {active:false,owner:'',p:[...BREAD_SPAWN] as Point,scale:1,yaw:Math.PI/4,pickupAt:0};}
/** Old untouched mountain pickups become unbaked; earned/carried/dropped bread stays. */
export function normalizeBread(b:BreadState|undefined):BreadState{
 if(!b)return newBread();
 const old=mountainWorld(MOUNTAIN_SUMMIT.tangent,MOUNTAIN_SUMMIT.radial-.5);
 if(b.active===undefined&&!b.owner&&!b.offering&&!b.drop&&Math.hypot(b.p[0]-old.x,b.p[2]-old.z)<1&&Math.abs(b.p[1]-MOUNTAIN_SUMMIT.y)<.1)return newBread();
 return b;
}
export function breadCarryScale(size:number){return Math.max(.65,size*.65);}
export function breadPosition(b:BreadState,now:number):Point{
 if(!b.drop)return [...b.p];
 const t=Math.max(0,Math.min(b.drop.duration,(now-b.drop.at)/1000)),u=t/b.drop.duration;
 if(t>=b.drop.duration)return [...b.p];
 return [b.drop.from[0]+(b.p[0]-b.drop.from[0])*u,b.drop.from[1]+(b.drop.speed??upwardSpeed)*t-gravity*t*t/2,b.drop.from[2]+(b.p[2]-b.drop.from[2])*u];
}
export function canPickBread(b:BreadState,a:BreadActor,now:number,bird?:BreadBirds){
 return !holdsBread(b,a.id)&&breadLoaves(b).some(v=>canPickLoaf(v,a,now,bird));
}
function canPickLoaf(b:BreadLoaf,a:BreadActor,now:number,bird?:BreadBirds){
 // Keep the bird's accepted target reserved even if the bread and NPC arrive
 // in different snapshots. Another loaf dropped here later remains independent.
 const reserved=!!b.offering||birdList(bird).some(({friend})=>!!friend&&b.drop?.at===friend.at&&Math.hypot(b.p[0]-friend.bread[0],b.p[1]-friend.bread[1],b.p[2]-friend.bread[2])<.05);
 const pickupAt=Math.max(b.pickupAt,b.drop?b.drop.at+b.drop.duration*1000+BREAD_PICKUP_DELAY_MS:0);
 return b.active!==false&&!b.owner&&!reserved&&a.available&&now>=pickupAt&&Math.abs(a.p[1]-b.p[1])<1.3&&Math.hypot(a.p[0]-b.p[0],a.p[2]-b.p[2])<1.4+Math.min(14,a.size*.7);
}
/** The same exposed mountain surfaces are used by solo and the authoritative room. */
export function breadFloor(x:number,z:number,ceiling:number,steps?:number[][]){
 let floor=Math.max(0,mountainSurfaceHeight(x,z));
 const local=mountainLocal(x,z);
 for(const [i,p] of [...MOUNTAIN_STEPS,MOUNTAIN_SUMMIT,MOUNTAIN_SEAL_NICHE].entries()){
  if(p.y>ceiling+.01)continue;
  const state=steps?.[i];if(state?.[0]===2)continue;
  const ease=(t:number)=>t*t*(3-2*t);
  const slide=state?.[0]===1?LEDGE_RETRACT_DISTANCE*ease(state[1]/LEDGE_RETRACT_SECONDS):state?.[0]===3?LEDGE_RETRACT_DISTANCE*(1-ease(state[1]/LEDGE_EXTEND_SECONDS)):0;
  const pose=mountainLedgePose(p,slide);if(pose.scale<=0)continue;
  if(p.seam){if(mountainOutlineContains(mountainLedgeOutline(p,slide),local.tangent,local.radial))floor=Math.max(floor,p.y);continue;}
  if(p.shape==='circle'){if(((local.tangent-p.tangent)/(p.width/2))**2+((local.radial-p.radial)/(p.depth/2))**2<=1)floor=Math.max(floor,p.y);continue;}
  const depth=p.depth*pose.scale,back=pose.radial+depth/2,dx=local.tangent-p.tangent,dz=local.radial-back;
  const onArc=dz<=0&&(dx/(p.width/2))**2+(dz/depth)**2<=1;
  const onSeam=p.embedDepth!==undefined&&dz>=0&&dz<=p.embedDepth*pose.scale&&Math.abs(dx)<=p.width/2;
  if((onArc||onSeam)&&(p.embedDepth!==undefined||!state||local.radial<=p.radial+p.depth/2))floor=Math.max(floor,p.y);
 }
 return floor;
}
export function advanceBread(b:BreadState,now:number,steps?:number[][]):BreadState{
 const loaves=breadLoaves(b),next=loaves.map(v=>advanceLoaf(v,now,steps));
 return next.some((v,i)=>v!==loaves[i])?{...next[0],...(next.length>1?{others:next.slice(1)}:{})}:b;
}
function advanceLoaf(b:BreadLoaf,now:number,steps?:number[][]):BreadLoaf{
 if(b.owner||b.drop&&now<b.drop.at+b.drop.duration*1000)return b;
 const from=breadPosition(b,now),floor=breadFloor(from[0],from[2],from[1],steps);
 if(floor>=from[1]-.03)return b;
 const duration=Math.sqrt(2*(from[1]-floor)/gravity);
 return {...b,p:[from[0],floor,from[2]],pickupAt:now+duration*1000+BREAD_PICKUP_DELAY_MS,drop:{from,at:now,duration,speed:0}};
}
export function applyBread(b:BreadState,action:BreadAction,a:BreadActor,now:number,steps?:number[][],bird?:BreadBirds):BreadState{
 if(action?.kind==='feed'&&action.bird!==undefined&&!isWildPigeonId(action.bird))return b;
 const loaves=breadLoaves(b);
 if(action?.kind==='pick'&&holdsBread(b,a.id))return b;
 const index=action?.kind==='pick'?loaves.findIndex(v=>canPickLoaf(v,a,now,bird)):loaves.findIndex(v=>v.owner===a.id);
 if(index<0)return b;
 const old=loaves[index],next=applyLoaf(old,action,a,now,steps,bird);if(old===next)return b;
 return {...next,...(loaves.length>1?{others:loaves.filter((_,i)=>i!==index)}:{})};
}
function applyLoaf(b:BreadLoaf,action:BreadAction,a:BreadActor,now:number,steps?:number[][],birds?:BreadBirds):BreadLoaf{
 const bird=birdList(birds)[0];
 if(action?.kind==='pick')return canPickLoaf(b,a,now,birds)?{...b,owner:a.id,drop:undefined}:b;
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
 return {owner:'',p:[x,floor,z],scale:breadCarryScale(a.size),yaw:a.yaw,pickupAt:now+duration*1000+BREAD_PICKUP_DELAY_MS,drop:{from,at:now,duration},...(action.kind==='feed'&&bird?{offering:{by:a.id,at:now,bird:[...bird.p] as Point,bread:[x,floor,z] as Point,...(action.bird?{target:action.bird}:{})}}:{})};
}
export function validBreadOffering(value:unknown):value is BreadOffering{
 const f=value as BreadOffering,point=(p:unknown)=>Array.isArray(p)&&p.length===3&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=512);
 return !!f&&(f.target===undefined||isWildPigeonId(f.target))&&typeof f.by==='string'&&f.by.length>0&&f.by.length<=64&&!/[\u0000-\u001f\u007f]/.test(f.by)&&Number.isFinite(f.at)&&f.at>=0&&point(f.bird)&&point(f.bread);
}
export function validBread(value:unknown):value is BreadState{
 const b=value as BreadState;
 if(!validLoaf(b)||b.others!==undefined&&(!Array.isArray(b.others)||b.others.length>256||!b.others.every(v=>validLoaf(v)&&!('others' in v))))return false;
 const owned=breadLoaves(b).filter(v=>v.owner).map(v=>v.owner);return owned.length===new Set(owned).size;
}
function validLoaf(value:unknown):value is BreadLoaf{
 const b=value as BreadState,point=(p:unknown)=>Array.isArray(p)&&p.length===3&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<10000);
 if(b?.active!==undefined&&typeof b.active!=='boolean'||b?.active===false&&(b.owner!==''||b.offering||b.drop))return false;
 if(b?.offering!==undefined&&(!validBreadOffering(b.offering)||b.owner!==''))return false;
 return !!b&&typeof b.owner==='string'&&b.owner.length<=80&&point(b.p)&&Number.isFinite(b.scale)&&b.scale>=.1&&b.scale<=20&&Number.isFinite(b.yaw)&&Number.isFinite(b.pickupAt)&&b.pickupAt>=0&&(!b.drop||point(b.drop.from)&&Number.isFinite(b.drop.at)&&b.drop.at>=0&&Number.isFinite(b.drop.duration)&&b.drop.duration>0&&b.drop.duration<60&&(b.drop.speed===undefined||Number.isFinite(b.drop.speed)&&Math.abs(b.drop.speed)<30));
}
