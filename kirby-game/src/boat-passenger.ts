import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const reduced=new WeakMap<T.BufferGeometry,T.BufferGeometry>();
/** Sample the original model's regular surface grids, retaining its face colors,
 * morphs and animation pivots. No costly runtime mesh simplification is needed. */
export function lightenBoatPassenger(model:T.Object3D){
 model.traverse(o=>{
  if(!(o instanceof T.Mesh))return;
  const source=o.geometry;let geometry=reduced.get(source);
  if(!geometry){
   const count=source.getAttribute('position').count,ids:number[]=[],indices:number[]=[];
   if(count===4097){
    const cols=32,rows=8;ids.push(0);
    for(let row=1;row<=rows;row++)for(let col=0;col<cols;col++)ids.push(1+(row*4-1)*128+col*4);
    for(let col=0;col<cols;col++)indices.push(0,1+col,1+(col+1)%cols);
    for(let row=1;row<rows;row++)for(let col=0;col<cols;col++){const a=1+(row-1)*cols+col,b=1+(row-1)*cols+(col+1)%cols;indices.push(a,a+cols,b+cols,a,b+cols,b);}
   }else if(count===41377||count===10449){
    const step=count===41377?8:4,sourceCols=count===41377?256:128,cols=32,rows=20;
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++)ids.push(row*step*(sourceCols+1)+col*step);
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=row*(cols+1)+col,b=a+cols+1;if(row)indices.push(a,a+1,b);if(row<rows-1)indices.push(a+1,b+1,b);}
   }else return;
   geometry=new T.BufferGeometry();
   const sample=(attr:T.BufferAttribute|T.InterleavedBufferAttribute)=>{
    const values=new Float32Array(ids.length*attr.itemSize);
    ids.forEach((index,i)=>{for(let k=0;k<attr.itemSize;k++)values[i*attr.itemSize+k]=attr.getComponent(index,k);});
    return new T.BufferAttribute(values,attr.itemSize);
   };
   for(const key of Object.keys(source.attributes))geometry.setAttribute(key,sample(source.getAttribute(key)));
   for(const key of ['position','normal','color'] as const)if(source.morphAttributes[key])geometry.morphAttributes[key]=source.morphAttributes[key]!.map(sample);
   geometry.morphTargetsRelative=source.morphTargetsRelative;geometry.setIndex(indices);geometry.computeBoundingSphere();reduced.set(source,geometry);
  }
  o.geometry=geometry;
 });
 // Merge rigid pieces under each animated pivot. Eyelids still blink and the
 // two mouth morph meshes stay separate, while seventeen draws become nine.
 const parents:T.Object3D[]=[];model.traverse(o=>{if(!(o instanceof T.Mesh))parents.push(o);});
 for(const parent of parents){
  const meshes=parent.children.filter((o):o is T.Mesh=>o instanceof T.Mesh&&!Object.keys(o.geometry.morphAttributes).length);
  if(meshes.length<2)continue;
  const parts=meshes.map(m=>{
   m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);g.deleteAttribute('uv');
   const mat=m.material as T.MeshStandardMaterial,attribute=g.getAttribute('color'),values=new Float32Array(g.attributes.position.count*3);
   for(let i=0;i<g.attributes.position.count;i++)values.set([mat.color.r*(attribute?.getX(i)??1),mat.color.g*(attribute?.getY(i)??1),mat.color.b*(attribute?.getZ(i)??1)],i*3);
   g.setAttribute('color',new T.BufferAttribute(values,3));return g;
  });
  const combined=mergeGeometries(parts)!,material=(meshes[0].material as T.MeshStandardMaterial).clone();material.color.set('#ffffff');material.vertexColors=true;
  const mesh=new T.Mesh(combined,material);mesh.name='Batched passenger details';mesh.receiveShadow=true;
  meshes.forEach(m=>parent.remove(m));parent.add(mesh);parts.forEach(g=>g.dispose());
 }
}
