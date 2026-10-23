import * as T from 'three';

/** Use the already authored middle/far crowns sooner. Fruit keeps its existing
 * visibility distance; the forest silhouette, placement and shadows stay intact. */
export class ForestDetail{
 private levels:{level:T.LOD['levels'][number];original:number;distance:number}[]=[];
 constructor(roots:readonly T.Object3D[]){
  for(const root of roots)root.traverse(o=>{
   if(!(o instanceof T.LOD)||!/^Decorative forest (wood|leaves|birchLeaves)/.test(o.name))return;
   for(let i=1;i<Math.min(3,o.levels.length);i++)this.levels.push({level:o.levels[i],original:o.levels[i].distance,distance:Math.min(o.levels[i].distance,i===1?80:180)});
  });
  this.setEnabled(true);
 }
 setEnabled(enabled:boolean){for(const entry of this.levels)entry.level.distance=enabled?entry.distance:entry.original;}
}
