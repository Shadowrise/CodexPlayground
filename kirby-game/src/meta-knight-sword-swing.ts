import * as T from 'three';
import {KNIGHT,type KnightBattle} from './meta-knight-battle';

const UP=new T.Vector3(0,1,0),TIP=new T.Vector3(-.315,2.05,0);
type SavedPose={node:T.Object3D;p:T.Vector3;q:T.Quaternion;s:T.Vector3};

/** The actual held blade and its arena trail share this angular path. */
export function knightSwordDirection(s:Pick<KnightBattle,'step'>){return s.step<2?-1:1;}
export function knightSwordAngle(s:Pick<KnightBattle,'stage'|'step'>,progress:number){
 const direction=-knightSwordDirection(s);
 return direction*KNIGHT.slashHalfAngle*(s.stage==='slash'?1-2*T.MathUtils.smoothstep(progress,0,1):1);
}

/** Boss-only choreography; the playable character's authored clips stay intact. */
export class MetaKnightSwordSwing{
 readonly tip=new T.Vector3();
 private body:T.Object3D;private arm:T.Object3D;private grip:T.Object3D;private blade:T.Object3D;
 private leftArm:T.Object3D;private feet:T.Object3D[];private wings:T.Object3D[];private cape:T.Object3D;
 private saved:SavedPose[]=[];
 private posed=false;private hasFollowThrough=false;
 private rest:Map<T.Object3D,{p:T.Vector3;q:T.Quaternion}>;
 private armAxis:T.Vector3;private reach:number;private drop:number;
 private axis=new T.Vector3();private side=new T.Vector3();private vertical=new T.Vector3();private basis=new T.Matrix4();
 private orientation=new T.Quaternion();private parentOrientation=new T.Quaternion();
 private followThrough:SavedPose[]=[];
 constructor(private actor:T.Object3D){
  const node=(name:string)=>{const found=actor.getObjectByName(name);if(!found)throw Error(`Missing sword-swing joint: ${name}`);return found;};
  this.body=node('Body_motion');this.arm=node('Right_shoulder');this.grip=node('Right_grip');this.blade=node('Galaxia');
  this.leftArm=node('Left_shoulder');this.feet=['Left','Right'].map(side=>node(side+'_foot_pivot'));
  this.wings=['Left','Right'].map(side=>node(side+'_wing_pivot'));this.cape=node('Cape');
  const nodes=[this.body,this.arm,this.grip,this.leftArm,...this.feet,...this.wings,this.cape];
  this.rest=new Map(nodes.map(node=>[node,{p:node.position.clone(),q:node.quaternion.clone()}]));
  const snapshot=(node:T.Object3D)=>({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()});
  this.saved=nodes.map(snapshot);this.followThrough=nodes.map(snapshot);
  actor.updateMatrixWorld(true);
  this.armAxis=this.arm.worldToLocal(this.grip.getWorldPosition(new T.Vector3())).normalize();
  const length=this.arm.worldToLocal(this.grip.getWorldPosition(new T.Vector3())).length();
  // Reach the same radius as the warning using the real arm and blade lengths.
  this.reach=KNIGHT.slashRadius/KNIGHT.modelScale-TIP.y-this.arm.position.x;
  this.drop=-Math.sqrt(Math.max(.01,length*length-this.reach*this.reach));
 }
 clear(){
  if(!this.posed)return;
  for(const {node,p,q,s} of this.saved){node.position.copy(p);node.quaternion.copy(q);node.scale.copy(s);}
  this.posed=false;
 }
 reset(){this.clear();this.hasFollowThrough=false;}
 private capture(poses:SavedPose[]){for(const pose of poses){pose.p.copy(pose.node.position);pose.q.copy(pose.node.quaternion);pose.s.copy(pose.node.scale);}}
 apply(s:Pick<KnightBattle,'stage'|'step'|'since'|'until'>,progress:number){
  if(s.stage==='shot'||s.stage==='shot-warn'){this.hasFollowThrough=false;return;}
  if(s.stage!=='slash-warn'&&s.stage!=='slash'){
   const blend=1-T.MathUtils.smoothstep(progress*(s.until-s.since),0,280);
   if(blend>0&&this.hasFollowThrough){
    this.capture(this.saved);this.posed=true;
    for(const {node,p,q,s:scale} of this.followThrough){node.position.lerp(p,blend);node.quaternion.slerp(q,blend);node.scale.lerp(scale,blend);}
   }else this.hasFollowThrough=false;
   return;
  }
  const f=T.MathUtils.clamp(progress,0,1);
  const swing=s.stage==='slash',angle=knightSwordAngle(s,f);
  const ready=swing||s.step>=2?1:T.MathUtils.smoothstep(f,0,.7),weight=Math.sin(Math.PI*(swing?f:s.step>=2?f:ready));
  this.capture(this.saved);this.posed=true;
  const bodyRest=this.rest.get(this.body)!;
  this.body.position.copy(bodyRest.p);this.body.position.y-=.20*ready+.025*weight;
  this.body.rotation.set(0,(angle-Math.PI/2)*ready,0);
  this.arm.position.copy(this.rest.get(this.arm)!.p);this.arm.position.z*=1-ready;
  const lift=swing?0:Math.sin(Math.PI*f);
  this.orientation.setFromUnitVectors(this.armAxis,this.axis.set(this.reach,this.drop+.95*lift,0).normalize());
  this.arm.quaternion.copy(this.rest.get(this.arm)!.q).slerp(this.orientation,ready);
  this.leftArm.rotation.set(-.35*ready,0,-.45*ready);
  this.feet.forEach((foot,i)=>{
   foot.position.copy(this.rest.get(foot)!.p).applyAxisAngle(UP,(angle-Math.PI/2)*ready*.55);
   foot.position.y+=(i===1?.045:.025)*weight;foot.rotation.set(-.08*weight,(angle-Math.PI/2)*ready*.55,0);
  });
  this.wings.forEach((wing,i)=>{const side=i===0?-1:1;wing.rotation.set(0,side*(.47+.28*ready),side*(.025+.08*weight));});
  this.cape.rotation.set(-.14*ready,-.12*weight,0);
  // Lift Galaxia during the wind-up, then lay it across the warned sector.
  const pitch=1.2*lift;
  this.axis.set(Math.sin(angle)*Math.cos(pitch),Math.sin(pitch),Math.cos(angle)*Math.cos(pitch));
  this.side.crossVectors(UP,this.axis).normalize();
  this.vertical.crossVectors(this.axis,this.side);
  this.basis.makeBasis(this.vertical,this.axis,this.side);
  this.actor.updateMatrixWorld(true);
  this.orientation.setFromRotationMatrix(this.basis).premultiply(this.actor.getWorldQuaternion(this.parentOrientation));
  this.grip.parent!.getWorldQuaternion(this.parentOrientation).invert();
  this.orientation.premultiply(this.parentOrientation);
  this.grip.quaternion.copy(this.rest.get(this.grip)!.q).slerp(this.orientation,ready);
  this.actor.updateMatrixWorld(true);this.tip.copy(TIP).applyMatrix4(this.blade.matrixWorld);
  if(swing){this.capture(this.followThrough);this.hasFollowThrough=true;}
 }
}
