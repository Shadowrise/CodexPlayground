import * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {Firefly} from './firefly';
import {HealthHeart} from './health-heart';
import {knightBattleActive,type KnightBattle} from './meta-knight-battle';
import {knightLifeFireflyPoint,LIFE_FIREFLY} from './meta-knight-life-firefly';
import type {KnightSound} from './meta-knight-sounds';
import {softMist,softMistMaterial} from './soft-mist';
import {COSMIC} from './meta-knight-cosmic';
import {arenaMaterials} from './meta-knight-arena-materials';

const BUG_SCALE=1.4,HEART_SCALE=.9,HEART_Y=-.18,HEART_Z=-.04;

/** One reusable visitor; models and heart resources remain shared with the world. */
export class MetaKnightLifeFireflyView{
 readonly group=new T.Group();
 readonly carrier=new T.Group();
 readonly heart=new HealthHeart();
 readonly firefly:Firefly;
 readonly halo=softMist(softMistMaterial('#baff55',.5));
 private motion:T.Object3D;
 private restoreMaterials:()=>void;
 private legs:{joint:T.Object3D;rotation:T.Quaternion}[]=[];
 private key='';private hitKey='';private point=new T.Vector3();private flying=false;
 constructor(gltf:GLTF,private cue:(kind:KnightSound)=>void){
  this.group.name='Meta Knight life firefly';this.carrier.name='Life firefly carrier';
  const object=clone(gltf.scene) as T.Group;this.firefly=new Firefly({...gltf,scene:object});this.firefly.setMode('Fly');
  // Meadow instances share the cached asset's CSM materials. The arena needs
  // its own clean lighting shaders for the head, legs and every other surface.
  this.restoreMaterials=arenaMaterials(object);
  // Reuse emission, without introducing a shadow light into the arena.
  const lights:T.Object3D[]=[];object.traverse(o=>{if(o instanceof T.Light)lights.push(o);if(o instanceof T.Mesh)o.castShadow=o.receiveShadow=false;});for(const light of lights)light.removeFromParent();
  this.motion=object.getObjectByName('Motion')!;
  this.halo.name='Life firefly glowing abdomen halo';this.halo.position.set(0,.74,-.6);this.halo.scale.set(1.5,1.35,1.8);this.halo.material.blending=T.AdditiveBlending;this.halo.material.fog=false;this.motion.add(this.halo);
  this.firefly.update(.3); // Finish Sit -> Fly before the very first rendered frame.
  this.heart.floating=false;this.heart.group.scale.setScalar(HEART_SCALE);this.heart.group.position.set(0,HEART_Y,HEART_Z);this.motion.add(this.heart.group);
  this.motion.updateWorldMatrix(true,true);
  // Fit all three pairs to the actual heart surface, cradling it below the body.
  // Tiny length adjustments keep every foot in contact with the curved shell.
  for(const side of [-1,1])for(let i=0;i<3;i++){
   const joint=object.getObjectByName(`${side<0?'Left':'Right'}_Leg_${i}`)!;
   const origin=this.motion.localToWorld(new T.Vector3(side*2,-.02,HEART_Z+.2-i*.2)),direction=new T.Vector3(-side,0,0).transformDirection(this.motion.matrixWorld);
   const contact=new T.Raycaster(origin,direction).intersectObject(this.heart.model,true)[0];
   if(!contact)throw Error('Life firefly foot cannot reach the heart surface');
   const target=this.motion.worldToLocal(contact.point.clone()).sub(joint.position),rest=new T.Vector3(side*.4,-.6,.25);
   joint.scale.multiplyScalar(target.length()/rest.length());
   this.legs.push({joint,rotation:new T.Quaternion().setFromUnitVectors(rest.normalize(),target.normalize())});
  }
  this.carrier.scale.setScalar(BUG_SCALE);this.carrier.add(object);this.group.add(this.carrier);this.group.visible=false;
 }
 update(s:KnightBattle|undefined,now:number,dt:number,visible=true){
  this.flying=false;const bug=s?.lifeFirefly,key=bug?`${s!.id}:${bug.phase}:${bug.at}`:'';
  if(key!==this.key){this.key=key;this.hitKey='';if(bug){const color=new T.Color().setHSL(bug.color,1,.5,T.SRGBColorSpace);this.firefly.setGlowColor(color);this.halo.material.color.copy(color);}}
  this.group.visible=visible&&!!s&&knightBattleActive(s)&&!!bug&&bug.phase===s.phase;
  if(!this.group.visible)return;
  const hit=bug!.hit,age=hit?now-hit.at:0;
  const point=knightLifeFireflyPoint(s!,now);
  if(!point&&(!hit||age<0||age>=LIFE_FIREFLY.dropMs)){this.group.visible=false;return;}
  // Pose from the shared flight clock, including paused screenshots and reconnects.
  this.firefly.mixer.setTime(.3+Math.max(0,(now-bug!.at)/1000));
  this.halo.material.opacity=.46+.06*Math.sin(now*.005);
  if(point){
   this.flying=true;
   const next=knightLifeFireflyPoint(s!,now+5)??point;
   this.carrier.position.fromArray(point);this.carrier.rotation.set(0,Math.atan2(next[0]-point[0],next[2]-point[2]),0);this.carrier.scale.setScalar(BUG_SCALE);
   if(this.heart.group.parent!==this.motion)this.motion.add(this.heart.group);
   this.heart.group.position.set(0,HEART_Y,HEART_Z);this.heart.group.rotation.set(0,0,0);this.heart.group.scale.setScalar(HEART_SCALE);this.heart.floating=false;
   for(const leg of this.legs)leg.joint.quaternion.copy(leg.rotation);
  }else if(hit){
   if(this.hitKey!==key){this.hitKey=key;if(age<350)this.cue('life-firefly-hit');}
   const t=age/LIFE_FIREFLY.dropMs;
   this.carrier.position.fromArray(hit.point);this.carrier.position.y+=Math.sin(t*Math.PI)*.5;this.carrier.rotation.set(0,hit.yaw,t*Math.PI*2);this.carrier.scale.setScalar(BUG_SCALE*Math.max(0,1-t*2));
   if(this.heart.group.parent!==this.group)this.group.add(this.heart.group);
   const floor=bug!.phase===4?COSMIC.height:0,offsetZ=HEART_Z*BUG_SCALE;
   this.heart.group.position.set(hit.point[0]+Math.sin(hit.yaw)*offsetZ,Math.max(floor+1.05,hit.point[1]+(.35+HEART_Y)*BUG_SCALE-Math.min(.9,4*t*t)+Math.max(0,t-.45)*2),hit.point[2]+Math.cos(hit.yaw)*offsetZ);
   this.heart.group.rotation.set(0,hit.yaw+t*1.8,0);this.heart.group.scale.setScalar(BUG_SCALE*HEART_SCALE*(1-Math.max(0,t-.65)/.35));this.heart.floating=true;
  }
  this.heart.update(now/1000);
 }
 buzzLevel(listener:T.Vector3){if(!this.group.visible||!this.flying)return 0;this.carrier.getWorldPosition(this.point);return Math.max(0,1-this.point.distanceTo(listener)/24)**2;}
 dispose(){
  this.heart.dispose();this.halo.material.dispose();this.firefly.mixer.stopAllAction();this.firefly.mixer.uncacheRoot(this.firefly.object);
  this.restoreMaterials();
  this.firefly.object.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name==='Firefly_Glow')m.dispose();});this.group.removeFromParent();
 }
}
