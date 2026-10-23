import * as T from 'three';
import type {KnightPoint} from './meta-knight-battle';
import {attackRibbonMaterial,updateAttackRibbon} from './attack-ribbon-material';
import {KNIGHT_WARNING_STYLE} from './meta-knight-warning-style';

/** Rounded glass path with a red countdown on both edges. Arc length is in metres. */
export class AssaultRibbon{
 readonly mesh:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
 private width:number;private length=1;
 constructor(name:string,width:number){
  this.width=width;this.mesh=new T.Mesh(new T.BufferGeometry(),attackRibbonMaterial(width,KNIGHT_WARNING_STYLE));this.mesh.name=name;this.mesh.position.y=.135;this.mesh.renderOrder=2;this.mesh.visible=false;
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
  rows.forEach(([p,d,x,z],i)=>{for(const side of [-1,1]){positions.push(p[0]+z*this.width*side,0,p[2]-x*this.width*side);uv.push(this.width*side,d);}if(i){const a=(i-1)*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}});
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingSphere();
  this.mesh.geometry.dispose();this.mesh.geometry=geometry;this.mesh.material.uniforms.span.value=this.length;
 }
 update(progress:number,active:boolean,now:number,opacity=1){updateAttackRibbon(this.mesh.material,progress,active,now,opacity);this.mesh.visible=true;}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
