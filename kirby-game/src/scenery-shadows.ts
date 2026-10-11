import {BufferGeometry,InstancedMesh,Matrix4,MeshBasicMaterial,Object3D,Mesh,BatchedMesh} from 'three';
import {spatialInstances} from './spatial-instances';

// Shadow shapes share one material regardless of the decoration's visible colour.
const shadowMaterial=new MeshBasicMaterial({colorWrite:false,depthWrite:false});
const prepared=new WeakSet<Mesh>();
/** Proxy silhouettes are needed in shadow passes only. Their main-camera draw
 * otherwise transforms every vertex while deliberately writing no pixels.
 * Scope the public draw range to this draw; shared visible geometry is restored
 * immediately, and the shadow pass always sees the original full range. */
export function skipShadowOnlyColourPass(object:Object3D){
 if(!(object instanceof Mesh)||object instanceof BatchedMesh||prepared.has(object)||Array.isArray(object.material)||object.material.colorWrite||object.material.depthWrite||!object.castShadow)return;
 prepared.add(object);
 const before=object.onBeforeRender,after=object.onAfterRender;let start=0,count=Infinity;
 object.onBeforeRender=function(...args){before.apply(this,args);start=this.geometry.drawRange.start;count=this.geometry.drawRange.count;this.geometry.setDrawRange(0,0);};
 object.onAfterRender=function(...args){this.geometry.setDrawRange(start,count);after.apply(this,args);};
}
export function sceneryShadowBatch(name:string,geometry:BufferGeometry,matrices:readonly Matrix4[]){
 const mesh=new InstancedMesh(geometry,shadowMaterial,matrices.length);
 mesh.name=name;mesh.castShadow=true;
 matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
 return spatialInstances(mesh);
}

/** Crown variants share the very same continuous silhouette. Consolidate their
 * instances per cell without changing a single caster matrix or shape. */
export function consolidateSceneryShadows(root:Object3D){
 root.updateMatrixWorld(true);
 const batches=new Map<BufferGeometry,InstancedMesh[]>(),inverse=root.matrixWorld.clone().invert(),matrix=new Matrix4();
 root.traverse(o=>{if(o instanceof InstancedMesh&&o.castShadow&&o.material===shadowMaterial){const list=batches.get(o.geometry)??[];list.push(o);batches.set(o.geometry,list);}});
 for(const [geometry,list] of batches){
  const matrices:Matrix4[]=[];
  for(const source of list){const local=inverse.clone().multiply(source.matrixWorld);for(let i=0;i<source.count;i++){source.getMatrixAt(i,matrix);matrices.push(matrix.clone().premultiply(local));}source.removeFromParent();source.dispose();}
  root.add(sceneryShadowBatch('Consolidated stable scenery shadows',geometry,matrices));
 }
}
