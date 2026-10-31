import {projectKnightFightersFinale} from './meta-knight-fighters-finale';
import {TURN_RATE} from './movement-input';
import {KIRBY_VARIANTS} from './variant-palette';
import {KNIGHT,knightPosition,knightDanger,knightAttack,knightProjectile,knightShotPath,type KnightActor,type KnightBattle,type KnightPoint,type KnightStage} from './meta-knight-battle';
import {HELPER,helperPosition,helperProjectile,helperOrbs,helperSegmentDistance,helperVulnerable} from './meta-knight-helper';
import {constrainKnightBody} from './meta-knight-body';
import {constrainKnightShield,crystalPoint} from './meta-knight-shield';
import {cosmicControlsLocked,cosmicHeight,cosmicPlayerPush} from './meta-knight-cosmic';
import {meteorPoint} from './meta-knight-cosmic-meteor';
import {refugeStar,cosmicRefugeStage} from './meta-knight-cosmic-refuge';
import {KNIGHT_CONTACT,knightBumpDistance,knightBumpActive,startKnightBump,constrainKnightCrowd,separateKnightOpponents,type KnightShove} from './meta-knight-opponents-contact';
import {knightPlayerPushable} from './meta-knight-push';
import {pushTarget} from './push-target';
import {knightLifeFireflyPoint} from './meta-knight-life-firefly';

export const OPPONENTS={count:3,hearts:16,speed:6.8,thinkMs:180,reactionMs:260,parryChance:.56,heartChance:.28,punishChance:.46} as const;
export type KnightOpponent=KnightActor&{variant:number;goal:KnightPoint;thinkAt:number;seed:number;moving?:boolean;turning?:number;evade?:{since:number;p:KnightPoint};dashUntil?:number;dashReady?:number;shove?:KnightShove;shoveReady?:number};
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
  result[`knight-ai:${i}`]={id:`knight-ai:${i}`,p,yaw:Math.PI,available:true,variant,goal:[...p],seed:(seed|0)+i*7919,thinkAt:seed+OPPONENTS.reactionMs+i*80,shoveReady:seed+3500+i*1100};
 }
 return result;
}
export function knightOpponentProfiles(s:KnightBattle|undefined){return Object.values(s?.opponents??{}).map(a=>({id:a.id,name:KIRBY_VARIANTS[a.variant][0],variant:a.variant,location:'meta-knight-arena' as const,p:a.p}));}

const warnings:Partial<Record<KnightStage,KnightStage>>={'slash-warn':'slash','dash-warn':'dash','jump-warn':'slam','dive-warn':'slam','cross-warn':'cross','ricochet-warn':'ricochet','star-warn':'star-fall','duet-warn':'duet-strike'};
/** Read the same visible telegraphs as a human; do not inspect future boss targets. */
function danger(s:KnightBattle,p:KnightPoint,now:number,parryBoss=false){
 const a:KnightActor={id:'probe',p,yaw:0,available:true};
 if(knightDanger(s,a,now+400,now))return true;
 if(!parryBoss&&(s.stage==='shot-warn'||s.stage==='shot')){
  const ray=knightShotPath(s),dx=Math.sin(s.yaw),dz=Math.cos(s.yaw),x=p[0]-ray.origin[0],z=p[2]-ray.origin[2],along=x*dx+z*dz,length=distance(ray.origin,ray.end);
  if(along>=-KNIGHT.projectileRadius&&along<=length+KNIGHT.projectileRadius&&Math.abs(x*dz-z*dx)<KNIGHT.projectileRadius*KNIGHT.projectileWidthScale+KNIGHT.bodyRadius)return true;
 }
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
 const bug=s.lifeFirefly,heart=knightLifeFireflyPoint(s,now);
 // One stable decision per visitor, including after reconnects; unreachable high detours are ignored.
 if(bug&&heart&&random(a.seed^(bug.at|0))<OPPONENTS.heartChance&&Math.abs(heart[1]-a.p[1])<3.2&&distance(a.p,heart)<18){
  const lead=knightLifeFireflyPoint(s,now+250)??heart;return {p:lead,attack:true};
 }
 for(const enemy of actors){const h=s.players[enemy.id]?.helper;if(h&&s.players[enemy.id].hp>0&&!s.players[enemy.id].withdrawn&&helperVulnerable(h,now)){
  const c=h.cast!,decision=random(a.seed^(c.at|0)^0x51e7),delay=420+random(a.seed+(c.at|0))*500;
  const p=helperPosition(h,now)??enemy.p;if(decision<OPPONENTS.punishChance&&now>=c.end+delay&&distance(a.p,p)<18)return {p,attack:true};
 }}
 if(now>=(a.shoveReady??0))for(const enemy of actors)if(enemy.metaKnight&&s.players[enemy.id]?.side==='boss'&&knightPlayerPushable(s,enemy.id,now)&&distance(a.p,enemy.p)<7.5)return {p:enemy.p,attack:false};
 if(s.stage==='shield'&&s.activeCrystal!==undefined)return {p:crystalPoint(s.activeCrystal,undefined,0),attack:true};
 if(s.pattern==='star')return {p:[...a.p],attack:false};
 if(cosmicRefugeStage(s))return {p:refugeStar(s,now),attack:s.stage==='cosmic-star-open'};
 const boss=knightPosition(s,now),attack=['open','cosmic-open','duet-recover'].includes(s.stage);
 if(attack)return {p:boss,attack:true};
 // Keep circling between openings instead of waiting at one radial spot.
 const turn=random(a.seed+71)<.5?-1:1,angle=facing(boss,a.p)+turn*.42,radius=(s.phase===4?16:15)+(random(a.seed+31)-.5)*2;
 return {p:[boss[0]+Math.sin(angle)*radius,a.p[1],boss[2]+Math.cos(angle)*radius],attack:false};
}
function constrain(s:KnightBattle,p:KnightPoint,previous:KnightPoint,now:number,actors?:KnightActor[],id=''){
 if(actors)constrainKnightCrowd(p,previous,actors,id);
 const r=Math.hypot(p[0],p[2]);if(r>43){p[0]*=43/r;p[2]*=43/r;}
 constrainKnightBody(s,p,now,previous);constrainKnightShield(s,p,previous);
}

/** Server-owned, serializable decisions; capped time prevents teleporting after a suspended tab. */
export function advanceKnightOpponents(s:KnightBattle,humans:KnightActor[],now:number):KnightActor[]{
 const bots=Object.values(s.opponents??{}),actors=[...humans,...bots],dt=Math.max(0,Math.min(150,now-s.checked))/1000;
 if(s.fightersFinale){projectKnightFightersFinale(s,now);return actors;}
 separateKnightOpponents(s,humans,(p,previous)=>constrain(s,p,previous,now));
 for(const a of bots){
  const player=s.players[a.id];a.moving=false;delete a.turning;if(!player||player.hp<=0||player.withdrawn)continue;
  a.p[1]=cosmicHeight(s,now);
  if(cosmicControlsLocked(s)){const push=cosmicPlayerPush(s,a.id,now);if(push)a.p=[push.point[0],a.p[1],push.point[2]];continue;}
  if(['intro','transition','side-choice'].includes(s.stage))continue;
  const bump=player.bump;
  if(bump&&bump.checked<bump.at+KNIGHT_CONTACT.rollMs){
   const from:KnightPoint=[...a.p],travel=knightBumpDistance(bump,now)-knightBumpDistance(bump,bump.checked);
   a.p[0]+=bump.dx*travel;a.p[2]+=bump.dz*travel;constrain(s,a.p,from,now,actors,a.id);bump.checked=now;a.moving=travel>0;
   delete a.shove;delete a.evade;a.goal=[...a.p];a.thinkAt=now;
   if(knightBumpActive(s,a.id,now))continue;
  }
  const shove=a.shove;
  if(shove&&now<shove.at+KNIGHT_CONTACT.shoveMs){
   a.yaw=shove.yaw;
   if(!shove.resolved&&now>=shove.release){
    shove.resolved=true;const enemy=humans.find(h=>h.id===shove.target&&h.available&&h.metaKnight&&s.players[h.id]?.side==='boss');
    if(enemy&&pushTarget(a.p,shove.yaw,1,[{id:enemy.id,p:enemy.p,s:1,state:'Idle'}]))startKnightBump(s,enemy.id,Math.sin(shove.yaw),Math.cos(shove.yaw),now);
   }
   continue;
  }
  if(now>=(a.shoveReady??0)&&knightPlayerPushable(s,a.id,now)){
   const enemies=humans.filter(h=>h.available&&h.metaKnight&&s.players[h.id]?.side==='boss'&&knightPlayerPushable(s,h.id,now)&&(!s.players[h.id].bump||now-s.players[h.id].bump!.at>=KNIGHT_CONTACT.victimCooldownMs));
   const enemy=enemies.sort((b,c)=>distance(a.p,b.p)-distance(a.p,c.p))[0];
   if(enemy&&distance(a.p,enemy.p)<4&&Math.cos(facing(a.p,enemy.p)-a.yaw)>.985&&random(a.seed+Math.floor(now/2000))<.5){
    const yaw=a.yaw;a.shove={at:now,release:now+KNIGHT_CONTACT.shoveWindupMs,target:enemy.id,yaw};a.shoveReady=now+KNIGHT_CONTACT.aiCooldownMs+Math.floor(random(a.seed+now)*1600);a.yaw=yaw;continue;
   }
  }
  if(a.evade?.since!==s.since||s.stage==='shield'||s.phase===4)delete a.evade;
  const parryBoss=(s.stage==='shot-warn'||s.stage==='shot')&&random(a.seed+((s.stage==='shot-warn'?s.until:s.since)|0))<OPPONENTS.parryChance;
  if(a.evade&&distance(a.p,a.evade.p)<.6)delete a.evade;
  let target=a.evade?{p:a.evade.p,attack:false}:objective(s,a,actors,now);const reacted=now>=s.since+OPPONENTS.reactionMs+random(a.seed)*160;
  if(now>=a.thinkAt){
   // A distant safe point supplies an escape direction even if every short step is still inside a wide telegraph.
   if(reacted&&danger(s,a.p,now,parryBoss)){
    let nearest=Infinity,safe:KnightPoint|undefined;
    for(let ring=1;ring<=4;ring++)for(let i=0;i<24;i++){
     const angle=i*Math.PI/12,p:KnightPoint=[a.p[0]+Math.sin(angle)*ring*4,a.p[1],a.p[2]+Math.cos(angle)*ring*4];
     if(Math.hypot(p[0],p[2])>43||danger(s,p,now,parryBoss))continue;
     const d=distance(a.p,p)+OPPONENTS.speed*Math.abs(Math.atan2(Math.sin(angle-a.yaw),Math.cos(angle-a.yaw)))/TURN_RATE;if(d<nearest){safe=p;nearest=d;}
    }
    if(safe){target={p:safe,attack:false};a.evade={since:s.since,p:safe};if(s.stage==='ricochet-warn'&&now>=(a.dashReady??0)){a.dashUntil=now+550;a.dashReady=now+4000;}}
   }
   a.thinkAt=now+OPPONENTS.thinkMs;let best:KnightPoint=[...a.p],score=Infinity;
   const direct=facing(a.p,target.p),stride=Math.min(distance(a.p,target.p),OPPONENTS.speed*(s.phase===4?2:1)*1.1);
   for(let i=-1;i<16;i++){
    const yaw=direct+i*Math.PI/8,p:KnightPoint=i<0?[...a.p]:[a.p[0]+Math.sin(yaw)*stride,a.p[1],a.p[2]+Math.cos(yaw)*stride];constrain(s,p,a.p,now,actors,a.id);
    const separation=bots.reduce((n,b)=>n+(b!==a?Math.max(0,2.4-distance(p,b.p)):0),0);
    const value=distance(p,target.p)+(reacted&&danger(s,p,now,parryBoss)?80:0)+separation*3.5+(i<0?.3:0)+Math.abs(Math.atan2(Math.sin(yaw-a.yaw),Math.cos(yaw-a.yaw)))*.9;
    if(value<score){score=value;best=p;}
   }
   a.goal=best;
  }
  // Choose one heading for both the body and its forward movement. No strafing or instant parry turns.
  const shots=[{point:knightProjectile(s,now+450)??meteorPoint(s,now+450),imminent:knightProjectile(s,now+120)??meteorPoint(s,now+120),from:knightPosition(s,now),at:s.since},...humans.flatMap(h=>{const c=s.players[h.id]?.helper?.cast;return c?.ability===1&&!c.returned?[{point:helperProjectile(c,now+450),imminent:helperProjectile(c,now+120),from:c.from,at:c.release}]:[];})];
  const parry=shots.find(shot=>shot.point&&random(a.seed+(shot.at|0))<OPPONENTS.parryChance&&distance(a.p,shot.point)<10&&Math.abs(a.p[1]+.85-shot.point[1])<3);
  const close=target.attack&&distance(a.p,target.p)<KNIGHT.meleeReach-.25;
  const watch=parry?.from??(parryBoss&&danger(s,a.p,now,false)?s.from:undefined),aim=watch??(close?target.p:a.goal),d=distance(a.p,a.goal);
  const desired=facing(a.p,aim),delta=Math.atan2(Math.sin(desired-a.yaw),Math.cos(desired-a.yaw)),turn=Math.max(-TURN_RATE*dt,Math.min(TURN_RATE*dt,delta));
  if(distance(a.p,aim)>.03){a.yaw+=turn;if(Math.abs(delta)>.035)a.turning=Math.sign(turn);}
  const aligned=Math.abs(delta)<=Math.min(.08,TURN_RATE*dt+1e-8);
  if(!watch&&!close&&d>.03&&aligned){
   const before:KnightPoint=[...a.p],step=Math.min(d,dt*OPPONENTS.speed*(s.phase===4?2:1)*(now<(a.dashUntil??0)?1.8:1));
   a.p[0]+=Math.sin(a.yaw)*step;a.p[2]+=Math.cos(a.yaw)*step;constrain(s,a.p,before,now,actors,a.id);
   // A blocked walk stops here; the next decision finds a route around the body.
   const side=(a.p[0]-before[0])*Math.cos(a.yaw)-(a.p[2]-before[2])*Math.sin(a.yaw);
   if(Math.abs(side)>.001){a.p=before;a.thinkAt=now;}a.moving=distance(before,a.p)>.001;
  }
  if(close&&reacted&&Math.cos(facing(a.p,target.p)-a.yaw)>.985)knightAttack(s,a,now);
  if(parry?.imminent&&distance(a.p,parry.imminent)<3.8&&Math.cos(facing(a.p,parry.from)-a.yaw)>.985)knightAttack(s,a,now);
 }
 separateKnightOpponents(s,humans,(p,previous)=>constrain(s,p,previous,now));
 return actors;
}
