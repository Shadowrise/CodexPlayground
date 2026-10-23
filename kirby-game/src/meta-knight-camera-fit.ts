import {META_KNIGHT_ARENA as SITE} from './meta-knight-arena-site';
import type {KnightPoint} from './meta-knight-battle';

const LENGTH=Math.hypot(.68,.82),RISE=.68/LENGTH,DEPTH=.82/LENGTH;
const ARENA_POINTS:KnightPoint[]=[];
for(let i=0;i<128;i++)for(const y of [0,-2.2]){const a=i*Math.PI/64;ARENA_POINTS.push([Math.sin(a)*(SITE.radius+.25),y,Math.cos(a)*(SITE.radius+.25)]);}
for(let i=0;i<8;i++){const a=i*Math.PI/4;ARENA_POINTS.push([Math.sin(a)*44.6,4.7,Math.cos(a)*44.6]);}
ARENA_POINTS.push([0,-16.5,0]);
const project=([x,y,z]:KnightPoint)=>({x,up:(y-3)*DEPTH-z*RISE,depth:(y-3)*RISE+z*DEPTH});
const ARENA_PROJECTION=ARENA_POINTS.map(project);

/** Fit the projected arena, rather than a sphere, and centre it inside the HUD insets. */
export function fitKnightArenaCamera(width:number,height:number,actors:readonly KnightPoint[]=[],top=96,bottom=24){
 width=Math.max(1,width);height=Math.max(1,height);
 const fov=height>width?75:55,tan=Math.tan(fov*Math.PI/360),aspect=width/height;
 const upper=1-2*Math.min(height*.3,Math.max(8,top))/height,lower=-1+2*Math.min(height*.25,Math.max(8,bottom))/height,horizontal=1-2*Math.min(20,width*.04)/width;
 const points=[...ARENA_PROJECTION,...actors.map(project)];
 let minDistance=1;for(const p of points)minDistance=Math.max(minDistance,p.depth+Math.abs(p.x)/(tan*aspect*horizontal),p.depth+1);
 const limits=(distance:number)=>{let min=-Infinity,max=Infinity;for(const p of points){const span=tan*(distance-p.depth);min=Math.max(min,p.up-upper*span);max=Math.min(max,p.up-lower*span);}return {min,max};};
 let low=minDistance,high=minDistance;while(limits(high).min>limits(high).max)high*=1.5;
 for(let i=0;i<32;i++){const middle=(low+high)/2,bounds=limits(middle);if(bounds.min>bounds.max)low=middle;else high=middle;}
 const distance=high+.02,bounds=limits(distance);let min=bounds.min,max=bounds.max;
 // Equalise the remaining top/bottom gaps when width limits the zoom.
 for(let i=0;i<24;i++){const centre=(min+max)/2;let topEdge=-Infinity,bottomEdge=Infinity;for(const p of points){const y=(p.up-centre)/(tan*(distance-p.depth));topEdge=Math.max(topEdge,y);bottomEdge=Math.min(bottomEdge,y);}if(topEdge+bottomEdge>upper+lower)min=centre;else max=centre;}
 const centre=(min+max)/2;
 return {fov,distance:distance/LENGTH,focus:[0,3+centre*DEPTH,-centre*RISE] as KnightPoint};
}
