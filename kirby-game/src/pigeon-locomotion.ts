import {PIGEON_CLIP_BY_NAME} from './pigeon-clips';

/** Shared IK travel and stance fractions: authored feet and game cadence agree. */
export const PIGEON_GAITS={
 Walk:{reach:.125,stance:.60,hipHeight:.50,cyclesPerClip:3},
 Run:{reach:.23,stance:.42,hipHeight:.44,cyclesPerClip:3},
 WalkBackward:{reach:.18,stance:.60,hipHeight:.46,cyclesPerClip:3},
} as const;
export type PigeonGait=keyof typeof PIGEON_GAITS;
export function isPigeonGait(state:string):state is PigeonGait{return Object.hasOwn(PIGEON_GAITS,state);}

/** Three strides per clip preserve planted ankle speed while the head slows. */
export function pigeonStanceSpeed(state:PigeonGait){
 const gait=PIGEON_GAITS[state];
 return 2*gait.reach*gait.cyclesPerClip/(gait.stance*PIGEON_CLIP_BY_NAME[state].duration);
}
export function pigeonGaitRate(state:PigeonGait,distance:number,dt:number,visualScale:number){
 if(dt<=0||!Number.isFinite(distance)||!Number.isFinite(visualScale)||visualScale<=0)return 0;
 return Math.max(0,distance)/(dt*visualScale*pigeonStanceSpeed(state));
}
