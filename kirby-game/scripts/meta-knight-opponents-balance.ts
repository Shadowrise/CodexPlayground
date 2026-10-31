import {startKnightBattle,advanceKnightBattle,knightPosition,type KnightActor} from '../src/meta-knight-battle';
import {startHelperAbility,helperPosition,helperLocked} from '../src/meta-knight-helper';
import {cosmicHeight} from '../src/meta-knight-cosmic';

export function simulate(seed:number,policy:'idle'|'aimed'|'reckless',limit=600000){
 const a:KnightActor={id:'solo',metaKnight:true,side:'boss',variant:18,available:true,p:[0,0,-2],yaw:0},s=startKnightBattle([a],a.id,seed)!;
 let casts=0;
 for(let now=seed;now<seed+limit;now+=50){
  const h=s.players.solo.helper!;a.p[1]=cosmicHeight(s,now);const locked=helperPosition(h,now);if(locked)a.p=[...locked];
  if(policy!=='idle'&&!helperLocked(h,now)){
   const bots=Object.values(s.opponents!),b=bots.reduce((best,b)=>Math.hypot(b.p[0]-a.p[0],b.p[2]-a.p[2])<Math.hypot(best.p[0]-a.p[0],best.p[2]-a.p[2])?b:best);
   a.yaw=Math.atan2(b.p[0]-a.p[0],b.p[2]-a.p[2]);
   if(policy==='aimed'){
    const dx=b.p[0]-a.p[0],dz=b.p[2]-a.p[2],d=Math.hypot(dx,dz)||1;
    if(d>12){a.p[0]+=dx/d*.35;a.p[2]+=dz/d*.35;}
    // Use ranged shots at a distance and a dash only when it will reach the target.
    if(startHelperAbility(s,a,d<15?2:1,now)||startHelperAbility(s,a,3,now)||startHelperAbility(s,a,4,now))casts++;
   }else if(startHelperAbility(s,a,2,now)||startHelperAbility(s,a,1,now))casts++;
  }
  advanceKnightBattle(s,[a],now);
  if(['won','lost','cancelled'].includes(s.stage))return {seed,policy,result:s.stage,seconds:(now-seed)/1000,phase:s.phase,boss:s.hp,heroes:s.teamHp,helper:s.players.solo.hp,casts};
 }
 return {seed,policy,result:'timeout',phase:s.phase,boss:s.hp,heroes:s.teamHp,helper:s.players.solo.hp,casts,position:knightPosition(s,s.checked)};
}
if(process.argv[1]?.endsWith('meta-knight-opponents-balance.ts'))for(const policy of ['idle','aimed','reckless'] as const)for(let i=0;i<8;i++)console.log(JSON.stringify(simulate(100000+i*7919,policy)));
