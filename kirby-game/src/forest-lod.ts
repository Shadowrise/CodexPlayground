import * as T from 'three';
import {ACTOR_DISTANCE} from './visibility';

export type ForestPart={matrix:T.Matrix4;color:T.Color;detail:number};
type Levels={middle:T.BufferGeometry;far:T.BufferGeometry;middleDetail?:number;farDetail?:number};

const eye=new T.Vector3(),bounds=new T.Sphere();

/** Measure from the foliage, not the cell centre. Centre-based hysteresis grows
 * with the cell and can keep sparse distant leaves even beside an outer tree. */
class ForestLOD extends T.LOD {
 private current=0;
 constructor(private readonly radius:number){super();}
 override getCurrentLevel(){return this.current;}
 private levelForDistance(distance:number){
  let current=0;
  for(let i=1;i<this.levels.length;i++){
   const level=this.levels[i];
   // Approaching restores detail at the advertised range. Hysteresis extends
   // the outward range instead of making details appear too late on return.
   const threshold=level.distance*(this.levels[i-1].object.visible?1+level.hysteresis:1);
   if(distance<=threshold)break;
   current=i;
  }
  return current;
 }
 override getObjectForDistance(distance:number){return this.levels[this.levelForDistance(Math.max(0,distance-this.radius))].object;}
 override update(camera:T.Camera){
  eye.setFromMatrixPosition(camera.matrixWorld);
  bounds.center.set(0,0,0);bounds.radius=this.radius;bounds.applyMatrix4(this.matrixWorld);
  const distance=Math.max(0,eye.distanceTo(bounds.center)-bounds.radius)/('zoom' in camera?Number(camera.zoom):1);
  const current=this.levelForDistance(distance);
  this.current=current;
  for(let i=0;i<this.levels.length;i++)this.levels[i].object.visible=i===current;
 }
}

/** One instanced draw per occupied cell and material. Distant crowns use larger,
 * fewer folded leaves; fine twigs/fruit disappear before they become subpixels.
 * Level changes never replace the separate, continuous shadow silhouettes. */
export function forestInstances(name:string,geometry:T.BufferGeometry,material:T.Material,parts:readonly ForestPart[],levels:Levels,receiveShadow:boolean){
 const root=new T.Group();root.name=name;
 const cells=new Map<string,ForestPart[]>();
 for(const part of parts){const e=part.matrix.elements,key=`${Math.floor(e[12]/64)},${Math.floor(e[14]/64)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(part);}
 const matrix=new T.Matrix4();
 for(const entries of cells.values()){
  const near=new T.InstancedMesh(geometry,material,entries.length);near.name=name;
  entries.forEach((p,i)=>{near.setMatrixAt(i,p.matrix);near.setColorAt(i,p.color);});near.computeBoundingSphere();
  const sphere=near.boundingSphere!,center=sphere.center.clone(),radius=sphere.radius+1.5;
  entries.forEach((p,i)=>{matrix.copy(p.matrix);matrix.elements[12]-=center.x;matrix.elements[13]-=center.y;matrix.elements[14]-=center.z;near.setMatrixAt(i,matrix);});
  near.boundingSphere=new T.Sphere(new T.Vector3(),radius);near.receiveShadow=receiveShadow;
  const level=(g:T.BufferGeometry,detail=2)=>{
   const selected=entries.filter(p=>p.detail<=detail);
   if(!selected.length)return new T.Group();
   const mesh=new T.InstancedMesh(g,material,selected.length);mesh.name=name;mesh.receiveShadow=receiveShadow;
   if(selected.length===entries.length){mesh.instanceMatrix=near.instanceMatrix;mesh.instanceColor=near.instanceColor;}
   else selected.forEach((p,i)=>{matrix.copy(p.matrix);matrix.elements[12]-=center.x;matrix.elements[13]-=center.y;matrix.elements[14]-=center.z;mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,p.color);});
   // Each shape has its own bounds; larger leaves at distance must never be
   // culled using a different level's geometry.
   mesh.computeBoundingSphere();return mesh;
  };
  const lod=new ForestLOD(radius);lod.name=name;lod.position.copy(center);lod.updateMatrix();lod.matrixAutoUpdate=false;
  lod.addLevel(near,0);lod.addLevel(level(levels.middle,levels.middleDetail),ACTOR_DISTANCE,.15);lod.addLevel(level(levels.far,levels.farDetail),ACTOR_DISTANCE*2,.15);
  root.add(lod);
 }
 return root;
}
