import {knightBattleActive,type KnightActor,type KnightBattle,type KnightPoint} from './meta-knight-battle';
import {knightPlayerPushable} from './meta-knight-push';
import {pushTarget,type PushCandidate} from './push-target';

export const KNIGHT_CONTACT={radius:1.25,clearance:.06,rollMs:950,rollDistance:4.2,shoveWindupMs:300,shoveMs:620,aiCooldownMs:6500,victimCooldownMs:2200} as const;
export type KnightBump={at:number;dx:number;dz:number;checked:number};
export type KnightShove={at:number;release:number;target:string;yaw:number;resolved?:boolean};
const gap=KNIGHT_CONTACT.radius*2+KNIGHT_CONTACT.clearance;
export const knightBumpActive=(s:KnightBattle|undefined,id:string,now:number)=>!!s?.players[id]?.bump&&now>=s.players[id].bump!.at&&now<s.players[id].bump!.at+KNIGHT_CONTACT.rollMs;
export function knightBumpDistance(b:KnightBump,now:number){const t=Math.max(0,Math.min(1,(now-b.at)/KNIGHT_CONTACT.rollMs));return KNIGHT_CONTACT.rollDistance*(1-(1-t)**2);}
export function startKnightBump(s:KnightBattle,id:string,dx:number,dz:number,now:number){
 const p=s.players[id],length=Math.hypot(dx,dz);
 if(!length||!knightPlayerPushable(s,id,now)||p.bump&&now-p.bump.at<KNIGHT_CONTACT.victimCooldownMs)return false;
 p.bump={at:now,checked:now,dx:dx/length,dz:dz/length};s.revision++;return true;
}
export function knightOpponentPushCandidates(s:KnightBattle|undefined,now:number):PushCandidate[]{
 return Object.values(s?.opponents??{}).filter(a=>knightPlayerPushable(s,a.id,now)).map(a=>({id:a.id,p:a.p,s:1,state:'Idle'}));
}
/** An ordinary Q press chooses a real target in front and never consumes health. */
export function pushKnightOpponent(s:KnightBattle|undefined,actor:KnightActor,now:number,targetId?:string){
 if(!s||!actor.available||!actor.metaKnight||!knightPlayerPushable(s,actor.id,now))return;
 const target=pushTarget(actor.p,actor.yaw,1,knightOpponentPushCandidates(s,now).filter(a=>!targetId||a.id===targetId));
 if(target&&startKnightBump(s,target.id,Math.sin(actor.yaw),Math.cos(actor.yaw),now))return target.id;
}

type Body={id:string;p:readonly number[]};
/** Sweep a circle and slide along its neighbours. The whole segment is checked, including fast dashes. */
export function constrainKnightCrowd(p:KnightPoint,previous:KnightPoint,bodies:readonly Body[],id:string){
 let from:KnightPoint=[...previous];
 const neighbours=bodies.filter(b=>b.id!==id&&Math.abs(b.p[1]-p[1])<2.4);
 for(let pass=0;pass<4;pass++){
  let first=1,obstacle:Body|undefined;
  const dx=p[0]-from[0],dz=p[2]-from[2],length=dx*dx+dz*dz;
  for(const b of neighbours){
   const x=from[0]-b.p[0],z=from[2]-b.p[2],c=x*x+z*z-gap*gap,dot=x*dx+z*dz;
   if(c<-.00001){
    // Initial overlaps are repaired by separation; allow an outward escape in the meantime.
    if(dot<0){const d=Math.hypot(p[0]-b.p[0],p[2]-b.p[2])||1;p[0]=b.p[0]+(p[0]-b.p[0])/d*gap;p[2]=b.p[2]+(p[2]-b.p[2])/d*gap;}continue;
   }
   const discriminant=dot*dot-length*c;if(length<1e-10||dot>=0||discriminant<0)continue;
   const t=(-dot-Math.sqrt(discriminant))/length;if(t>=-1e-8&&t<first){first=Math.max(0,t);obstacle=b;}
  }
  if(!obstacle)break;
  const x=from[0]+dx*Math.max(0,first-1e-5),z=from[2]+dz*Math.max(0,first-1e-5),nx=(x-obstacle.p[0])/gap,nz=(z-obstacle.p[2])/gap;
  let rx=p[0]-x,rz=p[2]-z;const inward=Math.min(0,rx*nx+rz*nz);rx-=nx*inward;rz-=nz*inward;
  from=[x,p[1],z];p[0]=x+rx;p[2]=z+rz;
 }
 for(let pass=0;pass<3;pass++)for(const b of neighbours){
  const dx=p[0]-b.p[0],dz=p[2]-b.p[2],d=Math.hypot(dx,dz);if(d>=gap-1e-6)continue;
  const nx=d>1e-8?dx/d:1,nz=d>1e-8?dz/d:0;p[0]=b.p[0]+nx*(gap+.00001);p[2]=b.p[2]+nz*(gap+.00001);
 }
}
/** Also repair old snapshots and crowds compressed against the boss, shield or arena rim. */
export function separateKnightOpponents(s:KnightBattle,humans:readonly KnightActor[],constrain:(p:KnightPoint,previous:KnightPoint)=>void){
 const bots=Object.values(s.opponents??{}).filter(a=>!s.players[a.id]?.withdrawn).sort((a,b)=>a.id.localeCompare(b.id));
 for(let pass=0;pass<18;pass++){
  let corrected=false;
  for(let i=0;i<bots.length;i++){
   const a=bots[i];
   for(const b of bots.slice(i+1)){
    if(Math.abs(a.p[1]-b.p[1])>=2.4)continue;
    const dx=b.p[0]-a.p[0],dz=b.p[2]-a.p[2],d=Math.hypot(dx,dz);if(d>=gap-1e-6)continue;
    const nx=d>1e-8?dx/d:1,nz=d>1e-8?dz/d:0,step=(gap-d)/2+.00001,ap:KnightPoint=[...a.p],bp:KnightPoint=[...b.p];
    a.p[0]-=nx*step;a.p[2]-=nz*step;b.p[0]+=nx*step;b.p[2]+=nz*step;constrain(a.p,ap);constrain(b.p,bp);corrected=true;
   }
   for(const h of humans){
    if(!h.available||!s.players[h.id]||s.players[h.id].withdrawn||Math.abs(a.p[1]-h.p[1])>=2.4)continue;
    const dx=a.p[0]-h.p[0],dz=a.p[2]-h.p[2],d=Math.hypot(dx,dz);if(d>=gap-1e-6)continue;
    const nx=d>1e-8?dx/d:Math.sin(i*2.4+.5),nz=d>1e-8?dz/d:Math.cos(i*2.4+.5),before:KnightPoint=[...a.p];
    a.p[0]=h.p[0]+nx*gap;a.p[2]=h.p[2]+nz*gap;constrain(a.p,before);corrected=true;
   }
  }
  if(!corrected)break;
 }
}
/** Client prediction and server validation share the same NPC collision bodies. */
export function constrainKnightOpponentBodies(s:KnightBattle|undefined,p:KnightPoint,previous:KnightPoint|undefined,id:string){
 if(!knightBattleActive(s)||!s?.players[id]||s.players[id].withdrawn)return;
 constrainKnightCrowd(p,previous??p,Object.values(s.opponents??{}).filter(a=>!s.players[a.id]?.withdrawn),id);
}
