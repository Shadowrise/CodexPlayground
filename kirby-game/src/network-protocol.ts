import type {CentipedeEvent,Point} from './centipede-event';
import type {ChaseSnapshot} from './centipede-chasers';
import type {MillQuest,MillAction} from './mill-quest';
import type {BreadState,BreadAction} from './bread-state';
import type {FlowerGame} from './musical-flower-game';
import type {NumberGame} from './number-garden-game';
import type {KnightBattle} from './meta-knight-battle';
import type {SealId,SealProgress} from './meta-knight-seal-state';
import {MOUNTAIN_STEPS} from './mountain-ledges-layout';
import {KIRBY_VARIANTS} from './variant-palette';
import type {StarfallState} from './starfall';
import type {Prank} from './pranks';
import type {SummonedPigeon,PigeonCheckpoint} from './pigeon-flock-state';
import type {LogEntry} from './world-log';
import {validAchievements} from './score';
import {validPidgieState,type PidgieState} from './pidgie-state';
import {WILD_PIGEONS,type WildPigeonId} from './wild-pigeons';
import {validFruitBoost,type FruitBoostState} from './fruit-speed';
/** Shared, dependency-free wire contract used by the Worker and browser. */
export const PROTOCOL=2;
export const BUILD='meadow-network-34';
export type ActorState={location?:'meta-knight-arena';p:number[];q:number[];s:number;fit?:number;state:string;pose:number[][];dash?:[charge:number,progress:number];roll?:number[];fruits:number;fruitBoost?:FruitBoostState;eventPoints?:number;achievements:string[];name:string;variant:number;star:number;progress?:{size:number;speed?:number;checkpoint:number;mountainCheckpoint?:number;ground:number};ride?:{key:string;data:(number|string)[]}};
export type WorldState={npcs:ActorState[];npcLife:number[][];carts:number[][];balloons:(number|string)[][];bugs:number[][];mountainSteps?:number[][]}&Partial<Record<WildPigeonId,PidgieState>>;
export type Event={type:'knight';action:'start'|'attack'|'cancel'}|{type:'seal';id:SealId}|{type:'number-start'}|{type:'number-step'}|{type:'number-note';digit:number}|{type:'bread';action:BreadAction}|{type:'flower-replay'}|{type:'flower-start'}|{type:'flower-step'}|{type:'flower-note';index:number}|{type:'centipede-step'}|{type:'centipede-start';trail:Point[]}|{type:'festival-star';index:number}|{type:'chat';text:string}|{type:'emote';emote:string}|{type:'pidgie-scare'|'pidgie-interest';playerId:string;bird?:WildPigeonId}|{type:'fruit';index:number;npc?:number}|{type:'mill';action:MillAction}|{type:'star'}|{type:'lock';key:string}|{type:'release';key:string;bugState?:number[]}|{type:'hit'}|{type:'visible';value:boolean};
export type RoomState={pigeonFlock?:SummonedPigeon[];knightBattle?:KnightBattle;id:string;host:string;epoch:number;dayPhase?:number;fruits:(string|null)[];starAt:number;mill:boolean;millQuest?:MillQuest;bread?:BreadState;sealProgress?:SealProgress;metaKnightPortalOpen?:boolean;flowerGame?:FlowerGame;numberGame?:NumberGame;centipede?:CentipedeEvent;locks:Record<string,string>;bugLandings?:Record<string,number[]>;world?:WorldState;log?:LogEntry[];festival?:StarfallState;pranks?:Prank[]};
export type Welcome={type:'welcome';serverNow?:number;protocolVersion:number;playerId:string;resume?:ActorState;room:RoomState;players:{id:string;actor?:ActorState}[]};
export type ServerMessage=Welcome|{type:'knight-victory'}|{type:'number-game';game?:NumberGame}|{type:'number-complete'}|{type:'number-note';digit:number;id:string}|{type:'flower-game';game?:FlowerGame}|{type:'flower-complete'}|{type:'flower-note';index:number;id:string}|{type:'centipede-progress';points:number;completed:boolean}|{type:'centipede-bump';direction:Point}|{type:'emote';emote:string;id:string}|{type:'log';entry:LogEntry}|{type:'presence';count:number}|{type:'frame';id:string;actor?:ActorState;world?:WorldState;pigeons?:PigeonCheckpoint[];chasers?:ChaseSnapshot}|{type:'room';room:RoomState}|{type:'left';id:string}|{type:'hit';id:string;actor:ActorState;target:string}|{type:'lock';key:string;ok:boolean}|{type:'star'}|{type:'resize';size:number}|{type:'error';message:string};
export function validResourceKey(key:unknown):key is string {if(typeof key!=='string')return false;const match=/^(cart|balloon|bug|bench|home|tree|swing|trampoline|boat):(\d{1,2})$/.exec(key);return !!match&&(match[1]!=='boat'||Number(match[2])%2===0)&&Number(match[2])<({boat:8,cart:12,balloon:3,bug:40,bench:32,home:1,tree:1,swing:1,trampoline:1} as Record<string,number>)[match[1]];}
const numbers=(v:unknown,n:number)=>Array.isArray(v)&&v.length===n&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<100000);
export function validActor(v:unknown):v is ActorState{
 const a=v as ActorState;
 const progress=a?.progress;
 if(a?.dash!==undefined&&(!numbers(a.dash,2)||a.dash.some(v=>v<0||v>1)))return false;
 if(a?.location!==undefined&&a.location!=='meta-knight-arena')return false;
 if(a?.fruitBoost!==undefined&&!validFruitBoost(a.fruitBoost))return false;
 if(progress?.mountainCheckpoint!==undefined&&(!Number.isInteger(progress.mountainCheckpoint)||progress.mountainCheckpoint<0||progress.mountainCheckpoint>2))return false;
 if(progress?.speed!==undefined&&(!Number.isFinite(progress.speed)||progress.speed<.1||progress.speed>20))return false;
 if(a?.eventPoints!==undefined&&(!Number.isInteger(a.eventPoints)||a.eventPoints<0||a.eventPoints>12))return false;
 if(a?.fit!==undefined&&(!Number.isFinite(a.fit)||a.fit<.01||a.fit>1))return false;
 if(progress!==undefined&&(!progress||!Number.isFinite(progress.size)||progress.size<.1||progress.size>20||!Number.isInteger(progress.checkpoint)||progress.checkpoint<0||progress.checkpoint>4||!Number.isFinite(progress.ground)||Math.abs(progress.ground)>1000))return false;
 if(a?.roll!==undefined&&(!numbers(a.roll,5)||Math.abs(a.roll[0])>1.01||Math.abs(a.roll[1])>1.01||a.roll[2]<0||a.roll[2]>60))return false;
 const ride=a?.ride,kind=typeof ride?.key==='string'?ride.key.split(':')[0]:'';
 if(kind==='boat'&&(!Array.isArray(ride?.data)||typeof ride.data[0]!=='number'||Math.abs(ride.data[0])>1))return false;
 const length=kind==='cart'?4:kind==='balloon'?16:kind==='bug'?10:kind==='tree'||kind==='swing'||kind==='boat'?1:0;
 const rideOk=!ride||(validResourceKey(ride.key)&&length>0&&Array.isArray(ride.data)&&ride.data.length===length&&ride.data.every((x,i)=>kind==='balloon'&&i===1?['parked','boarding','flying','exiting'].includes(x as string):typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1e7));
 return rideOk&&!!a&&numbers(a.p,3)&&numbers(a.q,4)&&typeof a.s==='number'&&a.s>=.1&&a.s<=20&&typeof a.state==='string'&&a.state.length<32&&typeof a.name==='string'&&a.name.length<=24&&Number.isInteger(a.variant)&&a.variant>=0&&a.variant<KIRBY_VARIANTS.length&&Number.isInteger(a.fruits)&&a.fruits>=0&&a.fruits<=70&&validAchievements(a.achievements)&&Array.isArray(a.pose)&&a.pose.length<=5&&a.pose.every(x=>numbers(x,10))&&Number.isFinite(a.star)&&a.star>=0&&a.star<=30;
}
export function validWorld(v:unknown):v is WorldState{
 const w=v as WorldState;
 const rows=(a:unknown,count:number,length:number)=>Array.isArray(a)&&a.length===count&&a.every(r=>Array.isArray(r)&&r.length===length&&r.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1e10));
 const balloons=Array.isArray(w?.balloons)&&w.balloons.length===3&&w.balloons.every(r=>Array.isArray(r)&&r.length===16&&['parked','boarding','flying','exiting'].includes(r[1] as string)&&r.every((x,i)=>i===1||typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1e7));
 const mountainSteps=w?.mountainSteps===undefined||[MOUNTAIN_STEPS.length,11,13].some(count=>rows(w.mountainSteps,count,3))&&w.mountainSteps.every(r=>Number.isInteger(r[0])&&r[0]>=0&&r[0]<=3&&r[1]>=0&&r[1]<=[0,.7,4,.9][r[0]]&&r[2]>=0&&r[2]<=3);
 return !!w&&Array.isArray(w.npcs)&&w.npcs.length===14&&w.npcs.every(validActor)&&rows(w.npcLife,14,15)&&(rows(w.carts,12,4)||rows(w.carts,13,4))&&balloons&&rows(w.bugs,40,10)&&WILD_PIGEONS.every(id=>w[id]===undefined||validPidgieState(w[id]))&&mountainSteps&&JSON.stringify(w).length<14500;
}
