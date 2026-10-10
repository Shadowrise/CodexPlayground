import * as T from 'three';
import polygonClipping from 'polygon-clipping';
import { HOME_SITE } from './home-site';
import {FOUNTAIN_SITE} from './fountain-site';
import {SKY_TRAIL_SITE} from './sky-trail-layout';
import { MAZE_SITE } from './maze-layout';
import { BALLOON_SITES } from './balloon-sites';
import { LANDMARKS, POND_SCALE } from './landmark-sites';
export const WATER_Y=-.42;
export const RIVER_HALF_WIDTH=3.5;
export const PONDS=LANDMARKS.filter(s=>s.kind===0);
export const streamX=(z:number)=>Math.sin((z-6)/1.35*.45)*1.2;
export const deckHeight=(x:number)=>3.5*Math.cos(Math.min(1,Math.abs(x)/5)*Math.PI/2)**2;
export function pondOutline(index=0){
 const pts:T.Vector2[]=[],a=Math.asin(6/7.8);
 for(let i=0;i<=80;i++){const t=a-(Math.PI+2*a)*i/80;const warp=1+(.07+index*.022)*Math.sin(t*(2+index%2)+index)*Math.sin(Math.PI*i/80)**2;pts.push(new T.Vector2(11.3*Math.cos(t)*warp,7.8*Math.sin(t)*warp));}
 for(let i=0;i<=30;i++){const z=6+i*.48;pts.push(new T.Vector2(streamX(z)-RIVER_HALF_WIDTH/POND_SCALE,z));}
 for(let i=30;i>=0;i--){const z=6+i*.48;pts.push(new T.Vector2(streamX(z)+RIVER_HALF_WIDTH/POND_SCALE,z));}
 return pts.map(p=>p.multiplyScalar(POND_SCALE));
}

export function inPond(x:number,z:number,index=0){return contains(pondOutline(index),x,z);}
function contains(points:T.Vector2[],x:number,z:number){let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside;
}

const obstacles=[FOUNTAIN_SITE,SKY_TRAIL_SITE,...LANDMARKS.filter(s=>s.kind!==0),HOME_SITE,MAZE_SITE,{x:135,z:45,radius:25},
 ...BALLOON_SITES.map(s=>({...s,radius:22})),{x:-45,z:0,radius:24},{x:0,z:0,radius:12}];
const free=(x:number,z:number)=>obstacles.every(s=>Math.hypot(x-s.x,z-s.z)>s.radius+9);
/** Relax the routing grid into broad bends, retaining obstacle clearance.
 * The contour, bridge selection and boat route all consume this same curve. */
function smoothRiver(points:T.Vector3[]){
 let relaxed=points;
 for(let pass=0;pass<12;pass++)relaxed=relaxed.map((p,i)=>{
  if(!i||i===relaxed.length-1)return p;
  const q=relaxed[i-1].clone().addScaledVector(p,2).add(relaxed[i+1]).multiplyScalar(.25);
  return free(q.x,q.z)?q:p;
 });
 const curve=new T.CatmullRomCurve3(relaxed,false,'centripetal');
 return curve.getSpacedPoints(Math.ceil(curve.getLength()/2.4));
}
/** A small deterministic navigation grid keeps rivers away from existing attractions. */
function riverRoute(start:T.Vector3,end:T.Vector3){
 const step=5,key=(x:number,z:number)=>`${x},${z}`;
 const sx=Math.round(start.x/step),sz=Math.round(start.z/step),ex=Math.round(end.x/step),ez=Math.round(end.z/step);
 const open=[{x:sx,z:sz,g:0}],cost=new Map([[key(sx,sz),0]]),parent=new Map<string,string>();
 while(open.length){open.sort((a,b)=>(a.g+Math.hypot(ex-a.x,ez-a.z))-(b.g+Math.hypot(ex-b.x,ez-b.z)));const n=open.shift()!;
  if(n.x===ex&&n.z===ez)break;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const x=n.x+dx,z=n.z+dz,k=key(x,z),g=n.g+Math.hypot(dx,dz);
   if(Math.abs(x)>48||Math.abs(z)>48||!free(x*step,z*step)||g>=(cost.get(k)??Infinity))continue;
   cost.set(k,g);parent.set(k,key(n.x,n.z));open.push({x,z,g});
  }
 }
 let k=key(ex,ez);if(!parent.has(k))throw new Error('No safe river route');
 const points=[end.clone()];while(k!==key(sx,sz)){const [x,z]=k.split(',').map(Number);points.push(new T.Vector3(x*step,0,z*step));k=parent.get(k)!;}points.push(start);points.reverse();
 return smoothRiver(points);
}
export const RIVERS=PONDS.slice(0,-1).map((s,i)=>riverRoute(new T.Vector3(s.x+streamX(20.4)*POND_SCALE,0,s.z+20.4*POND_SCALE),new T.Vector3(PONDS[i+1].x,0,PONDS[i+1].z)));
// Close the existing lake chain along the open eastern/northern edge, not back
// along the same diagonal. The joined water polygon now has a navigable circuit.
const last=PONDS.at(-1)!,first=PONDS[0];
const loopWaypoints=[new T.Vector3(last.x+streamX(20.4)*POND_SCALE,0,last.z+20.4*POND_SCALE),
 // Leave the last lake in its downstream direction before turning east. A
 // direct link north creates a hairpin immediately after the lake's outlet.
 new T.Vector3(185,0,235),new T.Vector3(210,0,235),new T.Vector3(232,0,210),
 new T.Vector3(225,0,150),new T.Vector3(225,0,-150),new T.Vector3(150,0,-225),new T.Vector3(-150,0,-225),new T.Vector3(first.x,0,first.z)];
const closingPoints=loopWaypoints.slice(1).flatMap((p,i)=>riverRoute(loopWaypoints[i],p).slice(i?1:0));
export const RIVER_CLOSING_ROUTE=smoothRiver(closingPoints).map((p,i,points)=>{
 if(i===0||i===points.length-1)return p;
 const tangent=points[i+1].clone().sub(points[i-1]).normalize();
 const bend=(Math.sin(p.x*.032+p.z*.019)*1.2+Math.sin(p.z*.024)*.6)*Math.min(1,i/12,(points.length-1-i)/12);
 const x=p.x+tangent.z*bend,z=p.z-tangent.x*bend;
 return free(x,z)?new T.Vector3(x,0,z):p;
});
RIVERS.push(RIVER_CLOSING_ROUTE);

export function riverClearance(x:number,z:number,padding=0){return RIVERS.every(points=>points.every(p=>Math.hypot(x-p.x,z-p.z)>RIVER_HALF_WIDTH+1.2+padding));}
export function outsideRivers(x:number,z:number,padding=0){
 for(let pass=0;pass<8;pass++)for(const points of RIVERS)for(const p of points){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),r=RIVER_HALF_WIDTH+2.2+padding;if(d<r){const a=d>.001?Math.atan2(dz,dx):0;x=p.x+Math.cos(a)*r;z=p.z+Math.sin(a)*r;}}
 return {x,z};
}
type Ring=[number,number][];
const pieces:Ring[][]=PONDS.map((s,i)=>[pondOutline(i).map(p=>[s.x+p.x,s.z+p.y] as [number,number])]);
for(const points of RIVERS){
 for(let i=0;i<points.length;i++){
  const p=points[i];pieces.push([Array.from({length:16},(_,j)=>[p.x+RIVER_HALF_WIDTH*Math.cos(j*Math.PI/8),p.z+RIVER_HALF_WIDTH*Math.sin(j*Math.PI/8)] as [number,number])]);
  if(i){const a=points[i-1],d=p.clone().sub(a).normalize(),x=d.z*RIVER_HALF_WIDTH,z=-d.x*RIVER_HALF_WIDTH;pieces.push([[[a.x+x,a.z+z],[p.x+x,p.z+z],[p.x-x,p.z-z],[a.x-x,a.z-z]]]);}
 }
}
// Millimetre precision avoids nearly coincident edges in overlapping river segments.
const snapped=pieces.map(p=>p.map(r=>r.map(([x,z])=>[Math.round(x*1000)/1000,Math.round(z*1000)/1000] as [number,number])));
/** Remove sub-4cm shoreline detail left by the union, keeping the same contour
 * for ground holes, water, bank walls and placement/collision queries.
 */
function simplifyShore(ring:Ring):Ring{
 if(ring.length<5)return ring;
 const keep=new Set([0,ring.length-1]);
 let split=1,farthest=0;
 for(let i=1;i<ring.length-1;i++){const d=(ring[i][0]-ring[0][0])**2+(ring[i][1]-ring[0][1])**2;if(d>farthest){farthest=d;split=i;}}
 keep.add(split);
 const section=(start:number,end:number)=>{
  const a=ring[start],b=ring[end],dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;
  let maximum=.04**2,index=-1;
  for(let i=start+1;i<end;i++){
   const p=ring[i],t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/length)):0;
   const d=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dz)**2;if(d>maximum){maximum=d;index=i;}
  }
  if(index!==-1){keep.add(index);section(start,index);section(index,end);}
 };
 section(0,split);section(split,ring.length-1);
 const result=ring.filter((_,i)=>keep.has(i));return result.length>=4?result:ring;
}
function roundShore(ring:Ring){
 const count=ring.length-1,rounded:Ring=[];
 for(let i=0;i<count;i++){
  const a=ring[(i+count-1)%count],p=ring[i],b=ring[(i+1)%count];
  const before=Math.hypot(a[0]-p[0],a[1]-p[1]),after=Math.hypot(b[0]-p[0],b[1]-p[1]);
  const t0=Math.min(.24,2.2/(before||1)),t1=Math.min(.24,2.2/(after||1));
  const q=[p[0]+(a[0]-p[0])*t0,p[1]+(a[1]-p[1])*t0],r=[p[0]+(b[0]-p[0])*t1,p[1]+(b[1]-p[1])*t1];
  for(let j=0;j<=3;j++){const t=j/3,u=1-t;rounded.push([q[0]*u*u+2*p[0]*u*t+r[0]*t*t,q[1]*u*u+2*p[1]*u*t+r[1]*t*t]);}
 }
 rounded.push(rounded[0]);return simplifyShore(rounded);
}
const ringArea=(r:Ring)=>Math.abs(r.slice(1).reduce((sum,p,i)=>sum+r[i][0]*p[1]-p[0]*r[i][1],0))/2;
export const WATER_REGIONS=polygonClipping.union(snapped[0],...snapped.slice(1)).map(region=>region.filter((r,i)=>!i||ringArea(r)>.15).map(r=>roundShore(simplifyShore(r))));
export const bankWidthAt=(x:number,z:number)=>1.65+.18*Math.sin(x*.08+z*.053)+.12*Math.cos(z*.11-x*.067);
/** Matching outer land edges create a shallow, irregular bank instead of a
 * vertical trench. Miter lengths are bounded at tight concave bends. */
export const BANK_RINGS=WATER_REGIONS.flatMap(region=>region.map(water=>{
 const count=water.length-1,land:Ring=[];
 for(let i=0;i<count;i++){
  const a=water[(i+count-1)%count],p=water[i],b=water[(i+1)%count];
  const d0=Math.hypot(p[0]-a[0],p[1]-a[1]),d1=Math.hypot(b[0]-p[0],b[1]-p[1]);
  const nx0=(p[1]-a[1])/d0,nz0=-(p[0]-a[0])/d0,nx1=(b[1]-p[1])/d1,nz1=-(b[0]-p[0])/d1;
  const len=Math.hypot(nx0+nx1,nz0+nz1),nx=(nx0+nx1)/(len||1),nz=(nz0+nz1)/(len||1);
  const width=bankWidthAt(p[0],p[1]),miter=Math.min(width*1.35,width/Math.max(.4,nx*nx1+nz*nz1));
  land.push([p[0]+nx*miter,p[1]+nz*miter]);
 }
 land.push(land[0]);return {water,land};
}));
// Offset curves may cross locally at tight concave bends. Resolve those once
// before triangulation, so neither the meadow nor the bank has inverted faces.
let bankIndex=0;
const landPolygons=WATER_REGIONS.map(region=>region.map(()=>BANK_RINGS[bankIndex++].land) as polygonClipping.Polygon);
export const LAND_WATER_REGIONS=polygonClipping.union(landPolygons[0],...landPolygons.slice(1));
export const BANK_REGIONS=polygonClipping.difference(LAND_WATER_REGIONS,WATER_REGIONS);
const waterContours=WATER_REGIONS.map(region=>region.map(ring=>ring.map(([x,z])=>new T.Vector2(x,z))));
const rawInWater=(x:number,z:number)=>waterContours.some(region=>contains(region[0],x,z)&&!region.slice(1).some(hole=>contains(hole,x,z)));
// Cache homogeneous cells; only shoreline cells need a full polygon query.
// Also index banks for exact footprint clearance during decoration placement.
const waterCellSize=8,waterCells=new Map<string,boolean>();
const waterEdges=new Map<string,{ax:number;az:number;bx:number;bz:number}[]>();
for(const region of WATER_REGIONS)for(const ring of region)for(let i=1;i<ring.length;i++){
 const [ax,az]=ring[i-1],[bx,bz]=ring[i],edge={ax,az,bx,bz};
 for(let x=Math.floor(Math.min(ax,bx)/waterCellSize);x<=Math.floor(Math.max(ax,bx)/waterCellSize);x++)for(let z=Math.floor(Math.min(az,bz)/waterCellSize);z<=Math.floor(Math.max(az,bz)/waterCellSize);z++){
  const key=`${x},${z}`;if(!waterEdges.has(key))waterEdges.set(key,[]);waterEdges.get(key)!.push(edge);
 }
}
export function inWater(x:number,z:number){
 const cx=Math.floor(x/waterCellSize),cz=Math.floor(z/waterCellSize),key=`${cx},${cz}`;
 if(waterEdges.has(key))return rawInWater(x,z);
 if(!waterCells.has(key))waterCells.set(key,rawInWater((cx+.5)*waterCellSize,(cz+.5)*waterCellSize));
 return waterCells.get(key)!;
}
/** The whole disk must rest on land, including petals and leaning leaves. */
export function dryGround(x:number,z:number,radius=0){
 if(inWater(x,z))return false;
 for(let cx=Math.floor((x-radius)/waterCellSize);cx<=Math.floor((x+radius)/waterCellSize);cx++)for(let cz=Math.floor((z-radius)/waterCellSize);cz<=Math.floor((z+radius)/waterCellSize);cz++)for(const e of waterEdges.get(`${cx},${cz}`)??[]){
  const dx=e.bx-e.ax,dz=e.bz-e.az,length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,((x-e.ax)*dx+(z-e.az)*dz)/length)):0;
  if((x-e.ax-t*dx)**2+(z-e.az-t*dz)**2<=radius*radius)return false;
 }
 return true;
}
/** Scenery placed at y=0 needs the flat meadow, not the dry but sloping bank. */
export function flatGround(x:number,z:number,radius=0){return dryGround(x,z,radius+bankWidthAt(x,z));}
/** Bounded nearest-bank query for startup texture painting and reed placement.
 * Reuses the shoreline index; no full contour scans or runtime water changes. */
export function shoreDistance(x:number,z:number,maximum=6){
 let best=maximum*maximum;
 for(let cx=Math.floor((x-maximum)/waterCellSize);cx<=Math.floor((x+maximum)/waterCellSize);cx++)for(let cz=Math.floor((z-maximum)/waterCellSize);cz<=Math.floor((z+maximum)/waterCellSize);cz++)for(const e of waterEdges.get(`${cx},${cz}`)??[]){
  const dx=e.bx-e.ax,dz=e.bz-e.az,length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,((x-e.ax)*dx+(z-e.az)*dz)/length)):0;
  best=Math.min(best,(x-e.ax-t*dx)**2+(z-e.az-t*dz)**2);
 }
 return Math.sqrt(best);
}
export function bankHeight(x:number,z:number){
 const width=bankWidthAt(x,z),distance=shoreDistance(x,z,2.1);
 if(distance>=width)return 0;
 // This strip is dry land outside the water polygon. Keep its lowest edge
 // just above the surface, so the water cannot look raised above the bank.
 return (WATER_Y+.02)*(1-distance/width);
}
type Bridge={x:number;z:number;yaw:number};
const bridgeCandidates:Bridge[]=[
 ...PONDS.flatMap(s=>[10,12,14,16].map(z=>({x:s.x+streamX(z)*POND_SCALE,z:s.z+z*POND_SCALE,yaw:Math.atan2(streamX(z+.1)-streamX(z-.1),.2)}))),
 ...RIVERS.flatMap(points=>points.slice(2,-2).map((p,i)=>{const d=points[i+3].clone().sub(points[i+1]);return {x:p.x,z:p.z,yaw:Math.atan2(d.x,d.z)};})),
].filter(s=>{
 if(!inWater(s.x,s.z))return false;
 const cos=Math.cos(s.yaw),sin=Math.sin(s.yaw);
 // Test the full width of both landings, including a short dry approach.
 for(const side of [-1,1])for(const x of [4.6,5.1,6.2])for(const z of [-1.6,0,1.6]){
  if(!flatGround(s.x+(side*x*cos+z*sin)*POND_SCALE,s.z+(-side*x*sin+z*cos)*POND_SCALE,.4))return false;
 }
 return true;
});
export const BRIDGES:Bridge[]=[];
// Central mill crossing plus the northern and eastern banks of the circuit.
for(const target of [{x:32,z:34},{x:-100,z:-225},{x:225,z:80}]){
 const chosen=bridgeCandidates.filter(s=>BRIDGES.every(b=>Math.hypot(b.x-s.x,b.z-s.z)>110))
  .sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z))[0];
 if(!chosen)throw new Error('No dry bank-to-bank bridge site');BRIDGES.push(chosen);
}
export function waterShapes(){return waterContours.map(region=>{const shape=new T.Shape(region[0].map(p=>new T.Vector2(p.x,-p.y)));for(const hole of region.slice(1))shape.holes.push(new T.Path(hole.map(p=>new T.Vector2(p.x,-p.y))));return shape;});}
export function meadowGeometry(half:number){
 const shape=new T.Shape([new T.Vector2(-half,-half),new T.Vector2(half,-half),new T.Vector2(half,half),new T.Vector2(-half,half)]),islands:T.Shape[]=[];
 for(const region of LAND_WATER_REGIONS){shape.holes.push(new T.Path(region[0].map(([x,z])=>new T.Vector2(x,-z))));for(const hole of region.slice(1))islands.push(new T.Shape(hole.map(([x,z])=>new T.Vector2(x,-z))));}
 return new T.ShapeGeometry([shape,...islands]);
}
