import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MEADOW_HALF_SIZE as H,MOUNTAIN_WIDTH as W} from './world-bounds';
import {mountainSurfaceHeight as surface} from './mountain-surface';
import {MOUNTAIN_LEDGE_SITE,MOUNTAIN_PEAK,MOUNTAIN_SUMMIT,MOUNTAIN_STEPS,mountainLocal} from './mountain-ledges-layout';
import {spruceGeometries,spruceParts,spruceNeedleMaterial,spruceBarkMaterial} from './spruce-shape';
import {instancedLod,type InstanceLodPart} from './instanced-lod';

/** Reserve the whole ascent, including room for jumps and the orbiting camera. */
export function clearOfMountainCourse(x:number,z:number,radius=0){
 const p=mountainLocal(x,z),minT=MOUNTAIN_SUMMIT.tangent-MOUNTAIN_SUMMIT.width/2-6-radius;
 const maxT=Math.max(...MOUNTAIN_STEPS.map(s=>s.tangent+s.width/2))+6+radius;
 return p.tangent<minT||p.tangent>maxT||p.radial<-12-radius||p.radial>MOUNTAIN_PEAK.radial+MOUNTAIN_PEAK.depth/2+12+radius;
}

/** Meadow spruce branches and needles, fitted to the existing slope-tree envelope. */
function detailedSpruce(){
 const source=spruceGeometries(),parts=spruceParts(),merged={} as Record<keyof typeof source,T.BufferGeometry>;
 for(const kind of ['wood','needles'] as const){
  const pieces=parts.filter(p=>p.kind===kind).map(p=>source[kind].clone().applyMatrix4(p.matrix));
  merged[kind]=mergeGeometries(pieces)!;pieces.forEach(p=>p.dispose());source[kind].dispose();
 }
 const positions=merged.needles.getAttribute('position');let radius=0,height=0;
 for(let i=0;i<positions.count;i++){radius=Math.max(radius,Math.hypot(positions.getX(i),positions.getZ(i)));height=Math.max(height,positions.getY(i));}
 for(const shape of Object.values(merged))shape.scale(.92/radius,4.2/height,.92/radius);
 return merged;
}

/** Small evergreen crowns supply actual canopy silhouettes on the lower slopes. */
export function createMountainWoodland(){
 const group=new T.Group();group.name='Mountain slope woodland';
 const detailed=detailedSpruce();
 const crowns=(segments:number)=>{
  const pieces:T.BufferGeometry[]=[];
  for(let tier=0;tier<4;tier++){
   const crown=new T.ConeGeometry(.92-tier*.17,1.8,segments,1);crown.translate(0,1.35+tier*.65,0);pieces.push(crown);
  }
  const shape=mergeGeometries(pieces)!;pieces.forEach(p=>p.dispose());return shape;
 };
 const bark=new T.CylinderGeometry(.07,.13,1.5,6);bark.translate(0,.75,0);
 const leafMaterial=spruceNeedleMaterial(),barkMaterial=spruceBarkMaterial();
 let seed=1783;
 const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
 const leaves:InstanceLodPart[]=[],trunks:InstanceLodPart[]=[],pose=new T.Object3D(),barkColor=new T.Color('#655645');
 const sites:{x:number;y:number;z:number;radius:number}[]=[];
 for(let z=-H-W;z<H+W;z+=2.9)for(let x=-H-W;x<H+W;x+=2.9){
  const px=x+random()*2.3,pz=z+random()*2.3,r=Math.max(Math.abs(px),Math.abs(pz));
  if(r<H+1||r>H+W-1)continue;
  const y=surface(px,pz),size=.72+random()*.68;
  if(y<1.5||y>43+5*Math.sin(px*.063+pz*.047)||!clearOfMountainCourse(px,pz,size*1.2))continue;
  const slope=Math.hypot(surface(px+.5,pz)-surface(px-.5,pz),surface(px,pz+.5)-surface(px,pz-.5));
  if(slope>2.75||random()>.94-(y/62)**2)continue;
  pose.position.set(px,y-.15,pz);pose.scale.set(size*1.18,size*1.45,size*1.18);pose.rotation.y=random()*Math.PI*2;pose.updateMatrix();
  leaves.push({matrix:pose.matrix.clone(),color:new T.Color('#20442d').lerp(new T.Color('#456942'),random()),detail:0});
  trunks.push({matrix:pose.matrix.clone(),color:barkColor,detail:0});
  sites.push({x:px,y,z:pz,radius:size*1.2});
 }
 // Small cells keep nearby branches local; bounds-based LOD restores them even
 // when approaching a tree at a cell edge or from above the mountain course.
 group.add(instancedLod('Mountain evergreen crowns',detailed.needles,leafMaterial,leaves,{middle:crowns(9),far:crowns(6),middleDistance:64,farDistance:160,cellSize:24},true));
 group.add(instancedLod('Mountain evergreen trunks',detailed.wood,barkMaterial,trunks,{middle:bark,far:bark,middleDistance:48,farDistance:120,cellSize:24},true));
 group.userData.treePositions=sites;
 group.userData.courseOrigin={x:MOUNTAIN_LEDGE_SITE.x,z:MOUNTAIN_LEDGE_SITE.z};
 return group;
}
