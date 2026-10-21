import * as T from 'three';
import {KNIGHT,knightJumpOpening,type KnightBattle} from './meta-knight-battle';
import {starOpening,ricochetCurve,ricochetIndex} from './meta-knight-star-assault';

const TIP=new T.Vector3(-.315,2.05,0).normalize();
const BLADE_LENGTH=Math.hypot(.315,2.05);
const TIP_UP=new T.Quaternion().setFromUnitVectors(TIP,new T.Vector3(0,1,0));
/** Poses layered over the native rig; the flying thrust is shared with players. */
export class MetaKnightBattleMotion{
 private body:T.Object3D;private motion:T.Object3D;private arm:T.Object3D;private left:T.Object3D;private hand:T.Object3D;private wrist:T.Object3D;private grip:T.Object3D;private feet:T.Object3D[];
 private poses:{node:T.Object3D;p:T.Vector3;q:T.Quaternion}[];private active=false;
 private armAxis:T.Vector3;private leftAxis:T.Vector3;private q=new T.Quaternion();private parentQ=new T.Quaternion();private axis=new T.Vector3();private hilt=new T.Vector3();private support=new T.Vector3();
 private side=new T.Vector3();private normal=new T.Vector3();private basis=new T.Matrix4();
 private wings:T.Object3D[];private cape:T.Object3D;
 constructor(private actor:T.Object3D){
  const node=(name:string)=>{const n=actor.getObjectByName(name);if(!n)throw Error('Missing battle joint: '+name);return n;};
  this.body=node('Body_motion');this.motion=node('MetaKnight_motion');this.arm=node('Right_shoulder');this.left=node('Left_shoulder');this.hand=node('Left_gauntlet');this.wrist=node('Right_gauntlet');this.grip=node('Right_grip');this.feet=['Left','Right'].map(s=>node(s+'_foot_pivot'));
  this.wings=['Left','Right'].map(s=>node(s+'_wing_pivot'));this.cape=node('Cape');
  this.poses=[this.motion,this.body,this.arm,this.left,this.hand,this.wrist,this.grip,...this.feet,...this.wings,this.cape].map(node=>({node,p:node.position.clone(),q:node.quaternion.clone()}));
  actor.updateMatrixWorld(true);this.armAxis=this.arm.worldToLocal(this.grip.getWorldPosition(new T.Vector3())).normalize();
  this.leftAxis=this.hand.position.clone().normalize();
 }
 clear(){if(!this.active)return;for(const {node,p,q} of this.poses){node.position.copy(p);node.quaternion.copy(q);}this.active=false;}
 private savePose(){if(this.active)return;for(const pose of this.poses){pose.p.copy(pose.node.position);pose.q.copy(pose.node.quaternion);}this.active=true;}
 applyThrust(extend=1,ricochet=false){
  this.savePose();
  this.body.rotation.set(.18*extend,0,0);this.left.rotation.set(.25,0,-.45);this.arm.position.x=T.MathUtils.lerp(this.arm.position.x,.46,extend);
  this.q.setFromUnitVectors(this.armAxis,this.axis.set(-.2,-.2,1).normalize());this.arm.quaternion.slerp(this.q,extend);
  this.actor.updateMatrixWorld(true);this.actor.worldToLocal(this.grip.getWorldPosition(this.hilt));this.placeHilt(.22,ricochet?.75:this.hilt.y,1.06);
  this.aim(this.axis.set(0,ricochet?-.35:-.045,1),extend);
  this.feet.forEach((foot,i)=>{foot.position.set((i?1:-1)*.46,.54,-.17);foot.rotation.set(-.8,0,0);});
 }
 private aim(direction:T.Vector3,blend=1){
  this.actor.updateMatrixWorld(true);
  direction.normalize();this.side.set(1,0,0).addScaledVector(direction,-direction.x).normalize();this.normal.crossVectors(this.side,direction);
  this.basis.makeBasis(this.side,direction,this.normal);
  this.q.setFromRotationMatrix(this.basis).multiply(TIP_UP).premultiply(this.actor.getWorldQuaternion(this.parentQ));
  this.grip.parent!.getWorldQuaternion(this.parentQ).invert();this.q.premultiply(this.parentQ);this.grip.quaternion.slerp(this.q,blend);
 }
 private placeHilt(x:number,y:number,z:number){
  this.actor.updateMatrixWorld(true);this.actor.localToWorld(this.support.set(x,y,z));this.wrist.parent!.worldToLocal(this.support);
  this.grip.getWorldPosition(this.hilt);this.wrist.parent!.worldToLocal(this.hilt);this.wrist.position.add(this.support.sub(this.hilt));
 }
 private twoHands(blend:number){
  // The support fist follows the lower hilt through the entire sword reversal.
  this.actor.updateMatrixWorld(true);this.grip.localToWorld(this.support.set(0,-.23,.025));
  this.axis.copy(this.support);this.left.parent!.worldToLocal(this.axis).sub(this.left.position).normalize();
  this.q.setFromUnitVectors(this.leftAxis,this.axis);this.left.quaternion.slerp(this.q,blend);
  this.actor.updateMatrixWorld(true);this.axis.copy(this.support);this.left.worldToLocal(this.axis);this.hand.position.lerp(this.axis,blend);
  this.grip.getWorldQuaternion(this.q);this.left.getWorldQuaternion(this.parentQ).invert();this.q.premultiply(this.parentQ);this.hand.quaternion.slerp(this.q,blend);
 }
 private jumpPose(crouch:number,plunge:number,air:boolean,hold:number,recovery=0,raisedHilt?:number,seat=0){
  // Land just behind the blade so its ground contact remains visible in front.
  this.motion.position.z=-1.04*plunge*(1-seat);
  this.body.position.y=1.17-.22*crouch-.1*recovery;this.body.rotation.set(.08*crouch+.14*recovery,0,0);this.left.rotation.set(-.35,0,-.6*crouch);
  this.arm.position.x=T.MathUtils.lerp(this.arm.position.x,.52,crouch);this.left.position.x=T.MathUtils.lerp(this.left.position.x,-.52,crouch);
  this.q.setFromUnitVectors(this.armAxis,this.axis.set(-.4,.6,.65).normalize());this.arm.quaternion.copy(this.q);
  this.feet.forEach((foot,i)=>{foot.position.set((i?1:-1)*.48,air?.55:.25,air?-.08:.11);foot.rotation.set(air?-.7:0,0,0);});
  if(seat>0){
   this.body.position.lerp(this.axis.set(0,.92,-.18),seat);this.body.rotation.x=T.MathUtils.lerp(this.body.rotation.x,-.10,seat);
   this.feet.forEach((foot,i)=>{foot.position.lerp(this.axis.set((i?1:-1)*.44,.26,.35),seat);this.q.setFromEuler(new T.Euler(-.25,0,(i?1:-1)*.12));foot.quaternion.slerp(this.q,seat);});
  }
  if(plunge>0){
   this.q.setFromUnitVectors(this.armAxis,this.axis.set(-.4,.15,.65).normalize());this.arm.quaternion.slerp(this.q,plunge);
  }
  this.actor.updateMatrixWorld(true);this.actor.worldToLocal(this.grip.getWorldPosition(this.hilt));
  let y=T.MathUtils.lerp(raisedHilt??this.hilt.y+.14,2,plunge);const z=this.motion.position.z+1.04+.45*Math.sin(Math.PI*plunge)+.36*seat,turn=.30+(Math.PI-.30)*plunge;
  // Explicit forward arc: never rotate the long blade back through the mask.
  for(let i=0;i<3;i++){
   this.axis.set(-.10/Math.max(.1,y-.015)*plunge,Math.cos(turn),Math.sin(turn)-z/Math.max(.1,y-.015)*plunge).normalize();
   const tipY=this.actor.position.y+(y+BLADE_LENGTH*this.axis.y)*KNIGHT.modelScale;
   if(air&&tipY<.14)y+=(.14-tipY)/KNIGHT.modelScale;else break;
  }
  if(seat>0){
   // Plant just ahead of the seated body, still inside the marked landing circle.
   const forward=1.1*seat-z,vertical=Math.sqrt(Math.max(.04,BLADE_LENGTH**2-.10**2-forward*forward)),tip=air?Math.max(-.07,(.14-this.actor.position.y)/KNIGHT.modelScale):-.07;
   y=T.MathUtils.lerp(y,vertical+tip,seat);this.axis.lerp(this.normal.set(-.10,-vertical,forward).normalize(),seat).normalize();
   if(air)y=Math.max(y,(.14-this.actor.position.y)/KNIGHT.modelScale-BLADE_LENGTH*this.axis.y);
  }
  this.placeHilt(.10,y,z);this.aim(this.axis);
  this.twoHands(hold);
  if(recovery)this.feet.forEach((foot,i)=>{foot.position.z+=(i?.22:-.15)*recovery;foot.rotation.x=-.15*recovery;});
 }
 apply(s:KnightBattle,f:number){
  const stage=s.stage,elapsed=f*(s.until-s.since),landed=knightJumpOpening(s),impact=stage==='slam',seated=stage==='won'||stage==='stunned'||stage==='crystal-break'||stage==='open',rising=stage==='get-up',charging=stage==='shot-warn'||stage==='shot';
  const warning=stage==='jump-warn'||stage==='dive-warn',air=stage==='jump'||stage==='dive',recover=stage==='wave'&&elapsed<350,dash=stage==='dash'||stage==='dash-warn'||stage==='ricochet'||stage==='ricochet-warn';
  const star=s.pattern==='star'&&!['won','lost','cancelled','stunned','get-up','crystal-break'].includes(stage)||s.phase===3&&stage==='transition';
  if(!seated&&!rising&&!charging&&!warning&&!air&&!impact&&!recover&&!dash&&!star)return;
  this.savePose();
  if(star){
   const tired=starOpening(s),fall=stage==='star-fall',lift=stage==='star-warn';
   const rest=tired?T.MathUtils.smoothstep(elapsed,0,600):0;
   this.wings.forEach((wing,i)=>{const side=i?1:-1;wing.rotation.set(T.MathUtils.lerp(-.10,.28,rest),side*T.MathUtils.lerp(.82+.13*Math.sin(elapsed*.012),.30,rest),side*T.MathUtils.lerp(.08,-1.05,rest));});
   this.cape.rotation.set(tired?.1:-.25,0,.05*Math.sin(elapsed*.007));
   if(lift){
    const raise=T.MathUtils.smoothstep(f,0,.4),turn=T.MathUtils.lerp(Math.PI/2,.30,raise);
    this.body.position.y=.95;this.body.rotation.set(.08,0,0);this.arm.rotation.set(-.8,0,-.1);this.left.rotation.set(-.5,0,-.65);
    this.placeHilt(.1,T.MathUtils.lerp(.75,1.65,raise),1.25-.21*raise);this.aim(this.axis.set(0,Math.cos(turn),Math.sin(turn)));this.twoHands(raise);
    this.feet.forEach((foot,i)=>{foot.position.set((i?1:-1)*.48,.55,-.08);foot.rotation.set(-.7,0,0);});return;
   }
   if(tired||fall){this.jumpPose(1,tired?1:T.MathUtils.smoothstep(f,.12,.9),!tired,1,tired?T.MathUtils.smoothstep(elapsed,100,650):0,1.65);return;}
   if(!dash){
    const conducting=stage==='cross-warn'||stage==='cross',cut=stage==='cross'?T.MathUtils.smoothstep(f,0,.75):0;
    this.body.position.y=1.08+.025*Math.sin(elapsed*.008);this.body.rotation.set(-.03,conducting?-.3+.6*cut:0,0);
    this.arm.rotation.set(-.8,0,-.1);this.left.rotation.set(-.6,0,-.95);this.placeHilt(.65,1.22,1.05);
    const turn=.8-1.6*cut;this.aim(this.axis.set(conducting?Math.sin(turn):.2,conducting?(stage==='cross-warn'?.85*(1-f)+.15:.15):.95,Math.cos(turn)));
    this.feet.forEach((foot,i)=>{foot.position.set((i?1:-1)*.47,.55,-.10);foot.rotation.set(-.75,0,0);});return;
   }
  }
  if(seated||rising){
   const settle=rising?1-T.MathUtils.smoothstep(f,0,1):landed||stage==='won'||stage==='stunned'||stage==='crystal-break'?1:T.MathUtils.smoothstep(elapsed,0,240),bob=Math.sin(elapsed*.007)*.01;
   this.motion.position.z=T.MathUtils.lerp(this.motion.position.z,0,settle);
   this.body.position.lerp(this.axis.set(0,.92+bob,-.18),settle);this.body.rotation.x=T.MathUtils.lerp(this.body.rotation.x,-.10,settle);this.body.rotation.y*=1-settle;this.body.rotation.z=.025*Math.sin(elapsed*.009)*settle;
   this.feet.forEach((foot,i)=>{foot.position.lerp(this.axis.set((i?1:-1)*.44,.26,.35),settle);this.q.setFromEuler(new T.Euler(-.25,0,(i?1:-1)*.12));foot.quaternion.slerp(this.q,settle);});
   for(const [node,rotation] of [[this.arm,[-.12,0,.24]],[this.left,[-.12,0,-.24]],[this.grip,[.28,.1,-.29]]] as const){this.q.setFromEuler(new T.Euler(...rotation));node.quaternion.slerp(this.q,settle);}
   for(const node of [this.arm,this.left,this.hand,this.wrist]){const pose=this.poses.find(p=>p.node===node)!;node.position.lerp(pose.p,settle);if(node===this.hand)node.quaternion.slerp(pose.q,settle);}
   if(landed){
    // The body is seated on the very first impact frame; only the planted sword recovers.
    const hold=1-T.MathUtils.smoothstep(elapsed,160,240);
    if(hold>0){
     const z=1.4,vertical=Math.sqrt(BLADE_LENGTH**2-.10**2-.30**2),turn=T.MathUtils.lerp(Math.PI+Math.atan(.30/vertical),0,T.MathUtils.smoothstep(elapsed,0,190)),x=-.10/BLADE_LENGTH*(1-T.MathUtils.clamp(elapsed/240,0,1)),flat=Math.sqrt(1-x*x);
     this.actor.updateMatrixWorld(true);this.actor.worldToLocal(this.grip.getWorldPosition(this.hilt));this.hilt.lerp(this.support.set(.10,vertical-.07,z),1-T.MathUtils.smoothstep(elapsed,120,240));this.placeHilt(this.hilt.x,this.hilt.y,this.hilt.z);
     this.aim(this.axis.set(x,Math.cos(turn)*flat,Math.sin(turn)*flat),hold);this.twoHands(hold);
    }
   }
   if(stage==='open'&&!landed){const slip=Math.sin(Math.PI*T.MathUtils.clamp(elapsed/320,0,1));this.body.rotation.x-=.27*slip;this.body.position.y+=.15*slip;this.feet.forEach(foot=>foot.position.z+=.15*slip);}
   if(rising)this.body.rotation.x+=.15*Math.sin(Math.PI*f);
   return;
  }
  if(charging){
   // Keep the blade on the locked launch ray while the crescent separates.
   // Native Fly animation must not move its emitter to the side of that ray.
   const release=KNIGHT.shotReleaseMs,separate=release+KNIGHT.shotLaunchMs;
   const wind=stage==='shot-warn'?T.MathUtils.smoothstep(f,0,.72):1,cut=stage==='shot'?(elapsed<=release?.5*T.MathUtils.smoothstep(elapsed,0,release):.5+.5*T.MathUtils.smoothstep(elapsed,separate,separate+release)):0,returning=stage==='shot'?T.MathUtils.smoothstep(elapsed,separate+release,1050):0;
   const angle=stage==='shot-warn'?T.MathUtils.lerp(.35,-1.2,wind):T.MathUtils.lerp(T.MathUtils.lerp(-1.2,1.2,cut),.35,returning),turn=stage==='shot-warn'?-.35*wind:T.MathUtils.lerp(-.35,.4,cut)*(1-returning);
   this.body.position.y=1.2-.06*(stage==='shot-warn'?wind:1-returning);this.body.rotation.set(.05,turn,0);this.arm.rotation.set(-.4,0,-.15);this.left.rotation.set(-.4,0,-.5);
   const x=stage==='shot-warn'?T.MathUtils.lerp(.6,-.6,wind):T.MathUtils.lerp(T.MathUtils.lerp(-.6,.6,cut),.6,returning),z=1.2+.12*Math.sin(Math.PI*cut)*(1-returning),dy=T.MathUtils.clamp(((KNIGHT.projectileHeight-this.actor.position.y)/KNIGHT.modelScale-KNIGHT.shotHiltY)/BLADE_LENGTH,-.8,.8),flat=Math.sqrt(1-dy*dy);
   this.placeHilt(x,KNIGHT.shotHiltY,z);this.aim(this.axis.set(Math.sin(angle)*flat,dy,Math.cos(angle)*flat));this.twoHands(stage==='shot-warn'?T.MathUtils.smoothstep(f,0,.22):1);
   const heel=Math.max(this.body.position.y-1,.33-this.actor.position.y/KNIGHT.modelScale);
   this.feet.forEach((foot,i)=>{foot.position.set((i?1:-1)*.49,heel,.38).applyAxisAngle(new T.Vector3(0,1,0),turn);foot.rotation.set(.1,turn,(i?1:-1)*.035);});
   return;
  }
  if(dash){
   const extend=stage==='dash'||stage==='ricochet'?1:T.MathUtils.smoothstep(f,.15,.85);
   if(stage==='ricochet'&&f>.04&&f<.96){const i=ricochetIndex(s),a=ricochetCurve(s,i,f-.04),b=ricochetCurve(s,i,f),c=ricochetCurve(s,i,f+.04),turn=Math.atan2(c[0]-b[0],c[2]-b[2])-Math.atan2(b[0]-a[0],b[2]-a[2]);this.motion.rotation.z=T.MathUtils.clamp(Math.atan2(Math.sin(turn),Math.cos(turn))*1.5,-.28,.28)*T.MathUtils.smoothstep(f,0,.15)*(1-T.MathUtils.smoothstep(f,.85,1));}
   this.applyThrust(extend,stage==='ricochet'||stage==='ricochet-warn');return;
  }
  const crouch=warning?T.MathUtils.smoothstep(f,.12,.85):air?1:impact?1:1-T.MathUtils.smoothstep(elapsed,0,350);
  const plunge=warning?0:air?T.MathUtils.smoothstep(f,.4,.94):impact?1:crouch;
  this.jumpPose(crouch,plunge,air,warning?T.MathUtils.smoothstep(f,0,.3):1,0,undefined,stage==='jump'?T.MathUtils.smoothstep(f,.82,1):0);
 }
}
