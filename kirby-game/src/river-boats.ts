import * as T from 'three';
import {CharacterController} from './controller';
import {cloneVariant,KIRBY_VARIANTS} from './variants';
import {awardFirst} from './score';
import {dryGround,WATER_Y} from './pond-layout';
import {insideMeadow} from './world-bounds';
import {showSwimRing} from './ponds';
import {BOAT_COUNT,BOAT_OCCUPIED,BOAT_ROUTE_LENGTH,boatDistance,boatPose} from './boat-route';
import {makeBoat} from './boat-model';
import {lightenBoatPassenger} from './boat-passenger';

type Ride={player:CharacterController;index:number;start:number;from:T.Vector3;elapsed:number;leaving?:T.Vector3};
const seat=new T.Vector3(0,.39,-.18);
const smooth=(t:number)=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
/** Boats follow the room clock on every client, so they need no world snapshots. */
export class RiverBoats {
 readonly group=new T.Group();
 readonly boats=Array.from({length:BOAT_COUNT},(_,i)=>makeBoat(i));
 networkBlocked=new Set<number>();
 private ride?:Ride;
 private seconds=0;
 private passengers:{model:T.Object3D;mixer:T.AnimationMixer;index:number}[]=[];
 private seatPosition=new T.Vector3();
 private fitted=new Map<CharacterController,T.Object3D>();
 get riding(){return !!this.ride;}
 get index(){return this.ride?.index;}
 networkData(){const r=this.ride;return [r?(r.leaving?-Math.max(.0001,smooth(r.elapsed/.7)):smooth(r.elapsed/.55)):1];}
 constructor(){this.group.name='Colourful river boats';this.group.add(...this.boats);this.update(0,0);}
 addPassengers(template:T.Object3D,clips:T.AnimationClip[]){
  if(this.passengers.length)return;
  for(const [i,index] of BOAT_OCCUPIED.entries()){
   const model=cloneVariant(template,KIRBY_VARIANTS[1+i*3],true);model.name=`River Kirby passenger ${i+1}`;
   lightenBoatPassenger(model);
   model.position.copy(seat);model.scale.setScalar(.85);model.traverse(o=>{o.castShadow=false;});
   const mixer=new T.AnimationMixer(model),idle=clips.find(c=>c.name==='Idle');if(idle)mixer.clipAction(idle).play();
   this.boats[index].add(model);this.passengers.push({model,mixer,index});this.sittingPose(model);
  }
 }
 private sittingPose(model:T.Object3D){
  for(const side of ['Left','Right']){
   const foot=model.getObjectByName(`${side}_foot_pivot`),arm=model.getObjectByName(`${side}_shoulder`);
   if(foot)foot.rotation.x=-.85;
   if(arm){arm.rotation.x=-.22;arm.rotation.z=(side==='Left'?-1:1)*.28;}
  }
 }
 private fit(player:CharacterController){
  // Keep large Kirby's saved/gameplay size; only fit the visual model under the canopy.
  const model=player.animationRoot.parent!;model.scale.setScalar(Math.min(1,.9/player.actor.scale.x));this.fitted.set(player,model);
 }
 private unfit(player:CharacterController){this.fitted.get(player)?.scale.setScalar(1);this.fitted.delete(player);}
 private nearby(player:CharacterController){
  if(player.flight.active||player.roll.active||player.actor.position.y>1.3)return -1;
  let nearest=-1,distance=6.5**2;
  this.boats.forEach((b,i)=>{if((BOAT_OCCUPIED as readonly number[]).includes(i)||this.networkBlocked.has(i))return;
   const d=b.position.distanceToSquared(player.actor.position);if(d<distance){distance=d;nearest=i;}
  });return nearest;
 }
 networkKey(player:CharacterController){const i=this.ride?.index??this.nearby(player);return i>=0?`boat:${i}`:undefined;}
 outlineBoat(player:CharacterController){const i=this.nearby(player);return !this.riding&&i>=0?this.boats[i]:undefined;}
 prompt(player:CharacterController){
  if(this.ride){if(this.ride.leaving)return 'Выходим на берег…';const percent=Math.min(100,Math.floor((boatDistance(this.ride.index,this.seconds)-this.ride.start)/BOAT_ROUTE_LENGTH*100));return `E — выйти на берег · Круг: ${percent}%`;}
  return this.nearby(player)>=0?'E — сесть в лодочку':'';
 }
 board(player:CharacterController){
  const index=this.nearby(player);if(this.riding||index<0||!['Idle','Run','WalkBackward','RotateLeft','RotateRight','Swim'].includes(player.state))return false;
  this.ride={player,index,start:boatDistance(index,this.seconds),from:player.actor.position.clone(),elapsed:0};
  player.setActivity('Boat');player.swimming=false;showSwimRing(player.actor,false,0);this.fit(player);return true;
 }
 landing(position:T.Vector3,size=1){
  const radius=Math.min(2,Math.max(.65,size*.6));
  for(let r=2;r<=45;r+=.5)for(let i=0;i<32;i++){
   const angle=i/32*Math.PI*2,p=new T.Vector3(position.x+Math.sin(angle)*r,0,position.z+Math.cos(angle)*r);
   if(insideMeadow(p,radius)&&dryGround(p.x,p.z,radius))return p;
  }
  return undefined;
 }
 savePosition(player:CharacterController){return this.ride?.player===player?this.landing(player.actor.position,player.savedSize):undefined;}
 disembark(){
  const r=this.ride;if(!r||r.leaving)return false;
  const landing=this.landing(r.player.actor.position,r.player.savedSize);if(!landing)return false;
  r.leaving=landing;r.elapsed=0;r.from.copy(r.player.actor.position);return true;
 }
 private poseRider(index:number,player:CharacterController){
  const b=this.boats[index];this.fit(player);this.seatPosition.copy(seat).applyQuaternion(b.quaternion).add(b.position);
  player.actor.position.copy(this.seatPosition);player.actor.quaternion.copy(b.quaternion);player.yaw=b.rotation.y;
  this.sittingPose(player.actor);
 }
 syncRemoteRiders(riders:Map<number,CharacterController>,phases?:ReadonlyMap<number,number>){
  for(const player of this.fitted.keys())if(player!==this.ride?.player&&![...riders.values()].includes(player))this.unfit(player);
  for(const [index,player] of riders)if(this.boats[index]){
   const phase=phases?.get(index)??1;
   if(phase>=1)this.poseRider(index,player);
   else {this.fit(player);if(phase<0)this.fitted.get(player)?.scale.setScalar(T.MathUtils.lerp(Math.min(1,.9/player.actor.scale.x),1,-phase));}
  }
 }
 update(dt:number,seconds:number,camera?:T.Vector3){
  this.seconds=seconds;
  for(let i=0;i<this.boats.length;i++){
   const b=this.boats[i],yaw=boatPose(boatDistance(i,seconds),b.position);
   b.position.y=WATER_Y+Math.sin(seconds*1.6+i)*.025;
   b.rotation.set(.012*Math.sin(seconds*1.3+i),yaw,.014*Math.sin(seconds*1.1+i*2),'YXZ');
   b.visible=!camera||b.position.distanceToSquared(camera)<280**2||i===this.ride?.index;
  }
  for(const p of this.passengers){p.model.visible=!camera||this.boats[p.index].position.distanceToSquared(camera)<120**2;if(this.boats[p.index].visible&&p.model.visible){p.mixer.update(dt);this.sittingPose(p.model);}}
  const r=this.ride;if(!r)return;
  r.elapsed+=dt;r.player.mixer.update(dt);
  if(r.leaving){
   const t=smooth(r.elapsed/.7);r.player.actor.position.lerpVectors(r.from,r.leaving,t);r.player.actor.position.y+=Math.sin(Math.PI*t)*1.3;
   this.fitted.get(r.player)?.scale.setScalar(T.MathUtils.lerp(Math.min(1,.9/r.player.actor.scale.x),1,t));
   if(t===1){this.unfit(r.player);r.player.surfaceY=0;r.player.actor.rotation.set(0,r.player.yaw,0);r.player.setActivity('Idle');this.ride=undefined;}return;
  }
  this.poseRider(r.index,r.player);
  const t=smooth(r.elapsed/.55);r.player.actor.position.lerpVectors(r.from,this.seatPosition,t);r.player.actor.position.y+=Math.sin(Math.PI*t)*.7;
  if(boatDistance(r.index,seconds)-r.start>=BOAT_ROUTE_LENGTH)awardFirst(r.player,'boat');
 }
}
