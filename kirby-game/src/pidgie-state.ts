/** Complete host-owned NPC checkpoint; shared by the browser and Worker. */
import {validBreadOffering,type BreadOffering} from './bread-state';
export const PIDGIE_FOLLOW_DISTANCE=8;
export const PIDGIE_FOLLOW_REACTION_SECONDS=.6;
/** Measured forward beak contact in the native ground-peck animation. */
export const PIDGIE_PECK_REACH=1.4;
export const PIDGIE_FOLLOW_MAX_SPEED=18;
export const PIDGIE_PHASES = ['hidden','wander','fear','takeoff','fly','landing','follow','greet','joy','toBread','feast'] as const;
export const PIDGIE_CLIPS = ['Idle','Walk','Fear','Jump','Fly','Peck','Run','Joy','Hello'] as const;
export type PidgiePhase = typeof PIDGIE_PHASES[number];
export type PidgieClip = typeof PIDGIE_CLIPS[number];
export type PidgiePoint = [number,number];
export type PidgieState = {
 phase:PidgiePhase;
 p:[number,number,number];
 yaw:number;
 elapsed:number;
 refuge:PidgiePoint;
 target:PidgiePoint;
 origin:PidgiePoint;
 destination:PidgiePoint;
 walkTimer:number;
 pause:number;
 cooldown:number;
 height:number;
 flightDuration:number;
 turnStart:number;
 turnTarget:number;
 clip:PidgieClip;
 clipTime:number;
 seed:number;
 /** Monotonic scare sequence, so late joins and handoffs never replay a coo. */
 fearCount:number;
 /** Stable player identity and current ground speed survive host handoff. */
 followId?:string;
 followSpeed?:number;
 friend?:BreadOffering;
};

const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const point=(v:unknown):v is PidgiePoint=>Array.isArray(v)&&v.length===2&&finite(v[0],-512,512)&&finite(v[1],-512,512);
const uint32=(v:unknown):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=0xffffffff;

/** Bounded primitives only: this module deliberately has no rendering imports. */
export function validPidgieState(value:unknown):value is PidgieState {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const s=value as Partial<PidgieState>;
 const followId=typeof s.followId==='string'&&s.followId.length>0&&s.followId.length<=64&&!/[\u0000-\u001f\u007f]/.test(s.followId);
 if((s.followId!==undefined&&!followId)||(s.followSpeed!==undefined&&!finite(s.followSpeed,0,PIDGIE_FOLLOW_MAX_SPEED)))return false;
 if((s.phase==='follow'||s.phase==='greet')&&(!followId||s.followSpeed===undefined))return false;
 if(s.friend!==undefined&&!validBreadOffering(s.friend))return false;
 if(['joy','toBread','feast'].includes(s.phase as string)&&!s.friend)return false;
 return PIDGIE_PHASES.includes(s.phase as PidgiePhase)
  &&PIDGIE_CLIPS.includes(s.clip as PidgieClip)
  &&Array.isArray(s.p)&&s.p.length===3&&finite(s.p[0],-512,512)&&finite(s.p[1],-20,256)&&finite(s.p[2],-512,512)
  &&point(s.refuge)&&point(s.target)&&point(s.origin)&&point(s.destination)
  &&finite(s.yaw,-1e4,1e4)&&finite(s.turnStart,-1e4,1e4)&&finite(s.turnTarget,-1e4,1e4)
  &&finite(s.elapsed,0,3600)&&finite(s.walkTimer,0,3600)&&finite(s.pause,0,3600)&&finite(s.cooldown,0,3600)
  &&finite(s.height,0,256)&&finite(s.flightDuration,0,120)&&finite(s.clipTime,0,3600)
  &&uint32(s.seed)&&uint32(s.fearCount);
}

export function beginPidgieFeeding(state:PidgieState,offering:BreadOffering):PidgieState{
 if(state.friend?.at===offering.at&&state.friend.by===offering.by&&['joy','toBread','feast'].includes(state.phase))return state;
 return {...state,phase:'joy',p:[...offering.bird],elapsed:0,clip:'Joy',clipTime:0,pause:0,walkTimer:0,cooldown:0,followId:undefined,followSpeed:undefined,friend:structuredClone(offering),target:[offering.bread[0],offering.bread[2]]};
}
