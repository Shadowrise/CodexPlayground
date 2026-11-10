import type {FireflyMode} from './firefly';

export const FIREFLY_FLIGHT_SECONDS=23;
export const FIREFLY_CYCLE_SECONDS=32;
const idleModes:readonly FireflyMode[]=['Sit','LookAround','Groom','WingStretch'];
const wrap=(value:number,length:number)=>((value%length)+length)%length;

/** The existing shared meadow clock also schedules idle gestures. No extra
 * network state or random choices are needed when joining an ongoing game. */
export function fireflyActivity(time:number,phase:number,index:number){
 const clock=time+phase,cycle=wrap(clock,FIREFLY_CYCLE_SECONDS);
 const flying=cycle<FIREFLY_FLIGHT_SECONDS,rest=cycle-FIREFLY_FLIGHT_SECONDS;
 const mode:FireflyMode=flying?'Fly':rest<8?idleModes[wrap(Math.floor(clock/FIREFLY_CYCLE_SECONDS)+index,idleModes.length)]:'Sit';
 return {cycle,flying,mode,animationTime:flying?cycle:rest<8?rest:rest-8};
}
