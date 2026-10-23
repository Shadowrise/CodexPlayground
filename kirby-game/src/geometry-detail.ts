import * as T from 'three';

const cache=new WeakMap<T.BufferGeometry,Map<number,T.BufferGeometry>>();

/** Weld a dense sculpt into small spatial cells. Retain authored attributes at
 * the selected vertices, including skin weights, UVs and morph targets. The
 * maximum position error is one cell diagonal; thin parts use their own bounds. */
export function clusteredGeometry(source:T.BufferGeometry,cells=32){
 let levels=cache.get(source);if(!levels){levels=new Map();cache.set(source,levels);}
 const cached=levels.get(cells);if(cached)return cached;
 const p=source.attributes.position,count=source.index?.count??p.count;
 if(count<1800){levels.set(cells,source);return source;}
 source.computeBoundingBox();const box=source.boundingBox!,size=box.getSize(new T.Vector3());
 const vertices:number[]=[],errors:number[]=[],remap=new Uint32Array(p.count),grid=new Map<string,number>();
 for(let i=0;i<p.count;i++){
  const coordinates=[0,1,2].map(axis=>(p.getComponent(i,axis)-box.min.getComponent(axis))/Math.max(size.getComponent(axis),1e-8)*cells);
  const cell=coordinates.map(Math.round),key=cell.join(','),error=coordinates.reduce((sum,value,axis)=>sum+(value-cell[axis])**2,0);
  let index=grid.get(key);if(index===undefined){index=vertices.length;vertices.push(i);errors.push(error);grid.set(key,index);}
  else if(error<errors[index]){vertices[index]=i;errors[index]=error;}
  remap[i]=index;
 }
 const indices:number[]=[],groups=source.groups.length?source.groups:[{start:0,count,materialIndex:0}];
 const geometry=new T.BufferGeometry();
 for(const group of groups){
  const start=indices.length,seen=new Set<string>();
  for(let i=group.start;i<Math.min(count,group.start+group.count);i+=3){
   const a=remap[source.index?.getX(i)??i],b=remap[source.index?.getX(i+1)??i+1],c=remap[source.index?.getX(i+2)??i+2];
   if(a===b||b===c||a===c)continue;
   const key=[a,b,c].sort((x,y)=>x-y).join(',');if(seen.has(key))continue;seen.add(key);indices.push(a,b,c);
  }
  if(source.groups.length)geometry.addGroup(start,indices.length-start,group.materialIndex);
 }
 if(indices.length>count*.85){geometry.dispose();levels.set(cells,source);return source;}
 const subset=(attribute:T.BufferAttribute|T.InterleavedBufferAttribute)=>{
  const values=new Float32Array(vertices.length*attribute.itemSize);
  vertices.forEach((v,i)=>{for(let axis=0;axis<attribute.itemSize;axis++)values[i*attribute.itemSize+axis]=attribute.getComponent(v,axis);});
  // getComponent already expands normalized integer attributes.
  return new T.BufferAttribute(values,attribute.itemSize);
 };
 for(const [name,attribute] of Object.entries(source.attributes))geometry.setAttribute(name,subset(attribute));
 for(const name of ['position','normal','color'] as const){const attributes=source.morphAttributes[name];if(attributes)geometry.morphAttributes[name]=attributes.map(subset);}
 geometry.morphTargetsRelative=source.morphTargetsRelative;geometry.setIndex(indices);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();levels.set(cells,geometry);return geometry;
}
