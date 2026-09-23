import {validAchievements} from './score';
/** Shared, dependency-free wire contract used by the Worker and browser. */
export const PROTOCOL=2;
export const BUILD='meadow-network-2';
export type ActorState={p:number[];q:number[];s:number;state:string;pose:number[][];fruits:number;achievements:string[];name:string;variant:number;star:number;ride?:{key:string;data:(number|string)[]}};
export type WorldState={npcs:ActorState[];npcLife:number[][];carts:number[][];balloons:(number|string)[][];bugs:number[][]};
export type Event={type:'fruit';index:number;npc?:number}|{type:'mill'}|{type:'star'}|{type:'lock';key:string}|{type:'release';key:string}|{type:'hit'}|{type:'visible';value:boolean};
export type RoomState={id:string;host:string;epoch:number;fruits:(string|null)[];starAt:number;mill:boolean;locks:Record<string,string>;world?:WorldState};
export type Welcome={type:'welcome';protocolVersion:number;playerId:string;room:RoomState;players:{id:string;actor?:ActorState}[]};
export type ServerMessage=Welcome|{type:'presence';count:number}|{type:'frame';id:string;actor?:ActorState;world?:WorldState}|{type:'room';room:RoomState}|{type:'left';id:string}|{type:'hit';id:string;actor:ActorState}|{type:'lock';key:string;ok:boolean}|{type:'star'}|{type:'error';message:string};
export function validResourceKey(key:unknown):key is string {if(typeof key!=='string')return false;const match=/^(cart|balloon|bug|bench|home|tree|trampoline):(\d{1,2})$/.exec(key);return !!match&&Number(match[2])<({cart:12,balloon:3,bug:40,bench:32,home:1,tree:1,trampoline:1} as Record<string,number>)[match[1]];}
const numbers=(v:unknown,n:number)=>Array.isArray(v)&&v.length===n&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<100000);
export function validActor(v:unknown):v is ActorState{
 const a=v as ActorState;
 const ride=a?.ride,kind=typeof ride?.key==='string'?ride.key.split(':')[0]:'';
 const length=kind==='cart'?4:kind==='balloon'?16:kind==='bug'?10:kind==='tree'?1:0;
 const rideOk=!ride||(validResourceKey(ride.key)&&length>0&&Array.isArray(ride.data)&&ride.data.length===length&&ride.data.every((x,i)=>kind==='balloon'&&i===1?['parked','boarding','flying','exiting'].includes(x as string):typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1e7));
 return rideOk&&!!a&&numbers(a.p,3)&&numbers(a.q,4)&&typeof a.s==='number'&&a.s>=.1&&a.s<=20&&typeof a.state==='string'&&a.state.length<32&&typeof a.name==='string'&&a.name.length<=24&&Number.isInteger(a.variant)&&a.variant>=0&&a.variant<15&&Number.isInteger(a.fruits)&&a.fruits>=0&&a.fruits<=70&&validAchievements(a.achievements)&&Array.isArray(a.pose)&&a.pose.length<=5&&a.pose.every(x=>numbers(x,10))&&Number.isFinite(a.star)&&a.star>=0&&a.star<=30;
}
export function validWorld(v:unknown):v is WorldState{
 const w=v as WorldState;
 const rows=(a:unknown,count:number,length:number)=>Array.isArray(a)&&a.length===count&&a.every(r=>Array.isArray(r)&&r.length===length&&r.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1e10));
 const balloons=Array.isArray(w?.balloons)&&w.balloons.length===3&&w.balloons.every(r=>Array.isArray(r)&&r.length===16&&['parked','boarding','flying','exiting'].includes(r[1] as string)&&r.every((x,i)=>i===1||typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1e7));
 return !!w&&Array.isArray(w.npcs)&&w.npcs.length===14&&w.npcs.every(validActor)&&rows(w.npcLife,14,15)&&rows(w.carts,12,4)&&balloons&&rows(w.bugs,40,10)&&JSON.stringify(w).length<12500;
}
