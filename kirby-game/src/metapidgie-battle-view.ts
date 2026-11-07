import * as T from 'three';
import type {CharacterController} from './controller';
import {MetaKnightBattleView} from './meta-knight-battle-view';
import {MetaKnightCrescentLaunch} from './meta-knight-crescent';
import {MetaKnightDazedStars} from './meta-knight-dazed-stars';
import {KNIGHT,knightPosition,knightProgress,type KnightBattle} from './meta-knight-battle';
import {META_KNIGHT_ARENA as SITE} from './meta-knight-arena-site';
import {pidgeyAirHeight} from './knight-boss';
import {createMetapidgieCombatFx} from './metapidgie-combat-fx';
import {meleeTrailTimes} from './metapidgie-melee';
import {disposeActor} from './actor-lifecycle';
import type {KnightSound} from './meta-knight-sounds';

/** Reuse the shared arena presentation, with an independent, authored bird rig.
 * The hidden reference owns sword-specific helpers; none ever pose the bird's joints.
 */
export class MetapidgieBattleView extends MetaKnightBattleView{
 private fx:ReturnType<typeof createMetapidgieCombatFx>;
 private beakLaunch=new MetaKnightCrescentLaunch();
 private stars=new MetaKnightDazedStars('Meta Pidgey golden dizziness stars');
 private actions=new Map<string,T.AnimationAction>();private key='';private point=new T.Vector3();
 private pidgeyBattleId=0;private trailBirth=[-Infinity,-Infinity];
 constructor(private pigeon:CharacterController,private reference:CharacterController,clips:T.AnimationClip[],scene:T.Scene,cancel:()=>void,cue:(kind:KnightSound,rate?:number)=>void,stop:()=>void,charge:(level:number)=>void){
  super(reference,scene,cancel,cue,stop,charge);
  reference.actor.visible=false;scene.add(reference.actor);pigeon.mixer.stopAllAction();
  const idle=pigeon.actions.get('Idle')!;idle.paused=true;this.actions.set('Idle',idle);
  pigeon.actor.traverse(node=>{if(node.name.startsWith('Phase1_'))node.visible=false;});
  for(const clip of clips){const action=pigeon.mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.paused=true;this.actions.set(clip.name,action);}
  this.fx=createMetapidgieCombatFx(pigeon.actor,clips);this.group.add(this.stars.group,this.beakLaunch.group);
  this.fx.group.traverse(node=>{node.castShadow=node.receiveShadow=false;});
 }
 override update(...args:Parameters<MetaKnightBattleView['update']>){
  super.update(...args);const [s,,now,dt,,,,,,camera]=args;
  this.usePidgeyPresentation(s?.stage);const stage=s?.stage??'idle',elapsed=s?Math.max(0,(now-s.since)/1000):now/1000;
  const name=stage==='idle'||stage==='cancelled'||stage==='side-choice'?'Idle':stage==='slash-warn'&&s!.step===2?'Boss_slash-warn-backhand':stage==='slash'&&s!.step===3?'Boss_slash-backhand':stage==='open'?s!.pattern==='leap'?'Boss_open-land':'Boss_open-melee':stage==='shot-warn'&&s!.step>0?'Boss_shot-recharge':`Boss_${stage}`;
  // The authoritative stage may last longer than the clip. Keep release at 220 ms.
  const action=this.actions.get(name),duration=action?.getClip().duration??1;
  let time=s?knightProgress(s,now)*duration:elapsed%duration;
  if(stage==='won'||stage==='lost'||stage==='stunned'||stage==='get-up')time=Math.min(duration,elapsed);
  if(stage==='shot')time=elapsed<=.22?elapsed:.22+(duration-.22)*Math.min(1,(elapsed-.22)/Math.max(.001,(s!.until-s!.since)/1000-.22));
  const key=`${s?.id??0}:${s?.since??0}:${name}`;
  if(key!==this.key){this.key=key;for(const a of this.actions.values())if(a.isScheduled())a.fadeOut(.10);if(action){action.reset();action.paused=true;action.enabled=true;action.setEffectiveWeight(1).fadeIn(.10).play();}}
  if(action)action.time=time;
  this.pigeon.mixer.update(Math.max(0,dt));
  const p=s?knightPosition(s,now):[0,0,-9],lift=s?pidgeyAirHeight(stage,knightProgress(s,now),s.step)*KNIGHT.modelScale:0;
  this.pigeon.actor.position.set(SITE.x+p[0],p[1]-lift,p[2]);this.pigeon.actor.rotation.set(0,this.reference.yaw,0);this.pigeon.yaw=this.reference.yaw;
  this.pigeon.actor.scale.setScalar(KNIGHT.modelScale);this.pigeon.actor.updateMatrixWorld(true);
  if(this.pidgeyBattleId!==(s?.id??0)){this.pidgeyBattleId=s?.id??0;this.trailBirth.fill(-Infinity);}
  meleeTrailTimes(name,time).forEach((age,i)=>{if(age>=0)this.trailBirth[i]=now-age*1000;});
  if(camera)this.fx.update(name,time,duration,camera,this.trailBirth.map(at=>(now-at)/1000));
  this.pigeon.actor.getObjectByName('Metapidgie_beak_tip')!.getWorldPosition(this.point);this.point.x-=SITE.x;this.beakLaunch.update(s,now,this.point,true);
  const head=this.pigeon.actor.getObjectByName('Head');head?.getWorldPosition(this.point);this.point.x-=SITE.x;this.point.y-=5.8;
  this.stars.update([this.point.x,this.point.y,this.point.z],now,stage==='stunned'||stage==='won');
 }
 override dispose(){
  this.stars.dispose();super.dispose();this.fx.group.removeFromParent();
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
  this.fx.group.traverse(node=>{if(node instanceof T.Mesh||node instanceof T.Points){geometries.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:[node.material])materials.add(m);}});
  this.fx.trails[0].uniforms.uBirth.value.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());disposeActor(this.reference);
 }
}
