import * as T from 'three';
import {isCharacterShadow} from './prepared-shadows';
import {clusteredGeometry} from './geometry-detail';

/** A shadow-only view of the scene. Leaves share the live pose, skeleton and
 * materials; ancestor visibility is retained without walking scenery twice.
 * No objects are reparented and the colour pass keeps its original geometry. */
export class CharacterShadowPass{
 readonly scene=new T.Scene();
 enabled=true;
 simplify=true;
 private links:{source:T.Object3D;view:T.Object3D}[]=[];
 private proxies=new WeakMap<T.Mesh,T.Mesh>();
 private original:T.WebGLShadowMap['render'];
 private silhouetteDetail(source:T.Mesh){
  // These small facial surfaces sit inside the body's projected silhouette.
  for(let p:T.Object3D|null=source;p;p=p.parent)if(p.userData.shadowSilhouette==='kirby')return /eye|cheek|mouth|tongue/i.test(source.name);
  return false;
 }
 constructor(renderer:T.WebGLRenderer,private world:T.Scene){
  this.original=renderer.shadowMap.render.bind(renderer.shadowMap);
  renderer.shadowMap.render=(lights,scene,camera)=>{
   if(!this.enabled||scene!==world){this.original(lights,scene,camera);return;}
   for(const {source,view} of this.links){
    view.visible=source.visible;view.layers.mask=source.layers.mask;
    if(source instanceof T.Mesh&&view instanceof T.Mesh){
     view.castShadow=source.castShadow&&(!this.simplify||!this.silhouetteDetail(source));view.material=source.material;
     view.geometry=this.simplify?clusteredGeometry(source.geometry,24):source.geometry;
     view.morphTargetInfluences=source.morphTargetInfluences;
     if(source instanceof T.SkinnedMesh&&view instanceof T.SkinnedMesh){
      // Attached rigs refresh the inverse bind transform as the actor moves
      // or grows. A one-time clone would apply that motion twice in shadows.
      view.bindMatrix.copy(source.bindMatrix);view.bindMatrixInverse.copy(source.bindMatrixInverse);view.skeleton=source.skeleton;
     }
    }
   }
   this.original(lights,this.scene,camera);
  };
 }
 refresh(){
  this.links=[];this.scene.children=[];
  const visit=(source:T.Object3D):T.Object3D|undefined=>{
   const children=source.children.map(visit).filter((o):o is T.Object3D=>!!o);
   let view:T.Object3D;
   if(source instanceof T.Mesh&&source.castShadow&&isCharacterShadow(source)){
    let proxy=this.proxies.get(source);
    if(!proxy){
     proxy=source.clone(false);proxy.matrixWorld=source.matrixWorld;proxy.matrixAutoUpdate=false;proxy.matrixWorldAutoUpdate=false;
     proxy.onBeforeShadow=(...args)=>source.onBeforeShadow.call(source,...args);
     proxy.onAfterShadow=(...args)=>source.onAfterShadow.call(source,...args);
     // The native skinned clone shares its skeleton. Rigid and morph animation
     // likewise use the live source matrices/influence array.
     this.proxies.set(source,proxy);
    }
    view=proxy;
   }else {if(!children.length)return;view=new T.Group();}
   view.children=children;this.links.push({source,view});return view;
  };
  for(const child of this.world.children){const view=visit(child);if(view)this.scene.children.push(view);}
 }
}
