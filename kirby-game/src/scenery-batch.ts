import * as T from 'three';
import {startupWork} from './startup-tasks';

// Multi-draw is optional (notably on some phones). Keep ordinary instancing on
// those devices: BatchedMesh's per-object fallback would produce more draws.
let multiDraw=false;
export function configureSceneryBatching(enabled:boolean){multiDraw=enabled;}
type Source={mesh:T.InstancedMesh;visibility:T.Object3D;ids:number[];shown:boolean};
const sources=new WeakMap<T.Mesh,Source[]>();
export function scenerySources(mesh:T.Mesh){return sources.get(mesh)??[];}
const cellBounds=new WeakMap<T.Object3D,T.Sphere>();
const retainedSources=new WeakSet<T.Object3D>();
export function sceneryCellBounds(object:T.Object3D){return cellBounds.get(object);}

/** Batch compatible prototypes within existing culling cells. Original LODs
 * continue choosing their own levels/ranges; only the submission is combined.
 * Buffers contain each prototype once, never one geometry copy per plant. */
export function batchScenery(root:T.Object3D){
 for(const _ of sceneryWork(root)){}
}
export function batchSceneryAsync(root:T.Object3D,combineCells=false){return startupWork(sceneryWork(root,combineCells));}
function* sceneryWork(root:T.Object3D,combineCells=false){
 if(combineCells)yield* combineInstanceCells(root);
 if(!multiDraw)return;
 root.updateMatrixWorld(true);
 const inverse=root.matrixWorld.clone().invert(),groups=new Map<string,T.InstancedMesh[]>(),families=new Map<T.InstancedMesh,string>();
 const materialKeys=new Map<T.Material,string>(),attributeKeys=new Map<T.BufferGeometry,string>();
 const metadata={textures:{},images:{}};
 root.traverse(o=>{
  if(!(o instanceof T.InstancedMesh)||retainedSources.has(o)||Array.isArray(o.material)||o.count===0||o.count>96)return;
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
  yield;
 }
}

type InstanceSource=Source&{matrices:Float32Array;colours:Float32Array;bounds:T.Sphere};

/** Compact only the visible original cells. Unlike one multi-draw item per twig,
 * identical geometry still uses one instanced draw. Uploads occur only when the
 * chosen cells change, before Three uploads vertex attributes for this frame. */
export class SceneryInstanceBatch extends T.InstancedMesh {
 enabled=true;
 private previousEnabled?:boolean;
 private readonly records:InstanceSource[]=[];
 private readonly frustum=new T.Frustum();
 private readonly projection=new T.Matrix4();
 private readonly eye=new T.Vector3();
 private readonly forward=new T.Vector3();
 private readonly offset=new T.Vector3();
 constructor(private readonly root:T.Object3D,list:T.InstancedMesh[],material:T.Material){
  super(list[0].geometry,material,list.reduce((n,m)=>n+m.count,0));
  this.name='Combined scenery instances';this.matrixAutoUpdate=false;
  const first=list[0];this.castShadow=first.castShadow;this.receiveShadow=first.receiveShadow;this.layers.mask=first.layers.mask;this.renderOrder=first.renderOrder;
  const inverse=root.matrixWorld.clone().invert(),local=new T.Matrix4(),matrix=new T.Matrix4(),colour=new T.Color(),tint=new T.Color();
  const bounds=new T.Box3();
  for(const mesh of list){
   if(!mesh.boundingSphere)mesh.computeBoundingSphere();
   const visibility=new T.Group();visibility.name=mesh.name;visibility.visible=mesh.visible;visibility.matrix.copy(mesh.matrix);visibility.matrixAutoUpdate=false;
   cellBounds.set(visibility,mesh.boundingSphere!.clone());
   local.multiplyMatrices(inverse,mesh.matrixWorld);
   const matrices=new Float32Array(mesh.count*16),colours=new Float32Array(mesh.count*3);
   for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);matrix.premultiply(local);matrix.toArray(matrices,i*16);
    colour.set(0xffffff);if('color' in mesh.material)colour.copy((mesh.material as T.MeshStandardMaterial).color);
    if(mesh.instanceColor){mesh.getColorAt(i,tint);colour.multiply(tint);}colour.toArray(colours,i*3);
   }
   const sphere=mesh.boundingSphere!.clone().applyMatrix4(mesh.matrixWorld);
   bounds.union(new T.Box3().setFromCenterAndSize(sphere.center,new T.Vector3().setScalar(sphere.radius*2)).applyMatrix4(inverse));
   const parent=mesh.parent!;parent.add(visibility);mesh.removeFromParent();
   if(parent instanceof T.LOD){const level=parent.levels.find(l=>l.object===mesh);if(level)level.object=visibility;}
   visibility.add(mesh);mesh.matrix.identity();mesh.matrixAutoUpdate=false;mesh.visible=false;retainedSources.add(mesh);
   this.records.push({mesh,visibility,ids:[],shown:false,matrices,colours,bounds:sphere});
  }
  this.boundingSphere=bounds.getBoundingSphere(new T.Sphere());this.boundingBox=bounds;
  this.instanceMatrix.setUsage(T.DynamicDrawUsage);
  this.instanceColor=new T.InstancedBufferAttribute(new Float32Array(this.instanceMatrix.count*3),3).setUsage(T.DynamicDrawUsage);
  this.count=0;sources.set(this,this.records);
 }
 sync(camera:T.Camera,distance:number){
  const changedMode=this.previousEnabled!==this.enabled;this.previousEnabled=this.enabled;
  if(changedMode)for(const source of this.records)source.mesh.visible=!this.enabled;
  this.visible=this.enabled;if(!this.enabled)return;
  this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  this.eye.setFromMatrixPosition(camera.matrixWorld);this.forward.set(0,0,-1).transformDirection(camera.matrixWorld);
  let changed=changedMode;
  for(const source of this.records){
   let shown=true;for(let p:T.Object3D|null=source.visibility;p;p=p.parent)if(!p.visible){shown=false;break;}
   if(shown){const depth=this.offset.subVectors(source.bounds.center,this.eye).dot(this.forward);shown=depth-source.bounds.radius<=distance&&(!source.mesh.frustumCulled||this.frustum.intersectsSphere(source.bounds));}
   if(shown!==source.shown){source.shown=shown;changed=true;}
  }
  if(!changed)return;
  let count=0;
  for(const source of this.records)if(source.shown){
   (this.instanceMatrix.array as Float32Array).set(source.matrices,count*16);
   (this.instanceColor!.array as Float32Array).set(source.colours,count*3);count+=source.mesh.count;
  }
  this.count=count;
  this.instanceMatrix.clearUpdateRanges();this.instanceColor!.clearUpdateRanges();
  if(count){this.instanceMatrix.addUpdateRange(0,count*16);this.instanceColor!.addUpdateRange(0,count*3);this.instanceMatrix.needsUpdate=true;this.instanceColor!.needsUpdate=true;}
 }
}

function* combineInstanceCells(root:T.Object3D){
 root.updateWorldMatrix(true,true);
 const groups=new Map<string,T.InstancedMesh[]>(),materialKeys=new Map<T.Material,string>();
 const metadata={textures:{},images:{}};
 root.traverse(o=>{
  if(!(o instanceof T.InstancedMesh)||retainedSources.has(o)||Array.isArray(o.material)||!o.count||o.userData.spatialCell===undefined)return;
  const material=o.material;
  if(material.transparent||!material.visible||!material.colorWrite||material.onBeforeCompile!==T.Material.prototype.onBeforeCompile||o.customDepthMaterial||o.geometry.morphAttributes.position)return;
  let finish=materialKeys.get(material);
  if(finish===undefined){const data=material.toJSON(metadata) as unknown as Record<string,unknown>;for(const key of ['uuid','name','color','metadata','userData'])delete data[key];finish=JSON.stringify(data);materialKeys.set(material,finish);}
  const key=JSON.stringify([o.geometry.uuid,finish,o.castShadow,o.receiveShadow,o.layers.mask,o.renderOrder,o.frustumCulled]);
  const list=groups.get(key)??[];list.push(o);groups.set(key,list);
 });
 for(const list of groups.values()){
  if(list.length<3||new Set(list.map(o=>o.userData.spatialCell)).size<2)continue;
  const inverse=root.matrixWorld.clone().invert(),matrix=new T.Matrix4(),local=new T.Matrix4();let reflected=false;
  for(const mesh of list){local.multiplyMatrices(inverse,mesh.matrixWorld);for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);if(matrix.premultiply(local).determinant()<0){reflected=true;break;}}if(reflected)break;}
  if(reflected)continue;
  const material=(list[0].material as T.Material).clone();if('color' in material)(material as T.MeshStandardMaterial).color.set(0xffffff);
  root.add(new SceneryInstanceBatch(root,list,material));yield;
 }
}
