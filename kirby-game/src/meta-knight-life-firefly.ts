import {knightBattleActive,knightPosition,type KnightBattle,type KnightPoint} from './meta-knight-battle';
import {META_KNIGHT_ARENA as ARENA} from './meta-knight-arena-site';
import {COSMIC} from './meta-knight-cosmic';
import {COSMIC_REFUGE,refugeActive,refugeStar,refugePlanet} from './meta-knight-cosmic-refuge';

export const LIFE_FIREFLY={speed:.005,height:.9,clearance:2,detour:14,hitRadius:1.1,dropMs:1100} as const;
export type KnightLifeFirefly={phase:1|2|3|4;at:number;angle:number;color:number;side:1|-1;hit?:{at:number;by:string;point:KnightPoint;yaw:number}};
const hash=(seed:number)=>{let n=seed|0;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;};
const R=ARENA.radius,D=LIFE_FIREFLY.detour,LEG=Math.sqrt(R*R-D*D),ANGLE=Math.acos(D/R),ARC=D*(Math.PI-2*ANGLE);
export const lifeFireflyDuration=(LEG*2+ARC)/LIFE_FIREFLY.speed;
/** The encounter owns this lottery, so reconnects and spectators see the same bug. */
export function spawnKnightLifeFirefly(s:KnightBattle,now:number){
 const mask=1<<(s.phase-1);if((s.lifeFireflyPhases??0)&mask)return;
 const n=hash((s.id|0)^Math.imul(s.phase,0x9e3779b9));
 s.lifeFireflyPhases=(s.lifeFireflyPhases??0)|mask;
 // Choose a gap between rim crystals, with a little angular variation.
 const gap=[1,2,3,5,6,7][n%6]; // Keep both endpoints away from the closed annex gate.
 s.lifeFirefly={phase:s.phase,at:now,angle:(gap+.5)*Math.PI/4+((n>>>8)%1000/999-.5)*.12,color:hash(n)/4294967296,side:n&256?1:-1};s.revision++;
}
/** Two tangents and a circular detour stay outside the entire central dome. */
export function knightLifeFireflyPoint(s:KnightBattle,now:number):KnightPoint|undefined{
 const bug=s.lifeFirefly;if(!bug||bug.phase!==s.phase||!knightBattleActive(s)||bug.hit||now<bug.at||now>=bug.at+lifeFireflyDuration)return;
 const travelled=(now-bug.at)*LIFE_FIREFLY.speed;let x:number,z:number;
 if(travelled<LEG){const t=travelled/LEG;x=R+(D*D/R-R)*t;z=D*LEG/R*t;}
 else if(travelled<LEG+ARC){const a=ANGLE+(travelled-LEG)/D;x=D*Math.cos(a);z=D*Math.sin(a);}
 else{const t=(travelled-LEG-ARC)/LEG;x=-D*D/R+(-R+D*D/R)*t;z=D*LEG/R*(1-t);}
 const a=bug.angle,side=bug.side,point:KnightPoint=[Math.sin(a)*x+Math.cos(a)*z*side,(s.phase===4?COSMIC.height:0)+LIFE_FIREFLY.height,Math.cos(a)*x-Math.sin(a)*z*side];
 // A moving knight can cross the radial flight. A smooth vertical detour clears
 // his whole wings/sword silhouette without changing the rim endpoints.
 const boss=knightPosition(s,now),distance=Math.hypot(point[0]-boss[0],point[2]-boss[2]),reach=12;
 if(distance<reach){const t=Math.min(1,(reach-distance)/4),blend=t*t*(3-2*t);point[1]+=Math.max(0,boss[1]+12-point[1])*blend;}
 if(s.phase===4&&s.cosmicRefuge&&refugeActive(s)){
  for(const [centre,radius] of [[refugeStar(s,now),COSMIC_REFUGE.domeRadius],[refugePlanet(s,now),COSMIC_REFUGE.planetRadius]] as const){
   const d=Math.hypot(point[0]-centre[0],point[2]-centre[2]),r=radius+LIFE_FIREFLY.clearance;
   if(d<r)point[1]=Math.max(point[1],centre[1]+Math.sqrt(r*r-d*d)+.1);
  }
 }
 return point;
}
/** Called once for a consumed melee press, by the same rules on client and Worker. */
export function hitKnightLifeFirefly(s:KnightBattle,id:string,p:KnightPoint,yaw:number,now:number,reach:number){
 const point=knightLifeFireflyPoint(s,now);if(!point)return false;
 const dx=point[0]-p[0],dz=point[2]-p[2];
 if(Math.hypot(dx,dz)>reach+LIFE_FIREFLY.hitRadius||Math.abs(point[1]-p[1])>3.2||Math.cos(Math.atan2(dx,dz)-yaw)<=-.15)return false;
 const next=knightLifeFireflyPoint(s,now+5)??point;
 s.lifeFirefly!.hit={at:now,by:id,point,yaw:Math.atan2(next[0]-point[0],next[2]-point[2])};
 const hp=(s.teamHp??s.players[id].hp)+1;
 if(s.teamHp!==undefined)s.teamHp=hp;
 for(const player of Object.values(s.players))player.hp=hp;
 s.revision++;return true;
}
