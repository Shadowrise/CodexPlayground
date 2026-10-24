import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
type RigidComponent={geometry:T.BufferGeometry;matrix:T.Matrix4};
const components=new WeakMap<T.Mesh,RigidComponent[]>();
export function rigidComponents(mesh:T.Mesh){return components.get(mesh);}

/** Merge rigid siblings only. Animated pivots stay separate, as do transparent
 * surfaces, morphs and materials with different lighting/texture properties.
 * Colours are baked in linear space; geometry, normals and UVs stay intact. */
export function batchRigidMeshes(parent:T.Object3D,preserve:ReadonlySet<T.Object3D>=new Set()){
 for(const _ of rigidMeshWork(parent,preserve)){}
}
export function* rigidMeshWork(parent:T.Object3D,preserve:ReadonlySet<T.Object3D>=new Set()){
 const batches=new Map<string,T.Mesh[]>();
 const metadata:T.JSONMeta={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},materialKeys=new Map<T.Material,string>();
 for(const child of parent.children){
  if(!(child instanceof T.Mesh)||child instanceof T.SkinnedMesh||preserve.has(child)||child.children.length||child.morphTargetInfluences||Array.isArray(child.material))continue;
  const m=child.material;
  if(!(m instanceof T.MeshStandardMaterial)||m.transparent||!m.visible||!child.visible||m.onBeforeCompile!==T.Material.prototype.onBeforeCompile)continue;
  if(child.customDepthMaterial||child.customDistanceMaterial||child.geometry.drawRange.start!==0||Number.isFinite(child.geometry.drawRange.count)||child.geometry.getAttribute('color')?.itemSize===4)continue;
  let properties=materialKeys.get(m);
  if(properties===undefined){
   const data=m.toJSON(metadata) as unknown as Record<string,unknown>;
   for(const key of ['uuid','name','color','vertexColors','metadata','userData'])delete data[key];
   properties=JSON.stringify(data);materialKeys.set(m,properties);
  }
  const attributes=Object.keys(child.geometry.attributes).filter(name=>name!=='color').sort().map(name=>{const a=child.geometry.getAttribute(name);return [name,a.itemSize,a.normalized];});
  const key=JSON.stringify([properties,attributes,child.castShadow,child.receiveShadow,child.renderOrder,child.layers.mask,child.frustumCulled]);
  const batch=batches.get(key)??[];batch.push(child);batches.set(key,batch);
  yield;
 }
 const matrix=new T.Matrix4(),instance=new T.Matrix4(),colour=new T.Color(),vertex=new T.Color(),vertexColour=new T.Color();
 for(const sources of batches.values()){
  if(sources.length<2)continue;
  const geometries:T.BufferGeometry[]=[],parts:RigidComponent[]=[];
  for(const source of sources){
   source.updateMatrix();
   const m=source.material as T.MeshStandardMaterial;
   for(let i=0;i<(source instanceof T.InstancedMesh?source.count:1);i++){
    matrix.copy(source.matrix);colour.copy(m.color);
    if(source instanceof T.InstancedMesh){source.getMatrixAt(i,instance);matrix.multiply(instance);if(source.instanceColor){source.getColorAt(i,vertex);colour.multiply(vertex);}}
    parts.push(...(components.get(source)?.map(p=>({geometry:p.geometry,matrix:matrix.clone().multiply(p.matrix)}))??[{geometry:source.geometry,matrix:matrix.clone()}]));
    const g=source.geometry.clone();g.applyMatrix4(matrix);
    // A reflected transform needs reversed winding after baking its matrix.
    if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,j)=>j));
    if(matrix.determinant()<0)for(let j=0;j<g.index!.count;j+=3){const a=g.index!.getX(j);g.index!.setX(j,g.index!.getX(j+2));g.index!.setX(j+2,a);}
    const old=g.getAttribute('color'),colors=new Float32Array(g.attributes.position.count*3);
    for(let j=0;j<g.attributes.position.count;j++){
     vertex.copy(colour);if(m.vertexColors&&old)vertex.multiply(vertexColour.fromBufferAttribute(old,j));
     colors.set([vertex.r,vertex.g,vertex.b],j*3);
    }
    g.setAttribute('color',new T.BufferAttribute(colors,3));g.clearGroups();geometries.push(g);
    yield;
   }
  }
  const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
  if(!geometry)continue;
  const source=sources[0],material=(source.material as T.MeshStandardMaterial).clone();material.color.set(0xffffff);material.vertexColors=true;
  const mesh=new T.Mesh(geometry,material);mesh.name='Batched rigid details';mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.renderOrder=source.renderOrder;mesh.layers.mask=source.layers.mask;mesh.frustumCulled=source.frustumCulled;
  mesh.updateMatrix();mesh.matrixAutoUpdate=false;geometry.computeBoundingSphere();
  components.set(mesh,parts);
  sources.forEach(s=>s.removeFromParent());parent.add(mesh);
 }
}

/** Prepare a template before cloning, so all instances share the merged buffers. */
export function batchRigidTree(root:T.Object3D,clips:readonly T.AnimationClip[]=[]){
 const preserve=new Set<T.Object3D>();
 for(const clip of clips)for(const track of clip.tracks){const name=T.PropertyBinding.parseTrackName(track.name).nodeName;const node=T.PropertyBinding.findNode(root,name);if(node instanceof T.Object3D)preserve.add(node);}
 const parents:T.Object3D[]=[];root.traverse(o=>{if(!(o instanceof T.Mesh))parents.push(o);});
 for(const parent of parents)batchRigidMeshes(parent,preserve);
}
