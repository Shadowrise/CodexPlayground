import * as T from 'three';
import polygonClipping from 'polygon-clipping';
import { HOME_SITE } from './home-site';
import { MAZE_SITE } from './maze-layout';
import { BALLOON_SITES } from './balloon-sites';
import { LANDMARKS, POND_SCALE } from './landmark-sites';
export const WATER_Y=-.42;
export const PONDS=LANDMARKS.filter(s=>s.kind===0);
export const streamX=(z:number)=>Math.sin((z-6)/1.35*.45)*1.2;
export const deckHeight=(x:number)=>2.8*Math.cos(Math.min(1,Math.abs(x)/5)*Math.PI/2)**2;
export function pondOutline(index=0){
 const pts:T.Vector2[]=[],a=Math.asin(6/7.8);
 for(let i=0;i<=80;i++){const t=a-(Math.PI+2*a)*i/80;const warp=1+(.07+index*.022)*Math.sin(t*(2+index%2)+index)*Math.sin(Math.PI*i/80)**2;pts.push(new T.Vector2(11.3*Math.cos(t)*warp,7.8*Math.sin(t)*warp));}
 for(let i=0;i<=30;i++){const z=6+i*.48;pts.push(new T.Vector2(streamX(z)-1.8,z));}
 for(let i=30;i>=0;i--){const z=6+i*.48;pts.push(new T.Vector2(streamX(z)+1.8,z));}
 return pts.map(p=>p.multiplyScalar(POND_SCALE));
}

export function inPond(x:number,z:number,index=0){return contains(pondOutline(index),x,z);}
function contains(points:T.Vector2[],x:number,z:number){let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside;
}

const obstacles=[...LANDMARKS.filter(s=>s.kind!==0),HOME_SITE,MAZE_SITE,{x:135,z:45,radius:25},
 ...BALLOON_SITES.map(s=>({...s,radius:22})),{x:-45,z:0,radius:24},{x:0,z:0,radius:12}];
const free=(x:number,z:number)=>obstacles.every(s=>Math.hypot(x-s.x,z-s.z)>s.radius+9);
/** A small deterministic navigation grid keeps rivers away from existing attractions. */
function riverRoute(start:T.Vector3,end:T.Vector3){
 const step=5,key=(x:number,z:number)=>`${x},${z}`;
 const sx=Math.round(start.x/step),sz=Math.round(start.z/step),ex=Math.round(end.x/step),ez=Math.round(end.z/step);
 const open=[{x:sx,z:sz,g:0}],cost=new Map([[key(sx,sz),0]]),parent=new Map<string,string>();
 while(open.length){open.sort((a,b)=>(a.g+Math.hypot(ex-a.x,ez-a.z))-(b.g+Math.hypot(ex-b.x,ez-b.z)));const n=open.shift()!;
  if(n.x===ex&&n.z===ez)break;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const x=n.x+dx,z=n.z+dz,k=key(x,z),g=n.g+Math.hypot(dx,dz);
   if(Math.abs(x)>46||Math.abs(z)>46||!free(x*step,z*step)||g>=(cost.get(k)??Infinity))continue;
   cost.set(k,g);parent.set(k,key(n.x,n.z));open.push({x,z,g});
  }
 }
 let k=key(ex,ez);if(!parent.has(k))throw new Error('No safe river route');
 const points=[end.clone()];while(k!==key(sx,sz)){const [x,z]=k.split(',').map(Number);points.push(new T.Vector3(x*step,0,z*step));k=parent.get(k)!;}points.push(start);points.reverse();
 const curve=new T.CatmullRomCurve3(points);return curve.getSpacedPoints(Math.ceil(curve.getLength()/4));
}
export const RIVERS=PONDS.slice(0,-1).map((s,i)=>riverRoute(new T.Vector3(s.x+streamX(20.4)*POND_SCALE,0,s.z+20.4*POND_SCALE),new T.Vector3(PONDS[i+1].x,0,PONDS[i+1].z)));
export const BRIDGES=[...PONDS.map(s=>({x:s.x,z:s.z+12*POND_SCALE,yaw:0})),...RIVERS.flatMap(points=>[.35,.68].map(t=>{
 const i=Math.floor((points.length-1)*t),p=points[i],d=points[i+1].clone().sub(points[i-1]);return {x:p.x,z:p.z,yaw:Math.atan2(d.x,d.z)};
}))];
export function riverClearance(x:number,z:number,padding=0){return RIVERS.every(points=>points.every(p=>Math.hypot(x-p.x,z-p.z)>4+padding));}
export function outsideRivers(x:number,z:number,padding=0){
 for(let pass=0;pass<8;pass++)for(const points of RIVERS)for(const p of points){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),r=5+padding;if(d<r){const a=d>.001?Math.atan2(dz,dx):0;x=p.x+Math.cos(a)*r;z=p.z+Math.sin(a)*r;}}
 return {x,z};
}
type Ring=[number,number][];
const pieces:Ring[][]=PONDS.map((s,i)=>[pondOutline(i).map(p=>[s.x+p.x,s.z+p.y] as [number,number])]);
for(const points of RIVERS){
 for(let i=0;i<points.length;i++){
  const p=points[i];pieces.push([Array.from({length:10},(_,j)=>[p.x+2.8*Math.cos(j*Math.PI/5),p.z+2.8*Math.sin(j*Math.PI/5)] as [number,number])]);
  if(i){const a=points[i-1],d=p.clone().sub(a).normalize(),x=d.z*2.8,z=-d.x*2.8;pieces.push([[[a.x+x,a.z+z],[p.x+x,p.z+z],[p.x-x,p.z-z],[a.x-x,a.z-z]]]);}
 }
}
// Millimetre precision avoids nearly coincident edges in overlapping river segments.
const snapped=pieces.map(p=>p.map(r=>r.map(([x,z])=>[Math.round(x*1000)/1000,Math.round(z*1000)/1000] as [number,number])));
export const WATER_REGIONS=polygonClipping.union(snapped[0],...snapped.slice(1));
const waterContours=WATER_REGIONS.map(region=>region.map(ring=>ring.map(([x,z])=>new T.Vector2(x,z))));
export function inWater(x:number,z:number){return waterContours.some(region=>contains(region[0],x,z)&&!region.slice(1).some(hole=>contains(hole,x,z)));}
export function waterShapes(){return waterContours.map(region=>{const shape=new T.Shape(region[0].map(p=>new T.Vector2(p.x,-p.y)));for(const hole of region.slice(1))shape.holes.push(new T.Path(hole.map(p=>new T.Vector2(p.x,-p.y))));return shape;});}
export function meadowGeometry(half:number){
 const shape=new T.Shape([new T.Vector2(-half,-half),new T.Vector2(half,-half),new T.Vector2(half,half),new T.Vector2(-half,half)]),islands:T.Shape[]=[];
 for(const region of waterContours){shape.holes.push(new T.Path(region[0].map(p=>new T.Vector2(p.x,-p.y))));for(const hole of region.slice(1))islands.push(new T.Shape(hole.map(p=>new T.Vector2(p.x,-p.y))));}
 return new T.ShapeGeometry([shape,...islands]);
}
