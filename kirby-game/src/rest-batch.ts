import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export type RestPart={geometry:T.BufferGeometry;matrix:T.Matrix4};

/** One draw for many parts that rest most of the time. A part that starts to
 * move is removed here (its triangles become degenerate) and drawn by its own
 * mesh; it returns when it is back at its rest pose. Geometry is unchanged. */
export class RestBatch{
 readonly mesh:T.Mesh;
 private ranges:{start:number;count:number}[]=[];
 private original:T.TypedArray;
 private shown:boolean[];
 constructor(parts:readonly RestPart[],material:T.Material,name:string){
  let start=0;
  const geometries=parts.map(({geometry,matrix})=>{
   const copy=geometry.clone();copy.userData={};copy.applyMatrix4(matrix);
   if(!copy.index)copy.setIndex(Array.from({length:copy.attributes.position.count},(_,i)=>i));
   this.ranges.push({start,count:copy.index!.count});start+=copy.index!.count;return copy;
  });
  const merged=mergeGeometries(geometries);geometries.forEach(geometry=>geometry.dispose());
  if(!merged)throw new Error('Rest batch parts need matching attributes: '+name);
  merged.computeBoundingSphere();this.original=merged.index!.array.slice();this.shown=parts.map(()=>true);
  this.mesh=new T.Mesh(merged,material);this.mesh.name=name;this.mesh.matrixAutoUpdate=false;this.mesh.raycast=()=>{};
 }
 isShown(index:number){return this.shown[index];}
 setShown(index:number,shown:boolean){
  if(this.shown[index]===shown)return;this.shown[index]=shown;
  const attribute=this.mesh.geometry.index!,{start,count}=this.ranges[index],array=attribute.array;
  if(shown)array.set(this.original.subarray(start,start+count),start);else array.fill(0,start,start+count);
  attribute.addUpdateRange(start,count);attribute.needsUpdate=true;
 }
}
