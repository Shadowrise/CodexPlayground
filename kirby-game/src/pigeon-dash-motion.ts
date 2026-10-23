import {AnimationClip,AnimationMixer,Euler,Group,LoopRepeat,MathUtils,Object3D,PropertyBinding,Quaternion,Vector3} from 'three';

/** Integral of a smooth burst: no instantaneous launch or abrupt stop. */
export function pigeonDashTravel(progress:number){
 const u=MathUtils.clamp(progress,0,1);return u*u*u*(10+u*(-15+6*u));
}

/** A reversible pose over the shipped bird rig; works with both pigeon skins. */
export class PigeonDashMotion{
 private readonly sampleRoot=new Group();
 private readonly mixer:AnimationMixer;
 private readonly rows:{node:Object3D;sample:Object3D;p:Vector3;q:Quaternion;s:Vector3}[];
 private readonly axis=new Vector3(0,0,1);
 private readonly pivot=new Vector3(0,1.12,0);
 private readonly offset=new Vector3();
 private applied=false;
 constructor(model:Object3D,flight:AnimationClip){
  const clip=flight.clone();clip.name='Pigeon burst pose sampler';
  clip.tracks=clip.tracks.filter(track=>['position','quaternion','scale'].includes(PropertyBinding.parseTrackName(track.name).propertyName));
  const names=new Set(clip.tracks.map(track=>PropertyBinding.parseTrackName(track.name).nodeName));
  this.rows=[...names].flatMap(name=>{
   const node=model.getObjectByName(name);if(!node)return [];
   const sample=new Object3D();sample.name=name;this.sampleRoot.add(sample);
   return [{node,sample,p:new Vector3(),q:new Quaternion(),s:new Vector3()}];
  });
  this.mixer=new AnimationMixer(this.sampleRoot);this.mixer.clipAction(clip).setLoop(LoopRepeat,Infinity).play();
 }
 clear(){
  if(!this.applied)return;
  for(const {node,p,q,s} of this.rows){node.position.copy(p);node.quaternion.copy(q);node.scale.copy(s);}
  this.applied=false;
 }
 apply(charge:number,progress:number,active:boolean){
  this.clear();if(!active&&charge<=0)return;
  const smooth=MathUtils.smoothstep,u=MathUtils.clamp(progress,0,1);
  const weight=active?1-smooth(u,.78,1):smooth(charge,0,.25);
  if(weight<=0)return;
  for(const {node,p,q,s} of this.rows){p.copy(node.position);q.copy(node.quaternion);s.copy(node.scale);}
  this.mixer.setTime(active?u*.7:charge*.3);
  for(const {node,sample} of this.rows){node.position.copy(sample.position);node.quaternion.copy(sample.quaternion);node.scale.copy(sample.scale);}
  const find=(name:string)=>this.rows.find(row=>row.node.name===name)?.node;
  const turn=(node:Object3D|undefined,x:number,y=0,z=0)=>node?.quaternion.setFromEuler(new Euler(x,y,z));
  const dive=active?smooth(u,0,.24):0,recover=active?1-smooth(u,.65,1):1;
  const fold=active?smooth(u,.09,.32)*(1-smooth(u,.61,.91)):0;
  const brake=active?smooth(u,.59,.77)*(1-smooth(u,.90,1)):0;
  const pitch=active?(.30+.60*dive)*recover:.30*smooth(charge,0,1);
  const motion=find('Motion');
  if(motion){
   turn(motion,pitch,0,active?.018*Math.sin(u*Math.PI*2):0);
   motion.position.copy(this.pivot).sub(this.offset.copy(this.pivot).applyQuaternion(motion.quaternion));
   motion.position.y-=.10*dive*recover;
  }
  const body=find('Body'),neck=find('Neck'),head=find('Head');
  turn(body,.025);if(body)body.position.y=.65;
  turn(neck,-pitch*.34-.015);if(neck){neck.position.y+=.055*dive;neck.position.z+=.025*dive;}
  turn(head,-pitch*.66-.01);if(head)head.position.z+=.055*dive;
  const stroke=active?MathUtils.lerp(-.32,.68,smooth(u,0,.13))*(1-smooth(u,.13,.31)):-.32*smooth(charge,.45,1);
  for(const [index,side] of [-1,1].entries()){
   const label=index===0?'Left':'Right',wing=find(label+'_wing'),vane=find(label+'_wing_vane');
   const spread=MathUtils.lerp(1.45,.14,fold),beat=stroke+brake*.48;
   if(wing){turn(wing,0,-side*spread,side*beat);}
   if(vane){vane.quaternion.setFromAxisAngle(this.axis,side*MathUtils.lerp(Math.PI/2,.24,fold));vane.scale.x=MathUtils.lerp(.30,.88,fold);}
  }
  const tail=find('Tail');turn(tail,-.12-.40*pitch+.32*brake);if(tail)tail.scale.x=1+.18*brake;
  turn(find('Forehead_tuft'),-.20*fold);
  // A focused gaze; the beak remains level while the long body pitches forward.
  for(const side of ['Left','Right']){
   const lid=find(side+'_eyelid');if(lid){lid.scale.set(1,.10+.08*fold,1);lid.position.y=.17*(1-lid.scale.y);}
  }
  for(const {node,sample,p,q,s} of this.rows){
   // Network peers share the sampled recovery phase, rather than their local
   // animation clock. Charging still eases out of the current jump/flight pose.
   node.position.lerp(active?sample.position:p,1-weight);node.quaternion.slerp(active?sample.quaternion:q,1-weight);node.scale.lerp(active?sample.scale:s,1-weight);
  }
  this.applied=true;
 }
 dispose(){this.clear();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.sampleRoot);}
}
