export const SKY_TRAIL_SITE={x:50,z:-60,radius:24};
export const SKY_COLORS=['#ff4858','#ff953e','#ffe356','#54d879','#49ceff','#386bea','#a668f1'];
export type SkyPlatform={x:number;y:number;z:number;size:number};
export const SKY_PLATFORMS:SkyPlatform[]=Array.from({length:15},(_,i)=>({x:Math.cos(Math.PI/2+i*.52)*10,y:.8+i*1.1,z:Math.sin(Math.PI/2+i*.52)*10,size:[4,9,14].includes(i)?4:3.2}));
const end=SKY_PLATFORMS[14];
SKY_PLATFORMS.push({x:8.5,y:end.y,z:end.z,size:5},...[[9,17.3,0],[6,18.4,-5],[1,19.5,-8],[-4,20.6,-5],[-5.8,21.7,0],[0,22.8,0]].map(([x,y,z],i)=>({x,y,z,size:i===5?8:i===3?4:3.2})));
export const SKY_CHECKPOINTS=[4,9,14,19];
export function rainbowHeight(x:number){const t=(x-end.x)/(8.5-end.x);return t>=0&&t<=1?end.y+Math.sin(t*Math.PI)*2:undefined;}
export function skySurfaces(x:number,z:number){const surfaces=SKY_PLATFORMS.flatMap((p,i)=>Math.abs(x-p.x)<=p.size/2&&Math.abs(z-p.z)<=p.size/2?[{height:p.y,index:i}]:[]);const h=rainbowHeight(x);if(h!==undefined&&Math.abs(z-end.z)<=1.8)surfaces.push({height:h,index:-1});return surfaces;}
