import {ease} from './metapidgie-ease';
// Arena radius converted into this asset's model-space units.
export const PIDGEY_MELEE_FX={radius:11.6/3.3,inner:.62,halfAngle:1.05,strike:.25,sweep:.2075,fade:.65};
export function meleeTrailTimes(name:string,time:number){
 let fore=-1,back=-1;
 if(name==='Boss_slash')fore=time;
 if(name==='Boss_slash-warn-backhand')fore=PIDGEY_MELEE_FX.strike+time;
 if(name==='Boss_slash-backhand')back=time;
 if(name==='Boss_open'||name==='Boss_open-melee')back=PIDGEY_MELEE_FX.strike+time;
 return [fore,back];
}
export function meleeBeakGlow(name:string,time:number,duration:number){
 const u=Math.max(0,Math.min(1,time/duration)),warning=name==='Boss_slash-warn'||name==='Boss_slash-warn-backhand';
 const wind=warning?.62*ease((u-.28)/.64):0;
 const hit=(name==='Boss_slash'||name==='Boss_slash-backhand')&&time<=duration+.000001?.62+.55*Math.sin(Math.PI*u):0;
 const after=Math.max(...meleeTrailTimes(name,time).map(t=>t>=PIDGEY_MELEE_FX.strike?.62*(1-ease((t-PIDGEY_MELEE_FX.strike)/.30)):0));
 const flight=name==='Boss_dash'?.9:name==='Boss_dash-warn'||name==='Boss_dash-warn-recharge'?.25+.55*ease(u):name==='Boss_dive-warn'?.3+.5*ease(u):name==='Boss_dive'?.85*(1-ease((u-.88)/.12)):name==='Boss_transition-phase2'?.75*Math.sin(Math.PI*u)**2:name==='Boss_duet-charge'?.8*ease(u):['Boss_duet-warn','Boss_duet-strike','Boss_duet-gap'].includes(name)?.9:0;
 return Math.max(wind,hit,after,flight);
}
