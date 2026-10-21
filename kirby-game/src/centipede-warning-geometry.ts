import * as T from 'three';
import type {Point} from './centipede-event';

/** A smooth ribbon and semicircular end caps in a single static draw. Rebuilt
 * only when the route changes; no transparent patches overlap at the joins. */
export function roundedRunWarning(sample:(u:number)=>Point,width:number){
 const positions:number[]=[],uv:number[]=[],indices:number[]=[],sections=192,border=.2;
 const points=Array.from({length:sections+1},(_,i)=>sample(i/sections)),distances=[0];
 for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
 const vertex=(x:number,z:number,across:number,along:number)=>{const index=positions.length/3;positions.push(x,.095,z);uv.push(across,along);return index;};
 const tangent=(u:number)=>{const a=sample(Math.max(0,u-.002)),b=sample(Math.min(1,u+.002)),dx=b[0]-a[0],dz=b[1]-a[1],d=Math.max(.00001,Math.hypot(dx,dz));return [dx/d,dz/d];};
 for(let i=0;i<=sections;i++){
  const p=points[i],[dx,dz]=tangent(i/sections);
  for(const w of [width+border,width,-width,-width-border])vertex(p[0]-dz*w,p[1]+dx*w,w,distances[i]);
  if(i<sections)for(let strip=0;strip<3;strip++){const j=i*4+strip;indices.push(j,j+1,j+4,j+4,j+1,j+5);}
 }
 for(const end of [0,1]){
  const p=points[end*sections],[dx,dz]=tangent(end),sign=end===0?-1:1,along=distances[end*sections],center=vertex(p[0],p[1],0,along),cap=18;let previous:number[]|undefined;
  for(let i=0;i<=cap;i++){
   const a=i/cap*Math.PI,x=-dz*Math.cos(a)+sign*dx*Math.sin(a),z=dx*Math.cos(a)+sign*dz*Math.sin(a);
   const row=[width,width+border].map(w=>vertex(p[0]+x*w,p[1]+z*w,Math.cos(a)*w,along+sign*Math.sin(a)*w));
   if(previous)indices.push(center,previous[0],row[0],previous[0],previous[1],row[0],row[0],previous[1],row[1]);previous=row;
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingSphere();geometry.userData.span=distances[sections];return geometry;
}

/** Full-size capsule avoids stretched elliptical corners after instancing. */
export function roundedBallWarning(){
 const radius=.325,half=6-radius,shape=new T.Shape();shape.moveTo(-radius,-half);shape.lineTo(-radius,half);
 shape.absarc(0,half,radius,Math.PI,0,true);shape.lineTo(radius,-half);shape.absarc(0,-half,radius,0,-Math.PI,true);shape.closePath();
 const geometry=new T.ShapeGeometry(shape,12),positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
 // This mesh's local -Y points forward after its floor/heading rotation.
 for(let i=0;i<positions.count;i++)uv.setXY(i,positions.getX(i),half-positions.getY(i));
 geometry.userData.span=half*2;return geometry;
}
