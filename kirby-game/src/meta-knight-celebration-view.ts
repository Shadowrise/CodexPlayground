import * as T from 'three';
import type {CharacterController} from './controller';
import type {KnightBattle} from './meta-knight-battle';
import {knightCelebration} from './meta-knight-celebration';
import {META_KNIGHT_ARENA as SITE} from './meta-knight-arena-site';

/** A reversible rig overlay: swords away, welcoming arms, a squeeze and playful skipping. */
export class MetaKnightCelebrationView{
 private poses:{node:T.Object3D;p:T.Vector3;q:T.Quaternion;s:T.Vector3}[]=[];private active=false;
 private sword?:T.Object3D;private swordVisible=true;private eyes?:T.Object3D;private eyesVisible=true;
 private gaitAction?:T.AnimationAction;private gaitRate=1;private happyEyes=new T.Group();private eyeGeometry:T.BufferGeometry[]=[];
 private happyMaterial=new T.MeshBasicMaterial({color:new T.Color().setRGB(1.8,1.35,.22),toneMapped:false});
 private armAxes=new Map<T.Object3D,T.Vector3>();private rotation=new T.Quaternion();private direction=new T.Vector3();
 constructor(private c:CharacterController){
  for(const name of ['MetaKnight_motion','Body_motion','Left_shoulder','Right_shoulder','Left_gauntlet','Right_gauntlet','Left_foot_pivot','Right_foot_pivot','Left_wing_pivot','Right_wing_pivot','Cape']){const node=c.actor.getObjectByName(name);if(node)this.poses.push({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()});}
  this.sword=c.actor.getObjectByName('Galaxia');this.eyes=c.actor.getObjectByName('Eyes_glow');
  for(const side of ['Left','Right']){const arm=c.actor.getObjectByName(side+'_shoulder'),hand=c.actor.getObjectByName(side+'_gauntlet');if(arm&&hand)this.armAxes.set(arm,hand.position.clone().normalize());}
  this.happyEyes.name='Meta Knight smiling crescent eyes';this.happyEyes.visible=false;
  for(const side of [-1,1]){const points=Array.from({length:21},(_,i)=>{const t=i/20,x=side*.29+(t-.5)*.25,y=-.04+Math.sin(t*Math.PI)*.10,z=.79*Math.sqrt(Math.max(.001,1-(x/.91)**2-(y/.91)**2))+.10;return new T.Vector3(x,y,z);});const geometry=new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.022,7,false);this.eyeGeometry.push(geometry);this.happyEyes.add(new T.Mesh(geometry,this.happyMaterial));}
  c.actor.getObjectByName('Mask_shell')?.add(this.happyEyes);
 }
 clear(){if(!this.active)return;if(this.gaitAction){this.gaitAction.setEffectiveTimeScale(this.gaitRate);this.gaitAction=undefined;}for(const {node,p,q,s} of this.poses){node.position.copy(p);node.quaternion.copy(q);node.scale.copy(s);}if(this.sword)this.sword.visible=this.swordVisible;if(this.eyes)this.eyes.visible=this.eyesVisible;this.happyEyes.visible=false;this.active=false;}
 update(s:KnightBattle|undefined,id:string,now:number,dt:number){
  this.clear();const pose=knightCelebration(s,id,now);if(!pose)return false;
  const {c}=this,clip=pose.phase==='run'?'Run':pose.phase==='circle'?'Idle':'Joy';c.clearDuelDazedPose();if(c.state!==clip)c.setActivity(clip);if(pose.phase==='run'){const action=c.actions.get('Run')!;this.gaitAction=action;this.gaitRate=action.getEffectiveTimeScale();action.setEffectiveTimeScale(0);action.time=(pose.travelled/Math.max(.25,c.actor.scale.x*2.4)%1)*action.getClip().duration;}c.updateActivity(dt);
  for(const p of this.poses){p.p.copy(p.node.position);p.q.copy(p.node.quaternion);p.s.copy(p.node.scale);}this.active=true;
  if(this.sword){this.swordVisible=this.sword.visible;this.sword.visible=false;}if(this.eyes){this.eyesVisible=this.eyes.visible;this.eyes.visible=pose.phase==='run';}this.happyEyes.visible=pose.phase!=='run';
  c.actor.position.set(SITE.x+pose.p[0],pose.p[1],pose.p[2]);c.yaw=pose.yaw;c.actor.rotation.set(0,pose.yaw,0);c.actor.visible=true;
  const node=(name:string)=>c.actor.getObjectByName(name),h=pose.hug,clock=pose.elapsed;
  const body=node('Body_motion');if(body){body.rotation.z+=pose.sway;body.rotation.x+=h*(pose.little?-.10:.15);body.position.y-=h*(pose.little?.02:.22);if(pose.phase==='circle'){const landing=1-Math.min(1,pose.jump/(pose.little?.95:.47));body.scale.set(1+landing*.035,1-landing*.055,1+landing*.025);}}
  for(const [side,sign] of [['Left',-1],['Right',1]] as const){
   const arm=node(side+'_shoulder'),foot=node(side+'_foot_pivot'),wing=node(side+'_wing_pivot');
   if(arm){const welcome=pose.phase==='greet'?Math.sin(clock*5)*.12:0;arm.rotation.set(-.35,0,sign*(.85+welcome));if(h>0){const squeeze=.025*Math.sin(clock*7.1)**2;arm.position.lerp(this.direction.set(sign*(.57-squeeze),pose.little?-.025:-.10,pose.little?.34:.50),h);this.direction.set(sign*(pose.little?-.07:-.20),pose.little?.33:-.06,.52).normalize();this.rotation.setFromUnitVectors(this.armAxes.get(arm)!,this.direction);arm.quaternion.slerp(this.rotation,h);}if(pose.phase==='circle')arm.rotation.set(-.35+.25*Math.sin(pose.hopPhase*Math.PI*2+sign),0,sign*(.85+.10*Math.sin(pose.hopPhase*Math.PI*2)));}
   if(foot&&pose.phase==='hug'){foot.rotation.x=-.12*h;foot.rotation.z=sign*.10*h;}
   if(foot&&pose.phase==='circle'){const lift=pose.hopLift,beat=pose.hopPhase;foot.position.set(sign*(.47+.035*(1-lift)),.25+.12*lift,.15+.25*lift+sign*.08*Math.sin(beat*Math.PI*2));foot.rotation.set(-.42*lift+.10*(1-lift),sign*.06*lift,sign*(.05+.05*lift));}
   if(wing){wing.rotation.y=T.MathUtils.lerp(wing.rotation.y,sign*.35,h);wing.rotation.z=T.MathUtils.lerp(wing.rotation.z,sign*.04,h);wing.rotation.y+=sign*.04*Math.sin(clock*5);}
  }
  const cape=node('Cape');if(cape)cape.rotation.x+=.08*Math.sin(clock*5)*(1-h);
  return true;
 }
 dispose(){this.clear();this.happyEyes.removeFromParent();this.eyeGeometry.forEach(g=>g.dispose());this.happyMaterial.dispose();}
}
