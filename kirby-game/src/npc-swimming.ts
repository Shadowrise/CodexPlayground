import {Vector3} from 'three';
import type {KirbyNpc,NpcConstraint} from './npcs';
import {PONDS,inWater,dryGround} from './pond-layout';
import {FOUNTAIN_SITE,inFountain} from './fountain-site';

type Spot={shore:Vector3;water:Vector3};
type Visit={spot:Spot;phase:'shore'|'water'|'rest'|'leave';elapsed:number;rest:number};
/** Host-only, occasional bathing trips. Ordinary water crossings still swim too. */
export class NpcSwimming {
 private visits=new Map<KirbyNpc,Visit>();
 private cooldown=new WeakMap<KirbyNpc,number>();
 private time=0;
 private next=8;
 private seed=82173;
 private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 private spots:Spot[]=[...PONDS,FOUNTAIN_SITE].flatMap(site=>Array.from({length:8},(_,i)=>{
  const a=i*Math.PI/4,fountain=site===FOUNTAIN_SITE;
  return {shore:new Vector3(site.x+Math.sin(a)*(fountain?12:25),0,site.z+Math.cos(a)*(fountain?12:20)),water:new Vector3(site.x+Math.sin(a)*(fountain?7:9),0,site.z+Math.cos(a)*(fountain?7:5))};
 })).filter(s=>dryGround(s.shore.x,s.shore.z,1)&&!inFountain(s.shore.x,s.shore.z)&&(inWater(s.water.x,s.water.z)||inFountain(s.water.x,s.water.z)));
 private clear(from:Vector3,to:Vector3,size:number,constrain:NpcConstraint){
  const steps=Math.ceil(from.distanceTo(to)/2),previous=from.clone();
  for(let i=1;i<=steps;i++){
   const next=from.clone().lerp(to,i/steps),target=next.clone();constrain(next,size,previous);
   if(next.distanceToSquared(target)>.000001)return false;previous.copy(next);
  }
  return true;
 }
 update(dt:number,npcs:readonly KirbyNpc[],constrain:NpcConstraint){
  this.time+=dt;
  for(const [npc,visit] of this.visits){
   visit.elapsed+=dt;
   const interrupted=!npcs.includes(npc)||npc.roll.active||npc.flight.active||npc.fireflyIndex!==undefined||npc.state.startsWith('Balloon');
   if(interrupted||visit.elapsed>65){this.finish(npc);continue;}
   const destination=visit.phase==='shore'||visit.phase==='leave'?visit.spot.shore:visit.spot.water;
   const close=Math.hypot(npc.actor.position.x-destination.x,npc.actor.position.z-destination.z)<1.2;
   if(visit.phase==='shore'&&close){visit.phase='water';visit.elapsed=0;npc.setWaterDestination(visit.spot.water);}
   else if(visit.phase==='water'&&close&&npc.swimming){visit.phase='rest';visit.elapsed=0;}
   else if(visit.phase==='rest'&&visit.elapsed>visit.rest){visit.phase='leave';visit.elapsed=0;npc.setWaterDestination(visit.spot.shore);}
   else if(visit.phase==='leave'&&close&&!npc.swimming)this.finish(npc);
  }
  if(this.time<this.next||this.visits.size>=2)return;
  this.next=this.time+16+this.random()*14;
  const candidates=npcs.filter(n=>n.canBoardBalloon&&!n.waterDestination&&(this.cooldown.get(n)??0)<=this.time);
  // Rotate the candidate order; the same nearest NPC should not take every turn.
  const offset=Math.floor(this.random()*Math.max(1,candidates.length));
  for(let i=0;i<candidates.length;i++){
   const npc=candidates[(i+offset)%candidates.length],p=npc.actor.position;
   const spots=this.spots.filter(s=>p.distanceTo(s.shore)<75).sort((a,b)=>p.distanceToSquared(a.shore)-p.distanceToSquared(b.shore));
   const spot=spots.find(s=>this.clear(p,s.shore,npc.actor.scale.x,constrain)&&this.clear(s.shore,s.water,npc.actor.scale.x,constrain));
   if(!spot)continue;
   this.visits.set(npc,{spot,phase:'shore',elapsed:0,rest:8+this.random()*8});npc.setWaterDestination(spot.shore);break;
  }
 }
 private finish(npc:KirbyNpc){npc.setWaterDestination();this.visits.delete(npc);this.cooldown.set(npc,this.time+90+this.random()*60);}
}
