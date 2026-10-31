import {requestKnightDuet} from './meta-knight-duet';
import {META_KNIGHT_ARENA,insideKnightFightingArea} from './meta-knight-arena-site';
import type {KnightActor,KnightBattle,KnightPoint} from './meta-knight-battle';

export type KnightSide='players'|'boss';
export type HelperAbility=1|2|3|4;
export const HELPER={hearts:5,opponentHearts:8,cooldowns:[10000,8000,14000,90000],recoverMs:3000,stunMs:1000,shotWarnMs:1760,meteorWarnMs:1800,dashWarnMs:1600,spinWarnMs:2800,dashMs:700,dashDistance:18,spinMs:1200,shotMs:300,projectileMs:4500,returnMs:650,shotSpeed:28,meteorSpeed:34,orbSpeed:13.5,orbRadius:.72,shotRadius:1.15,dashHalfWidth:1.8} as const;
export type HelperCast={ability:HelperAbility;meteor:boolean;at:number;release:number;end:number;recoverUntil:number;from:KnightPoint;to:KnightPoint;yaw:number;hit:boolean;returned?:{at:number;from:KnightPoint;by:string};resolved?:boolean;contacts?:Record<string,number>};
export type KnightHelper={cooldowns:[number,number,number,number?];duet?:{at:number;arrival:number;until:number;from:KnightPoint;to:KnightPoint};cast?:HelperCast;stunnedUntil?:number;anchor?:KnightPoint;phase:number};
const mix=(a:KnightPoint,b:KnightPoint,t:number)=>a.map((v,i)=>v+(b[i]-v)*t) as KnightPoint;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export const helperIsBoss=(s:KnightBattle|undefined,id:string)=>s?.players[id]?.side==='boss';
export function helperRoster(actors:readonly KnightActor[]){return actors.filter(a=>a.available&&insideKnightFightingArea(a.p));}
export function helperChoiceAvailable(actors:readonly KnightActor[]){const roster=helperRoster(actors);return roster.some(a=>a.metaKnight)&&roster.some(a=>!a.metaKnight);}
export function helperPosition(h:KnightHelper,now:number):KnightPoint|undefined{
 const d=h.duet;if(d&&now<d.until){const f=clamp((now-d.at)/(d.arrival-d.at)),t=f*f*(3-2*f);return mix(d.from,d.to,t);}
 const c=h.cast;if(!c)return now<(h.stunnedUntil??0)?h.anchor:undefined;
 if(now<c.at||now>=c.recoverUntil)return now<(h.stunnedUntil??0)?h.anchor:undefined;
 return c.ability===2?mix(c.from,c.to,clamp((now-c.release)/(c.end-c.release))):[...c.from];
}
export function helperRecovering(h:KnightHelper,now:number){const c=h.cast;return !!c&&now>=c.end&&now<c.recoverUntil;}
export function helperVulnerable(h:KnightHelper,now:number){return !!h.cast&&h.cast.ability!==1&&!h.cast.hit&&helperRecovering(h,now)&&now>=(h.stunnedUntil??0);}
export function helperLocked(h:KnightHelper,now:number){return !!helperPosition(h,now);}
export function startHelperAbility(s:KnightBattle|undefined,actor:KnightActor,ability:HelperAbility,now:number){
 const p=s?.players[actor.id],h=p?.helper;
 if(ability===4)return !!s&&requestKnightDuet(s,actor,now);
 if(!s||!p||p.side!=='boss'||!h||!actor.available||!actor.metaKnight||p.withdrawn||p.hp<=0||![1,2,3].includes(ability)||['intro','transition','won','lost','cancelled','cosmic-surge','cosmic-lift','cosmic-rise','cosmic-descent'].includes(s.stage)||helperLocked(h,now)||s.duet?.owner===actor.id||now<(h.cooldowns[ability-1]??0))return false;
 const meteor=ability===1&&s.phase===4,warn=ability===1?(meteor?HELPER.meteorWarnMs:HELPER.shotWarnMs):ability===2?HELPER.dashWarnMs:HELPER.spinWarnMs;
 const from:KnightPoint=[...actor.p],dx=Math.sin(actor.yaw),dz=Math.cos(actor.yaw),b=from[0]*dx+from[2]*dz,radius=META_KNIGHT_ARENA.walkRadius-1;
 const distance=Math.min(HELPER.dashDistance,Math.max(0,-b+Math.sqrt(Math.max(0,b*b+radius*radius-from[0]**2-from[2]**2)))),to:KnightPoint=[from[0]+dx*distance,from[1],from[2]+dz*distance];
 h.cast={ability,meteor,at:now,release:now+warn,end:now+warn+(ability===1?HELPER.shotMs:ability===2?HELPER.dashMs:HELPER.spinMs),recoverUntil:now+warn+(ability===1?HELPER.shotMs:ability===2?HELPER.dashMs:HELPER.spinMs)+HELPER.recoverMs,from,to,yaw:actor.yaw,hit:false};
 h.cooldowns[ability-1]=now+HELPER.cooldowns[ability-1];h.phase=s.phase;delete h.stunnedUntil;delete h.anchor;s.revision++;return true;
}
/** Shared curved meteor / straight crescent paths, including the return to their sender. */
export function helperProjectile(c:HelperCast,now:number,sender?:KnightPoint):KnightPoint|undefined{
 if(c.ability!==1||c.resolved)return;
 if(c.returned){const t=clamp((now-c.returned.at)/HELPER.returnMs);const target=sender??c.from;return mix(c.returned.from,[target[0],target[1]+1.25,target[2]],t);}
 const elapsed=now-c.release;if(elapsed<0||elapsed>HELPER.projectileMs)return;
 const distance=1.8+elapsed/1000*(c.meteor?HELPER.meteorSpeed:HELPER.shotSpeed),bend=c.meteor?Math.sin(Math.min(1,distance/45)*Math.PI)*3:0;
 return [c.from[0]+Math.sin(c.yaw)*distance+Math.cos(c.yaw)*bend,c.from[1]+1.25,c.from[2]+Math.cos(c.yaw)*distance-Math.sin(c.yaw)*bend];
}
export function helperOrbs(c:HelperCast,now:number){
 if(c.ability!==3||now<c.release||now>c.release+HELPER.projectileMs)return [];
 const distance=2.1+(now-c.release)/1000*HELPER.orbSpeed;
 return Array.from({length:6},(_,i)=>{const angle=c.yaw+i*Math.PI/3;return [c.from[0]+Math.sin(angle)*distance,c.from[1]+1.25,c.from[2]+Math.cos(angle)*distance] as KnightPoint;});
}
export function helperSegmentDistance(a:KnightPoint,b:KnightPoint,p:KnightPoint){const d=b.map((v,i)=>v-a[i]),length=d.reduce((v,n)=>v+n*n,0),t=length?clamp(p.reduce((v,n,i)=>v+(n-a[i])*d[i],0)/length):0;return Math.hypot(...p.map((v,i)=>v-a[i]-t*d[i]));}
