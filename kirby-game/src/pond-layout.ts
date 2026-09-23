import * as T from 'three';
import { LANDMARKS } from './landmark-sites';
export const WATER_Y=-.42;
export const PONDS=LANDMARKS.filter(s=>s.kind===0);
export const streamX=(z:number)=>Math.sin((z-6)/1.35*.45)*1.2;
export const deckHeight=(x:number)=>2.8*Math.cos(Math.min(1,Math.abs(x)/5)*Math.PI/2)**2;
export function pondOutline(){
 const pts:T.Vector2[]=[],a=Math.asin(6/7.8);
 for(let i=0;i<=80;i++){const t=a-(Math.PI+2*a)*i/80;pts.push(new T.Vector2(11.3*Math.cos(t),7.8*Math.sin(t)));}
 for(let i=0;i<=30;i++){const z=6+i*.48;pts.push(new T.Vector2(streamX(z)-1.8,z));}
 for(let i=30;i>=0;i--){const z=6+i*.48;pts.push(new T.Vector2(streamX(z)+1.8,z));}
 return pts;
}
const outline=pondOutline();
export function inPond(x:number,z:number){
 const points=outline;let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside;
}
export function meadowGeometry(half:number){
 const shape=new T.Shape([new T.Vector2(-half,-half),new T.Vector2(half,-half),new T.Vector2(half,half),new T.Vector2(-half,half)]);
 for(const site of PONDS)shape.holes.push(new T.Path(pondOutline().map(p=>new T.Vector2(site.x+p.x,-site.z-p.y))));
 return new T.ShapeGeometry(shape);
}
