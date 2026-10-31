import type {Group,Scene,AnimationAction} from 'three';
import type {CharacterController} from './controller';
import type {KnightBattle} from './meta-knight-battle';
import {knightFighterFinale} from './meta-knight-fighters-finale';
import {MetaKnightDazedStars} from './meta-knight-dazed-stars';
import {EmotePose} from './emotes';
import {META_KNIGHT_ARENA as SITE} from './meta-knight-arena-site';

/** The same authored joy / Kirby emote and dazed pose used by playable characters. */
export class MetaKnightFightersFinaleView{
 readonly stars=new MetaKnightDazedStars('Fighter finale dizziness stars');
 private joy?:EmotePose;private sampled?:{action:AnimationAction;rate:number};
 constructor(private c:CharacterController){}
 clear(){this.joy?.clear();if(this.sampled){this.sampled.action.setEffectiveTimeScale(this.sampled.rate);this.sampled=undefined;}this.c.clearDuelDazedPose();this.stars.group.visible=false;}
 update(s:KnightBattle|undefined,id:string,now:number,dt:number,scene:Scene,cosmic:Group){
  this.clear();const pose=knightFighterFinale(s,id,now);if(!pose)return false;
  const c=this.c,parent=pose.p[1]>.001?cosmic:scene;parent.add(c.actor,this.stars.group);c.roll.reset();c.flight.reset();c.cloud.visible=false;
  const clip=!pose.landed?'Fly':!pose.won?'Sitting':pose.joy?'Joy':'Idle';if(c.state!==clip)c.setActivity(clip,c.hasNativeAnimations||clip!=='Joy');
  c.updateActivity(dt);
  if(pose.joy){if(c.hasNativeAnimations){const action=c.actions.get('Joy');if(action){this.sampled={action,rate:action.getEffectiveTimeScale()};action.setEffectiveTimeScale(0);action.time=pose.joySeconds%action.getClip().duration;c.mixer.update(0);}}
   else{this.joy??=new EmotePose('Joy',c.animationRoot);this.joy.elapsed=0;this.joy.update(pose.joySeconds);}}
  c.actor.position.set(SITE.x+pose.p[0],pose.p[1],pose.p[2]);c.surfaceY=pose.p[1];c.yaw=pose.yaw;c.actor.rotation.set(0,pose.yaw,0);c.actor.visible=true;
  const dazed=pose.landed&&!pose.won;c.updateDuelDazedPose(now,dazed);this.stars.group.scale.setScalar(c.actor.scale.x*.38);this.stars.update([c.actor.position.x,c.actor.position.y,c.actor.position.z],now,dazed);return true;
 }
 dispose(){this.clear();this.stars.dispose();}
}
