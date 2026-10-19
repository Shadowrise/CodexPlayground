import * as T from 'three';

const grips=new WeakMap<T.Object3D,{feather:T.Mesh;point:T.Vector3}>();
const poses=new Map<T.Object3D,{native:T.Quaternion;held:T.Quaternion}>();

/** Clear last frame's carrying overlay after native animations have advanced. */
export function clearPigeonCarryPoses(){
  for(const [wing,pose] of poses)if(wing.quaternion.equals(pose.held))wing.quaternion.copy(pose.native);
  poses.clear();
}

export function posePigeonCarryWing(wing:T.Object3D){
  let pose=poses.get(wing);
  if(!pose){pose={native:wing.quaternion.clone(),held:new T.Quaternion()};poses.set(wing,pose);}
  else if(!wing.quaternion.equals(pose.held))pose.native.copy(wing.quaternion);
  wing.rotation.set(-.9,-.25,.85);
  pose.held.copy(wing.quaternion);
  wing.updateWorldMatrix(true,true);
}

/** Locate a surface grip on the carrying feathers for mill sacks and dough. */
export function pigeonCarryGrip(wing:T.Object3D,point:T.Vector3){
  posePigeonCarryWing(wing);
  let grip=grips.get(wing);
  if(!grip){
    let feather:T.Mesh|undefined;
    wing.getObjectByName('Right_wing_vane')?.traverse(node=>{if(!feather&&node instanceof T.Mesh)feather=node;});
    if(feather){
      if(!feather.geometry.boundingBox)feather.geometry.computeBoundingBox();
      const bounds=feather.geometry.boundingBox!,target=bounds.getCenter(new T.Vector3());target.y=T.MathUtils.lerp(bounds.min.y,bounds.max.y,.35);
      const p=feather.geometry.attributes.position,indices=feather.geometry.index,triangle=new T.Triangle(),nearest=new T.Vector3(),contact=new T.Vector3();
      let distance=Infinity;
      // Find the actual feather surface once; animation only transforms the cached grip.
      for(let i=0;i<(indices?.count??p.count);i+=3){
        triangle.a.fromBufferAttribute(p,indices?.getX(i)??i);triangle.b.fromBufferAttribute(p,indices?.getX(i+1)??i+1);triangle.c.fromBufferAttribute(p,indices?.getX(i+2)??i+2);
        triangle.closestPointToPoint(target,nearest);const gap=nearest.distanceToSquared(target);
        if(gap<distance){distance=gap;contact.copy(nearest);}
      }
      grip={feather,point:contact};grips.set(wing,grip);
    }
  }
  if(grip){point.copy(grip.point);grip.feather.localToWorld(point);}
  else{point.set(.2,-.4,.2);wing.localToWorld(point);}
  return point;
}
