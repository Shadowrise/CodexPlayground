import {Mesh,Sprite,type Material,type Object3D,type AnimationMixer} from 'three';

/** Models, ring geometry and mist geometry are shared; only materials belong to an actor. */
export function disposeActor(character:{actor:Object3D;mixer:AnimationMixer}){
 character.mixer.stopAllAction();character.mixer.uncacheRoot(character.mixer.getRoot());
 character.actor.removeFromParent();
 const materials=new Set<Material>();
 character.actor.traverse(object=>{if(object instanceof Mesh||object instanceof Sprite)for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);});
 for(const material of materials)material.dispose();
}
