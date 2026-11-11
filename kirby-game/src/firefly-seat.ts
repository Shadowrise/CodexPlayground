import {Mesh,Object3D,SkinnedMesh,Vector3} from 'three';
import type {CharacterController} from './controller';

type SeatBody={node:Object3D;center:Vector3;radii?:Vector3};
/** Cache the belly support once; never inspect the full sculpt in the frame loop. */
export class FireflySeat {
 private bodies=new WeakMap<CharacterController,SeatBody>();
 private point=new Vector3();
 private shell=new Vector3();
 sync(carrier:Object3D,seat:Object3D|undefined,rider:CharacterController,remote=false){
  if(!seat)return false;
  let body=this.bodies.get(rider);
  if(!body){
   const mesh=rider.isPigeon?rider.actor.getObjectByName('Continuous_pigeon_body')??rider.actor.getObjectByName('Continuous pigeon body'):rider.actor.getObjectByName('Body_motion')?.children.find((node):node is Mesh=>node instanceof Mesh&&(/^Body_motion_surface|^Body_/.test(node.name)));
   if(!(mesh instanceof Mesh))return false;
   if(mesh instanceof SkinnedMesh){
    const index=mesh.skeleton.bones.findIndex(bone=>bone.name==='Body');if(index<0)return false;
    const positions=mesh.geometry.getAttribute('position'),center=new Vector3();let lowest=0;
    for(let i=1;i<positions.count;i++)if(positions.getY(i)<positions.getY(lowest))lowest=i;
    // The belly pole belongs entirely to the torso bone; neck and peck morphs
    // do not participate in the riding pose. Keep the support in bone space.
    center.fromBufferAttribute(positions,lowest).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[index]);
    body={node:mesh.skeleton.bones[index],center};
   }else{
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox!;
    body={node:mesh,center:bounds.getCenter(new Vector3()),radii:bounds.getSize(new Vector3()).multiplyScalar(.5)};
   }
   this.bodies.set(rider,body);
  }
  body.node.updateWorldMatrix(true,false);this.point.copy(body.center);
  if(body.radii){
   const m=body.node.matrixWorld.elements,r=body.radii,n=Math.hypot(m[1]*r.x,m[5]*r.y,m[9]*r.z);
   this.point.x-=m[1]*r.x*r.x/n;this.point.y-=m[5]*r.y*r.y/n;this.point.z-=m[9]*r.z*r.z/n;
  }
  this.point.applyMatrix4(body.node.matrixWorld);seat.getWorldPosition(this.shell);
  const correction=this.shell.y-this.point.y+(rider.isMetaKnight?0:.025*rider.actor.scale.x);
  if(remote)carrier.position.y-=correction;else rider.actor.position.y+=correction;
  if(!rider.isMetaKnight){
   // Keep the belly over the bobbing back, even
   // when hidden branches still carry last frame's world matrices.
   carrier.position.x+=this.point.x-this.shell.x;carrier.position.z+=this.point.z-this.shell.z;
  }
  return true;
 }
}
