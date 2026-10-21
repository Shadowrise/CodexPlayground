import * as T from 'three';
import {SKY_PLATFORMS,platformThickness} from './sky-trail-layout';
import {ProjectedStructureShadows} from './projected-structure-shadows';

export const SKY_GLASS_SHADOW_DENSITY=.32;

/** Project the actual 3D prism, including the thin first step. Its footprint
 * stays square/hexagonal and its displacement follows the height of its faces. */
export class SkyTrailShadows extends ProjectedStructureShadows{
 constructor(world:T.Matrix4){
  super(SKY_GLASS_SHADOW_DENSITY,'Prepared translucent sky platform shadows');
  const cube=new T.BoxGeometry(1,1,1),q=new T.Quaternion();
  for(let i=0;i<SKY_PLATFORMS.length;i++){
   const p=SKY_PLATFORMS[i],thickness=platformThickness(i),matrix=new T.Matrix4().compose(new T.Vector3(p.x,p.y-thickness/2,p.z),q,new T.Vector3(p.size,thickness,p.size));
   this.add(cube,world.clone().multiply(matrix));
  }
  this.commit();
 }
}
