import {Mesh,SkinnedMesh,type Material,type Object3D} from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {prepareCharacterDetail} from './character-detail';

/** Everything about a mesh that selects a different shader program for one material. */
export function meshKind(mesh:Mesh){
 const morphs=mesh.geometry.morphAttributes,attributes=mesh.geometry.attributes;
 return (mesh instanceof SkinnedMesh?'skinned':'rigid')+(morphs.position?.length??0)+(morphs.normal?'n':'')+(morphs.color?'c':'')+(attributes.color?.itemSize===4?'a':'')+(attributes.tangent?'t':'');
}

/** Native paint is baked into each template's texture and vertex colours. */
export function clonePigeon(template:Object3D){
 prepareCharacterDetail(template);
 // Parts of different kinds keep separate copies: a material used by a skinned
 // and a rigid part, or by parts with and without morph targets, makes Three
 // re-resolve its program at every switch between them.
 const model=cloneSkeleton(template),copies=new Map<string,Map<Material,Material>>();
 model.userData.character='pigeon';
 model.userData.characterShadow=true;
 model.traverse(node=>{
  if(!(node instanceof Mesh))return;
  const kind=meshKind(node);let materials=copies.get(kind);if(!materials){materials=new Map();copies.set(kind,materials);}
  const own=(source:Material)=>{let material=materials.get(source);if(!material){material=source.clone();materials.set(source,material);}return material;};
  node.material=Array.isArray(node.material)?node.material.map(own):own(node.material);
  node.castShadow=node.receiveShadow=true;
 });
 return model;
}
