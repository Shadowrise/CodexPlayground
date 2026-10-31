import type {KnightActor,KnightBattle,KnightPoint} from './meta-knight-battle';
import {cosmicHeight,easeCosmic} from './meta-knight-cosmic';

const STAGES=['transition','cosmic-charge','cosmic-strike','cosmic-surge','cosmic-lift','cosmic-rise','cosmic-flight'];
export function prepareKnightCosmicAllies(s:KnightBattle,actors:readonly KnightActor[],now:number){
 const helpers=actors.filter(a=>a.available&&s.players[a.id]?.side==='boss'&&s.players[a.id].hp>0&&!s.players[a.id].withdrawn).sort((a,b)=>a.id.localeCompare(b.id));
 helpers.forEach((a,i)=>{const h=s.players[a.id].helper;if(h)h.ascent={at:now,from:[...a.p],to:[4.8,0,(i-(helpers.length-1)/2)*3]};});
}
/** Only the boss ally joins the ritual; a Meta Knight on the player team is still launched normally. */
export function knightCosmicAlly(s:KnightBattle|undefined,id:string,now:number){
 const p=s?.players[id],a=p?.helper?.ascent;if(!s||s.phase!==4||!a||p?.side!=='boss'||p.hp<=0||p.withdrawn||!STAGES.includes(s.stage))return;
 const f=Math.max(0,Math.min(1,(now-s.since)/Math.max(1,s.until-s.since))),gather=s.stage==='transition',t=gather?easeCosmic(f):1;
 const point:KnightPoint=gather?a.from.map((v,i)=>v+(a.to[i]-v)*t) as KnightPoint:[a.to[0],cosmicHeight(s,now),a.to[2]];
 const yaw=gather?Math.atan2(a.to[0]-a.from[0],a.to[2]-a.from[2])*(1-easeCosmic((f-.7)/.3)):0;
 return {p:point,yaw,progress:f,gather};
}
