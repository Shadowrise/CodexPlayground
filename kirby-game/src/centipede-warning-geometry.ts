import * as T from 'three';
import type {Point} from './centipede-event';

/** A smooth ribbon and semicircular end caps in a single static draw. Rebuilt
 * only when the route changes; no transparent patches overlap at the joins. */
export function roundedRunWarning(sample:(u:number)=>Point,width:number){
 const positions:number[]=[],colours:number[]=[],indices:number[]=[],sections=192;
 const fill=new T.Color('#86c1d6'),edge=new T.Color('#31576a'),border=.2;
 const vertex=(x:number,z:number,c:T.Color)=>{const index=positions.length/3;positions.push(x,.095,z);colours.push(c.r,c.g,c.b);return index;};
 const tangent=(u:number)=>{const a=sample(Math.max(0,u-.002)),b=sample(Math.min(1,u+.002)),dx=b[0]-a[0],dz=b[1]-a[1],d=Math.max(.00001,Math.hypot(dx,dz));return [dx/d,dz/d];};
 for(let i=0;i<=sections;i++){
  const p=sample(i/sections),[dx,dz]=tangent(i/sections);
  for(const [j,w] of [width+border,width,-width,-width-border].entries())vertex(p[0]-dz*w,p[1]+dx*w,j===0||j===3?edge:fill);
  if(i<sections)for(let strip=0;strip<3;strip++){const j=i*4+strip;indices.push(j,j+1,j+4,j+4,j+1,j+5);}
 }
 for(const end of [0,1]){
  const p=sample(end),[dx,dz]=tangent(end),sign=end===0?-1:1,center=vertex(p[0],p[1],fill),cap=18;let previous:number[]|undefined;
  for(let i=0;i<=cap;i++){
   const a=i/cap*Math.PI,x=-dz*Math.cos(a)+sign*dx*Math.sin(a),z=dx*Math.cos(a)+sign*dz*Math.sin(a);
   const row=[vertex(p[0]+x*width,p[1]+z*width,fill),vertex(p[0]+x*(width+border),p[1]+z*(width+border),edge)];
   if(previous)indices.push(center,previous[0],row[0],previous[0],previous[1],row[0],row[0],previous[1],row[1]);previous=row;
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}

/** Full-size capsule avoids stretched elliptical corners after instancing. */
export function roundedBallWarning(){
 const radius=.325,half=6-radius,shape=new T.Shape();shape.moveTo(-radius,-half);shape.lineTo(-radius,half);
 shape.absarc(0,half,radius,Math.PI,0,true);shape.lineTo(radius,-half);shape.absarc(0,-half,radius,0,-Math.PI,true);shape.closePath();
 return new T.ShapeGeometry(shape,12);
}
