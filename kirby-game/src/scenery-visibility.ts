import {BatchedMesh,Camera,Frustum,InstancedMesh,LOD,Matrix4,Mesh,Object3D,Scene,Sphere,Vector3} from 'three';
import {SceneryInstanceBatch,sceneryCellBounds} from './scenery-batch';

type Cell={object:Object3D;bounds:Sphere};

/** Static scenery keeps its simulation/placement while invisible cells skip
 * traversal, LOD selection and draw submission. Sky and actors are independent. */
export class SceneryVisibility{
 private cells:Cell[]=[];
 private frustum=new Frustum();
 private viewProjection=new Matrix4();
 private eye=new Vector3();
 private forward=new Vector3();
 private offset=new Vector3();
 private batches:SceneryInstanceBatch[]=[];
 private distance=Infinity;
 constructor(roots:readonly Object3D[],private scene?:Scene){
  for(const root of roots)root.traverse(o=>{if(o instanceof SceneryInstanceBatch)this.batches.push(o);});
  if(scene){const before=scene.onBeforeRender;scene.onBeforeRender=(...args)=>{before.apply(scene,args);this.sync(args[2]);};}
  const visit=(object:Object3D)=>{
   if(!object.visible)return;
   if(object instanceof LOD&&typeof object.userData.boundsLodRadius==='number'){
    const bounds=new Sphere(new Vector3(),object.userData.boundsLodRadius);
    // Batched LODs retain their visibility nodes and saved bounds even after
    // their geometry has moved into a separate spatial multi-draw mesh.
    for(const {object:level} of object.levels){let sphere=sceneryCellBounds(level);if(level instanceof InstancedMesh){if(!level.boundingSphere)level.computeBoundingSphere();sphere=level.boundingSphere!;}if(sphere)bounds.radius=Math.max(bounds.radius,sphere.center.length()+sphere.radius);}
    object.autoUpdate=false;
    this.cells.push({object,bounds:bounds.applyMatrix4(object.matrixWorld)});return;
   }
   // A mesh can also parent decorations outside its own geometry bounds.
   // Keep such parents traversable and cull their leaf meshes independently.
   const saved=sceneryCellBounds(object);
   if(saved){this.cells.push({object,bounds:saved.clone().applyMatrix4(object.matrixWorld)});return;}
   if(object instanceof Mesh&&object.children.length===0){
    let bounds:Sphere;
    if(object instanceof InstancedMesh||object instanceof BatchedMesh){
     if(!object.boundingSphere)object.computeBoundingSphere();bounds=object.boundingSphere!.clone();
    }else{
     if(!object.geometry.boundingSphere)object.geometry.computeBoundingSphere();bounds=object.geometry.boundingSphere!.clone();
    }
    this.cells.push({object,bounds:bounds.applyMatrix4(object.matrixWorld)});
   }
   for(const child of object.children)visit(child);
  };
  for(const root of roots){root.updateWorldMatrix(true,true);visit(root);}
 }
 update(camera:Camera,distance:number){
  this.distance=distance;
  camera.updateWorldMatrix(true,false);
  this.frustum.setFromProjectionMatrix(this.viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  this.eye.setFromMatrixPosition(camera.matrixWorld);this.forward.set(0,0,-1).transformDirection(camera.matrixWorld);
  for(const {object,bounds} of this.cells){
   // Fog uses view depth, so a sphere is removed only after its nearest point
   // has passed the fog's far plane. Wide batches cannot disappear early.
   const depth=this.offset.subVectors(bounds.center,this.eye).dot(this.forward);
   object.visible=depth-bounds.radius<=distance&&this.frustum.intersectsSphere(bounds);
  }
  if(!this.scene)this.sync(camera);
 }
 private sync(camera:Camera){
  for(const {object} of this.cells)if(object instanceof LOD&&object.visible)object.update(camera);
  for(const batch of this.batches)batch.sync(camera,this.distance);
 }
}
