import {KIRBY_VARIANTS} from './variant-palette';
import {KNIGHT,knightPosition,knightDanger,knightAttack,knightProjectile,type KnightActor,type KnightBattle,type KnightPoint,type KnightStage} from './meta-knight-battle';
import {HELPER,helperPosition,helperProjectile,helperOrbs,helperSegmentDistance,helperVulnerable} from './meta-knight-helper';
import {constrainKnightBody} from './meta-knight-body';
import {constrainKnightShield,crystalPoint} from './meta-knight-shield';
import {cosmicControlsLocked,cosmicHeight,cosmicPlayerPush} from './meta-knight-cosmic';
import {meteorPoint} from './meta-knight-cosmic-meteor';
import {refugeStar,cosmicRefugeStage} from './meta-knight-cosmic-refuge';

export const OPPONENTS={count:3,hearts:12,speed:6.8,thinkMs:180,reactionMs:260,parryChance:.56} as const;
export type KnightOpponent=KnightActor&{variant:number;goal:KnightPoint;thinkAt:number;seed:number;moving?:boolean;evade?:{since:number;p:KnightPoint};dashUntil?:number;dashReady?:number};
function random(seed:number){let x=Math.imul(seed^(seed>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967296;}
const distance=(a:KnightPoint,b:KnightPoint)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const facing=(a:KnightPoint,b:KnightPoint)=>Math.atan2(b[0]-a[0],b[2]-a[2]);

/** The full model palette is eligible, regardless of the fourteen meadow NPC slots. */
export function createKnightOpponents(seed:number,occupied:readonly (number|undefined)[]=[]):Record<string,KnightOpponent>{
 const pool=KIRBY_VARIANTS.map((v,i)=>i).filter(i=>KIRBY_VARIANTS[i][0]!=='Meta Knight'&&!occupied.includes(i)),result:Record<string,KnightOpponent>={};
 // If every other character is occupied, duplicates of human variants are preferable to an empty team.
 if(pool.length<OPPONENTS.count)for(let i=0;i<KIRBY_VARIANTS.length;i++)if(KIRBY_VARIANTS[i][0]!=='Meta Knight'&&!pool.includes(i))pool.push(i);
 for(let i=0;i<OPPONENTS.count;i++){
  const variant=pool.splice(Math.floor(random(seed+i*7919)*pool.length),1)[0],a=(i-1)*1.1,p:KnightPoint=[Math.sin(a)*11,0,Math.cos(a)*11];
  result[`knight-ai:${i}`]={id:`knight-ai:${i}`,p,yaw:Math.PI,available:true,variant,goal:[...p],seed:(seed|0)+i*7919,thinkAt:seed+OPPONENTS.reactionMs+i*80};
 }
 return result;
}
export function knightOpponentProfiles(s:KnightBattle|undefined){return Object.values(s?.opponents??{}).map(a=>({id:a.id,name:KIRBY_VARIANTS[a.variant][0],variant:a.variant,location:'meta-knight-arena' as const,p:a.p}));}

const warnings:Partial<Record<KnightStage,KnightStage>>={'slash-warn':'slash','dash-warn':'dash','jump-warn':'slam','dive-warn':'slam','cross-warn':'cross','ricochet-warn':'ricochet','star-warn':'star-fall','duet-warn':'duet-strike'};
/** Read the same visible telegraphs as a human; do not inspect future boss targets. */
function danger(s:KnightBattle,p:KnightPoint,now:number){
 const a:KnightActor={id:'probe',p,yaw:0,available:true};
 if(knightDanger(s,a,now+400,now))return true;
 const strike=warnings[s.stage];
 if(s.stage==='dash-warn'&&helperSegmentDistance([s.from[0],p[1],s.from[2]],[s.to[0],p[1],s.to[2]],p)<KNIGHT.laneHalfWidth*(s.phase===2?1.5:1)+1)return true;
 if(strike){const preview={...s,stage:strike,since:s.until,until:s.until+650};if(strike==='slam')preview.from=preview.to;if(knightDanger(preview,a,s.until+(strike==='ricochet'?650:200),s.until))return true;}
 for(const player of Object.values(s.players)){
  const c=player.helper?.cast;if(!c||now<c.at+OPPONENTS.reactionMs||now>c.release+HELPER.projectileMs)continue;
  if(c.ability===2&&now<c.end&&helperSegmentDistance(c.from,c.to,p)<HELPER.dashHalfWidth+1.1)return true;
  if(c.ability===1&&!c.returned){const q=helperProjectile(c,Math.max(c.release,now)),r=helperProjectile(c,Math.max(c.release,now)+650);if(q&&r&&helperSegmentDistance(q,r,[p[0],p[1]+.85,p[2]])<HELPER.shotRadius+1)return true;}
  if(c.ability===3){const q=helperOrbs(c,Math.max(c.release,now)),r=helperOrbs(c,Math.max(c.release,now)+650);if(q.some((v,i)=>helperSegmentDistance(v,r[i]??v,[p[0],p[1]+.85,p[2]])<HELPER.orbRadius+1))return true;}
 }
 return false;
}
function objective(s:KnightBattle,a:KnightOpponent,actors:KnightActor[],now:number):{p:KnightPoint;attack:boolean}{
 for(const enemy of actors){const h=s.players[enemy.id]?.helper;if(h&&s.players[enemy.id].hp>0&&!s.players[enemy.id].withdrawn&&helperVulnerable(h,now)){
  const p=helperPosition(h,now)??enemy.p;if(distance(a.p,p)<18)return {p,attack:true};
 }}
 if(s.stage==='shield'&&s.activeCrystal!==undefined)return {p:crystalPoint(s.activeCrystal,undefined,0),attack:true};
 if(s.pattern==='star')return {p:[...a.p],attack:false};
 if(cosmicRefugeStage(s))return {p:refugeStar(s,now),attack:s.stage==='cosmic-star-open'};
 const boss=knightPosition(s,now),attack=['open','cosmic-open','duet-recover'].includes(s.stage);
 if(attack)return {p:boss,attack:true};
 const angle=facing(boss,a.p),radius=s.phase===4?16:15;
 return {p:[boss[0]+Math.sin(angle)*radius,a.p[1],boss[2]+Math.cos(angle)*radius],attack:false};
}
function constrain(s:KnightBattle,p:KnightPoint,previous:KnightPoint,now:number){
 const r=Math.hypot(p[0],p[2]);if(r>43){p[0]*=43/r;p[2]*=43/r;}
 constrainKnightBody(s,p,now,previous);constrainKnightShield(s,p,previous);
}

/** Server-owned, serializable decisions; capped time prevents teleporting after a suspended tab. */
export function advanceKnightOpponents(s:KnightBattle,humans:KnightActor[],now:number):KnightActor[]{
 const bots=Object.values(s.opponents??{}),actors=[...humans,...bots],dt=Math.max(0,Math.min(150,now-s.checked))/1000;
 for(const a of bots){
  const player=s.players[a.id];a.moving=false;if(!player||player.hp<=0||player.withdrawn)continue;
  a.p[1]=cosmicHeight(s,now);
  if(cosmicControlsLocked(s)){const push=cosmicPlayerPush(s,a.id,now);if(push)a.p=[push.point[0],a.p[1],push.point[2]];continue;}
  if(['intro','transition','side-choice'].includes(s.stage))continue;
  if(a.evade?.since!==s.since||s.stage==='shield'||s.phase===4)delete a.evade;
  let target=a.evade?{p:a.evade.p,attack:false}:objective(s,a,actors,now);const reacted=now>=s.since+OPPONENTS.reactionMs+random(a.seed)*160;
  if(now>=a.thinkAt){
   // A distant safe point supplies an escape direction even if every short step is still inside a wide telegraph.
   if(reacted&&danger(s,a.p,now)){
    let nearest=Infinity,safe:KnightPoint|undefined;
    for(let ring=1;ring<=4;ring++)for(let i=0;i<24;i++){
     const angle=i*Math.PI/12,p:KnightPoint=[a.p[0]+Math.sin(angle)*ring*4,a.p[1],a.p[2]+Math.cos(angle)*ring*4];
     if(Math.hypot(p[0],p[2])>43||danger(s,p,now))continue;
     const d=distance(a.p,p);if(d<nearest){safe=p;nearest=d;}
    }
    if(safe){target={p:safe,attack:false};a.evade={since:s.since,p:safe};if(s.stage==='ricochet-warn'&&now>=(a.dashReady??0)){a.dashUntil=now+550;a.dashReady=now+4000;}}
   }
   a.thinkAt=now+OPPONENTS.thinkMs;let best:KnightPoint=[...a.p],score=Infinity;
   const direct=facing(a.p,target.p),stride=OPPONENTS.speed*(s.phase===4?2:1)*1.1;
   for(let i=-1;i<16;i++){
    const yaw=direct+i*Math.PI/8,p:KnightPoint=i<0?[...a.p]:[a.p[0]+Math.sin(yaw)*stride,a.p[1],a.p[2]+Math.cos(yaw)*stride];constrain(s,p,a.p,now);
    const separation=bots.reduce((n,b)=>n+(b!==a?Math.max(0,2.4-distance(p,b.p)):0),0);
    const value=distance(p,target.p)+(reacted&&danger(s,p,now)?80:0)+separation*1.8+(i<0?.3:0);
    if(value<score){score=value;best=p;}
   }
   a.goal=best;
  }
  const before:KnightPoint=[...a.p],d=distance(a.p,a.goal),step=Math.min(d,dt*OPPONENTS.speed*(s.phase===4?2:1)*(now<(a.dashUntil??0)?1.8:1));
  if(d>.03){a.yaw=facing(a.p,a.goal);a.p[0]+=Math.sin(a.yaw)*step;a.p[2]+=Math.cos(a.yaw)*step;constrain(s,a.p,before,now);a.moving=distance(before,a.p)>.001;}
  if(target.attack&&distance(a.p,target.p)<KNIGHT.meleeReach-.25&&reacted){a.yaw=facing(a.p,target.p);knightAttack(s,a,now);}
  // Imperfect parries are decided once per projectile, never rerolled each frame.
  const shots=[{point:knightProjectile(s,now+120)??meteorPoint(s,now+120),from:knightPosition(s,now),at:s.since},...humans.flatMap(h=>{const c=s.players[h.id]?.helper?.cast;return c?.ability===1&&!c.returned?[{point:helperProjectile(c,now+120),from:c.from,at:c.release}]:[];})];
  for(const shot of shots)if(shot.point&&random(a.seed+(shot.at|0))<OPPONENTS.parryChance&&distance(a.p,shot.point)<3.8&&Math.abs(a.p[1]+.85-shot.point[1])<3){a.yaw=facing(a.p,shot.from);knightAttack(s,a,now);}
 }
 return actors;
}
