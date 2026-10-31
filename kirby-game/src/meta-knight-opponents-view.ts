import {MetaKnightFightersFinaleView} from './meta-knight-fighters-finale-view';
import {knightBumpActive,KNIGHT_CONTACT} from './meta-knight-opponents-contact';
import type {Group,Scene} from 'three';
import type {CharacterController} from './controller';
import type {KnightBattle} from './meta-knight-battle';
import {knightPlayerVisible} from './meta-knight-battle';
import {cosmicAirborne} from './meta-knight-cosmic';
import {arenaMaterials} from './meta-knight-arena-materials';
import {disposeActor} from './actor-lifecycle';
import {META_KNIGHT_ARENA} from './meta-knight-arena-site';

/** Models are local projections of shared AI state; clients never choose their actions. */
export class MetaKnightOpponentsView{
 readonly characters=new Map<string,CharacterController>();
 private finales=new Map<string,MetaKnightFightersFinaleView>();
 private bumpSeen=new Map<string,number>();
 private gait=new Map<string,{x:number;z:number;travelled:number;movedAt:number}>();
 private restores=new Map<string,()=>void>();private battleId=0;
 constructor(private make:(variant:number)=>CharacterController|undefined,private cue?:()=>void){}
 update(s:KnightBattle|undefined,scene:Scene,cosmic:Group,now:number,dt:number){
  if(this.battleId!==(s?.id??0)||s?.stage==='cancelled'){this.clear();this.battleId=s?.id??0;}
  for(const [id,a] of Object.entries(s?.opponents??{})){
   if(s?.stage==='cancelled')break;
   let c=this.characters.get(id);if(!c){c=this.make(a.variant);if(!c)continue;c.actor.name=`Meta Knight AI opponent ${id}`;c.actor.userData.location='meta-knight-arena';c.beginDuel();this.restores.set(id,arenaMaterials(c.actor));this.characters.set(id,c);}
   let finale=this.finales.get(id);if(!finale){finale=new MetaKnightFightersFinaleView(c);this.finales.set(id,finale);}if(finale.update(s,id,now,dt,scene,cosmic))continue;
   const p=s!.players[id],airborne=cosmicAirborne(s);(airborne?cosmic:scene).add(c.actor);
   let gait=this.gait.get(id);if(!gait){gait={x:a.p[0],z:a.p[2],travelled:0,movedAt:-Infinity};this.gait.set(id,gait);}
   const travelled=Math.hypot(a.p[0]-gait.x,a.p[2]-gait.z);if(travelled>.003&&dt>0){gait.travelled+=Math.min(travelled,3);gait.movedAt=now;}gait.x=a.p[0];gait.z=a.p[2];
   c.actor.position.set(META_KNIGHT_ARENA.x+a.p[0],a.p[1],a.p[2]);c.yaw=a.yaw;c.actor.rotation.set(0,a.yaw,0);
   const defeated=p.hp<=0||s?.stage==='lost',attacking=now>=p.attackAt&&now-p.attackAt<500;
   const rolling=knightBumpActive(s,id,now),shoving=!!a.shove&&now<a.shove.at+KNIGHT_CONTACT.shoveMs;
   const pose=defeated?'Sitting':rolling?'Roll':shoving?'Push':attacking?(c.hasNativeAnimations?'Attack':'Push'):now<(a.dashUntil??0)?'Dash':airborne?'Fly':a.turning&&!a.moving?(a.turning>0?'RotateLeft':'RotateRight'):a.moving||now-gait.movedAt<180?'Run':'Idle';
   if(rolling&&this.bumpSeen.get(id)!==p.bump!.at){this.bumpSeen.set(id,p.bump!.at);this.cue?.();}
   c.roll.clearPose();if(c.state!==pose)c.setActivity(pose,true);
   // Sample Kirby's authored leg cycle by actual distance, so brief pauses and fresh snapshots do not restart it.
   const run=c.actions.get('Run')!;if(!c.hasNativeAnimations&&pose==='Run'){run.setEffectiveTimeScale(0);run.time=(gait.travelled/2.4%1)*run.getClip().duration;}else if(!c.hasNativeAnimations)run.setEffectiveTimeScale(2);
   c.updateActivity(dt);
   if(rolling&&!defeated){const b=p.bump!;c.roll.state=[b.dx,b.dz,(now-b.at)/1000,0,a.p[1]];if(!c.hasNativeAnimations)c.roll.applyPose(c.animationRoot,c.yaw);}else c.roll.reset();c.updateDuelDazedPose(now,defeated);c.actor.visible=knightPlayerVisible(s,id,now);
  }
 }
 clear(){for(const view of this.finales.values())view.dispose();this.finales.clear();for(const [id,c] of this.characters){this.restores.get(id)?.();disposeActor(c);}this.restores.clear();this.characters.clear();this.bumpSeen.clear();this.gait.clear();}
 dispose(){this.clear();}
}
