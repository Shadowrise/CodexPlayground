import {MetapidgieHelperMotion} from './metapidgie-helper-motion';
import {KNIGHT_WARNING_STYLE} from './meta-knight-warning-style';
import * as T from 'three';
import type {CharacterController} from './controller';
import type {KnightBattle,KnightStage} from './meta-knight-battle';
import type {KnightSound} from './meta-knight-sounds';
import {KNIGHT} from './meta-knight-battle';
import {HELPER,helperOrbExit,helperPosition,helperProjectile,helperOrbs,helperRecovering,helperVulnerable,helperDefeated} from './meta-knight-helper';
import {MetaKnightCrescent} from './meta-knight-crescent';
import {MetaKnightCosmicOrbs} from './meta-knight-cosmic-orbs';
import {MetaKnightCosmicMeteorView} from './meta-knight-cosmic-meteor-view';
import {MetaKnightBattleMotion} from './meta-knight-battle-motion';
import {MetaKnightDashSparks} from './meta-knight-dash-sparks';
import {MetaKnightDazedStars} from './meta-knight-dazed-stars';
import {CentipedeTargetCue} from './centipede-target-cue';
import {MetaKnightCosmicView} from './meta-knight-cosmic-view';
import {knightCosmicAlly} from './meta-knight-cosmic-ally';
import {knightWarningGlass,knightWarningArrow} from './meta-knight-warning-material';
import {META_KNIGHT_ARENA as SITE} from './meta-knight-arena-site';

export class MetaKnightHelperView{
 readonly group=new T.Group();private lighting=new T.Group();private crescent=new MetaKnightCrescent();private orbs=new MetaKnightCosmicOrbs();private meteor:MetaKnightCosmicMeteorView;
 private warningMaterial=knightWarningGlass(KNIGHT_WARNING_STYLE.gold,true);private activeWarning=knightWarningGlass(KNIGHT_WARNING_STYLE.red,true);private lanes:T.Mesh[]=[];private arrows:T.Mesh[]=[];
 private arenaOrigin=new T.Vector3();
 readonly target=new CentipedeTargetCue();
 private cosmic?:MetaKnightCosmicView;private birdMotion?:MetapidgieHelperMotion;
 private motion?:MetaKnightBattleMotion;private sparks:MetaKnightDashSparks;private beakSparkAnchor?:T.Group;private stars=new MetaKnightDazedStars('Helper dizziness stars');
 private soundKey='';private hp=HELPER.hearts as number;
 constructor(private c:CharacterController,private cue:(kind:KnightSound)=>void,clips:readonly T.AnimationClip[]=[]){
  this.group.name='Playable boss abilities';this.group.position.x=SITE.x;
  for(const material of [this.warningMaterial,this.activeWarning]){
   material.uniforms.helperArenaCenter={value:new T.Vector2()};material.uniforms.helperArenaRadius={value:SITE.radius-.5};
   material.vertexShader='varying vec2 helperArenaPoint;\n'+material.vertexShader.replace('gl_Position=','helperArenaPoint=(modelMatrix*vec4(position,1.)).xz;gl_Position=');
   material.fragmentShader='varying vec2 helperArenaPoint;uniform vec2 helperArenaCenter;uniform float helperArenaRadius;\n'+material.fragmentShader.replace('void main(){','void main(){if(distance(helperArenaPoint,helperArenaCenter)>helperArenaRadius)discard;');
  }
  if(c.actor.getObjectByName('Metapidgie_beak_tip'))this.birdMotion=new MetapidgieHelperMotion(c,clips);
  if(c.isMetaKnight||this.birdMotion){this.cosmic=new MetaKnightCosmicView(c.actor,this.group,true);this.group.add(this.cosmic.group);}
  const blade=c.actor.getObjectByName(c.isMetaKnight?'Galaxia':'Metapidgie_beak_tip')!;this.meteor=new MetaKnightCosmicMeteorView(blade);this.lighting.position.x=SITE.x;this.lighting.name='Persistent helper meteor lighting';this.lighting.add(this.meteor.light);this.meteor.light.intensity=0;
  if(c.isMetaKnight)this.motion=new MetaKnightBattleMotion(c.actor);
  else{this.beakSparkAnchor=new T.Group();this.beakSparkAnchor.name='Gold beak dash mist';this.beakSparkAnchor.scale.setScalar(.3);this.beakSparkAnchor.rotation.x=Math.PI/2;blade.add(this.beakSparkAnchor);}
  this.sparks=new MetaKnightDashSparks(this.beakSparkAnchor??blade);
  this.crescent.group.scale.setScalar(.9);this.target.group.name='Small Meta Knight available hit target';this.target.group.scale.setScalar(.85);
  const lane=new T.Mesh(new T.PlaneGeometry(1,1),this.warningMaterial);lane.rotation.x=-Math.PI/2;this.lanes.push(lane);this.group.add(lane);for(let i=0;i<8;i++){const arrow=knightWarningArrow();arrow.name='Helper dash direction arrow '+i;this.arrows.push(arrow);this.group.add(arrow);}
  this.group.add(this.crescent.group,this.orbs.group,this.meteor.group,this.target.group,this.stars.group);
 }
 prepareEyes(){return this.cosmic?.prepareEyes();}
 clear(){this.birdMotion?.clear();this.motion?.clear();this.c.setMetapidgieAbilityDash(false);}
 updatePlanetLightning(s:KnightBattle|undefined,id:string,now:number,planet?:{node:T.Object3D;radius:number}){
  const ally=knightCosmicAlly(s,id,now);if(!s?.cosmicRefuge||ally?.kind!=='planet'||ally.gather||!planet)return;
  this.cosmic?.addPlanetLightning(planet.node,planet.radius,(now-s.cosmicRefuge.at)/1000);
 }
 update(s:KnightBattle|undefined,id:string,now:number,dt:number,camera?:T.Camera){
  this.clear();if(this.c.actor.parent&&this.group.parent!==this.c.actor.parent)this.c.actor.parent.add(this.group);if(this.group.parent&&this.lighting.parent!==this.group.parent)this.group.parent.add(this.lighting);this.meteor.light.intensity=0;
  this.cosmic?.update(undefined,now);
  const p=s?.players[id],h=p?.helper,c=h?.cast,active=!!s&&!!h&&!p?.withdrawn&&!['won','lost','cancelled'].includes(s.stage);
  this.group.visible=active;this.sparks.update(0,false);if(!active||!s||!h||!p){this.birdMotion?.update(undefined,id,now,camera);return;}
  const ally=knightCosmicAlly(s,id,now);
  if(ally&&(this.c.isMetaKnight||this.birdMotion)){
   this.c.actor.position.set(SITE.x+ally.p[0],ally.p[1],ally.p[2]);this.c.yaw=ally.yaw;this.c.actor.rotation.y=ally.yaw;
   const clip=ally.waiting?'Sitting':ally.kind==='planet'?'Fly':ally.gather?'Run':['cosmic-rise','cosmic-flight'].includes(s.stage)?'Fly':'Idle';if(this.c.state!==clip)this.c.setActivity(clip);this.c.updateActivity(dt);
   if(ally.kind==='planet'&&!ally.waiting)this.motion?.applyRaisedSword(ally.raise,(now-s.cosmicRefuge!.at)/1000,true);else if(!ally.gather)this.motion?.apply(s,ally.progress);
   this.birdMotion?.update(s,id,now,camera);
   if(!this.cosmic){this.cosmic=new MetaKnightCosmicView(this.c.actor,this.group,true);this.group.add(this.cosmic.group);}
   const powered=!ally.waiting&&(ally.kind==='planet'?ally.raise>0:!ally.gather);this.cosmic.update(powered?s:undefined,now);this.c.updateKnightBladeGlow(now,powered);this.target.group.visible=false;this.stars.group.scale.setScalar(this.c.actor.scale.x*.38);this.stars.update(ally.p,now,ally.waiting);this.c.updateDuelDazedPose(now,ally.waiting);this.crescent.group.visible=this.orbs.group.visible=this.meteor.group.visible=false;this.lanes.forEach(l=>l.visible=false);this.arrows.forEach(a=>a.visible=false);return;
  }
  const locked=helperPosition(h,now),recover=helperRecovering(h,now),vulnerable=helperVulnerable(h,now),stunned=now<(h.stunnedUntil??0),dead=helperDefeated(s,id,now);
  if(locked&&!dead)this.c.actor.position.set(SITE.x+locked[0],locked[1],locked[2]);
  const casting=!!c&&!!locked&&now<c.end,warning=!!c&&now<c.release;
  if(casting){this.group.getWorldPosition(this.arenaOrigin);for(const m of [this.warningMaterial,this.activeWarning])m.uniforms.helperArenaCenter.value.set(this.arenaOrigin.x,this.arenaOrigin.z);}
  if(c&&(casting||recover||stunned||dead)){
   const stage:KnightStage=dead||recover||stunned?'open':c.ability===2?warning?'dash-warn':'dash':c.ability===3?warning?'cosmic-spin-warn':'cosmic-spin':c.meteor?warning?'cosmic-meteor-draw':'cosmic-meteor-cast':warning?'shot-warn':'shot';
   const clip=dead||recover||stunned?'Sitting':c.ability===2||!this.c.isMetaKnight&&c.ability===3?'Fly':!this.c.isMetaKnight&&!warning?'Push':'Idle';if(this.c.state!==clip)this.c.setActivity(clip);this.c.updateActivity(dt);
   const f=T.MathUtils.clamp((now-(warning?c.at:c.release))/Math.max(1,warning?c.release-c.at:c.end-c.release),0,1);
   if(casting&&!stunned){const mock:KnightBattle={...s,phase:c.meteor||c.ability===3?4:1,stage,since:warning?c.at:c.release,until:warning?c.release:c.end,cosmicPart:c.meteor?2:1};this.motion?.apply(mock,f);}
   this.c.yaw=c.yaw+(c.ability===3&&!warning&&!recover?f*Math.PI*2:0);this.c.actor.rotation.y=this.c.yaw;
  }
  const green=vulnerable&&!dead;
  const local=[this.c.actor.position.x-SITE.x,this.c.actor.position.y,this.c.actor.position.z] as [number,number,number];
  this.target.group.visible=green;if(green){this.target.group.scale.setScalar(.85*this.c.actor.scale.x);this.target.update([local[0],local[1]+.97*this.c.actor.scale.x,local[2]],now,camera,true,c?(now-c.end)/(c.recoverUntil-c.end):undefined);this.target.arrow.position.y=1.4+.04*Math.sin(now*.003);}
  this.stars.group.scale.setScalar(.38);this.stars.update(local,now,dead||stunned);this.c.updateDuelDazedPose(now,dead||stunned);
  const dash=!!c&&c.ability===2&&casting&&!dead&&!stunned,length=dash?Math.hypot(c!.to[0]-c!.from[0],c!.to[2]-c!.from[2]):0,width=HELPER.dashHalfWidth*2,material=warning?this.warningMaterial:this.activeWarning;
  this.c.setMetapidgieAbilityDash(dash&&!warning);
  this.lanes.forEach(lane=>{lane.visible=dash;if(!dash||!c)return;lane.material=material;lane.position.set((c.from[0]+c.to[0])/2,c.from[1]+.10,(c.from[2]+c.to[2])/2);lane.rotation.set(-Math.PI/2,0,c.yaw);lane.scale.set(width,length+width,1);});
  this.arrows.forEach((arrow,i)=>{arrow.visible=dash;if(!dash||!c)return;const t=(i+.5)/this.arrows.length;arrow.position.set(c.from[0]+(c.to[0]-c.from[0])*t,c.from[1]+.15,c.from[2]+(c.to[2]-c.from[2])*t);arrow.rotation.set(-Math.PI/2,0,c.yaw+Math.PI);arrow.scale.setScalar(1.5*KNIGHT.effectScale);(arrow.material as T.MeshBasicMaterial).color.setHex(warning?KNIGHT_WARNING_STYLE.gold:KNIGHT_WARNING_STYLE.red);arrow.visible=Math.hypot(arrow.position.x,arrow.position.z)<SITE.radius-.8;});
  for(const m of [this.warningMaterial,this.activeWarning]){m.uniforms.clock.value=now/1000;m.uniforms.progress.value=c?warning?T.MathUtils.clamp((now-c.at)/(c.release-c.at),0,1):1:0;m.uniforms.width.value=width;m.uniforms.span.value=length;}
  const projectile=c&&!dead?helperProjectile(c,now,local):undefined;this.crescent.group.visible=!!projectile&&!c?.meteor;
  if(projectile&&c&&!c.meteor){this.crescent.group.position.fromArray(projectile);this.crescent.group.rotation.y=c.returned?Math.atan2(local[0]-projectile[0],local[2]-projectile[2])-Math.PI/2:c.yaw-Math.PI/2;this.crescent.update(now,!!c.returned);}
  this.meteor.update(undefined,now,c?.meteor&&!dead?{since:c.at,release:c.release,returned:!!c.returned,yaw:c.yaw,point:time=>time<c.release&&time>=c.at?[c.from[0]+Math.sin(c.yaw)*1.8,c.from[1]+2.4,c.from[2]+Math.cos(c.yaw)*1.8]:helperProjectile(c,time,local)}:undefined);
  this.birdMotion?.update(s,id,now,camera);
  const orbs=c&&!dead?helperOrbs(c,now):[];this.orbs.update(undefined,now,orbs.map((p,i)=>({id:i,at:c!.release+(c!.beak?i*HELPER.spinMs/6:0),angle:c!.yaw+i*Math.PI/3,p,from:c!.from,distance:helperOrbExit(c!).radius+(now-c!.release-(c!.beak?i*HELPER.spinMs/6:0))/1000*HELPER.orbSpeed})));
  this.sparks.update(c?now-c.release:0,!!c&&c.ability===2&&!warning&&casting);this.c.updateKnightBladeGlow(now,casting,!dead);
  const beat=c?c.returned?'reflect':warning?'warn':now<c.end?'release':'rest':'';const key=c?`${s.id}:${c.at}:${beat}`:'';
  if(key&&key!==this.soundKey){this.soundKey=key;if(beat==='warn')this.cue(c!.meteor?'cosmic-meteor-draw':'warn');if(beat==='release'){this.cue(c!.ability===1?c!.meteor?'cosmic-meteor-throw':'slash':c!.ability===2?'thrust':'cosmic-spin');if(c!.ability===1&&!c!.meteor)this.cue('shot');}if(beat==='reflect')this.cue(c!.meteor?'cosmic-meteor-reflect':'reflect');if(beat==='rest'&&c!.ability===3)this.cue('cosmic-tired');}
  if(p.hp<this.hp)this.cue('hit');this.hp=p.hp;
 }
 dispose(){this.clear();this.birdMotion?.dispose();this.motion?.clear();this.cosmic?.dispose();this.sparks.dispose();this.beakSparkAnchor?.removeFromParent();this.stars.dispose();this.crescent.dispose();this.orbs.dispose();this.meteor.dispose();for(const lane of this.lanes)lane.geometry.dispose();for(const arrow of this.arrows){arrow.geometry.dispose();(arrow.material as T.Material).dispose();}this.warningMaterial.dispose();this.activeWarning.dispose();this.target.dispose();this.group.removeFromParent();this.lighting.removeFromParent();}
}
