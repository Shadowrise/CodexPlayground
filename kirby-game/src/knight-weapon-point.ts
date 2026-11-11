import type {Object3D,Vector3} from 'three';
/** Sword coordinates stay native. Bird electricity starts at the live bill tip. */
export function knightWeaponPoint(weapon:Object3D,out:Vector3,x=-.315,y=2.05,z=0){
 weapon.updateWorldMatrix(true,false);
 return weapon.localToWorld(out.set(...(weapon.name==='Metapidgie_beak_tip'?[0,0,0] as const:[x,y,z] as const)));
}
