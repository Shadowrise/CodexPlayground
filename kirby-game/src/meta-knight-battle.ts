/** Shared encounter rules. Coordinates are local to the cosmic arena; time is ms. */
export type KnightPoint=[number,number,number];
export type KnightActor={id:string;p:KnightPoint;yaw:number;available:boolean};
export type KnightStage='intro'|'approach'|'slash-warn'|'slash'|'jump-warn'|'jump'|'slam'|'wave'|'dash-warn'|'dash'|'dive-warn'|'dive'|'shot-warn'|'shot'|'return'|'open'|'rest'|'transition'|'won'|'lost'|'cancelled';
export type KnightPlayer={hp:number;invulnerable:number;attackAt:number;handled:number;hits:number;reflects:number;withdrawn?:boolean};
export type KnightBattle={id:number;revision:number;stage:KnightStage;since:number;until:number;checked:number;phase:1|2|3;hp:number;players:Record<string,KnightPlayer>;target:string;from:KnightPoint;to:KnightPoint;yaw:number;height:number;cycle:number;step:number;pattern:'sword'|'leap'|'flight'|'dive'|'crescent';openHit:boolean;returnFrom?:KnightPoint;rewarded?:boolean};
export const KNIGHT={effectScale:2,modelScale:3.3,health:12,hearts:5,reflectMs:300,attackCooldown:650,invulnerableMs:1200,bodyRadius:.65,slashRadius:11.6,slashHalfAngle:1.05,laneHalfWidth:3,impactRadius:5,waveSpeed:.014,waveHeight:.85,projectileRadius:2.4,projectileHeight:2.9,meleeReach:4.8} as const;
export function knightBattleActive(s:KnightBattle|undefined){return !!s&&!['won','lost','cancelled'].includes(s.stage);}
const distance=(a:KnightPoint,b:KnightPoint)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const clamp=(p:KnightPoint,r=31):KnightPoint=>{const d=Math.hypot(p[0],p[2]);return d>r?[p[0]*r/d,p[1],p[2]*r/d]:[...p];};
const angle=(a:KnightPoint,b:KnightPoint)=>Math.atan2(b[0]-a[0],b[2]-a[2]);
const mix=(a:KnightPoint,b:KnightPoint,t:number):KnightPoint=>a.map((v,i)=>v+(b[i]-v)*t) as KnightPoint;
export function knightProgress(s:KnightBattle,now:number){return Math.max(0,Math.min(1,(now-s.since)/Math.max(1,s.until-s.since)));}
export function knightPosition(s:KnightBattle,now:number):KnightPoint{
 const t=knightProgress(s,now),p=['approach','jump','dash','dive','return'].includes(s.stage)?mix(s.from,s.to,t):[...s.from] as KnightPoint;
 if(s.stage==='cancelled')return [0,0,-9];
 if(s.stage==='jump')p[1]+=Math.sin(t*Math.PI)*5;
 if(s.stage==='dive-warn')p[1]+=Math.sin(t*Math.PI/2)*5;
 if(s.stage==='dive')p[1]+=5*(1-t);
 if(['slash-warn','slash','dash-warn','dash','shot-warn','shot'].includes(s.stage))p[1]=s.height;
 return p;
}
export function knightProjectile(s:KnightBattle,now:number):KnightPoint|undefined{
 if(s.stage==='shot'){const t=Math.max(0,(now-s.since)/1100),p=mix([s.from[0],s.height+KNIGHT.projectileHeight,s.from[2]],[s.to[0],Math.max(KNIGHT.projectileHeight,s.to[1]+.85),s.to[2]],t);p[1]=Math.max(KNIGHT.projectileHeight,p[1]);return p;}
 if(s.stage==='return'&&s.returnFrom)return mix(s.returnFrom,[s.to[0],s.to[1]+KNIGHT.projectileHeight,s.to[2]],knightProgress(s,now));
}
const recipes:Record<KnightBattle['pattern'],[KnightStage,number][]>={
 sword:[['slash-warn',1000],['slash',250],['slash-warn',750],['slash',250],['open',2200]],
 leap:[['jump-warn',1000],['jump',850],['slam',180],['wave',1550],['open',2400]],
 flight:[['dash-warn',1000],['dash',700],['dash-warn',850],['dash',700],['open',2100]],
 dive:[['dive-warn',1200],['dive',450],['slam',180],['wave',1250],['open',2400]],
 crescent:[['shot-warn',1150],['shot',1800],['rest',650]],
};
function living(s:KnightBattle,actors:KnightActor[]){return actors.filter(a=>a.available&&s.players[a.id]?.hp>0&&!s.players[a.id].withdrawn);}
function target(s:KnightBattle,actors:KnightActor[]){const alive=living(s,actors);return alive.find(a=>a.id===s.target)??alive[0];}
export function startKnightBattle(actors:KnightActor[],owner:string,now:number):KnightBattle|undefined{
 const a=actors.find(a=>a.id===owner&&a.available&&distance(a.p,[0,0,-9])<9&&a.p[1]<1);
 if(!a)return;
 const players:KnightBattle['players']={};for(const actor of actors)if(actor.available&&distance(actor.p,[0,0,0])<33)players[actor.id]={hp:5,invulnerable:0,attackAt:-1e9,handled:-1e9,hits:0,reflects:0};
 return {id:now,revision:1,stage:'intro',since:now,until:now+1300,checked:now,phase:1,hp:12,players,target:owner,from:[0,0,-9],to:[0,0,-9],yaw:0,height:0,cycle:0,step:-1,pattern:'sword',openHit:false};
}
/** One fresh press; holding and repeated packets cannot keep a reflection active. */
export function knightAttack(s:KnightBattle|undefined,actor:KnightActor,now:number){
 const p=s?.players[actor.id];if(!s||!p||p.hp<=0||p.withdrawn||!actor.available||['won','lost','cancelled','transition','intro'].includes(s.stage)||now-p.attackAt<KNIGHT.attackCooldown)return false;
 p.attackAt=now;return true;
}
/** Leaving the duel never teleports the player or grants a victory. Friends can continue. */
export function cancelKnightBattle(s:KnightBattle|undefined,id:string,now:number){
 const p=s?.players[id];if(!s||!p||p.withdrawn)return false;
 p.withdrawn=true;s.revision++;
 if(!Object.values(s.players).some(p=>p.hp>0&&!p.withdrawn)){s.stage='cancelled';s.since=s.checked=now;s.until=now+1e12;s.from=s.to=[0,0,-9];}
 return true;
}
function enter(s:KnightBattle,stage:KnightStage,ms:number,now:number,actors:KnightActor[]){
 const p=knightPosition(s,now),a=target(s,actors);s.from=[p[0],0,p[2]];s.to=[...s.from];s.stage=stage;s.since=now;s.until=now+ms;s.openHit=false;s.revision++;
 if(!a)return;
 if(stage.endsWith('-warn')){
  s.yaw=angle(s.from,a.p);s.height=stage==='dash-warn'||stage==='shot-warn'?Math.max(.5,Math.min(3,a.p[1])):0;
  if(stage==='slash-warn'&&a.p[1]>1)s.height=Math.min(3,a.p[1]);
  s.to=[...s.from];
  if(stage==='jump-warn'||stage==='dive-warn'||stage==='shot-warn')s.to=clamp([a.p[0],a.p[1],a.p[2]]);
  if(stage==='dash-warn'){
   const direction=s.phase===3&&s.step===2?s.yaw+Math.PI/2:s.yaw;
   s.yaw=direction;const d=Math.min(46,Math.max(22,distance(s.from,a.p)+10));
   s.to=clamp([s.from[0]+Math.sin(direction)*d,0,s.from[2]+Math.cos(direction)*d]);
  }
 }
 if(stage==='approach'){
  const d=Math.max(.1,distance(s.from,a.p)),end:KnightPoint=[a.p[0]+(s.from[0]-a.p[0])/d*9.4,0,a.p[2]+(s.from[2]-a.p[2])/d*9.4];s.to=clamp(end);s.yaw=angle(s.from,a.p);
 }
}
function nextPattern(s:KnightBattle,now:number,actors:KnightActor[]){
 const alive=living(s,actors);s.target=alive[s.cycle%Math.max(1,alive.length)]?.id??s.target;
 const order:KnightBattle['pattern'][]=s.phase===1?['sword','leap','crescent']:s.phase===2?['flight','dive','crescent']:['flight','sword','crescent','dive'];
 s.pattern=order[s.cycle%order.length];s.cycle++;s.step=-1;
 enter(s,'approach',900,now,actors);
}
function nextStep(s:KnightBattle,now:number,actors:KnightActor[]){
 const old=s.stage,oldFrom=[...s.from] as KnightPoint,oldTo=[...s.to] as KnightPoint,oldHeight=s.height;
 if(old==='intro'||old==='rest'||old==='open'){nextPattern(s,now,actors);return;}
 if(old==='transition'){s.cycle=0;nextPattern(s,now,actors);return;}
 if(old==='return'){enter(s,'open',3200,now,actors);return;}
 s.step++;
 const recipe=recipes[s.pattern];let next=recipe[s.step];
 // The last phase combines the familiar double slash with a leap and wave.
 if(s.phase===3&&s.pattern==='sword')next=([...recipe.slice(0,4),...recipes.leap] as [KnightStage,number][])[s.step];
 if(s.phase===3&&s.pattern==='crescent')next=([...recipe.slice(0,2),...recipe] as [KnightStage,number][])[s.step];
 if(!next){nextPattern(s,now,actors);return;}
 // Wider attacks retain time to move out with the ordinary controls.
 const duration=next[0].endsWith('-warn')?Math.max(1300,(next[1]-(s.phase===3?180:0))*1.6):next[0]==='open'?next[1]*1.25:next[1];
 enter(s,next[0],duration,now,actors);
 if(old.endsWith('-warn')&&['slash','jump','dash','dive','shot'].includes(s.stage)){
  s.from=oldFrom;s.to=oldTo;s.height=oldHeight;
  if(s.stage==='slash')s.to=[...oldFrom];
  if(s.stage==='jump'||s.stage==='dive'){s.to[1]=0;}
 }
 if(old==='jump'||old==='dive'){s.from=[oldTo[0],0,oldTo[2]];s.to=[...s.from];}
 if(s.stage==='wave'||s.stage==='open'){s.height=0;s.from[1]=s.to[1]=0;}
}
function segmentDistance(a:KnightPoint,b:KnightPoint,p:KnightPoint){
 const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],n=dx*dx+dy*dy+dz*dz,t=n?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy+(p[2]-a[2])*dz)/n)):0;
 return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t,p[2]-a[2]-dz*t);
}
export function knightDanger(s:KnightBattle,a:KnightActor,now:number,previous=now){
 const p=knightPosition(s,now),d=distance(p,a.p),feet=a.p[1];
 if(s.stage==='slash')return d<KNIGHT.slashRadius+KNIGHT.bodyRadius&&Math.abs(feet-s.height)<1.5&&Math.cos(angle(p,a.p)-s.yaw)>Math.cos(KNIGHT.slashHalfAngle);
 if(s.stage==='dash'){
  const before=knightPosition(s,Math.max(s.since,previous));return Math.abs(feet-s.height)<1.5&&segmentDistance([before[0],0,before[2]],[p[0],0,p[2]],[a.p[0],0,a.p[2]])<KNIGHT.laneHalfWidth+KNIGHT.bodyRadius;
 }
 if(s.stage==='slam')return d<KNIGHT.impactRadius+KNIGHT.bodyRadius&&feet<2.5;
 if(s.stage==='wave'){
  const r=Math.max(0,now-s.since)*KNIGHT.waveSpeed,old=Math.max(0,previous-s.since)*KNIGHT.waveSpeed;
  return feet<KNIGHT.waveHeight&&d>=old-.6-KNIGHT.bodyRadius&&d<=r+.6+KNIGHT.bodyRadius;
 }
 return false;
}
/** Mutates only encounter state; returns true for state changes worth broadcasting. */
export function advanceKnightBattle(s:KnightBattle,actors:KnightActor[],now:number){
 const revision=s.revision;if(!knightBattleActive(s))return false;
 const alive=living(s,actors);if(!alive.length){enter(s,'lost',1e12,now,actors);return true;}
 // Never replay unseen damage after a background tab, reconnect or Worker wakeup.
 const previous=Math.max(s.checked,now-150);s.checked=now;
 let guard=0;while(now>=s.until&&guard++<32)nextStep(s,s.until,actors);
 if(guard>=32){nextPattern(s,now,actors);return true;}
 for(const a of alive){
  const p=s.players[a.id];
  if(s.stage==='shot'){
   const end=knightProjectile(s,now)!,begin=knightProjectile(s,Math.max(s.since,previous))!,center:KnightPoint=[a.p[0],a.p[1]+.85,a.p[2]];
   if(segmentDistance(begin,end,center)<KNIGHT.projectileRadius){
    const facing=Math.cos(angle(a.p,end)-a.yaw)>-.25;
    if(now-p.attackAt>=0&&now-p.attackAt<=KNIGHT.reflectMs&&facing){
     p.reflects++;const boss=knightPosition(s,now);s.returnFrom=[...end];enter(s,'return',450,now,actors);s.from=[boss[0],boss[1],boss[2]];s.to=[boss[0],0,boss[2]];s.yaw=angle(s.to,a.p);break;
    }
    if(now>=p.invulnerable){p.hp--;p.invulnerable=now+KNIGHT.invulnerableMs;s.revision++;}
   }
  }else if(knightDanger(s,a,now,previous)&&now>=p.invulnerable){p.hp--;p.invulnerable=now+KNIGHT.invulnerableMs;s.revision++;}
  if(p.hp<=0)continue;
  if(p.handled<p.attackAt&&now>=p.attackAt+140){
   p.handled=p.attackAt;const pos=knightPosition(s,now);
   if(s.stage==='open'&&!s.openHit&&now-p.attackAt<550&&distance(a.p,pos)<KNIGHT.meleeReach&&Math.abs(a.p[1]-pos[1])<1.6&&Math.cos(angle(a.p,pos)-a.yaw)>-.15){
    s.hp--;p.hits++;s.openHit=true;s.revision++;s.until=Math.min(s.until,now+550);
    if(s.hp<=0){enter(s,'won',1e12,now,actors);return true;}
    const phase=s.hp<=4?3:s.hp<=8?2:1;
    if(phase!==s.phase){s.phase=phase;enter(s,'transition',1500,now,actors);return true;}
   }
  }
 }
 if(!living(s,actors).length)enter(s,'lost',1e12,now,actors);
 return revision!==s.revision;
}
