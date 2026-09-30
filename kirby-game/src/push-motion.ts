import {AnimationClip,Euler,Object3D,Quaternion,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack} from 'three';
const smooth=(t:number)=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
export const PUSH_HIT=.23,PUSH_DURATION=.62;
const PUSH_TIMES=[0,.1,.23,.36,.62],PUSH_STRENGTH=[0,-.12,1,.8,0];
const pushEuler=new Euler(),pushTurn=new Quaternion();
export function pushStrength(t:number){
 if(t<=PUSH_TIMES[0])return PUSH_STRENGTH[0];
 for(let i=1;i<PUSH_TIMES.length;i++)if(t<=PUSH_TIMES[i]){const u=(t-PUSH_TIMES[i-1])/(PUSH_TIMES[i]-PUSH_TIMES[i-1]);return PUSH_STRENGTH[i-1]+(PUSH_STRENGTH[i]-PUSH_STRENGTH[i-1])*u;}
 return 0;
}
export function applyPushArms(arms:{arm:Object3D;q:Quaternion;p:Vector3;side:number}[],t:number){
 const v=pushStrength(t);
 for(const {arm,q,p,side} of arms){
  pushEuler.set(-.15*v,-side*1.25*v,side*.2*v);pushTurn.setFromEuler(pushEuler);
  arm.quaternion.copy(q).multiply(pushTurn);
  arm.position.set(p.x-side*.1*v,p.y-.03*v,p.z+.35*v);
 }
}
export function pushClip(idle:AnimationClip,model:Object3D){
 const clip=idle.clone();clip.name='Push';clip.duration=PUSH_DURATION;
 const times=PUSH_TIMES,strength=PUSH_STRENGTH;
 for(const [label,side] of [['Left',-1],['Right',1]] as const){const arm=model.getObjectByName(label+'_shoulder');if(!arm)continue;
  const track=clip.tracks.find(t=>t.name===arm.name+'.quaternion'),base=track?new Quaternion().fromArray(Array.from(track.values).slice(0,4)):arm.quaternion.clone();
  clip.tracks=clip.tracks.filter(t=>t.name!==arm.name+'.quaternion');
  clip.tracks.push(new QuaternionKeyframeTrack(arm.name+'.quaternion',times,strength.flatMap(v=>base.clone().multiply(new Quaternion().setFromEuler(new Euler(-.15*v,-side*1.25*v,side*.2*v))).toArray())));
  const positionTrack=clip.tracks.find(t=>t.name===arm.name+'.position'),p=positionTrack?Array.from(positionTrack.values).slice(0,3):arm.position.toArray();
  clip.tracks=clip.tracks.filter(t=>t.name!==arm.name+'.position');clip.tracks.push(new VectorKeyframeTrack(arm.name+'.position',times,strength.flatMap(v=>[p[0]-side*.1*v,p[1]-.03*v,p[2]+.35*v])));
 }
 const root=model.children.find(o=>o.name.startsWith('Kirby'))??model.children[0];
 if(root){const track=clip.tracks.find(t=>t.name===root.name+'.position'),base=track?Array.from(track.values).slice(0,3):root.position.toArray();clip.tracks=clip.tracks.filter(t=>t.name!==root.name+'.position');clip.tracks.push(new VectorKeyframeTrack(root.name+'.position',times,strength.flatMap(v=>[base[0],base[1]-.08*Math.abs(v),base[2]+.15*v])));}
 return clip;
}
/** A short, non-damaging tumble. The actor stays upright; only its visual root rolls. */
export class PushRoll{
 state?:number[];private poses:{root:Object3D;p:Vector3;q:Quaternion;s:Vector3}[]=[];
 get active(){return !!this.state;}
 start(dx:number,dz:number,ground:number){const d=Math.hypot(dx,dz)||1;this.state=[dx/d,dz/d,0,2.8,ground];}
 clearPose(){for(const p of this.poses){p.root.position.copy(p.p);p.root.quaternion.copy(p.q);p.root.scale.copy(p.s);}this.poses=[];}
 reset(){this.clearPose();this.state=undefined;}
 update(dt:number,actor:Object3D,ground:number){
  const r=this.state;if(!r)return false;const before=r[2];r[2]+=dt;r[4]=ground;
  const distance=4.2*actor.scale.x*(smooth(Math.min(1,r[2]/.95))-smooth(Math.min(1,before/.95)));
  actor.position.x+=r[0]*distance;actor.position.z+=r[1]*distance;
  const gravity=30*actor.scale.x;actor.position.y=Math.max(ground,actor.position.y+r[3]*dt-.5*gravity*dt*dt);r[3]-=gravity*dt;
  if(actor.position.y<=ground)r[3]=0;
  if(r[2]>=.95&&actor.position.y<=ground+.01){this.state=undefined;return false;}return true;
 }
 applyPose(root:Object3D,yaw:number){
  const r=this.state;if(!r)return;this.clearPose();const save=(node:Object3D)=>this.poses.push({root:node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()});save(root);
  const axis=new Vector3(r[1],0,-r[0]).applyAxisAngle(new Vector3(0,1,0),-yaw),q=new Quaternion().setFromAxisAngle(axis,Math.PI*2*smooth(r[2]/.95)),center=new Vector3(0,1.05,0);
  root.position.add(center.clone().sub(center.clone().applyQuaternion(q)));root.quaternion.premultiply(q);
  const spring=Math.sin(Math.min(1,r[2]/.95)*Math.PI*4)*Math.exp(-r[2]*3);root.scale.multiply(new Vector3(1+spring*.07,1-spring*.07,1+spring*.07));
  const tuck=Math.sin(Math.min(1,r[2]/.95)*Math.PI);
  for(const [name,side] of [['Left',-1],['Right',1]] as const){const arm=root.getObjectByName(name+'_shoulder'),foot=root.getObjectByName(name+'_foot_pivot');if(arm){save(arm);arm.rotateY(-side*tuck*.6);}if(foot){save(foot);foot.rotateX(-tuck*.8);}}
 }
}
