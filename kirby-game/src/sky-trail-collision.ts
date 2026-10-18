import type {Vector3} from 'three';
import {standingFootprint,footprintOverlapsRect} from './standing-footprint';
import {SKY_PLATFORMS,SKY_TRAIL_SITE,platformThickness} from './sky-trail-layout';

const boxes=SKY_PLATFORMS.map((p,i)=>({
 x:SKY_TRAIL_SITE.x+p.x,z:SKY_TRAIL_SITE.z+p.z,
 half:p.size/2,top:p.y,bottom:p.y-platformThickness(i),
}));
const EPS=1e-7;
type Axis='x'|'y'|'z';
const axes:Axis[]=['y','x','z'];

/** Sweep a standing body against the actual cube volumes, then slide along faces. */
export function collideSkyPlatforms(position:Vector3,previous:Vector3,size:number,yaw:number){
 const radius=.6*size,height=1.8*size,footprint=standingFootprint(size,yaw);
 const from={x:previous.x,y:previous.y,z:previous.z};
 const motion={x:position.x-previous.x,y:position.y-previous.y,z:position.z-previous.z};
 // Growth or an old saved position can start inside a cube. Recover sideways
 // rather than forcing the actor through its top or below the ground.
 for(let pass=0;pass<4;pass++){
  let moved=false;
  for(const b of boxes){
   if(from.y>=b.top-EPS||from.y+height<=b.bottom+EPS)continue;
   const half=b.half+radius,dx=from.x-b.x,dz=from.z-b.z;
   if(Math.abs(dx)>=half-EPS||Math.abs(dz)>=half-EPS)continue;
   if(half-Math.abs(dx)<half-Math.abs(dz))from.x=b.x+(dx<0?-half:half);
   else from.z=b.z+(dz<0?-half:half);
   moved=true;
  }
  if(!moved)break;
 }
 let ceiling=false;
 for(let pass=0;pass<4;pass++){
  let hit:{time:number;axis:Axis;boundary:number}|undefined;
  for(const b of boxes){
   const min={x:b.x-b.half-radius,y:b.bottom-height,z:b.z-b.half-radius};
   const max={x:b.x+b.half+radius,y:b.top,z:b.z+b.half+radius};
   let enter=-Infinity,exit=Infinity,axis:Axis='y',boundary=0,miss=false;
   for(const a of axes){
    if(Math.abs(motion[a])<EPS){if(from[a]<=min[a]+EPS||from[a]>=max[a]-EPS){miss=true;break;}continue;}
    const near=(min[a]-from[a])/motion[a],far=(max[a]-from[a])/motion[a];
    const time=Math.min(near,far);
    if(time>enter){enter=time;axis=a;boundary=motion[a]>0?min[a]:max[a];}
    exit=Math.min(exit,Math.max(near,far));
   }
   if(miss||enter<0||enter>1||exit<=enter+EPS||hit&&enter>=hit.time)continue;
   // Tops keep the existing rounded, rotated feet support, including large
   // characters standing on an edge. A square body must not add phantom ground.
   if(axis==='y'&&motion.y<0&&!footprintOverlapsRect(from.x+motion.x*enter-b.x,from.z+motion.z*enter-b.z,b.half,b.half,footprint))continue;
   hit={time:enter,axis,boundary};
  }
  if(!hit)break;
  if(hit.axis==='y'&&motion.y>0)ceiling=true;
  for(const a of axes){from[a]+=motion[a]*hit.time;motion[a]*=1-hit.time;}
  from[hit.axis]=hit.boundary;
  motion[hit.axis]=0;
 }
 position.set(from.x+motion.x,from.y+motion.y,from.z+motion.z);
 return ceiling;
}
