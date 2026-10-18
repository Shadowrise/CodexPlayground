import * as T from 'three';

type Rig='kirby'|'meta-knight'|'pigeon';
type Pose={node:T.Object3D;p:T.Vector3;q:T.Quaternion;s:T.Vector3};
/** Arena-only overlays: a real seated silhouette and spirals attached to the face. */
export class DuelDazedPose{
 private groups:T.Group[]=[];private hidden:{node:T.Object3D;visible:boolean}[]=[];private poses:Pose[]=[];private posed=false;private seated=false;
 private geometries=new Set<T.BufferGeometry>();private materials:T.Material[]=[];
 constructor(private actor:T.Object3D,private rig:Rig){
  const ink=new T.MeshBasicMaterial({color:rig==='meta-knight'?'#ffe66b':'#29324d',toneMapped:false}),ivory=new T.MeshBasicMaterial({color:'#fff7de',toneMapped:false});this.materials.push(ink,ivory);
  const remember=(name:string)=>{const node=actor.getObjectByName(name);if(node)this.poses.push({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()});};
  for(const name of [rig==='pigeon'?'Body':'Body_motion','Head','Left_shoulder','Right_shoulder','Left_foot_pivot','Right_foot_pivot'])remember(name);
  const hide=(node:T.Object3D|undefined)=>{if(node)this.hidden.push({node,visible:node.visible});};
  const root=(parent:T.Object3D)=>{const group=new T.Group();group.name='Duel dazed eyes';group.visible=false;parent.add(group);this.groups.push(group);return group;};
  const add=(parent:T.Object3D,geometry:T.BufferGeometry,material:T.Material,name:string)=>{this.geometries.add(geometry);const mesh=new T.Mesh(geometry,material);mesh.name=name;parent.add(mesh);return mesh;};
  const spiral=(parent:T.Object3D,label:string,cx:number,cy:number,rx:number,ry:number,z:(x:number,y:number)=>number,thickness:number)=>{
   const points:T.Vector3[]=[];for(let i=0;i<=96;i++){const u=i/96,r=.06+.92*u,angle=u*Math.PI*4.8,x=cx+Math.cos(angle)*rx*r,y=cy+Math.sin(angle)*ry*r;points.push(new T.Vector3(x,y,z(x,y)));}
   add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points),96,thickness,6,false),ink,label+' dazed spiral eye');
  };
  if(rig==='pigeon'){
   for(const side of ['Left','Right']){const eye=actor.getObjectByName(side+'_eye');if(!eye)continue;hide(actor.getObjectByName(side+'_pupil'));hide(actor.getObjectByName(side+'_eyelid'));spiral(root(eye),side,0,.015,.13,.13,(x,y)=>.015+.063*Math.sqrt(Math.max(.05,1-(x/.16)**2-(y/.165)**2))+.008,.009);}
  }else{
   const parent=actor.getObjectByName(rig==='meta-knight'?'Mask_shell':'Body_motion');if(!parent)return;const group=root(parent);
   if(rig==='meta-knight'){
    hide(actor.getObjectByName('Eyes_glow'));
    const z=(x:number,y:number)=>.79*Math.sqrt(Math.max(.001,1-(x/.91)**2-(y/.91)**2))+.09;
    for(const side of [-1,1])spiral(group,side<0?'Left':'Right',side*.29,-.045,.13,.14,z,.014);
   }else{
    for(const side of ['Left','Right'])hide(actor.getObjectByName(side+'_eyelid_pivot'));
    for(const name of ['Open_smiling_mouth','Rounded_tongue'])hide(actor.getObjectByName(name));
    const z=(x:number,y:number)=>.84*Math.sqrt(Math.max(.001,1-x*x-(y/.96)**2))+.028;
    const patch=(cx:number,cy:number,rx:number,ry:number,material:T.Material,name:string,depth=0)=>{const shape=new T.Shape();shape.absellipse(cx,cy,rx,ry,0,Math.PI*2,false,0);const geometry=new T.ShapeGeometry(shape,48),positions=geometry.getAttribute('position');for(let i=0;i<positions.count;i++)positions.setZ(i,z(positions.getX(i),positions.getY(i))-.012+depth);add(group,geometry,material,name);};
    for(const side of [-1,1]){const cx=side*.255;patch(cx,.37,.122,.205,ink,'Dazed eye outline');patch(cx,.37,.108,.189,ivory,'Dazed eye ivory',.004);spiral(group,side<0?'Left':'Right',cx,.37,.088,.158,z,.012);}
    patch(0,-.09,.06,.085,ink,'Dazed surprised mouth');
   }
  }
 }
 clear(){
  if(!this.posed)return;if(this.seated)for(const {node,p,q,s} of this.poses){node.position.copy(p);node.quaternion.copy(q);node.scale.copy(s);}for(const {node,visible} of this.hidden)node.visible=visible;for(const group of this.groups)group.visible=false;this.posed=false;
 }
 apply(now:number,seat=true){
  this.clear();this.seated=seat;if(seat)for(const pose of this.poses){pose.p.copy(pose.node.position);pose.q.copy(pose.node.quaternion);pose.s.copy(pose.node.scale);}for(const saved of this.hidden){saved.visible=saved.node.visible;saved.node.visible=false;}for(const group of this.groups)group.visible=true;this.posed=true;
  if(!seat)return;
  const body=this.actor.getObjectByName(this.rig==='pigeon'?'Body':'Body_motion'),wobble=Math.sin(now*.004);if(!body)return;
  if(this.rig==='pigeon'){body.position.y=.44+.006*wobble;body.rotation.set(.045,0,.025*wobble);return;}
  const knight=this.rig==='meta-knight';body.position.set(0,(knight?.92:.99)+.008*wobble,knight?-.18:-.10);body.rotation.set(-.10,0,.035*wobble);
  for(const [side,sign] of [['Left',-1],['Right',1]] as const){const foot=this.actor.getObjectByName(side+'_foot_pivot'),arm=this.actor.getObjectByName(side+'_shoulder');
   if(foot){foot.position.set(sign*(knight?.44:.46),knight?.26:.38,knight?.35:.59);foot.rotation.set(knight?-.25:-.40,0,sign*.12);}
   if(arm)arm.rotation.set(-.18,0,sign*.27);
  }
 }
 dispose(){this.clear();this.groups.forEach(group=>group.removeFromParent());this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());}
}
