import {knightAudienceYaw} from './meta-knight-staging';
import type {KnightActor,KnightBattle,KnightPoint} from './meta-knight-battle';
import {COSMIC_DESCENT,cosmicDescent,easeCosmic} from './meta-knight-cosmic';

export type KnightDefeat={at:number;until:number;yaw:number;boss:KnightPoint;helpers:Record<string,KnightPoint>};
/** Capture once before clearing casts. The fall also gathers the defeated pair. */
export function prepareKnightDefeat(s:KnightBattle,actors:readonly KnightActor[],boss:KnightPoint,now:number){
 if(s.defeat)return;
 const helpers=Object.fromEntries(actors.filter(a=>a.available&&s.players[a.id]?.side==='boss'&&!s.players[a.id].withdrawn).sort((a,b)=>a.id.localeCompare(b.id)).map(a=>[a.id,[...a.p] as KnightPoint]));
 if(!Object.keys(helpers).length)return;
 const duration=s.stage==='cosmic-descent'?COSMIC_DESCENT.impactMs:Math.max(1200,...Object.values(helpers).map(p=>Math.hypot(p[0],p[2])/8.5*1000));
 s.defeat={at:now,until:now+duration,yaw:knightAudienceYaw(s,actors,boss,s.cosmicFall?.yaw??s.yaw),boss:[...boss],helpers};
}
export function knightDefeatPose(s:KnightBattle|undefined,id:string,now:number){
 const d=s?.defeat;if(!s||!d||!['cosmic-descent','won'].includes(s.stage))return;
 const ids=Object.keys(d.helpers),index=ids.indexOf(id),from=id==='boss'?d.boss:d.helpers[id];
 if(!from||id!=='boss'&&s.players[id]?.withdrawn)return;
 const t=easeCosmic((now-d.at)/Math.max(1,d.until-d.at)),side=id==='boss'?-3:6.5+index*3.5,fall=cosmicDescent(s,now);
 const target:KnightPoint=[Math.cos(d.yaw)*side,0,-Math.sin(d.yaw)*side],p=from.map((v,i)=>v+(target[i]-v)*t) as KnightPoint;
 if(fall)p[1]=fall.height;
 return {p,yaw:d.yaw,gather:now<d.until,landed:fall?.landed??now>=d.until};
}
