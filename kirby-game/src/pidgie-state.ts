/** Complete host-owned NPC checkpoint; shared by the browser and Worker. */
export const PIDGIE_PHASES = ['hidden','wander','fear','takeoff','fly','landing'] as const;
export const PIDGIE_CLIPS = ['Idle','Walk','Fear','Jump','Fly'] as const;
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
};

const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const point=(v:unknown):v is PidgiePoint=>Array.isArray(v)&&v.length===2&&finite(v[0],-512,512)&&finite(v[1],-512,512);
const uint32=(v:unknown):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=0xffffffff;

/** Bounded primitives only: this module deliberately has no rendering imports. */
export function validPidgieState(value:unknown):value is PidgieState {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const s=value as Partial<PidgieState>;
 return PIDGIE_PHASES.includes(s.phase as PidgiePhase)
  &&PIDGIE_CLIPS.includes(s.clip as PidgieClip)
  &&Array.isArray(s.p)&&s.p.length===3&&finite(s.p[0],-512,512)&&finite(s.p[1],-20,256)&&finite(s.p[2],-512,512)
  &&point(s.refuge)&&point(s.target)&&point(s.origin)&&point(s.destination)
  &&finite(s.yaw,-1e4,1e4)&&finite(s.turnStart,-1e4,1e4)&&finite(s.turnTarget,-1e4,1e4)
  &&finite(s.elapsed,0,3600)&&finite(s.walkTimer,0,3600)&&finite(s.pause,0,3600)&&finite(s.cooldown,0,3600)
  &&finite(s.height,0,256)&&finite(s.flightDuration,0,120)&&finite(s.clipTime,0,3600)
  &&uint32(s.seed)&&uint32(s.fearCount);
}
