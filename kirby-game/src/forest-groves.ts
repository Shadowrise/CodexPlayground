import type {Biome} from './forest';
import type {MeadowLayout,MeadowTree} from './meadow-layout';
import {MeadowIndex} from './meadow-index';
import {sceneryClearance} from './landmarks';
import {fruitLayout} from './fruit-layout';
import {MEADOW_HALF_SIZE as H} from './world-bounds';
import type {Vector3} from 'three';

export type GroveTree=MeadowTree&{biome:Biome;scale:number;yaw:number;grove:number;spread:number};
type Grove={x:number;z:number;rx:number;rz:number;yaw:number;trail:boolean};

/** Existing mature trees anchor the new groves. Paths/fruit clearings are planned
 * first, so denser woodland cannot close an approach or crowd out collectibles. */
export function growForestGroves(base:readonly MeadowTree[],layout:MeadowLayout,track:readonly Vector3[],biomeAt:(x:number,z:number)=>Biome){
 let seed=85731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const fruitClearings=fruitLayout(base);
 const trees=new MeadowIndex<MeadowTree>(24,base),rails=new MeadowIndex(24,track),fruit=new MeadowIndex(24,fruitClearings);
 const groves:Grove[]=[];
 for(const path of layout.paths){
  let walked=0,next=8+random()*12;
  for(let i=1;i<path.points.length;i++){
   const a=path.points[i-1],b=path.points[i],len=Math.hypot(b.x-a.x,b.z-a.z);walked+=len;if(walked<next||len<.001)continue;
   next=walked+18+random()*13;
   for(const side of [-1,1]){
    const offset=13+random()*10,yaw=Math.atan2(b.z-a.z,b.x-a.x);
    groves.push({x:b.x-(b.z-a.z)/len*offset*side,z:b.z+(b.x-a.x)/len*offset*side,rx:12+random()*9,rz:6+random()*5,yaw,trail:true});
   }
  }
 }
 const trailGroves=groves.length;
 for(let x=-H+34;x<H-25;x+=58)for(let z=-H+34;z<H-25;z+=58){
  const px=x+(random()-.5)*26,pz=z+(random()-.5)*26;
  if(sceneryClearance(px,pz,12)&&layout.clearOfTrails(px,pz,5))groves.push({x:px,z:pz,rx:22+random()*10,rz:15+random()*9,yaw:random()*Math.PI*2,trail:false});
 }
 for(const t of base)groves.push({x:t.x,z:t.z,rx:12+random()*12,rz:10+random()*10,yaw:random()*Math.PI*2,trail:false});
 const added:GroveTree[]=[],target=base.length*4;
 const largest=Math.max(...base.map(t=>t.crownRadius),8);
 // Round-robin growth keeps every biome and every path populated before adding
 // another layer to any grove. Reject obstacles rather than pushing trees onto banks.
 for(let round=0;round<300&&added.length<target;round++)for(let g=0;g<groves.length&&added.length<target;g++){
  const grove=groves[g],a=random()*Math.PI*2,r=Math.sqrt(random()),co=Math.cos(grove.yaw),si=Math.sin(grove.yaw);
  const dx=Math.cos(a)*r*grove.rx,dz=Math.sin(a)*r*grove.rz,x=grove.x+dx*co-dz*si,z=grove.z+dx*si+dz*co;
  // Broad clearings separate the copses; small-scale random jitter alone would
  // turn a fivefold increase into another evenly scattered field of trees.
  const density=.5+.27*Math.sin(x*.047+1.2*Math.sin(z*.026))+.24*Math.cos(z*.044-.8*Math.sin(x*.023));
  if(density<.23)continue;
  const biome=biomeAt(x,z),s=random()<.12?.8+random()*.4:.42+random()*.4;
  const spread=biome==='spruce'?1:.82;
  const crownRadius=(biome==='spruce'?2.2:biome==='birch'?6.4:4.2)*s*spread;
  if(Math.max(Math.abs(x),Math.abs(z))+crownRadius>H-2||Math.hypot(x,z)<14||Math.abs(x)<19&&z>207)continue;
  if(!layout.clearOfTrails(x,z,crownRadius+.5)||!sceneryClearance(x,z,crownRadius+1))continue;
  if(rails.some(x,z,crownRadius+5,p=>(p.x-x)**2+(p.z-z)**2<(crownRadius+5)**2))continue;
  if(trees.some(x,z,crownRadius+largest+1.2,p=>(p.x-x)**2+(p.z-z)**2<(crownRadius+p.crownRadius+1.2)**2))continue;
  if(fruit.some(x,z,10.5,p=>(p.x-x)**2+(p.z-z)**2<10.5**2))continue;
  const tree={x,z,crownRadius,biome,scale:s,yaw:random()*Math.PI*2,grove:g,spread};added.push(tree);trees.add(tree);
 }
 return {trees:added,groves,trailGroves,fruitClearings};
}
