import {Matrix4,Object3D,Scene} from 'three';

/** Environment transforms never animate. Update their world matrices once,
 * rather than forcing the entire forest hierarchy through them every frame.
 * New actors, lights, attractions and their bones remain fully dynamic. */
export class StaticWorldMatrices {
 private roots=new Set<Object3D>();
 private previous=new Matrix4();
 constructor(private scene:Scene,enabled=true){
  if(!enabled)return;
  scene.updateMatrixWorld(true);this.previous.copy(scene.matrixWorld);
  scene.matrixWorldAutoUpdate=false;
  const before=scene.onBeforeRender;
  scene.onBeforeRender=(...args)=>{this.update();before.apply(scene,args);};
 }
 add(root:Object3D){root.updateWorldMatrix(true,true);this.roots.add(root);}
 update(){
  this.scene.updateMatrix();
  const changed=!this.scene.matrix.equals(this.previous);
  this.scene.matrixWorld.copy(this.scene.matrix);this.previous.copy(this.scene.matrix);
  for(const root of this.scene.children)if(changed||!this.roots.has(root))root.updateMatrixWorld(changed);
 }
}
