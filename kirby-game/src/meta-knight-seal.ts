import {Group,Vector3} from 'three';
import {createMetaKnightSealModel} from './meta-knight-seal-model';
import {softMist,softMistMaterial} from './soft-mist';
import {ACTOR_DISTANCE,MIST_DISTANCE} from './visibility';

// All displays reuse the same analytic proxy and material. The violet cloud
// sits behind the relief so the silver mask and warm eyes remain readable.
const mistMaterial=softMistMaterial('#aa7cf2',.58);

/** A decorative seal display. The exported GLB contains only the solid model;
 * this small mist proxy and floating motion belong to the game presentation. */
export class MetaKnightSeal {
 readonly group=new Group();
 readonly model=createMetaKnightSealModel();
 readonly aura=softMist(mistMaterial);
 mistEnabled=true;
 spinEnabled=true;
 private enabled=true;
 private disposed=false;
 private readonly worldPosition=new Vector3();

 constructor(readonly phase=0){
  this.group.name='Meta Knight seal · floating display';
  this.aura.name='Meta Knight seal · violet mist';
  this.aura.frustumCulled=true;
  this.group.add(this.model,this.aura);
  this.update(0);
 }

 get active(){return this.enabled&&!this.disposed;}
 set active(value:boolean){
  if(this.disposed)return;
  this.enabled=value;
  if(!value){this.group.visible=false;this.aura.visible=false;}
 }

 /** Absolute seconds make reset, pause and re-entering the view deterministic. */
 update(seconds:number,cameraPosition?:Vector3){
  if(!this.active){this.group.visible=false;this.aura.visible=false;return;}
  const distanceSquared=cameraPosition?this.group.getWorldPosition(this.worldPosition).distanceToSquared(cameraPosition):0;
  this.group.visible=distanceSquared<=ACTOR_DISTANCE**2;
  this.aura.visible=this.group.visible&&this.mistEnabled&&distanceSquared<=MIST_DISTANCE**2;
  if(!this.group.visible)return;
  const time=(Number.isFinite(seconds)?Math.max(0,seconds):0)+this.phase;
  const bob=.06*Math.sin(time*1.35),yaw=this.spinEnabled?time*.22:0;
  this.model.position.y=bob;
  this.model.rotation.set(0,yaw,.035*Math.sin(time*.7));
  if(this.aura.visible){
   const swell=1+.035*Math.sin(time*.9);
   this.aura.position.set(-.34*Math.sin(yaw),bob-.10,-.34*Math.cos(yaw));
   this.aura.rotation.set(0,yaw,.05*Math.sin(time*.55));
   this.aura.scale.set(1.18*swell,1.24*swell,.28*swell);
  }
 }

 /** Instances own transforms only; disposing one cannot invalidate its siblings. */
 dispose(){
  if(this.disposed)return;
  this.active=false;this.disposed=true;this.group.removeFromParent();
 }
}
