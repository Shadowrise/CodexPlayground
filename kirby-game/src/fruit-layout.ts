import { LANDMARKS,sceneryClearance } from './landmarks';
import { inWater } from './pond-layout';
import {MeadowIndex} from './meadow-index';
import {startupWork} from './startup-tasks';
export type FruitObstacle={x:number;z:number;radius?:number};
export function fruitLayout(obstacles:readonly FruitObstacle[]=[]){
 const work=layoutWork(obstacles);for(;;){const step=work.next();if(step.done)return step.value;}
}
export function fruitLayoutAsync(obstacles:readonly FruitObstacle[]=[]){return startupWork(layoutWork(obstacles));}
function* layoutWork(obstacles:readonly FruitObstacle[]):Generator<void,{x:number;z:number}[]>{
 let seed=9913;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const placed:{x:number;z:number}[]=[];
 const blocked=new MeadowIndex(24,obstacles),neighbours=new MeadowIndex<{x:number;z:number}>(16);
 const reach=obstacles.reduce((r,p)=>Math.max(r,(p.radius??7)+3),0);
 const safe=(x:number,z:number)=>Math.abs(x)<202 && Math.abs(z)<202 && sceneryClearance(x,z,5) && !inWater(x,z)
  && Math.hypot(x+189,z+207)>39 && !blocked.some(x,z,reach,p=>(x-p.x)**2+(z-p.z)**2<=((p.radius??7)+3)**2)
  && !neighbours.some(x,z,9,p=>(x-p.x)**2+(z-p.z)**2<=81);
 for(let i=0;i<70;i++){
  const cell=i*27%70,cx=(cell%10+.5)*40-200,cz=(Math.floor(cell/10)+.5)*400/7-200;
  let best:{x:number;z:number}|undefined,bestScore=Infinity;
  for(let attempt=0;attempt<500;attempt++){
   const x=cx+(random()-.5)*38,z=cz+(random()-.5)*54;if(!safe(x,z))continue;
   // Prefer accessible open verges beside attractions while retaining map-wide coverage.
   const verge=Math.min(...LANDMARKS.map(p=>Math.abs(Math.hypot(x-p.x,z-p.z)-(p.radius+13))));
   const score=verge+Math.hypot(x-cx,z-cz)*.2;if(score<bestScore){best={x,z};bestScore=score;}
  }
  if(!best){for(let r=5;r<150&&!best;r+=5)for(let j=0;j<60;j++){const a=j*Math.PI/30,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(safe(x,z)){best={x,z};break;}}}
  if(!best)throw new Error('No clear fruit location');placed.push(best);neighbours.add(best);
  yield;
 }
 return placed;
}
