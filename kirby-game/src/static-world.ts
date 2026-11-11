import {Matrix4,Object3D,Scene} from 'three';

const baseUpdate=Object3D.prototype.updateMatrixWorld;
/** Object3D.updateMatrixWorld() that leaves hidden branches at their previous
 * world pose. A skipped branch is flagged, so it is refreshed with all of its
 * descendants in the first frame it is shown again. Classes with their own
 * update (skinned meshes, cameras, audio) keep the native behaviour. */
export function updateVisibleMatrixWorld(object:Object3D,force=false){
 if(!object.visible){object.matrixWorldNeedsUpdate=true;return;}
 if(object.updateMatrixWorld!==baseUpdate){object.updateMatrixWorld(force);return;}
 if(object.matrixAutoUpdate)object.updateMatrix();
 if(object.matrixWorldNeedsUpdate||force){
  if(object.matrixWorldAutoUpdate){
   if(object.parent)object.matrixWorld.multiplyMatrices(object.parent.matrixWorld,object.matrix);
   else object.matrixWorld.copy(object.matrix);
  }
  object.matrixWorldNeedsUpdate=false;force=true;
 }
 const children=object.children;
 for(let i=0;i<children.length;i++)updateVisibleMatrixWorld(children[i],force);
}

/** Environment transforms never animate. Update their world matrices once,
 * rather than forcing the entire forest hierarchy through them every frame.
 * New actors, lights, attractions and their bones remain fully dynamic. */
export class StaticWorldMatrices {
 private roots=new Set<Object3D>();
 private renderOnly=new Set<Object3D>();
 private previous=new Matrix4();
 constructor(private scene:Scene,enabled=true){
  if(!enabled)return;
  scene.updateMatrixWorld(true);this.previous.copy(scene.matrixWorld);
  scene.matrixWorldAutoUpdate=false;
  const before=scene.onBeforeRender;
  scene.onBeforeRender=(...args)=>{this.update();before.apply(scene,args);};
 }
 add(root:Object3D){root.updateWorldMatrix(true,true);this.roots.add(root);}
 /** A dynamic root whose hidden branches are needed only for drawing. Code
  * that reads a hidden node's world pose must refresh it explicitly, e.g.
  * with getWorldPosition() or updateWorldMatrix(). */
 skipHidden(root:Object3D){this.renderOnly.add(root);}
 update(){
  this.scene.updateMatrix();
  const changed=!this.scene.matrix.equals(this.previous);
  this.scene.matrixWorld.copy(this.scene.matrix);this.previous.copy(this.scene.matrix);
  for(const root of this.scene.children){
   if(this.roots.has(root)){if(changed)root.updateMatrixWorld(true);}
   // A hidden actor or attraction draws nothing. Its pose is refreshed when
   // it is shown; game code reading a hidden bone refreshes it explicitly.
   else if(!root.visible)root.matrixWorldNeedsUpdate=true;
   else if(this.renderOnly.has(root))updateVisibleMatrixWorld(root,changed);
   else root.updateMatrixWorld(changed);
  }
 }
}
