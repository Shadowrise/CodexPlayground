import {standingFootprint,footprintOverlapsRect} from './standing-footprint';
export const SKY_TRAIL_SITE={x:50,z:-60,radius:24};
export const SKY_COLORS=['#ff4858','#ff953e','#ffe356','#54d879','#49ceff','#386bea','#a668f1'];
export type SkyPlatform={x:number;y:number;z:number;size:number};
export const SKY_RAINBOW_START=22;
export const SKY_RAINBOW_END=23;
export const SKY_CHECKPOINTS=[9,22,32,39];
const rise=(45.6-.8)/42;
export const SKY_PLATFORMS:SkyPlatform[]=Array.from({length:44},(_,i)=>{
 const angle=i<=22?Math.PI+(i-22)*.42:(i-23)*.42;
 const radius=i===43?8.5:14;
 const a=i===43?19*.42:angle;
 return {x:Math.cos(a)*radius,y:.8+(i<=22?i:i-1)*rise,z:Math.sin(a)*radius,size:i===43?5:SKY_CHECKPOINTS.includes(i)?4:3.2};
});
export function platformThickness(index:number){const p=SKY_PLATFORMS[index];return index===SKY_PLATFORMS.length-1?1.2:Math.min(p.size,p.y-.15);}
const start=SKY_PLATFORMS[SKY_RAINBOW_START],end=SKY_PLATFORMS[SKY_RAINBOW_END];
export function rainbowHeight(x:number){const t=(x-start.x)/(end.x-start.x);return t>=0&&t<=1?start.y+Math.sin(t*Math.PI)*2:undefined;}
export function skySurfaces(x:number,z:number,size=0,yaw=0){
 const footprint=standingFootprint(size,yaw);
 const surfaces=SKY_PLATFORMS.flatMap((p,i)=>footprintOverlapsRect(x-p.x,z-p.z,p.size/2,p.size/2,footprint)?[{height:p.y,index:i}]:[]);
 const mid=(start.x+end.x)/2,half=Math.abs(end.x-start.x)/2;
 if(footprintOverlapsRect(x-mid,z-start.z,half,1.75,footprint)){
  const contactX=Math.max(mid-half,Math.min(mid+half,x));
  surfaces.push({height:rainbowHeight(contactX)!,index:-1});
 }
 return surfaces;
}
