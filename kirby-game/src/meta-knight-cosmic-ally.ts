import {knightAudienceYaw,knightFormationSide,knightGatherYaw} from './meta-knight-staging';
import type {KnightActor,KnightBattle,KnightPoint} from './meta-knight-battle';
import {COSMIC,cosmicHeight,easeCosmic} from './meta-knight-cosmic';
import {refugeAngle,refugeDirection} from './meta-knight-cosmic-refuge';
import {helperPosition,cancelHelperCast} from './meta-knight-helper';

const STAGES=['transition','cosmic-charge','cosmic-strike','cosmic-surge','cosmic-lift','cosmic-rise','cosmic-flight'];
const PLANET_STAGES=['cosmic-star-draw','cosmic-star-open','cosmic-planet-draw','cosmic-planet-sweep'];
export function knightPlanetAssistStage(s:Pick<KnightBattle,'phase'|'stage'>|undefined){return s?.phase===4&&PLANET_STAGES.includes(s.stage);}
export function prepareKnightCosmicAllies(s:KnightBattle,actors:readonly KnightActor[],now:number){
 const helpers=actors.filter(a=>a.available&&s.players[a.id]?.side==='boss'&&s.players[a.id].hp>0&&!s.players[a.id].withdrawn).sort((a,b)=>a.id.localeCompare(b.id));
 const yaw=knightAudienceYaw(s,actors);helpers.forEach((a,i)=>{const h=s.players[a.id].helper;if(h)h.ascent={yaw,at:now,from:[...a.p],to:knightFormationSide(4.8+i*3,yaw)};});
}
function planetSide(s:KnightBattle,id:string){const ids=Object.keys(s.players).filter(id=>s.players[id].side==='boss'&&s.players[id].hp>0&&!s.players[id].withdrawn).sort();return -refugeDirection(s)*(4.8+Math.max(0,ids.indexOf(id))*3);}
export function prepareKnightPlanetAllies(s:KnightBattle,actors:readonly KnightActor[],now:number){
 if(!knightPlanetAssistStage(s)||!s.cosmicRefuge)return false;let changed=false;
 for(const a of actors){const p=s.players[a.id],h=p?.helper;if(!a.available||p?.side!=='boss'||p.hp<=0||p.withdrawn||!h||h.planet?.round===s.cosmicRefuge.at)continue;
  const current=helperPosition(h,now)??a.p,from:KnightPoint=[current[0],COSMIC.height,current[2]],yaw=knightAudienceYaw(s,actors),side=planetSide(s,a.id),x=Math.cos(yaw)*side,z=-Math.sin(yaw)*side,at=Math.max(now,h.stunnedUntil??now);
  h.planet={yaw,round:s.cosmicRefuge.at,side,at,arrival:at+Math.max(1000,Math.hypot(from[0]-x,from[2]-z)/8.5*1000),from};cancelHelperCast(h,now);delete h.duet;h.phase=s.phase;changed=true;
 }return changed;
}
/** Only the boss ally joins the ritual; a Meta Knight on the player team is still launched normally. */
export function knightCosmicAlly(s:KnightBattle|undefined,id:string,now:number){
 const p=s?.players[id],h=p?.helper;if(!s||s.phase!==4||!h||p?.side!=='boss'||p.hp<=0||p.withdrawn)return;
 if(knightPlanetAssistStage(s)&&s.cosmicRefuge&&h.planet?.round===s.cosmicRefuge.at){
  const a=h.planet,f=Math.max(0,Math.min(1,(now-a.at)/(a.arrival-a.at))),t=easeCosmic(f),heading=a.yaw??refugeAngle(s,now),side=a.side??planetSide(s,id),target:KnightPoint=[Math.cos(heading)*side,COSMIC.height,-Math.sin(heading)*side],point=a.from.map((v,i)=>v+(target[i]-v)*t) as KnightPoint;
  const yaw=knightGatherYaw(a.from,target,heading,f);
  return {p:point,yaw,progress:f,gather:f<1,waiting:now<a.at,kind:'planet' as const,raise:easeCosmic((now-a.arrival+600)/600)};
 }
 const a=h.ascent;if(!a||!STAGES.includes(s.stage))return;
 const f=Math.max(0,Math.min(1,(now-s.since)/Math.max(1,s.until-s.since))),gather=s.stage==='transition',t=gather?easeCosmic(f):1;
 const point:KnightPoint=gather?a.from.map((v,i)=>v+(a.to[i]-v)*t) as KnightPoint:[a.to[0],cosmicHeight(s,now),a.to[2]];
 const yaw=gather?knightGatherYaw(a.from,a.to,a.yaw??0,f):a.yaw??0;
 return {p:point,yaw,progress:f,gather,waiting:false,kind:'ascent' as const};
}
/** The side offset and both headings share one frame, independent of either player's camera. */
export function knightCosmicFormationYaw(s:KnightBattle|undefined,now:number){
 for(const id of Object.keys(s?.players??{})){const pose=knightCosmicAlly(s,id,now);if(pose){if(!pose.gather)return pose.yaw;if(pose.kind==='ascent'){const target=s!.players[id].helper!.ascent?.yaw??0;return s!.yaw+Math.atan2(Math.sin(target-s!.yaw),Math.cos(target-s!.yaw))*easeCosmic((pose.progress-.65)/.35);}}}
}
