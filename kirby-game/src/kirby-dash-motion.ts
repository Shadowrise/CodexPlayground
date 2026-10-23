import {Euler,MathUtils,Object3D,Quaternion,Vector3} from 'three';

/** Reversible airplane pose: the game actor and its heading remain upright. */
export class KirbyDashMotion{
 private readonly poses:{node:Object3D;p:Vector3;q:Quaternion}[]=[];
 private readonly turn=new Quaternion();
 private readonly angles=new Euler();
 private readonly center=new Vector3(0,1.05,0);
 private readonly offset=new Vector3();
 constructor(private readonly root:Object3D){
  for(const node of [root,...['Left_shoulder','Right_shoulder','Left_foot_pivot','Right_foot_pivot'].map(name=>root.getObjectByName(name))]){
   if(node)this.poses.push({node,p:new Vector3(),q:new Quaternion()});
  }
 }
 private applied=false;
 clear(){if(!this.applied)return;for(const {node,p,q} of this.poses){node.position.copy(p);node.quaternion.copy(q);}this.applied=false;}
 apply(charge:number,progress:number,active:boolean){
  this.clear();if(!active&&charge<=0)return;
  const smooth=MathUtils.smoothstep,u=MathUtils.clamp(progress,0,1),weight=active?1-smooth(u,.76,1):smooth(charge,0,.5)*.65;
  if(weight<=0)return;
  for(const pose of this.poses){pose.p.copy(pose.node.position);pose.q.copy(pose.node.quaternion);}
  const pitch=active?(.20+.40*smooth(u,0,.22))*(1-smooth(u,.68,1)):.15;
  this.turn.setFromEuler(this.angles.set(pitch,0,active?.025*Math.sin(u*Math.PI*2):0));
  this.root.quaternion.slerp(this.turn,weight);
  this.root.position.add(this.offset.copy(this.center).sub(this.center.clone().applyQuaternion(this.turn)).multiplyScalar(weight));
  for(const {node,p} of this.poses){
   const side=node.name.startsWith('Left')?-1:1;
   if(node.name.endsWith('_shoulder')){
    this.turn.setFromEuler(this.angles.set(-.06,-side*.10,-side*.34));node.quaternion.slerp(this.turn,weight);
    node.position.x=MathUtils.lerp(p.x,p.x+side*.08,weight);
   }else if(node.name.endsWith('_foot_pivot')){
    this.turn.setFromEuler(this.angles.set(-.65,0,side*.08));node.quaternion.slerp(this.turn,weight);
    node.position.z=MathUtils.lerp(p.z,p.z-.20,weight);
   }
  }
  this.applied=true;
 }
}
