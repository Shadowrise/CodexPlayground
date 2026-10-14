import * as T from 'three';

// Multi-draw is optional (notably on some phones). Keep ordinary instancing on
// those devices: BatchedMesh's per-object fallback would produce more draws.
let multiDraw=false;
export function configureSceneryBatching(enabled:boolean){multiDraw=enabled;}
type Source={mesh:T.InstancedMesh;visibility:T.Object3D;ids:number[];shown:boolean};
const sources=new WeakMap<T.BatchedMesh,Source[]>();
export function scenerySources(mesh:T.BatchedMesh){return sources.get(mesh)??[];}

/** Batch compatible prototypes within existing culling cells. Original LODs
 * continue choosing their own levels/ranges; only the submission is combined.
 * Buffers contain each prototype once, never one geometry copy per plant. */
export function batchScenery(root:T.Object3D){
 if(!multiDraw)return;
 root.updateMatrixWorld(true);
 const inverse=root.matrixWorld.clone().invert(),groups=new Map<string,T.InstancedMesh[]>(),families=new Map<T.InstancedMesh,string>();
 const materialKeys=new Map<T.Material,string>(),attributeKeys=new Map<T.BufferGeometry,string>();
 const metadata={textures:{},images:{}};
 root.traverse(o=>{
  if(!(o instanceof T.InstancedMesh)||Array.isArray(o.material)||o.count===0||o.count>96)return;
  const m=o.material;
  if(m.transparent||!m.visible||!m.colorWrite||m.onBeforeCompile!==T.Material.prototype.onBeforeCompile||o.customDepthMaterial||o.geometry.morphAttributes.position)return;
  let properties=materialKeys.get(m);
  if(properties===undefined){
   // A shared serialization context keeps full texture pixels out of each
   // material key. Map UUIDs still distinguish every surface and finish.
   const props=m.toJSON(metadata) as unknown as Record<string,unknown>;
   for(const k of ['uuid','name','color','metadata','userData'])delete props[k];
   properties=JSON.stringify(props);materialKeys.set(m,properties);
  }
  let attributes=attributeKeys.get(o.geometry);
  if(attributes===undefined){attributes=JSON.stringify(Object.keys(o.geometry.attributes).sort().map(k=>{const a=o.geometry.attributes[k];return [k,a.itemSize,a.normalized];}));attributeKeys.set(o.geometry,attributes);}
  const family=JSON.stringify([properties,attributes,o.castShadow,o.receiveShadow,o.renderOrder,o.layers.mask,o.frustumCulled]),key=o.userData.spatialCell+family;
  // Only combine meshes carrying an explicit cell key. Large animated groups
  // and independent object positions must not silently become static.
  if(o.userData.spatialCell===undefined)return;
  families.set(o,family);
  const list=groups.get(key)??[];list.push(o);groups.set(key,list);
 });
 const eligible=[...groups.values()].filter(list=>list.length>=2&&!(list[0].parent instanceof T.LOD&&list.every(m=>m.parent===list[0].parent))&&list.reduce((n,m)=>n+m.count,0)<=384);
 const prototypes=new Map<string,Set<T.BufferGeometry>>();
 for(const list of eligible){const family=families.get(list[0])!,set=prototypes.get(family)??new Set<T.BufferGeometry>();list.forEach(m=>set.add(m.geometry));prototypes.set(family,set);}
 const matrix=new T.Matrix4(),local=new T.Matrix4(),color=new T.Color(),tint=new T.Color(),geometryPool=new Map<string,T.BufferGeometry>();
 for(const list of eligible){
  // Hundreds of repeated twigs/petals are cheaper as one instanced draw than
  // hundreds of tiny multi-draw items. Combine only modest mixed prototypes.
  // A common prototype atlas also lets cells containing different subsets of
  // birch variants share buffers. Each cell draws only its own live instances.
  const geometrySet=[...prototypes.get(families.get(list[0])!)!].sort((a,b)=>a.id-b.id);
  const material=list[0].material as T.Material;
  const vertices=geometrySet.reduce((n,g)=>n+g.attributes.position.count,0),indices=geometrySet.reduce((n,g)=>n+(g.index?.count??g.attributes.position.count),0);
  // Reflections are unsupported by BatchedMesh. Leave their original draws.
  let reflected=false;
  for(const mesh of list){local.multiplyMatrices(inverse,mesh.matrixWorld);for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);if(matrix.premultiply(local).determinant()<0){reflected=true;break;}}if(reflected)break;}
  if(reflected)continue;
  const canonical=material.clone();if('color' in canonical)(canonical as T.MeshStandardMaterial).color.set(0xffffff);
  const batch=new T.BatchedMesh(list.reduce((n,m)=>n+m.count,0),vertices,indices,canonical);
  batch.name='Spatial multi-draw scenery';batch.sortObjects=false;batch.perObjectFrustumCulled=false;
  batch.castShadow=list[0].castShadow;batch.receiveShadow=list[0].receiveShadow;batch.renderOrder=list[0].renderOrder;batch.layers.mask=list[0].layers.mask;
  batch.frustumCulled=list[0].frustumCulled;
  batch.matrixAutoUpdate=false;
  const geometryIds=new Map<T.BufferGeometry,number>();
  for(const g of geometrySet){
   const indexed=g.index?g:g.clone().setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
   geometryIds.set(g,batch.addGeometry(indexed));if(indexed!==g)indexed.dispose();
  }
  // Cells with the same prototype set can share the read-only vertex/index
  // buffers, while retaining independent bounds and instance/visibility data.
  const geometryKey=geometrySet.map(g=>g.id).join(','),pooled=geometryPool.get(geometryKey);
  if(pooled){batch.geometry.dispose();batch.geometry=pooled;}else geometryPool.set(geometryKey,batch.geometry);
  const records:Source[]=[];
  for(const mesh of list){
   local.multiplyMatrices(inverse,mesh.matrixWorld);
   const ids:number[]=[];
   for(let i=0;i<mesh.count;i++){
    const id=batch.addInstance(geometryIds.get(mesh.geometry)!);ids.push(id);
    mesh.getMatrixAt(i,matrix);matrix.premultiply(local);batch.setMatrixAt(id,matrix);
    color.set(0xffffff);if('color' in mesh.material)color.copy((mesh.material as T.MeshStandardMaterial).color);
    if(mesh.instanceColor){mesh.getColorAt(i,tint);color.multiply(tint);}batch.setColorAt(id,color);
   }
   const visibility=new T.Group();visibility.name=mesh.name;visibility.visible=mesh.visible;visibility.matrix.copy(mesh.matrix);visibility.matrixAutoUpdate=false;
   mesh.parent!.add(visibility);mesh.removeFromParent();
   // A LOD's level references must point to the replacement visibility node.
   const parent=visibility.parent;if(parent instanceof T.LOD){const level=parent.levels.find(l=>l.object===mesh);if(level)level.object=visibility;}
   records.push({mesh,visibility,ids,shown:true});
  }
  sources.set(batch,records);batch.computeBoundingSphere();batch.computeBoundingBox();root.add(batch);
  batch.onBeforeRender=function(...args){
   for(const source of records){let shown=true;for(let o:T.Object3D|null=source.visibility;o&&o!==root;o=o.parent)if(!o.visible){shown=false;break;}
    if(shown!==source.shown){source.shown=shown;for(const id of source.ids)this.setVisibleAt(id,shown);}
   }
   T.BatchedMesh.prototype.onBeforeRender.apply(this,args);
  };
 }
}
