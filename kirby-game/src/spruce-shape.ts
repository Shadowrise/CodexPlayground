import * as T from 'three';
import {createFoliageTexture} from './foliage-texture';
import {woodlandBarkMaterial} from './tree-bark';

/** Shared conifer shape for the visible forest and its once-baked silhouette. */
export function spruceGeometries(){
 return {wood:new T.CylinderGeometry(.7,1,1,9),needles:new T.ConeGeometry(1,1,12,3)};
}
export function spruceParts(){
 const parts:{kind:'wood'|'needles';matrix:T.Matrix4;tier:number;detail:number}[]=[],pose=new T.Object3D();
 const add=(kind:'wood'|'needles',x:number,y:number,z:number,sx:number,sy:number,sz:number,angle:number,tier:number,detail=0)=>{
  pose.position.set(x,y,z);pose.scale.set(sx,sy,sz);pose.rotation.set(0,angle,0);pose.updateMatrix();
  parts.push({kind,matrix:pose.matrix.clone(),tier,detail});
 };
 const h=7.5;
 add('wood',0,h*.38,0,.25,h*.76,.25,0,-1);
 for(let tier=0;tier<7;tier++){
  const y=h*(.22+tier*.1),width=(1-tier*.115)*2;
  add('needles',0,y+.8,0,width,2.7,width,tier*.5,tier);
  for(let arm=0;arm<5;arm++){
   const a=arm*Math.PI*2/5+tier*.55,tx=Math.cos(a)*width*.65,tz=Math.sin(a)*width*.65;
   const from=new T.Vector3(0,y,0),to=new T.Vector3(tx,y-.13,tz);
   pose.position.copy(from).add(to).multiplyScalar(.5);
   pose.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),to.clone().sub(from).normalize());
   pose.scale.set(.045,from.distanceTo(to),.045);pose.updateMatrix();
   parts.push({kind:'wood',matrix:pose.matrix.clone(),tier,detail:1});
   add('needles',tx,y+.12,tz,width*.38,1.05,width*.38,a,tier,1);
  }
 }
 return parts;
}

let needleMaterial:T.MeshStandardMaterial|undefined;
export function spruceNeedleMaterial(){return needleMaterial??=new T.MeshStandardMaterial({roughness:1,map:createFoliageTexture('spruce')});}
let barkMaterial:T.MeshStandardMaterial|undefined;
export function spruceBarkMaterial(){return barkMaterial??=new T.MeshStandardMaterial({roughness:1,map:woodlandBarkMaterial().map});}
