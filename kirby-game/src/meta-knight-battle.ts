/** Shared encounter rules. Coordinates are local to the cosmic arena; time is ms. */
import {META_KNIGHT_ARENA,insideKnightFightingArea,type KnightArenaSide} from './meta-knight-arena-site';
import {STAR_SEQUENCE,starSequence,starPosition,starDanger,STAR_ASSAULT,planStarRoute,lockStarFlight,lockStarCross,crossWarningDuration} from './meta-knight-star-assault';
import {SHIELD,crystalPoint,chooseShieldCrystal} from './meta-knight-shield';
export type KnightPoint=[number,number,number];
export type KnightActor={id:string;p:KnightPoint;yaw:number;available:boolean};
export type KnightStage='intro'|'approach'|'slash-warn'|'slash'|'jump-warn'|'jump'|'slam'|'wave'|'dash-warn'|'dash'|'dive-warn'|'dive'|'shot-warn'|'shot'|'return'|'open'|'rest'|'stunned'|'get-up'|'transition'|'won'|'lost'|'cancelled'|'star-rise'|'cross-warn'|'cross'|'ricochet-warn'|'ricochet'|'star-warn'|'star-fall'|'shield'|'crystal-break';
export type KnightPlayer={hp:number;invulnerable:number;attackAt:number;handled:number;hits:number;reflects:number;withdrawn?:boolean};
export type KnightCross={pairs:[[number,number],[number,number]];side:0|1};
export type KnightImpactWave={at:number;origin:KnightPoint};
export type KnightBattle={id:number;revision:number;stage:KnightStage;since:number;until:number;checked:number;phase:1|2|3;hp:number;teamHp?:number;players:Record<string,KnightPlayer>;target:string;from:KnightPoint;to:KnightPoint;yaw:number;height:number;cycle:number;step:number;pattern:'sword'|'leap'|'flight'|'dive'|'crescent'|'star';openHit:boolean;impactWave?:KnightImpactWave;returnFrom?:KnightPoint;shotContacts?:Record<string,number>;rewarded?:boolean;activeCrystal?:number;brokenCrystals?:number;lastCrystal?:number;starRoute?:number[];starAims?:KnightPoint[];starCross?:KnightCross};
export const KNIGHT={effectScale:2,modelScale:3.3,health:12,hearts:5,introMs:3000,hitStunMs:1000,getUpMs:260,reflectMs:300,parryGraceMs:160,shotReleaseMs:220,shotLaunchMs:160,aimLockMs:260,hoverHeight:1.2,attackCooldown:650,invulnerableMs:1200,bodyRadius:.65,slashRadius:11.6,slashHalfAngle:1.05,laneHalfWidth:3,impactRadius:5,waveSpeed:.014,waveHeight:.85,projectileRadius:2.4,projectileWidthScale:1.6,projectileSpeed:.028,projectileHeight:1.2,meleeReach:4.8,shotHiltY:.55,shotHiltZ:1.32,bladeLength:Math.hypot(.315,2.05)} as const;
export function knightBattleActive(s:KnightBattle|undefined){return !!s&&!['won','lost','cancelled'].includes(s.stage);}
/** Old room snapshots inherit the lowest remaining health, never extra lives. */
export function knightPartyHearts(s:KnightBattle|undefined){return Math.max(0,Math.min(KNIGHT.hearts,s?.teamHp??Math.min(KNIGHT.hearts,...Object.values(s?.players??{}).map(p=>p.hp))));}
/** Server time keeps the local and remote damage flicker in the same phase. */
export function knightPlayerVisible(s:KnightBattle|undefined,id:string,now:number,withdrawn=false){const p=s?.players[id];return !knightBattleActive(s)||!p||p.hp<=0||p.withdrawn||withdrawn||now>=p.invulnerable||Math.floor(now/95)%2===0;}
/** The start snapshot keeps both sides of the gate fixed until the whole duel ends. */
export function knightArenaSide(s:KnightBattle|undefined,id:string):KnightArenaSide|undefined{return knightBattleActive(s)?s!.players[id]?'arena':'annex':undefined;}
export const KNIGHT_PHASE_HEALTH={1:12,2:8,3:4} as const;
export function knightDashHalfWidth(s:KnightBattle){return KNIGHT.laneHalfWidth*(s.phase===2?1.5:1);}
/** The landing ring keeps its own origin and clock while the duel continues. */
export function knightPressureWave(s:KnightBattle,now:number){
 if(!knightBattleActive(s))return;
 const wave=s.impactWave??(s.stage==='wave'?{at:s.since,origin:s.from}:undefined);if(!wave)return;
 const until=wave.at+(Math.hypot(wave.origin[0],wave.origin[2])+META_KNIGHT_ARENA.radius+SHIELD.waveHalfWidth)/KNIGHT.waveSpeed;
 if(now<wave.at||now>=until)return;
 return {...wave,radius:(now-wave.at)*KNIGHT.waveSpeed,until};
}
const distance=(a:KnightPoint,b:KnightPoint)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const clamp=(p:KnightPoint,r=31):KnightPoint=>{const d=Math.hypot(p[0],p[2]);return d>r?[p[0]*r/d,p[1],p[2]*r/d]:[...p];};
const angle=(a:KnightPoint,b:KnightPoint)=>Math.atan2(b[0]-a[0],b[2]-a[2]);
const mix=(a:KnightPoint,b:KnightPoint,t:number):KnightPoint=>a.map((v,i)=>v+(b[i]-v)*t) as KnightPoint;
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const warningDuration=(ms:number,phase:number)=>Math.max(1300,(ms-(phase===3?180:0))*1.6);
export function knightProgress(s:KnightBattle,now:number){return Math.max(0,Math.min(1,(now-s.since)/Math.max(1,s.until-s.since)));}
export function knightPosition(s:KnightBattle,now:number):KnightPoint{
 const star=starPosition(s,now);if(star)return star;
 const t=knightProgress(s,now),p=['approach','jump','dash','dive','return'].includes(s.stage)?mix(s.from,s.to,t):[...s.from] as KnightPoint;
 if(s.stage==='cancelled')return [0,0,-9];
 if(s.stage==='jump')p[1]+=Math.sin(t*Math.PI)*5;
 if(s.stage==='dive-warn')p[1]+=Math.sin(t*Math.PI/2)*5;
 if(s.stage==='dive')p[1]+=5*(1-t);
 if(['slash-warn','slash','dash-warn','dash','shot'].includes(s.stage))p[1]=s.height;
 if(s.stage==='shot-warn')p[1]=s.from[1]+(s.height-s.from[1])*smooth((now-s.since)/450);
 if(s.stage==='rest'&&s.pattern==='crescent')p[1]*=1-smooth(t);
 return p;
}
export function knightShotOrigin(s:KnightBattle):KnightPoint{const dy=(KNIGHT.projectileHeight-s.height)/KNIGHT.modelScale-KNIGHT.shotHiltY,reach=(KNIGHT.shotHiltZ+Math.sqrt(Math.max(0,KNIGHT.bladeLength**2-dy**2)))*KNIGHT.modelScale;return [s.from[0]+Math.sin(s.yaw)*reach,KNIGHT.projectileHeight,s.from[2]+Math.cos(s.yaw)*reach];}
/** Continue the locked ray past the player until the whole blade clears the rim. */
export function knightShotPath(s:KnightBattle){
 const origin=knightShotOrigin(s),x=Math.sin(s.yaw),z=Math.cos(s.yaw),b=origin[0]*x+origin[2]*z,r=META_KNIGHT_ARENA.radius+KNIGHT.projectileRadius;
 const travel=Math.max(0,-b+Math.sqrt(Math.max(0,b*b+r*r-origin[0]**2-origin[2]**2)));
 return {origin,end:[origin[0]+x*travel,KNIGHT.projectileHeight,origin[2]+z*travel] as KnightPoint,duration:travel/KNIGHT.projectileSpeed};
}
export function knightProjectile(s:KnightBattle,now:number):KnightPoint|undefined{
 if(s.stage==='shot'){const elapsed=now-s.since-KNIGHT.shotReleaseMs;if(elapsed<0)return;const path=knightShotPath(s);if(elapsed>path.duration)return;return mix(path.origin,path.end,Math.min(1,elapsed/Math.max(1,path.duration)));}
 if(s.stage==='return'&&s.returnFrom)return mix([s.returnFrom[0],KNIGHT.projectileHeight,s.returnFrom[2]],[s.to[0],KNIGHT.projectileHeight,s.to[2]],knightProgress(s,now));
}
const recipes:Record<KnightBattle['pattern'],[KnightStage,number][]>={
 sword:[['slash-warn',1000],['slash',250],['slash-warn',750],['slash',250],['open',2200]],
 leap:[['jump-warn',1000],['jump',850],['open',3200]],
 flight:[['dash-warn',1000],['dash',700],['dash-warn',850],['dash',700],['open',2100]],
 dive:[['dive-warn',1200],['dive',450],['open',2400]],
 crescent:[['shot-warn',1100],['shot',1800],['shot-warn',1100],['shot',1800],['shot-warn',1100],['shot',1800],['rest',650]],
 star:STAR_SEQUENCE,
};
/** Both jumps land directly in their seated counterattack opening. */
export function knightJumpOpening(s:KnightBattle){return s.stage==='open'&&(s.pattern==='leap'||s.pattern==='dive');}
/** The circular warning counts all the way through flight to the sword impact. */
export function knightImpactProgress(s:KnightBattle,now:number){
 const dive=s.stage.startsWith('dive'),recipe=recipes[dive?'dive':'leap'],warning=warningDuration(recipe[0][1],s.phase),air=recipe[1][1];
 if(s.stage==='jump-warn'||s.stage==='dive-warn'){const duration=s.until-s.since;return knightProgress(s,now)*duration/(duration+air);}
 if(s.stage==='jump'||s.stage==='dive')return (warning+knightProgress(s,now)*(s.until-s.since))/(warning+s.until-s.since);
 return s.stage==='slam'?1:0;
}
export function knightStartCount(s:KnightBattle|undefined,now:number):'3'|'2'|'1'|'fight'|undefined{
 if(!s)return;
 if(s.stage==='intro')return String(Math.max(1,Math.min(3,Math.ceil((s.until-now)/1000)))) as '3'|'2'|'1';
 if(s.stage==='approach'&&s.phase===1&&s.cycle===1&&s.since===s.id+KNIGHT.introMs&&now-s.since<600)return 'fight';
}
function living(s:KnightBattle,actors:KnightActor[]){return actors.filter(a=>a.available&&s.players[a.id]?.hp>0&&!s.players[a.id].withdrawn);}
function target(s:KnightBattle,actors:KnightActor[]){const alive=living(s,actors);return alive.find(a=>a.id===s.target)??alive[0];}
export function startKnightBattle(actors:KnightActor[],owner:string,now:number):KnightBattle|undefined{
 const a=actors.find(a=>a.id===owner&&a.available&&distance(a.p,[0,0,-9])<9&&a.p[1]<1);
 if(!a)return;
 const players:KnightBattle['players']={};for(const actor of actors)if(actor.available&&insideKnightFightingArea(actor.p))players[actor.id]={hp:5,invulnerable:0,attackAt:-1e9,handled:-1e9,hits:0,reflects:0};
 return {id:now,revision:1,stage:'intro',since:now,until:now+KNIGHT.introMs,checked:now,phase:1,hp:12,...(Object.keys(players).length>1?{teamHp:KNIGHT.hearts}:{}),players,target:owner,from:[0,0,-9],to:[0,0,-9],yaw:0,height:0,cycle:0,step:-1,pattern:'sword',openHit:false};
}
/** Health is shared; contact immunity and hit feedback belong to the struck player. */
function damageKnightPlayer(s:KnightBattle,id:string,now:number){
 const p=s.players[id];if(p.hp<=0||p.withdrawn||now<p.invulnerable)return;
 if(s.teamHp!==undefined){s.teamHp=Math.max(0,s.teamHp-1);for(const player of Object.values(s.players))player.hp=s.teamHp;}
 else p.hp=Math.max(0,p.hp-1);
 p.invulnerable=now+KNIGHT.invulnerableMs;s.revision++;
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
 const p=knightPosition(s,now),a=target(s,actors);s.from=[...p];s.to=[...s.from];s.stage=stage;s.since=now;s.until=now+ms;s.openHit=false;delete s.shotContacts;s.revision++;
 if(['won','lost','cancelled'].includes(stage))delete s.impactWave;
 if(!a||s.pattern==='star')return;
 if(stage.endsWith('-warn')){
  s.yaw=angle(s.from,a.p);s.height=stage==='shot-warn'?KNIGHT.hoverHeight:stage==='dash-warn'?Math.max(.5,Math.min(3,a.p[1])):0;
  s.to=[...s.from];
  if(stage==='jump-warn'||stage==='dive-warn'||stage==='shot-warn')s.to=clamp([a.p[0],a.p[1],a.p[2]],stage==='shot-warn'?META_KNIGHT_ARENA.radius:31);
  if(stage==='dash-warn'){
   const direction=s.phase===3&&s.step===2?s.yaw+Math.PI/2:s.yaw;
   s.yaw=direction;const x=Math.sin(direction),z=Math.cos(direction),radius=META_KNIGHT_ARENA.radius+6,b=s.from[0]*x+s.from[2]*z;
   const rim=Math.max(0,-b+Math.sqrt(Math.max(0,b*b+radius*radius-s.from[0]**2-s.from[2]**2))),d=Math.min(rim,Math.max(22,distance(s.from,a.p)+10));
   s.to=[s.from[0]+x*d,0,s.from[2]+z*d];
  }
 }
 if(stage==='approach'){
  const d=Math.max(.1,distance(s.from,a.p)),end:KnightPoint=[a.p[0]+(s.from[0]-a.p[0])/d*9.4,0,a.p[2]+(s.from[2]-a.p[2])/d*9.4];s.to=clamp(end);s.yaw=angle(s.from,a.p);
 }
}
function nextPattern(s:KnightBattle,now:number,actors:KnightActor[]){
 const alive=living(s,actors);s.target=alive[s.cycle%Math.max(1,alive.length)]?.id??s.target;
 if(s.phase===3){s.pattern='star';s.cycle++;s.step=0;delete s.starCross;enter(s,'star-rise',STAR_SEQUENCE[0][1],now,actors);planStarRoute(s,target(s,actors)?.p??[0,0,1]);s.to=crystalPoint(s.starRoute![0],STAR_ASSAULT.ricochetRadius,STAR_ASSAULT.hover);s.yaw=angle(s.from,s.to);return;}
 const order:KnightBattle['pattern'][]=s.phase===1?['sword','leap','crescent']:['flight','dive','crescent'];
 s.pattern=order[s.cycle%order.length];s.cycle++;s.step=-1;
 if(s.pattern==='leap'){s.step=0;enter(s,'jump-warn',warningDuration(recipes.leap[0][1],s.phase),now,actors);return;}
 enter(s,'approach',900,now,actors);
}
/** Both melee and returned crescents use the same phase and victory boundaries. */
function finishKnightDamage(s:KnightBattle,now:number,actors:KnightActor[]){
 if(s.hp<=0){enter(s,'won',1e12,now,actors);return true;}
 const phase=s.hp<=4?3:s.hp<=8?2:1;
 if(phase!==s.phase){s.phase=phase;enter(s,'transition',1500,now,actors);return true;}
 return false;
}
function damageKnight(s:KnightBattle,now:number,actors:KnightActor[],reaction?:'stunned'|'crystal-break'){
 s.hp--;s.revision++;
 if(reaction){enter(s,reaction,KNIGHT.hitStunMs,now,actors);s.from[1]=s.to[1]=s.height=0;return true;}
 return finishKnightDamage(s,now,actors);
}
/** Local duel command: replace the phase without carrying an old attack across. */
export function setKnightPhase(s:KnightBattle,phase:1|2|3,actors:KnightActor[],now:number){
 if(!knightBattleActive(s)||![1,2,3].includes(phase)||!living(s,actors).length)return false;
 enter(s,'transition',1500,now,actors);s.phase=phase;s.hp=KNIGHT_PHASE_HEALTH[phase];
 s.checked=now;s.cycle=0;s.step=-1;s.pattern='sword';s.height=0;
 delete s.returnFrom;delete s.shotContacts;
 delete s.impactWave;
 delete s.activeCrystal;delete s.lastCrystal;delete s.starRoute;delete s.starAims;delete s.starCross;s.brokenCrystals=0;
 for(const p of Object.values(s.players))p.handled=p.attackAt;
 return true;
}
function nextStep(s:KnightBattle,now:number,actors:KnightActor[]){
 const old=s.stage,oldFrom=[...s.from] as KnightPoint,oldTo=[...s.to] as KnightPoint,oldHeight=s.height;
 const starFrom=s.pattern==='star'?knightPosition(s,now):undefined;
 if(old==='stunned'||old==='crystal-break'){if(s.hp<=0){finishKnightDamage(s,now,actors);return;}enter(s,'get-up',KNIGHT.getUpMs,now,actors);return;}
 if(old==='get-up'){if(finishKnightDamage(s,now,actors))return;delete s.activeCrystal;nextPattern(s,now,actors);return;}
 if(old==='intro'||old==='rest'||old==='open'){delete s.activeCrystal;nextPattern(s,now,actors);return;}
 if(old==='transition'){s.cycle=0;nextPattern(s,now,actors);return;}
 if(old==='return'){damageKnight(s,now,actors,'stunned');return;}
 s.step++;
 const recipe=s.pattern==='star'?starSequence(s):recipes[s.pattern],next=recipe[s.step];
 if(!next){nextPattern(s,now,actors);return;}
 // Wider attacks retain time to move out with the ordinary controls.
 const duration=s.pattern==='star'?next[1]:next[0]==='shot-warn'?next[1]-(s.phase===3?200:0):next[0].endsWith('-warn')?warningDuration(next[1],s.phase):next[0]==='open'?next[1]*1.25:next[1];
 enter(s,next[0],duration,now,actors);
 if(starFrom&&s.pattern==='star')s.from=starFrom;
 if(s.stage==='cross-warn'){const p=target(s,actors)?.p??[0,0,1];lockStarCross(s,p);s.until=s.since+Math.max(crossWarningDuration(s,p),...living(s,actors).map(a=>crossWarningDuration(s,a.p)));}
 if(s.stage==='ricochet-warn')lockStarFlight(s,target(s,actors)?.p??[0,0,1]);
 if(old.endsWith('-warn')&&['slash','jump','dash','dive','shot'].includes(s.stage)){
  s.from=oldFrom;s.to=oldTo;s.height=oldHeight;
  if(s.stage==='slash')s.to=[...oldFrom];
  if(s.stage==='jump'||s.stage==='dive'){s.to[1]=0;}
  if(s.stage==='shot')s.until=s.since+Math.max(1000,KNIGHT.shotReleaseMs+knightShotPath(s).duration+KNIGHT.parryGraceMs);
  if(s.stage==='dash')s.until=s.since+Math.max(700,distance(s.from,s.to)/.075);
 }
 if(old==='jump'||old==='dive'){s.from=[oldTo[0],0,oldTo[2]];s.to=[...s.from];}
 if(s.stage==='wave'||s.stage==='open'){s.height=0;s.from[1]=s.to[1]=0;}
 if(old==='dive')s.impactWave={at:now,origin:[...s.from]};
 if(s.pattern==='star'&&s.stage==='open'){s.from=s.to=[0,0,0];}
 if(s.stage==='shield'){s.from=s.to=[0,0,0];s.activeCrystal=chooseShieldCrystal(s);}
}
function resolveCrescent(s:KnightBattle,alive:KnightActor[],actors:KnightActor[],now:number,previous:number,protectedPlayer?:string){
 const flight=knightShotPath(s),end=knightProjectile(s,now)??(now>=s.since+KNIGHT.shotReleaseMs?flight.end:undefined);if(!end)return;
 const origin=flight.origin,finished=s.since+KNIGHT.shotReleaseMs+flight.duration,begin=knightProjectile(s,Math.max(s.since,previous))??(previous>=finished?flight.end:origin),contacts=s.shotContacts??={};
 const dx=flight.end[0]-origin[0],dz=flight.end[2]-origin[2],d=Math.hypot(dx,dz)||1,x=dx/d,z=dz/d;
 const space=(p:KnightPoint):KnightPoint=>[(p[0]-origin[0])*x+(p[2]-origin[2])*z,p[1],((p[0]-origin[0])*z-(p[2]-origin[2])*x)/KNIGHT.projectileWidthScale];
 const first=space(begin),last=space(end),release=s.since+KNIGHT.shotReleaseMs,launching=now>=release&&previous<=release+KNIGHT.shotLaunchMs;
 const root=space([s.from[0],KNIGHT.projectileHeight,s.from[2]]),touching=previous<finished?alive.filter(a=>{const p=space([a.p[0],a.p[1]+.85,a.p[2]]);return segmentDistance(first,last,p)<KNIGHT.projectileRadius||launching&&segmentDistance(root,space(origin),p)<KNIGHT.projectileRadius;}):[];
 // Resolve every possible parry before applying any damage, including contact grace.
 const reflector=alive.find(a=>{
  const p=s.players[a.id],contact=contacts[a.id];
  const close=segmentDistance(root,space(origin),space([a.p[0],a.p[1]+.85,a.p[2]]))<KNIGHT.projectileRadius;
  const facing=close&&distance(a.p,s.from)<KNIGHT.bodyRadius||Math.cos(angle(a.p,close?s.from:origin)-a.yaw)>-.25;
  return contact!==-1&&(touching.includes(a)||contact!==undefined&&now-contact<=KNIGHT.parryGraceMs)&&now>=p.attackAt&&now-p.attackAt<=KNIGHT.reflectMs&&facing;
 });
 if(reflector){
  s.players[reflector.id].reflects++;const boss=knightPosition(s,now);s.returnFrom=[...end];enter(s,'return',450,now,actors);s.from=[...boss];s.to=[boss[0],0,boss[2]];s.yaw=angle(s.to,reflector.p);return;
 }
 for(const a of touching)if(now>=s.players[a.id].invulnerable&&contacts[a.id]===undefined){contacts[a.id]=now;s.revision++;}
 for(const a of alive)if(contacts[a.id]!==undefined&&contacts[a.id]>=0&&now-contacts[a.id]>=KNIGHT.parryGraceMs&&now>=s.players[a.id].invulnerable){
  if(a.id!==protectedPlayer)damageKnightPlayer(s,a.id,now);contacts[a.id]=-1;s.revision++;
 }
}
function segmentDistance(a:KnightPoint,b:KnightPoint,p:KnightPoint){
 const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],n=dx*dx+dy*dy+dz*dz,t=n?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy+(p[2]-a[2])*dz)/n)):0;
 return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t,p[2]-a[2]-dz*t);
}
export function knightDanger(s:KnightBattle,a:KnightActor,now:number,previous=now){
 const wave=knightPressureWave(s,now);
 if(wave){const d=distance(wave.origin,a.p),old=Math.max(0,previous-wave.at)*KNIGHT.waveSpeed;
  if(a.p[1]<KNIGHT.waveHeight&&d>=old-SHIELD.waveHalfWidth-KNIGHT.bodyRadius&&d<=wave.radius+SHIELD.waveHalfWidth+KNIGHT.bodyRadius)return true;
 }
 if(s.pattern==='star')return starDanger(s,a.p,now,previous,KNIGHT.bodyRadius);
 // Marked attacks cover their floor footprint at every height. Only the low ring is jumpable.
 const p=knightPosition(s,now),d=distance(p,a.p);
 if(s.stage==='slash')return d<KNIGHT.slashRadius+KNIGHT.bodyRadius&&Math.cos(angle(p,a.p)-s.yaw)>Math.cos(KNIGHT.slashHalfAngle);
 if(s.stage==='dash'){
  const before=knightPosition(s,Math.max(s.since,previous));return segmentDistance([before[0],0,before[2]],[p[0],0,p[2]],[a.p[0],0,a.p[2]])<knightDashHalfWidth(s)+KNIGHT.bodyRadius;
 }
 if(s.stage==='slam'||knightJumpOpening(s)&&previous<=s.since&&now-s.since<150)return d<KNIGHT.impactRadius+KNIGHT.bodyRadius;
 return false;
}
/** Mutates only encounter state; returns true for state changes worth broadcasting. */
export function advanceKnightBattle(s:KnightBattle,actors:KnightActor[],now:number,protectedPlayer?:string){
 const revision=s.revision;if(!knightBattleActive(s))return false;
 if(s.teamHp===undefined&&Object.keys(s.players).length>1){s.teamHp=knightPartyHearts(s);s.revision++;}
 // Keep player health as a projection for movement, defeat poses and older clients.
 if(s.teamHp!==undefined)for(const p of Object.values(s.players))if(p.hp!==s.teamHp){p.hp=s.teamHp;s.revision++;}
 if(s.impactWave&&!knightPressureWave(s,now)&&now>=s.impactWave.at){delete s.impactWave;s.revision++;}
 const alive=living(s,actors);if(!alive.length){enter(s,'lost',1e12,now,actors);return true;}
 // Never replay unseen damage after a background tab, reconnect or Worker wakeup.
 const previous=Math.max(s.checked,now-150);s.checked=now;
 let guard=0;while(now>=s.until&&guard++<32)nextStep(s,s.until,actors);
 if(guard>=32){nextPattern(s,now,actors);return true;}
 if(s.stage==='shot-warn'&&now<s.until-KNIGHT.aimLockMs){
  const a=target(s,actors);if(a){const aim=clamp([...a.p],META_KNIGHT_ARENA.radius),yaw=angle(s.from,a.p);if(distance(aim,s.to)>.02||Math.abs(yaw-s.yaw)>.005||Math.abs(aim[1]-s.to[1])>.02){s.to=aim;s.yaw=yaw;s.revision++;}}
 }
 if(s.stage==='shot')resolveCrescent(s,alive,actors,now,previous,protectedPlayer);
 for(const a of alive){
  const p=s.players[a.id];
  if(a.id!==protectedPlayer&&knightDanger(s,a,now,previous)&&now>=p.invulnerable)damageKnightPlayer(s,a.id,now);
 }
 if(!living(s,actors).length){enter(s,'lost',1e12,now,actors);return true;}
 // A counterattack must not skip another fighter's independent wave contact.
 for(const a of alive){
  const p=s.players[a.id];
  if(p.hp<=0)continue;
  if(p.handled<p.attackAt&&now>=p.attackAt+140){
   p.handled=p.attackAt;const pos=knightPosition(s,now);
   if(s.stage==='shield'&&s.activeCrystal!==undefined&&now-p.attackAt<550){
    const crystal=crystalPoint(s.activeCrystal,undefined,0);
    if(distance(a.p,crystal)<KNIGHT.meleeReach&&a.p[1]<3.8&&Math.cos(angle(a.p,crystal)-a.yaw)>-.15){
     s.lastCrystal=s.activeCrystal;s.brokenCrystals=(s.brokenCrystals??0)|(1<<s.activeCrystal);delete s.activeCrystal;p.hits++;
     damageKnight(s,now,actors,'crystal-break');s.from=s.to=[0,0,0];return true;
    }
   }
   // Scale vertical melee reach with the enlarged boss so jumps and normal flight can connect.
   if(s.phase!==3&&s.stage==='open'&&!s.openHit&&now-p.attackAt<550&&distance(a.p,pos)<KNIGHT.meleeReach&&Math.abs(a.p[1]-pos[1])<1.6*KNIGHT.effectScale&&Math.cos(angle(a.p,pos)-a.yaw)>-.15){
    p.hits++;damageKnight(s,now,actors,'stunned');return true;
   }
  }
 }
 if(!living(s,actors).length)enter(s,'lost',1e12,now,actors);
 return revision!==s.revision;
}
