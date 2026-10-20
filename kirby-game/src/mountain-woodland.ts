import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MEADOW_HALF_SIZE as H,MOUNTAIN_WIDTH as W} from './world-bounds';
import {mountainSurfaceHeight as surface} from './mountain-surface';
import {MOUNTAIN_LEDGE_SITE,MOUNTAIN_PEAK,MOUNTAIN_SUMMIT,MOUNTAIN_STEPS,mountainLocal} from './mountain-ledges-layout';

/** Reserve the whole ascent, including room for jumps and the orbiting camera. */
export function clearOfMountainCourse(x:number,z:number,radius=0){
 const p=mountainLocal(x,z),minT=MOUNTAIN_SUMMIT.tangent-MOUNTAIN_SUMMIT.width/2-6-radius;
 const maxT=Math.max(...MOUNTAIN_STEPS.map(s=>s.tangent+s.width/2))+6+radius;
 return p.tangent<minT||p.tangent>maxT||p.radial<-12-radius||p.radial>MOUNTAIN_PEAK.radial+MOUNTAIN_PEAK.depth/2+12+radius;
}

/** Small evergreen crowns supply actual canopy silhouettes on the lower slopes. */
export function createMountainWoodland(){
 const group=new T.Group();group.name='Mountain slope woodland';
 const pieces:T.BufferGeometry[]=[];
 for(let tier=0;tier<4;tier++){
  const crown=new T.ConeGeometry(.92-tier*.17,1.8,9,1);crown.translate(0,1.35+tier*.65,0);pieces.push(crown);
 }
 const crowns=mergeGeometries(pieces)!;pieces.forEach(p=>p.dispose());
 const bark=new T.CylinderGeometry(.07,.13,1.5,6);bark.translate(0,.75,0);
 const leafMaterial=new T.MeshLambertMaterial({color:'#ffffff'}),barkMaterial=new T.MeshLambertMaterial({color:'#655645'});
 let seed=1783;
 const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
 const cells=new Map<string,{x:number;y:number;z:number;size:number;yaw:number;tint:T.Color}[]>();
 const sites:{x:number;y:number;z:number;radius:number}[]=[];
 for(let z=-H-W;z<H+W;z+=2.9)for(let x=-H-W;x<H+W;x+=2.9){
  const px=x+random()*2.3,pz=z+random()*2.3,r=Math.max(Math.abs(px),Math.abs(pz));
  if(r<H+1||r>H+W-1)continue;
  const y=surface(px,pz),size=.72+random()*.68;
  if(y<1.5||y>43+5*Math.sin(px*.063+pz*.047)||!clearOfMountainCourse(px,pz,size*1.2))continue;
  const slope=Math.hypot(surface(px+.5,pz)-surface(px-.5,pz),surface(px,pz+.5)-surface(px,pz-.5));
  if(slope>2.75||random()>.94-(y/62)**2)continue;
  const key=Math.floor(px/72)+','+Math.floor(pz/72),list=cells.get(key)??[];
  list.push({x:px,y:y-.15,z:pz,size,yaw:random()*Math.PI*2,tint:new T.Color('#20442d').lerp(new T.Color('#456942'),random())});cells.set(key,list);
  sites.push({x:px,y,z:pz,radius:size*1.2});
 }
 const pose=new T.Object3D();
 for(const [key,trees] of cells){
  const leaves=new T.InstancedMesh(crowns,leafMaterial,trees.length),trunks=new T.InstancedMesh(bark,barkMaterial,trees.length);
  leaves.name='Mountain evergreen crowns '+key;trunks.name='Mountain evergreen trunks '+key;
  trees.forEach((tree,i)=>{
   pose.position.set(tree.x,tree.y,tree.z);pose.scale.set(tree.size*1.18,tree.size*1.45,tree.size*1.18);pose.rotation.y=tree.yaw;pose.updateMatrix();
   leaves.setMatrixAt(i,pose.matrix);leaves.setColorAt(i,tree.tint);trunks.setMatrixAt(i,pose.matrix);
  });
  for(const mesh of [leaves,trunks]){mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);}
 }
 group.userData.treePositions=sites;
 group.userData.courseOrigin={x:MOUNTAIN_LEDGE_SITE.x,z:MOUNTAIN_LEDGE_SITE.z};
 return group;
}
