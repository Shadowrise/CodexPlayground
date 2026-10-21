import {validPidgieState,type PidgieState} from './pidgie-state';
import type {WildPigeonId} from './wild-pigeons';

export const PIGEON_FLOCK_BATCH=16;
export const ROOM_FRAME_LIMIT=22000;
export type PigeonCheckpoint={id:string;bird:PidgieState;helloIn:number;helloRemaining:number;helloCount:number;departureY?:number;departed?:boolean;at?:number};
export type SummonedPigeon={id:string;playerId:string;skin:WildPigeonId;seed:number;order:number;dismissedAt?:number;checkpoint?:PigeonCheckpoint};
export function validPigeonCheckpoint(value:unknown):value is PigeonCheckpoint{
 const c=value as PigeonCheckpoint;
 return !!c&&typeof c.id==='string'&&c.id.length>0&&c.id.length<=64&&validPidgieState(c.bird)
  &&Number.isFinite(c.helloIn)&&c.helloIn>=0&&c.helloIn<=20&&Number.isFinite(c.helloRemaining)&&c.helloRemaining>=0&&c.helloRemaining<=3
  &&Number.isSafeInteger(c.helloCount)&&c.helloCount>=0
  &&(c.at===undefined||Number.isFinite(c.at)&&c.at>=0)
  &&(c.departureY===undefined||Number.isFinite(c.departureY)&&c.departureY>=0&&c.departureY<=256)
  &&(c.departed===undefined||typeof c.departed==='boolean');
}
