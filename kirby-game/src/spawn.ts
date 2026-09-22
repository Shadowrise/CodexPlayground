import { sceneryClearance } from './landmarks';
export function randomSpawn(obstacles: readonly {x:number;z:number}[], random=Math.random) {
  const safe=(x:number,z:number)=>sceneryClearance(x,z,5) && obstacles.every(p=>Math.hypot(p.x-x,p.z-z)>7);
  for(let i=0;i<1000;i++) {
    const x=(random()*2-1)*208,z=(random()*2-1)*208;
    if(safe(x,z))return {x,z};
  }
  for(let x=-200;x<=200;x+=10)for(let z=-200;z<=200;z+=10)if(safe(x,z))return {x,z};
  return {x:0,z:0};
}
