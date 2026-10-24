import * as T from 'three';
import {KNIGHT,type KnightPoint} from './meta-knight-battle';
import {knightWarningGlass,knightWarningArrowGeometry,knightWarningArrowMaterial} from './meta-knight-warning-material';
import {KNIGHT_WARNING_STYLE} from './meta-knight-warning-style';

/** Rounded glass path with a red countdown on both edges. Arc length is in metres. */
export class AssaultRibbon{
 readonly mesh:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
 readonly arrows=new T.InstancedMesh(knightWarningArrowGeometry(),knightWarningArrowMaterial(),8);
 private width:number;private length=1;
 constructor(name:string,width:number){
  this.width=width;this.mesh=new T.Mesh(new T.BufferGeometry(),knightWarningGlass(KNIGHT_WARNING_STYLE.gold,true));this.mesh.material.uniforms.width.value=width*2;this.mesh.name=name;this.mesh.position.y=.135;this.mesh.renderOrder=2;this.mesh.visible=false;
  this.arrows.name=`${name} direction arrows`;this.arrows.renderOrder=3;this.arrows.frustumCulled=false;this.arrows.position.y=.015;this.mesh.add(this.arrows);
 }
 setPath(points:KnightPoint[]){
  const length=[0];for(let i=1;i<points.length;i++)length.push(length[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2]));
  this.length=length[length.length-1];const rows:[KnightPoint,number,number,number][]=[];
  for(let i=0;i<points.length;i++){
   const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=Math.hypot(b[0]-a[0],b[2]-a[2])||1,x=(b[0]-a[0])/d,z=(b[2]-a[2])/d;
   if(i===0)rows.push([[points[i][0]-x*this.width,0,points[i][2]-z*this.width],-this.width,x,z]);
   rows.push([points[i],length[i],x,z]);
   if(i===points.length-1)rows.push([[points[i][0]+x*this.width,0,points[i][2]+z*this.width],this.length+this.width,x,z]);
  }
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  rows.forEach(([p,d,x,z],i)=>{for(const side of [-1,1]){positions.push(p[0]+z*this.width*side,0,p[2]-x*this.width*side);uv.push((side+1)/2,1-(d+this.width)/(this.length+2*this.width));}if(i){const a=(i-1)*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}});
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingSphere();
  this.mesh.geometry.dispose();this.mesh.geometry=geometry;this.mesh.material.uniforms.span.value=this.length;
  const matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3().setScalar(1.5*KNIGHT.effectScale);
  this.arrows.count=this.length>0?8:0;
  for(let i=0;i<this.arrows.count;i++){
   const along=this.length*(i+.5)/this.arrows.count;let end=1;while(end<length.length-1&&length[end]<along)end++;
   const a=points[end-1],b=points[end],t=(along-length[end-1])/Math.max(.0001,length[end]-length[end-1]);
   position.set(a[0]+(b[0]-a[0])*t,0,a[2]+(b[2]-a[2])*t);rotation.setFromEuler(new T.Euler(-Math.PI/2,0,Math.atan2(b[0]-a[0],b[2]-a[2])+Math.PI));
   matrix.compose(position,rotation,scale);this.arrows.setMatrixAt(i,matrix);
  }this.arrows.instanceMatrix.needsUpdate=true;
 }
 update(progress:number,active:boolean,now:number){const u=this.mesh.material.uniforms;u.progress.value=Math.max(0,Math.min(1,progress));u.tint.value.setHex(active?KNIGHT_WARNING_STYLE.red:KNIGHT_WARNING_STYLE.gold);u.clock.value=now/1000;this.arrows.material.color.setHex(active?KNIGHT_WARNING_STYLE.red:KNIGHT_WARNING_STYLE.arrow);this.mesh.visible=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.arrows.geometry.dispose();this.arrows.material.dispose();this.arrows.dispose();}
}
