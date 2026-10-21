import {Mesh,type Material,type Object3D} from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

/** Native paint is baked into each template's texture and vertex colours. */
export function clonePigeon(template:Object3D){
 const model=cloneSkeleton(template),materials=new Map<Material,Material>();
 model.userData.character='pigeon';
 model.traverse(node=>{
  if(!(node instanceof Mesh))return;
  const own=(source:Material)=>{let material=materials.get(source);if(!material){material=source.clone();materials.set(source,material);}return material;};
  node.material=Array.isArray(node.material)?node.material.map(own):own(node.material);
  node.castShadow=node.receiveShadow=true;
 });
 return model;
}
