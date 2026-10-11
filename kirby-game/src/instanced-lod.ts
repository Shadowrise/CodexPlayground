import * as T from 'three';
import {ACTOR_DISTANCE} from './visibility';

export type InstanceLodPart={matrix:T.Matrix4;color:T.Color;detail:number};
type Levels={middle:T.BufferGeometry;far:T.BufferGeometry;middleDetail?:number;farDetail?:number;middleDistance?:number;farDistance?:number;hideDistance?:number;cellSize?:number};

const eye=new T.Vector3(),bounds=new T.Sphere();

/** The same axis extents as a detailed unit sphere, with smooth radial normals.
 * Flat normals on an unsubdivided polyhedron make distant clumps look angular. */
export function roundedCoarseShape(){
 const geometry=new T.IcosahedronGeometry(1,0);
 const extent=1/.85065080835204;geometry.scale(extent,extent,extent);
 const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),normal=new T.Vector3();
 for(let i=0;i<positions.count;i++){normal.fromBufferAttribute(positions,i).normalize();normals.setXYZ(i,normal.x,normal.y,normal.z);}
 return geometry;
}

/** Measure from the foliage, not the cell centre. Centre-based hysteresis grows
 * with the cell and can keep sparse distant leaves even beside an outer tree. */
class BoundsLOD extends T.LOD {
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

/** One instanced draw per occupied cell and material. All levels reuse the same
 * transforms/colours unless detail filtering is explicitly requested. Keep any
 * separate continuous shadow silhouettes outside these visual LOD groups. */
export function instancedLod(name:string,geometry:T.BufferGeometry,material:T.Material,parts:readonly InstanceLodPart[],levels:Levels,receiveShadow:boolean){
 const root=new T.Group();root.name=name;
 const cellSize=levels.cellSize??64,cells=new Map<string,InstanceLodPart[]>();
 for(const part of parts){const e=part.matrix.elements,key=`${Math.floor(e[12]/cellSize)},${Math.floor(e[14]/cellSize)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(part);}
 const matrix=new T.Matrix4();
 for(const [cell,entries] of cells){
  const near=new T.InstancedMesh(geometry,material,entries.length);near.name=name;
  near.userData.spatialCell=cell;
  entries.forEach((p,i)=>{near.setMatrixAt(i,p.matrix);near.setColorAt(i,p.color);});near.computeBoundingSphere();
  const sphere=near.boundingSphere!,center=sphere.center.clone(),radius=sphere.radius+1.5;
  entries.forEach((p,i)=>{matrix.copy(p.matrix);matrix.elements[12]-=center.x;matrix.elements[13]-=center.y;matrix.elements[14]-=center.z;near.setMatrixAt(i,matrix);});
  near.boundingSphere=new T.Sphere(new T.Vector3(),radius);near.receiveShadow=receiveShadow;near.matrixAutoUpdate=false;
  const level=(g:T.BufferGeometry,detail=2)=>{
   const selected=entries.filter(p=>p.detail<=detail);
   if(!selected.length)return new T.Group();
   const mesh=new T.InstancedMesh(g,material,selected.length);mesh.name=name;mesh.receiveShadow=receiveShadow;mesh.matrixAutoUpdate=false;mesh.userData.spatialCell=cell;
   if(selected.length===entries.length){mesh.instanceMatrix=near.instanceMatrix;mesh.instanceColor=near.instanceColor;}
   else selected.forEach((p,i)=>{matrix.copy(p.matrix);matrix.elements[12]-=center.x;matrix.elements[13]-=center.y;matrix.elements[14]-=center.z;mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,p.color);});
   // Each shape has its own bounds; larger leaves at distance must never be
   // culled using a different level's geometry.
   mesh.computeBoundingSphere();return mesh;
  };
  const lod=new BoundsLOD(radius);lod.name=name;lod.position.copy(center);lod.updateMatrix();lod.matrixAutoUpdate=false;
  lod.addLevel(near,0);lod.addLevel(level(levels.middle,levels.middleDetail),levels.middleDistance??ACTOR_DISTANCE,.15);lod.addLevel(level(levels.far,levels.farDetail),levels.farDistance??ACTOR_DISTANCE*2,.15);
  if(levels.hideDistance!==undefined)lod.addLevel(new T.Group(),levels.hideDistance,.12);
  root.add(lod);
 }
 return root;
}
