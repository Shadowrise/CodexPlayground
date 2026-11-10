import {Object3D,Vector3,type Camera} from 'three';
import {MetapidgieFlightTrail,metapidgieTrailOrigin} from './metapidgie-flight-trail';
import {KNIGHT} from './meta-knight-battle';

/** Emit the phase-two wake beyond the player's posed tail into the scene frame. */
export class MetapidgiePlayerDashFx{
 readonly trail=new MetapidgieFlightTrail();
 private tail:Object3D;private point=new Vector3();private now=0;
 constructor(private actor:Object3D){this.tail=actor.getObjectByName('Tail')!;}
 update(active:boolean,dt:number,camera:Camera){
  this.now+=Math.max(0,dt)*1000;
  const parent=this.actor.parent;
  if(!parent||!this.actor.visible){this.trail.clear();return;}
  if(this.trail.group.parent!==parent){this.trail.clear();parent.add(this.trail.group);}
  metapidgieTrailOrigin(this.tail,this.point);parent.worldToLocal(this.point);
  this.trail.updateDash(active,this.now,this.point,camera,this.actor.scale.x/KNIGHT.modelScale);
 }
 dispose(){this.trail.dispose();}
}
