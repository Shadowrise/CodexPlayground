import type {KnightActor,KnightBattle,KnightPoint} from './meta-knight-battle';
import {COSMIC_DESCENT,easeCosmic} from './meta-knight-cosmic';

export type KnightFightersFinale={at:number;landAt:number;won:boolean;actors:Record<string,{from:KnightPoint;to:KnightPoint;yaw:number}>};
/** One immutable result clock for human fighters, AI, late arrivals and sleeping Workers. */
export function prepareKnightFightersFinale(s:KnightBattle,actors:readonly KnightActor[],now:number){
 if(s.fightersFinale)return;
 const won=s.stage!=='lost',roster=[...new Map([...Object.values(s.opponents??{}),...actors].map(a=>[a.id,a])).values()].filter(a=>a.available&&s.players[a.id]&&s.players[a.id].side!=='boss'&&!s.players[a.id].withdrawn).sort((a,b)=>a.id.localeCompare(b.id));
 const airborne=s.phase===4&&roster.some(a=>a.p[1]>.1),placed:KnightPoint[]=[],result:KnightFightersFinale['actors']={};
 for(const [index,a] of roster.entries()){
  const r=Math.hypot(a.p[0],a.p[2]),radius=Math.max(12,Math.min(40,r)),angle=r>.01?Math.atan2(a.p[0],a.p[2]):index*2.399963;let to:KnightPoint=r>=12&&r<=40?[a.p[0],0,a.p[2]]:[Math.sin(angle)*radius,0,Math.cos(angle)*radius];
  const free=(p:KnightPoint)=>Math.hypot(p[0],p[2])>=12-1e-6&&Math.hypot(p[0],p[2])<=40.1&&placed.every(q=>Math.hypot(p[0]-q[0],p[2]-q[2])>=2.65);
  if(!free(to)){const centre=[...to];let best=Infinity;for(let ring=1;ring<=30;ring++)for(let i=0;i<24;i++){const angle=i*Math.PI/12,p:KnightPoint=[centre[0]+Math.sin(angle)*ring*2.7,0,centre[2]+Math.cos(angle)*ring*2.7],d=Math.hypot(p[0]-a.p[0],p[2]-a.p[2]);if(free(p)&&d<best){best=d;to=p;}}}
  placed.push(to);result[a.id]={from:[...a.p],to,yaw:a.yaw};delete s.players[a.id].bump;
 }
 s.fightersFinale={at:now,landAt:now+(airborne?(won?COSMIC_DESCENT.impactMs:COSMIC_DESCENT.durationMs):0),won,actors:result};
}
export function knightFighterFinale(s:KnightBattle|undefined,id:string,now:number){
 if(!s||!['cosmic-descent','won','lost'].includes(s.stage)||s.players[id]?.withdrawn)return;
 const f=s.fightersFinale,a=f?.actors[id];if(!f||!a)return;
 const t=f.landAt===f.at?1:Math.max(0,Math.min(1,(now-f.at)/(f.landAt-f.at))),landed=now>=f.landAt,k=easeCosmic(t),p=a.from.map((v,i)=>v+(a.to[i]-v)*k) as KnightPoint;
 p[1]=landed?0:a.from[1]*(1-t*t);
 const index=Object.keys(f.actors).indexOf(id),cycle=((now-f.landAt+index*830)%7000+7000)%7000,joy=f.won&&landed&&cycle>=700&&cycle<3100;
 return {p,yaw:a.yaw,landed,won:f.won,joy,joySeconds:(cycle-700)/1000};
}
export function projectKnightFightersFinale(s:KnightBattle,now:number){
 let changed=false;for(const a of Object.values(s.opponents??{})){const pose=knightFighterFinale(s,a.id,now);if(!pose)continue;if(a.p.some((v,i)=>v!==pose.p[i]))changed=true;a.p=[...pose.p];a.yaw=pose.yaw;a.moving=false;delete a.turning;delete a.shove;delete a.dashUntil;}
 if(changed)s.revision++;return changed;
}
