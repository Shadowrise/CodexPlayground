import type {PidgieState} from '../src/pidgie-state';

/** A mid-flight checkpoint includes every value needed to continue as a new host. */
export function pidgieFixture():PidgieState {
 return {phase:'fly',p:[67.375,26,-29.25],yaw:1.17,elapsed:.812,
  refuge:[61.5,-31.25],target:[63.7,-29.6],origin:[61.5,-31.25],destination:[103.2,-15.8],
  walkTimer:2.7,pause:.35,cooldown:4.9,height:26,flightDuration:2.47,
  turnStart:-.4,turnTarget:1.17,clip:'Fly',clipTime:.422,seed:0x8ac4f713,fearCount:7};
}
