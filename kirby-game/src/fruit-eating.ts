import {Float32BufferAttribute,MathUtils,Mesh,Object3D,Vector3} from 'three';

export type FruitEaterKind='kirby'|'pigeon'|'meta-knight';
const smooth=MathUtils.smoothstep;
const bump=(t:number,a:number,b:number,c:number)=>smooth(t,a,b)*(1-smooth(t,b,c));
export const FRUIT_EATING={
 kirby:{swallow:.82,duration:1.22},
 pigeon:{swallow:.88,duration:1.30},
 'meta-knight':{swallow:.82,duration:1.18},
} as const;

/** A temporary upper-body pose, layered over the current walking/standing pose. */
export class FruitEatingPose{
 private restore:(()=>void)[]=[];
 private mouth?:Mesh;
 private mouthShape?:number;
 private mouthGeometry?:Mesh['geometry'];
 private readonly point=new Vector3();
 constructor(readonly actor:Object3D,readonly kind:FruitEaterKind){
  const mouth=actor.getObjectByName('Open_smiling_mouth');
  if(mouth instanceof Mesh)this.mouth=mouth;
 }
 clear(){for(let i=this.restore.length-1;i>=0;i--)this.restore[i]();this.restore=[];}
 dispose(){this.clear();this.mouthGeometry?.dispose();this.mouthGeometry=undefined;}
 private node(name:string){
  const node=this.actor.getObjectByName(name);if(!node)return;
  const p=node.position.clone(),q=node.quaternion.clone(),s=node.scale.clone();
  this.restore.push(()=>{node.position.copy(p);node.quaternion.copy(q);node.scale.copy(s);});return node;
 }
 private morph(mesh:Mesh,index:number,value:number){
  const weights=mesh.morphTargetInfluences;if(!weights)return;
  const before=weights.slice();this.restore.push(()=>{before.forEach((v,i)=>weights[i]=v);});
  weights.fill(0);weights[index]=value;
 }
 private prepareMouth(){
  if(!this.mouth||this.mouthShape!==undefined)return;
  const mesh=this.mouth,geometry=mesh.geometry.clone(),p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
  this.mouthGeometry=geometry;
  const positions:number[]=[],normals:number[]=[],relative=geometry.morphTargetsRelative;
  // Turn the smile into a round, puckered opening on the curved face. Moving
  // vertices along that surface keeps the mouth attached at oblique angles.
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),v=(y-1.087)/(y>=1.087?.023:.145);
   const nx=x/.165*.385,ny=1.06+v*.345;
   const oldFront=.84*Math.sqrt(Math.max(.001,1-x*x-((y-1.17)/.96)**2));
   const front=.84*Math.sqrt(Math.max(.001,1-nx*nx-((ny-1.17)/.96)**2));
   const nz=front+z-oldFront+.012,normal=new Vector3(nx,(ny-1.17)/(.96*.96),front/(.84*.84)).normalize();
   positions.push(nx-(relative?x:0),ny-(relative?y:0),nz-(relative?z:0));
   normals.push(normal.x-(relative?n.getX(i):0),normal.y-(relative?n.getY(i):0),normal.z-(relative?n.getZ(i):0));
  }
  this.mouthShape=geometry.morphAttributes.position?.length??0;
  geometry.morphAttributes.position=[...(geometry.morphAttributes.position??[]),new Float32BufferAttribute(positions,3)];
  geometry.morphAttributes.normal=[...(geometry.morphAttributes.normal??[]),new Float32BufferAttribute(normals,3)];
  const weights=mesh.morphTargetInfluences;mesh.geometry=geometry;mesh.updateMorphTargets();
  if(weights){while(weights.length<mesh.morphTargetInfluences!.length)weights.push(0);mesh.morphTargetInfluences=weights;}
  mesh.morphTargetDictionary!['Fruit inhale']=this.mouthShape;
  geometry.computeBoundingSphere();
 }
 mouthPosition(target:Vector3){
  if(this.kind==='pigeon'){
   const beak=this.actor.getObjectByName('Beak');
   if(beak)return beak.localToWorld(target.set(0,-.075,.24));
  }
  if(this.mouth)return this.mouth.localToWorld(target.set(0,1.06,.87));
  return this.actor.localToWorld(target.set(0,1.02,.85));
 }
 apply(t:number,fruit:Vector3){
  this.clear();
  const {swallow,duration}=FRUIT_EATING[this.kind];
  if(t<0||t>=duration)return;
  const open=smooth(t,0,.18)*(1-smooth(t,swallow-.07,swallow+.13));
  const gulp=bump(t,swallow-.03,swallow+.13,swallow+.33);
  const settle=bump(t,swallow+.14,swallow+.25,duration);
  if(this.kind==='kirby'){
   this.prepareMouth();
   if(this.mouth&&this.mouthShape!==undefined)this.morph(this.mouth,this.mouthShape,open);
   const tongue=this.node('Rounded_tongue');if(tongue)tongue.scale.multiplyScalar(1-.90*open);
   const body=this.node('Body_motion');
   if(body){
    const breath=Math.sin(t*24)*.005*open;
    body.scale.multiply(new Vector3(1+.045*open+.105*gulp+breath,1-.035*open+.035*gulp,1+.085*open+.055*gulp+breath));
    body.position.z+=.075*open-.025*gulp;body.position.y-=.025*open;
    body.rotateX(.045*open-.065*settle);
   }
   for(const [label,side] of [['Left',-1],['Right',1]] as const){
    const arm=this.node(`${label}_shoulder`);if(arm){arm.rotateX(-.30*open);arm.rotateZ(side*(.28*open-.10*gulp));}
    const eye=this.node(`${label}_eyelid_pivot`);if(eye)eye.scale.y*=1-.13*open-.65*settle;
   }
  }else if(this.kind==='pigeon'){
   // One deliberate reach, an open beak, then a head flick and a travelling
   // throat bulge. Feet and wings retain their independent locomotion.
   const reach=bump(t,.02,.38,swallow+.12),flick=bump(t,swallow-.08,swallow+.06,swallow+.23);
   this.point.copy(fruit);this.actor.worldToLocal(this.point);
   const yaw=MathUtils.clamp(Math.atan2(this.point.x,this.point.z),-.55,.55)*open;
   const neck=this.node('Neck');
   if(neck){neck.rotateX(.16*reach-.16*flick);neck.rotateY(yaw*.35);neck.position.z+=.10*reach;neck.scale.multiply(new Vector3(1+.14*gulp,1+.025*flick,1+.17*gulp));}
   const head=this.node('Head');
   if(head){head.rotateX(.11*reach-.23*flick);head.rotateY(yaw*.65);head.position.z+=.085*reach;head.position.y+=.045*flick;}
   const jaw=this.node('Lower_beak');if(jaw)jaw.rotateX(.64*open+.08*Math.sin(t*19)*open*(1-open));
   const body=this.node('Body');if(body){body.rotateX(.035*reach-.025*flick);body.scale.z*=1+.018*settle;}
   for(const side of ['Left','Right']){const lid=this.node(`${side}_eyelid`);if(lid){lid.scale.y=Math.max(lid.scale.y,.45*gulp);lid.scale.x=lid.scale.z=1;}}
  }else{
   const body=this.node('Body');if(body){body.rotateX(.045*open-.04*gulp);body.scale.z*=1+.035*gulp;}
  }
 }
}
