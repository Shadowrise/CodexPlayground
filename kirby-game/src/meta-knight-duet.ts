import type {KnightActor,KnightBattle,KnightPoint} from './meta-knight-battle';
import {helperLocked,helperPosition,HELPER} from './meta-knight-helper';

export const DUET={cooldownMs:90000,gatherMs:2200,speed:8.5,chargeMs:3000,warnMs:3200,strikeMs:650,gapMs:650,recoverMs:3000,radius:9.5,maxSpots:3} as const;
export type DuetStage='duet-gather'|'duet-charge'|'duet-warn'|'duet-strike'|'duet-gap'|'duet-recover';
export type KnightDuet={owner:string;requestedAt:number;stage:'queued'|'gather'|'charge'|'warn'|'strike'|'gap'|'recover';round:number;at?:number;gatherUntil?:number;bossFrom?:KnightPoint;helperFrom?:KnightPoint;floor?:number;bossHit?:number;spots:KnightPoint[];contacts:Record<string,number>;resume?:'cosmic-spin-warn'|'cosmic-meteor-draw'|'cosmic-star-draw'};
const smooth=(n:number)=>{n=Math.max(0,Math.min(1,n));return n*n*(3-2*n);};
export const duetActive=(s:KnightBattle|undefined)=>!!s?.duet&&s.duet.stage!=='queued'&&s.stage.startsWith('duet-');
export const knightDuetOpening=(s:KnightBattle|undefined)=>s?.stage==='duet-recover'&&s.duet?.stage==='recover'&&!s.openHit&&s.hp>0;
export const duetBossDazed=(s:KnightBattle|undefined,now:number)=>s?.stage==='duet-recover'&&s.duet?.bossHit!==undefined&&now>=s.duet.bossHit&&now-s.duet.bossHit<HELPER.stunMs;
export function requestKnightDuet(s:KnightBattle,actor:KnightActor,now:number){
 const p=s.players[actor.id],h=p?.helper;if(!p||!h||p.side!=='boss'||p.hp<=0||p.withdrawn||!actor.available||!actor.metaKnight||s.duet||now<(h.cooldowns[3]??0)||['intro','transition','won','lost','cancelled','cosmic-surge','cosmic-lift','cosmic-rise','cosmic-descent'].includes(s.stage))return false;
 s.duet={owner:actor.id,requestedAt:now,stage:'queued',round:0,spots:[],contacts:{}};h.cooldowns[3]=now+DUET.cooldownMs;s.revision++;return true;
}
export function duetOwnerAvailable(s:KnightBattle,actors:KnightActor[]){const id=s.duet?.owner,p=id?s.players[id]:undefined;return !!p&&p.hp>0&&!p.withdrawn&&actors.some(a=>a.id===id&&a.available&&a.metaKnight);}
export function beginKnightDuet(s:KnightBattle,actors:KnightActor[],now:number,boss:KnightPoint){
 const d=s.duet;if(!d||d.stage!=='queued'||!duetOwnerAvailable(s,actors))return false;
 const h=s.players[d.owner].helper!;if(helperLocked(h,now))return false;
 const actor=actors.find(a=>a.id===d.owner)!,floor=boss[1],bossTo:KnightPoint=[-3.3,floor,0],helperTo:KnightPoint=[3.3,floor,0],helperFrom=helperPosition(h,now)??actor.p;
 const duration=Math.max(DUET.gatherMs,Math.hypot(boss[0]-bossTo[0],boss[2]-bossTo[2])/DUET.speed*1000,Math.hypot(helperFrom[0]-helperTo[0],helperFrom[2]-helperTo[2])/DUET.speed*1000);
 d.stage='gather';d.at=now;d.gatherUntil=now+duration;d.bossFrom=[...boss];d.helperFrom=[...helperFrom];d.floor=floor;h.cooldowns[3]=now+DUET.cooldownMs;
 if(s.phase===4)d.resume=s.stage==='cosmic-flight'||s.cosmicPart===3?'cosmic-spin-warn':s.cosmicPart===2?'cosmic-star-draw':'cosmic-meteor-draw';
 h.duet={at:now,arrival:now+duration,until:now+duration+DUET.chargeMs+3*(DUET.warnMs+DUET.strikeMs)+2*DUET.gapMs,from:[...helperFrom],to:helperTo};h.phase=s.phase;delete h.cast;delete h.stunnedUntil;delete h.anchor;
 delete s.impactWave;delete s.cosmicSpin;delete s.cosmicMeteor;delete s.cosmicRefuge;
 s.from=[...boss];s.to=bossTo;s.stage='duet-gather';s.since=now;s.until=now+duration;s.openHit=false;s.revision++;return true;
}
export function duetBossPosition(s:KnightBattle,now:number):KnightPoint|undefined{
 const d=s.duet;if(!duetActive(s)||!d?.bossFrom)return;
 if(s.phase===4&&d.stage==='recover')return [-3.3*(1-smooth((now-s.since)/DUET.recoverMs)),d.floor!,0];
 const f=smooth((now-d.at!)/Math.max(1,d.gatherUntil!-d.at!));return [d.bossFrom[0]+(-3.3-d.bossFrom[0])*f,d.floor!,d.bossFrom[2]*(1-f)];
}
/** Each wave locks new targets once. Disjoint disks and a full clear interval keep all three readable. */
export function duetSpots(d:KnightDuet,actors:KnightActor[],s:KnightBattle):KnightPoint[]{
 const heroes=actors.filter(a=>a.available&&s.players[a.id]?.side!=='boss'&&s.players[a.id]?.hp>0&&!s.players[a.id].withdrawn).sort((a,b)=>a.id.localeCompare(b.id)),candidates:KnightPoint[]=[];
 for(let i=0;i<heroes.length;i++){const p=heroes[(i+d.round)%heroes.length].p,r=Math.hypot(p[0],p[2]),scale=r>31?31/r:1;candidates.push([p[0]*scale,d.floor!,p[2]*scale]);}
 for(let i=0;i<12;i++){const a=i*Math.PI/6+(d.requestedAt%977)/977*Math.PI*2+d.round*.71;candidates.push([Math.sin(a)*28,d.floor!,Math.cos(a)*28]);}
 const spots:KnightPoint[]=[];for(const p of candidates){if(spots.every(q=>Math.hypot(p[0]-q[0],p[2]-q[2])>DUET.radius*2+1.5))spots.push(p);if(spots.length===DUET.maxSpots)break;}return spots;
}
export function advanceKnightDuetStep(s:KnightBattle,actors:KnightActor[],now:number){
 const d=s.duet!;let stage:DuetStage,ms:number;
 if(s.stage==='duet-gather'){d.stage='charge';stage='duet-charge';ms=DUET.chargeMs;}
 else if(s.stage==='duet-charge'||s.stage==='duet-gap'){if(s.stage==='duet-gap')d.round++;d.stage='warn';d.spots=duetSpots(d,actors,s);d.contacts={};stage='duet-warn';ms=DUET.warnMs;}
 else if(s.stage==='duet-warn'){d.stage='strike';stage='duet-strike';ms=DUET.strikeMs;}
 else if(s.stage==='duet-strike'&&d.round<2){d.stage='gap';d.spots=[];stage='duet-gap';ms=DUET.gapMs;}
 else if(s.stage==='duet-strike'){
  d.stage='recover';d.spots=[];stage='duet-recover';ms=DUET.recoverMs;const h=s.players[d.owner]?.helper;
  if(h){const from:KnightPoint=[3.3,d.floor!,0];delete h.duet;h.cast={ability:4,meteor:false,at:d.at!,release:now,end:now,recoverUntil:now+HELPER.recoverMs,from,to:[...from],yaw:0,hit:false};}
 }else return true;
 s.stage=stage;s.since=now;s.until=now+ms;s.revision++;return false;
}
export function endKnightDuet(s:KnightBattle,now=s.until){const d=s.duet;if(duetActive(s)){const p=duetBossPosition(s,now)!;s.from=[...p];s.to=[...p];s.yaw=0;}if(d&&s.players[d.owner]?.helper)delete s.players[d.owner].helper!.duet;delete s.duet;s.revision++;return d?.resume;}
export function duetDanger(s:KnightBattle,p:KnightPoint){return s.stage==='duet-strike'&&!!s.duet?.spots.some(q=>Math.hypot(p[0]-q[0],p[2]-q[2])<DUET.radius+.65);}
