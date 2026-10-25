/** Shared clock for the ascent. Altitude belongs to the encounter, never to input. */
export const COSMIC={height:180,health:6,flightSpeedMultiplier:2,rim:41,pushDelayMs:120,pushFrontMs:740,pushMs:950,centerMs:1500,chargeMs:2800,strikeMs:850,surgeMs:1900,liftMs:1050,riseMs:5600} as const;
export const COSMIC_DESCENT={durationMs:3000,impactMs:2380,releaseMs:240,braceMs:380,settleMs:620} as const;
export type CosmicFall={at:number;yaw:number};
export const COSMIC_SEQUENCE=[['cosmic-charge',COSMIC.chargeMs],['cosmic-strike',COSMIC.strikeMs],['cosmic-surge',COSMIC.surgeMs],['cosmic-lift',COSMIC.liftMs],['cosmic-rise',COSMIC.riseMs],['cosmic-flight',4000]] as const;
export type CosmicStage=typeof COSMIC_SEQUENCE[number][0]|'cosmic-spin-warn'|'cosmic-spin'|'cosmic-open'|'cosmic-hit'|'cosmic-recover'|'cosmic-descent'|'cosmic-meteor-draw'|'cosmic-meteor-cast'|'cosmic-meteor-return'|'cosmic-meteor-gap'|'cosmic-meteor-settle'|'cosmic-star-draw'|'cosmic-star-open'|'cosmic-planet-draw'|'cosmic-planet-sweep'|'cosmic-planet-break'|'cosmic-star-strike'|'cosmic-star-stun'|'cosmic-star-retreat'|'cosmic-planet-release';
type State={phase:number;stage:string;since:number;until:number;cosmicLaunch?:CosmicLaunch;cosmicFall?:CosmicFall};
export type CosmicLaunch={at:number;players:Record<string,{from:[number,number,number];angle:number}>};
export function cosmicControlsLocked(s:State|undefined){return s?.phase===4&&['cosmic-surge','cosmic-lift','cosmic-rise','cosmic-descent'].includes(s.stage);}
export function cosmicCombat(s:State|undefined){return s?.phase===4&&(['cosmic-spin-warn','cosmic-spin','cosmic-open','cosmic-hit','cosmic-recover'].includes(s.stage)||s.stage.startsWith('cosmic-meteor-')||s.stage.startsWith('cosmic-star-')||s.stage.startsWith('cosmic-planet-'));}
export function cosmicOpening(s:State|undefined){return s?.phase===4&&s.stage==='cosmic-open';}
/** The electrical front reaches each player before a timed, outward recoil. */
export function cosmicPlayerPush(s:(State&{cosmicLaunch?:CosmicLaunch})|undefined,id:string,now:number){
 const launch=s?.cosmicLaunch,player=launch?.players[id];if(!cosmicStage(s)||s.stage==='cosmic-descent'||!launch||!player)return;
 const radius=Math.hypot(player.from[0],player.from[2]),hit=launch.at+COSMIC.pushDelayMs+Math.min(COSMIC.rim,radius)/46*COSMIC.pushFrontMs;
 const progress=Math.max(0,Math.min(1,(now-hit)/COSMIC.pushMs)),t=easeCosmic(progress);
 const point:[number,number,number]=[player.from[0]+(Math.sin(player.angle)*COSMIC.rim-player.from[0])*t,0,player.from[2]+(Math.cos(player.angle)*COSMIC.rim-player.from[2])*t];
 return {point,progress,hit};
}
export const easeCosmic=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
/** Accelerating descent and a separate ground recovery share one authoritative clock. */
export function cosmicDescent(s:State|undefined,now:number){
 if(s?.phase!==4||!['cosmic-descent','won'].includes(s.stage))return;
 const at=s.cosmicFall?.at??(s.stage==='won'?s.since-COSMIC_DESCENT.durationMs:s.since),elapsed=Math.max(0,now-at),progress=Math.min(1,elapsed/COSMIC_DESCENT.impactMs),landed=elapsed>=COSMIC_DESCENT.impactMs,landAge=Math.max(0,elapsed-COSMIC_DESCENT.impactMs),release=easeCosmic(elapsed/COSMIC_DESCENT.releaseMs),brace=easeCosmic((elapsed-COSMIC_DESCENT.impactMs+COSMIC_DESCENT.braceMs)/COSMIC_DESCENT.braceMs),settle=easeCosmic(landAge/COSMIC_DESCENT.settleMs);
 const bodyY=landed?.92+.14*Math.exp(-landAge/110)*(.5+.5*Math.cos(landAge*.035)):(1.14+.055*Math.sin(Math.min(1,elapsed/500)*Math.PI))*(1-brace)+1.06*brace;
 return {at,elapsed,progress,landed,landAge,release,brace,settle,bodyY,bodyZ:-.18*brace,height:COSMIC.height*(1-progress*progress),speed:landed?0:2*COSMIC.height*progress/(COSMIC_DESCENT.impactMs/1000),pitch:landed?-.10+.065*Math.sin(landAge*.022)*Math.exp(-landAge/170):(.08+.30*release+.05*Math.sin(elapsed*.010)*release)*(1-brace)-.10*brace,roll:landed?.045*Math.sin(landAge*.020)*Math.exp(-landAge/160):(.14*Math.sin(elapsed*.010)+.04*Math.sin(elapsed*.017))*release*(1-brace)};
}
export function cosmicStage(s:State|undefined):s is State&{stage:CosmicStage}{return s?.phase===4&&s.stage.startsWith('cosmic-');}
export function cosmicAirborne(s:State|undefined){return s?.phase===4&&(s.stage==='cosmic-rise'||s.stage==='cosmic-flight'||s.stage==='cosmic-descent'||cosmicCombat(s));}
export function cosmicHeight(s:State|undefined,now:number){
 if(!cosmicAirborne(s))return 0;
 return s!.stage==='cosmic-rise'?COSMIC.height*easeCosmic((now-s!.since)/COSMIC.riseMs):s!.stage==='cosmic-descent'?cosmicDescent(s,now)!.height:COSMIC.height;
}
export function cosmicElapsed(s:State,now:number){
 if(s.cosmicLaunch)return Math.max(0,now-s.cosmicLaunch.at+COSMIC.chargeMs+COSMIC.strikeMs);
 let elapsed=now-s.since;
 for(const [stage,duration] of COSMIC_SEQUENCE){if(s.stage===stage)return Math.max(0,elapsed);elapsed+=duration;}
 return 0;
}
export function cosmicNext(stage:string){const i=COSMIC_SEQUENCE.findIndex(s=>s[0]===stage);return i<0?COSMIC_SEQUENCE[0]:COSMIC_SEQUENCE[Math.min(i+1,COSMIC_SEQUENCE.length-1)];}
