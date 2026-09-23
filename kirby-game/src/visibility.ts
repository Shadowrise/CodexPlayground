import {Object3D,Vector3} from 'three';
export const MIST_DISTANCE=42;
export const ACTOR_DISTANCE=MIST_DISTANCE*2;
const position=new Vector3();
const mistCache=new WeakMap<Object3D,Object3D[]>();
/** Render-only limits: simulation and network state continue outside the view radius. */
export function updateVisibility(root:Object3D,camera:Vector3,exists=true,alwaysVisible=false){
 root.getWorldPosition(position);
 root.visible=exists&&(alwaysVisible||position.distanceToSquared(camera)<=ACTOR_DISTANCE**2);
 let mists=mistCache.get(root);
 if(!mists){mists=[];root.traverse(o=>{if(o.name==='Fruit colored mist')mists!.push(o);});mistCache.set(root,mists);}
 for(const mist of mists){mist.getWorldPosition(position);mist.visible=position.distanceToSquared(camera)<=MIST_DISTANCE**2;}
}
