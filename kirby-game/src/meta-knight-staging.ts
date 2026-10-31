import type {KnightActor,KnightBattle,KnightPoint} from './meta-knight-battle';
const difference=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
/** Capture the densest forward hemisphere once per scene, including the solo AI roster. */
export function knightAudienceYaw(s:KnightBattle,actors:readonly KnightActor[],origin:KnightPoint=[0,0,0],fallback=s.yaw){
 const roster=new Map([...Object.values(s.opponents??{}),...actors].map(a=>[a.id,a]));
 const angles=[...roster.values()].filter(a=>a.available&&s.players[a.id]&&!s.players[a.id].withdrawn&&s.players[a.id].side!=='boss'&&Math.hypot(a.p[0]-origin[0],a.p[2]-origin[2])>.1).sort((a,b)=>a.id.localeCompare(b.id)).map(a=>Math.atan2(a.p[0]-origin[0],a.p[2]-origin[2]));
 if(!angles.length)return fallback;
 let yaw=angles[0],best=-1,tie=Infinity;
 // Sector boundaries supply all possible majority sets; a distant outlier cannot swing the mean.
 for(const angle of angles)for(const edge of [-1,0,1]){
  const centre=angle+edge*Math.PI/3,inside=angles.filter(a=>Math.abs(difference(a,centre))<=Math.PI/3+1e-8),candidate=Math.atan2(inside.reduce((n,a)=>n+Math.sin(a),0),inside.reduce((n,a)=>n+Math.cos(a),0)),turn=Math.abs(difference(candidate,fallback));
  if(inside.length>best||inside.length===best&&turn<tie){best=inside.length;tie=turn;yaw=candidate;}
 }return yaw;
}
export function knightFormationSide(side:number,yaw:number,height=0):KnightPoint{return [Math.cos(yaw)*side,height,-Math.sin(yaw)*side];}
export function knightGatherYaw(from:KnightPoint,to:KnightPoint,heading:number,f:number){const toward=Math.atan2(to[0]-from[0],to[2]-from[2]),t=Math.max(0,Math.min(1,(f-.7)/.3)),ease=t*t*(3-2*t);return toward+difference(heading,toward)*ease;}
