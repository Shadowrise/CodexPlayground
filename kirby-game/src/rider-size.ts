import {MathUtils,type Object3D} from 'three';
export type SizedRider={actor:Object3D;animationRoot:Object3D};
/** Fit only the visual model. Gameplay size, growth, scores and saved progress stay intact. */
export function fitRider(rider:SizedRider,limit=1,amount=1){
 const model=rider.animationRoot?.parent;if(!model||model===rider.actor)return;
 model.scale.setScalar(MathUtils.lerp(1,Math.min(1,limit/rider.actor.scale.x),MathUtils.clamp(amount,0,1)));
}
export function restoreRider(rider:SizedRider){fitRider(rider,1,0);}
export function riderFit(rider:SizedRider){return rider.animationRoot?.parent?.scale.x??1;}
