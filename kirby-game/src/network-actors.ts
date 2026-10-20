import {riderFit,restoreRider} from './rider-size';
import {META_KNIGHT_PORTAL} from './meta-knight-arena-site';
import {disposeActor} from './actor-lifecycle';
import type {PlayerSnapshots} from './player-snapshots';
import {makeSwimRing,showSwimRing} from './ponds';
import {updateFlightCloud} from './flight';
import * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from './controller';
import {KIRBY_VARIANTS,isPigeonVariant} from './variants';
import {createPlayerModel} from './player-model';
import type {KirbyNpc} from './npcs';
import type {ActorState} from './network-protocol';
import {validAchievements} from './score';
const round=(v:number)=>Math.round(v*1000)/1000;
function poseNodes(c:CharacterController|KirbyNpc){
 // Preserve the protocol's five slots for both rigs: root, arms/wings, feet.
 // A pigeon has native wing and toe pivots instead of Kirby's shoulders.
 const pairs=[['Left_shoulder','Left_wing'],['Right_shoulder','Right_wing'],['Left_foot_pivot','Left_foot'],['Right_foot_pivot','Right_foot']];
 return [c.animationRoot,...pairs.map(([kirby,pigeon])=>c.actor.getObjectByName(kirby)??c.actor.getObjectByName(pigeon)??c.animationRoot)];
}
export function actorState(c:CharacterController|KirbyNpc,name:string,variant:number):ActorState{
 const fruitBoost=c.fruitBoost.snapshot();
 return {p:c.actor.position.toArray().map(round),q:c.actor.quaternion.toArray().map(round),s:round(c.actor.scale.x),...(riderFit(c)<.9999?{fit:round(riderFit(c))}:{}),state:c.state,...(c.roll.state?{roll:[...c.roll.state].map(round)}:{}),pose:(c instanceof CharacterController&&c.state!=='Idle')||c.state==='Hello'?poseNodes(c).map(n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()].map(round)):[],fruits:c.fruitsEaten,...(fruitBoost?{fruitBoost:{...fruitBoost,remaining:Math.max(.001,round(fruitBoost.remaining))}}:{}),...(c instanceof CharacterController?{eventPoints:c.eventPoints}:{}),achievements:[...c.achievements],name,variant,star:c instanceof CharacterController?round(c.starRemaining):0,...(c instanceof CharacterController?{progress:{size:round(c.savedSize),speed:round(c.savedSpeedSize),checkpoint:c.skyCheckpoint,mountainCheckpoint:c.mountainCheckpoint,ground:round(c.surfaceY)}}:{})};
}
/** Restore durable progress without resuming an abandoned ride or animation. */
export function restoreNetworkPlayer(c:CharacterController,a:ActorState){
 restoreRider(c);c.actor.position.fromArray(a.p);c.surfaceY=a.p[1];c.resizeTo(a.progress?.size??a.s,true);
 c.restoreMovementSpeed(a.progress?.speed??c.savedSize);c.fruitBoost.restore(a.fruitBoost);
 c.yaw=new T.Euler().setFromQuaternion(new T.Quaternion().fromArray(a.q).normalize(),'YXZ').y;c.actor.rotation.set(0,c.yaw,0);
 c.fruitsEaten=a.fruits;c.achievements.clear();for(const action of a.achievements)c.achievements.add(action as import('./score').ScoreAction);
 c.eventPoints=a.eventPoints??0;
 c.skyCheckpoint=a.progress?.checkpoint??0;c.mountainCheckpoint=a.progress?.mountainCheckpoint??0;c.starRemaining=a.star;c.starBlessed=c.achievements.has('star');
 if(a.location==='meta-knight-arena'){c.actor.position.set(META_KNIGHT_PORTAL.x,0,META_KNIGHT_PORTAL.z+META_KNIGHT_PORTAL.returnOffset);c.surfaceY=0;}
}
export function applyActor(c:CharacterController|KirbyNpc,a:ActorState,dt:number,snap=false){
 if(c instanceof CharacterController)c.fruitEating.clear();
 if(c instanceof CharacterController)c.clearDuelDazedPose();
 if(c instanceof CharacterController)c.clearKnightDashPose();
 if(c instanceof CharacterController)c.clearPigeonFlightWings();
 c.actor.userData.location=a.location;
 c.roll.clearPose();c.roll.state=a.roll?[...a.roll]:undefined;
 const previousX=c.actor.position.x,previousZ=c.actor.position.z;
 const blend=snap?1:1-Math.exp(-dt*16);c.actor.position.lerp(new T.Vector3().fromArray(a.p),blend);c.actor.quaternion.slerp(new T.Quaternion().fromArray(a.q).normalize(),blend);c.actor.scale.setScalar(T.MathUtils.lerp(c.actor.scale.x,a.s,blend));c.yaw=new T.Euler().setFromQuaternion(c.actor.quaternion).y;
 const model=c.animationRoot.parent;if(model&&model!==c.actor)model.scale.setScalar(T.MathUtils.lerp(model.scale.x,a.fit??1,blend));
 c.fruitsEaten=a.fruits;if(validAchievements(a.achievements)){c.achievements.clear();for(const v of a.achievements)c.achievements.add(v);}
 c.fruitBoost.restore(a.fruitBoost);
 if(c instanceof CharacterController){
  c.eventPoints=a.eventPoints??0;
  if(c.state!==a.state){c.setActivity(a.state);c.actions.forEach(x=>x.stop());const action=c.actions.get(a.state)??c.actions.get('Idle');action?.reset().play();}
  const nativeGait=c.syncPigeonLocomotion(dt,Math.hypot(c.actor.position.x-previousX,c.actor.position.z-previousZ));
  c.mixer.update(dt);
  c.updatePigeonFlightWings(a.state==='Fly'||a.state==='Push'&&a.p[1]>(a.progress?.ground??0)+.02);
  // Buffered positions drive the native gait clock. Old foot poses belong to
  // another presentation time and would undo planted-foot travel each frame.
  // Flight supplies the untransmitted vane pose; transmitted wings stay authoritative.
  if(!nativeGait)poseNodes(c).forEach((n,i)=>{const pose=a.pose[i];if(!pose)return;n.position.fromArray(pose);n.quaternion.fromArray(pose.slice(3,7));n.scale.fromArray(pose.slice(7,10));});
  c.flight.active=a.state==='Jump'||a.state==='Fly'||c.isMetaKnight&&a.state==='Dash';c.flight.height=c.flight.active?Math.max(0,a.p[1]/Math.max(1,a.s)):0;c.updateFlightVisual(a.state==='Fly');
  c.updateKnightDashVisual();
 }else {
  c.swimming=a.state==='Swim';c.surfaceY=a.p[1];
  c.networkAnimate(a.state,dt,Math.hypot(c.actor.position.x-previousX,c.actor.position.z-previousZ)>.00001);
  showSwimRing(c.actor,c.swimming,c.mixer.time);
  if(a.state==='Hello')poseNodes(c).forEach((n,i)=>{const pose=a.pose[i];if(!pose)return;n.position.fromArray(pose);n.quaternion.fromArray(pose.slice(3,7));n.scale.fromArray(pose.slice(7,10));});
  if(c.roll.active)c.roll.applyPose(c.animationRoot,c.yaw);updateFlightCloud(c.cloud,c.flight);
 }
}
export class RemotePlayers{
 readonly players=new Map<string,CharacterController>();
 readonly renderedStates=new Map<string,ActorState>();
 constructor(private scene:T.Scene,private model:GLTF,private pigeon?:GLTF,private metaKnight?:GLTF,private onMetaKnight?:(model:T.Object3D)=>void){}
 clear(){for(const c of this.players.values()){c.setActivity('Idle');disposeActor(c);}this.players.clear();this.renderedStates.clear();}
 update(actors:Map<string,ActorState>,dt:number,snapshots?:Map<string,PlayerSnapshots>){
  const now=performance.now();
  for(const [id,c] of this.players)if(!actors.has(id)){c.setActivity('Idle');disposeActor(c);this.players.delete(id);this.renderedStates.delete(id);}
  for(const [id,latest] of actors){const a=snapshots?.get(id)?.sample(now)??latest;this.renderedStates.set(id,a);let c=this.players.get(id);
   if(c&&c.actor.userData.variant!==a.variant){c.setActivity('Idle');disposeActor(c);this.players.delete(id);c=undefined;}
   const variant=KIRBY_VARIANTS[a.variant]??KIRBY_VARIANTS[0];
   // An optional model may still be loading; keep the state for a later frame.
   if(isPigeonVariant(variant[0])&&!this.pigeon)continue;
   if(variant[0]==='Meta Knight'&&!this.metaKnight)continue;
   const fresh=!c;if(!c){const rig=createPlayerModel(this.model,variant,this.pigeon,false,this.metaKnight);if(rig.character==='meta-knight')this.onMetaKnight?.(rig.model);c=new CharacterController(rig.model,rig.clips);c.actor.userData.variant=a.variant;c.actor.position.fromArray(a.p);this.players.set(id,c);this.scene.add(c.actor);const ring=makeSwimRing();ring.visible=false;c.actor.add(ring);

  }applyActor(c,a,dt,!!snapshots||fresh);c.actor.getObjectByName('Rainbow swim ring')!.visible=a.state==='Swim';}
 }
}
