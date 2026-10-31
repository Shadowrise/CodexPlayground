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
 private restores=new Map<string,()=>void>();private battleId=0;
 constructor(private make:(variant:number)=>CharacterController|undefined){}
 update(s:KnightBattle|undefined,scene:Scene,cosmic:Group,now:number,dt:number){
  if(this.battleId!==(s?.id??0)||s?.stage==='cancelled'){this.clear();this.battleId=s?.id??0;}
  for(const [id,a] of Object.entries(s?.opponents??{})){
   if(s?.stage==='cancelled')break;
   let c=this.characters.get(id);if(!c){c=this.make(a.variant);if(!c)continue;c.actor.name=`Meta Knight AI opponent ${id}`;c.beginDuel();this.restores.set(id,arenaMaterials(c.actor));this.characters.set(id,c);}
   const p=s!.players[id],airborne=cosmicAirborne(s);(airborne?cosmic:scene).add(c.actor);
   c.actor.position.set(META_KNIGHT_ARENA.x+a.p[0],a.p[1],a.p[2]);c.yaw=a.yaw;c.actor.rotation.set(0,a.yaw,0);
   const defeated=p.hp<=0||s?.stage==='lost',attacking=now>=p.attackAt&&now-p.attackAt<500;
   const pose=defeated?'Sitting':attacking?'Attack':now<(a.dashUntil??0)?'Dash':airborne?'Fly':a.moving?'Run':'Idle';
   if(c.state!==pose)c.setActivity(pose);c.updateActivity(dt);c.updateDuelDazedPose(now,defeated);c.actor.visible=knightPlayerVisible(s,id,now);
  }
 }
 clear(){for(const [id,c] of this.characters){this.restores.get(id)?.();disposeActor(c);}this.restores.clear();this.characters.clear();}
 dispose(){this.clear();}
}
