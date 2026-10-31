import * as T from 'three';
import type {CharacterController} from './controller';
import type {KnightBattle,KnightStage} from './meta-knight-battle';
import type {KnightSound} from './meta-knight-sounds';
import {HELPER,helperPosition,helperProjectile,helperOrbs,helperRecovering,helperVulnerable} from './meta-knight-helper';
import {MetaKnightCrescent} from './meta-knight-crescent';
import {MetaKnightCosmicOrbs} from './meta-knight-cosmic-orbs';
import {MetaKnightCosmicMeteorView} from './meta-knight-cosmic-meteor-view';
import {MetaKnightBattleMotion} from './meta-knight-battle-motion';
import {MetaKnightDashSparks} from './meta-knight-dash-sparks';
import {MetaKnightDazedStars} from './meta-knight-dazed-stars';
import {CentipedeTargetCue} from './centipede-target-cue';
import {knightWarningGlass,knightWarningArrow} from './meta-knight-warning-material';
import {META_KNIGHT_ARENA as SITE} from './meta-knight-arena-site';

export class MetaKnightHelperView{
 readonly group=new T.Group();private lighting=new T.Group();private crescent=new MetaKnightCrescent();private orbs=new MetaKnightCosmicOrbs();private meteor:MetaKnightCosmicMeteorView;
 private warningMaterial=knightWarningGlass(0xffc342,true);private lanes:T.Mesh[]=[];private arrows:T.Mesh[]=[];
 readonly target=new CentipedeTargetCue();
 private motion:MetaKnightBattleMotion;private sparks:MetaKnightDashSparks;private stars=new MetaKnightDazedStars('Helper dizziness stars');
 private materials=new Map<T.MeshStandardMaterial,{color:T.Color;intensity:number}>();private tinted=false;private soundKey='';private hp=HELPER.hearts as number;
 constructor(private c:CharacterController,private cue:(kind:KnightSound)=>void){
  this.group.name='Playable Meta Knight boss abilities';this.group.position.x=SITE.x;
  const blade=c.actor.getObjectByName('Galaxia')!;this.meteor=new MetaKnightCosmicMeteorView(blade);this.lighting.position.x=SITE.x;this.lighting.name='Persistent helper meteor lighting';this.lighting.add(this.meteor.light);this.meteor.light.intensity=0;this.motion=new MetaKnightBattleMotion(c.actor);this.sparks=new MetaKnightDashSparks(blade);
  this.crescent.group.scale.setScalar(.9);this.target.group.name='Small Meta Knight available hit target';this.target.group.scale.setScalar(.85);
  for(let i=0;i<6;i++){const lane=new T.Mesh(new T.PlaneGeometry(1,1),this.warningMaterial);lane.rotation.x=-Math.PI/2;this.lanes.push(lane);const arrow=knightWarningArrow();this.arrows.push(arrow);this.group.add(lane,arrow);}
  this.group.add(this.crescent.group,this.orbs.group,this.meteor.group,this.target.group,this.stars.group);
  c.actor.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&!this.materials.has(m))this.materials.set(m,{color:m.emissive.clone(),intensity:m.emissiveIntensity});});
 }
 clear(){this.motion.clear();if(this.tinted){for(const [m,v] of this.materials){m.emissive.copy(v.color);m.emissiveIntensity=v.intensity;}this.tinted=false;}}
 update(s:KnightBattle|undefined,id:string,now:number,dt:number,camera?:T.Camera){
  this.clear();if(this.c.actor.parent&&this.group.parent!==this.c.actor.parent)this.c.actor.parent.add(this.group);if(this.group.parent&&this.lighting.parent!==this.group.parent)this.group.parent.add(this.lighting);this.meteor.light.intensity=0;
  const p=s?.players[id],h=p?.helper,c=h?.cast,active=!!s&&!!h&&!p?.withdrawn&&!['won','lost','cancelled'].includes(s.stage);
  this.group.visible=active;this.sparks.update(0,false);if(!active||!s||!h||!p)return;
  const locked=helperPosition(h,now),recover=helperRecovering(h,now),vulnerable=helperVulnerable(h,now),stunned=now<(h.stunnedUntil??0),dead=p.hp<=0;
  if(locked&&!dead)this.c.actor.position.set(SITE.x+locked[0],locked[1],locked[2]);
  const casting=!!c&&now<c.end,warning=!!c&&now<c.release;
  if(c&&(casting||recover||stunned||dead)){
   const stage:KnightStage=dead||recover||stunned?'open':c.ability===2?warning?'dash-warn':'dash':c.ability===3?warning?'cosmic-spin-warn':'cosmic-spin':c.meteor?warning?'cosmic-meteor-draw':'cosmic-meteor-cast':warning?'shot-warn':'shot';
   const clip=dead||recover||stunned?'Sitting':c.ability===2?'Fly':'Idle';if(this.c.state!==clip)this.c.setActivity(clip);this.c.updateActivity(dt);
   const f=T.MathUtils.clamp((now-(warning?c.at:c.release))/Math.max(1,warning?c.release-c.at:c.end-c.release),0,1);
   if(casting&&!stunned){const mock:KnightBattle={...s,phase:c.meteor||c.ability===3?4:1,stage,since:warning?c.at:c.release,until:warning?c.release:c.end,cosmicPart:c.meteor?2:1};this.motion.apply(mock,f);}
   this.c.yaw=c.yaw+(c.ability===3&&!warning&&!recover?f*Math.PI*2:0);this.c.actor.rotation.y=this.c.yaw;
  }
  const green=vulnerable&&!dead,yellow=!!c&&c.ability===2&&casting;
  if(yellow){this.tinted=true;for(const m of this.materials.keys()){m.emissive.setHex(0xffc233);m.emissiveIntensity=.48;}}
  const local=[this.c.actor.position.x-SITE.x,this.c.actor.position.y,this.c.actor.position.z] as [number,number,number];
  this.target.group.visible=green;if(green){this.target.group.scale.setScalar(.85*this.c.actor.scale.x);this.target.update([local[0],local[1]+.97*this.c.actor.scale.x,local[2]],now,camera,true,c?(now-c.end)/(c.recoverUntil-c.end):undefined);this.target.arrow.position.y=1.4+.04*Math.sin(now*.003);}
  this.stars.group.scale.setScalar(.38);this.stars.update(local,now,dead||stunned);this.c.updateDuelDazedPose(now,dead||stunned);
  this.lanes.forEach((lane,i)=>{lane.visible=!!c&&warning&&(c.ability===3||i===0);this.arrows[i].visible=lane.visible;if(!lane.visible||!c)return;const yaw=c.yaw+(c.ability===3?i*Math.PI/3:0),length=c.ability===2?Math.hypot(c.to[0]-c.from[0],c.to[2]-c.from[2]):c.ability===3?35:42,width=c.ability===2?HELPER.dashHalfWidth*2:1.8;lane.position.set(c.from[0]+Math.sin(yaw)*length/2,c.from[1]+.10,c.from[2]+Math.cos(yaw)*length/2);lane.rotation.set(-Math.PI/2,0,yaw);lane.scale.set(width,length,1);const arrow=this.arrows[i];arrow.position.set(c.from[0]+Math.sin(yaw)*5,c.from[1]+.13,c.from[2]+Math.cos(yaw)*5);arrow.rotation.set(-Math.PI/2,0,yaw+Math.PI);});
  this.warningMaterial.uniforms.clock.value=now/1000;this.warningMaterial.uniforms.progress.value=c?T.MathUtils.clamp((now-c.at)/(c.release-c.at),0,1):0;this.warningMaterial.uniforms.width.value=c?.ability===2?HELPER.dashHalfWidth*2:1.8;this.warningMaterial.uniforms.span.value=c?.ability===2?HELPER.dashDistance:40;
  const projectile=c&&!dead?helperProjectile(c,now,local):undefined;this.crescent.group.visible=!!projectile&&!c?.meteor;
  if(projectile&&c&&!c.meteor){this.crescent.group.position.fromArray(projectile);this.crescent.group.rotation.y=c.returned?Math.atan2(local[0]-projectile[0],local[2]-projectile[2])-Math.PI/2:c.yaw-Math.PI/2;this.crescent.update(now,!!c.returned);}
  this.meteor.update(undefined,now,c?.meteor&&!dead?{since:c.at,release:c.release,returned:!!c.returned,yaw:c.yaw,point:time=>time<c.release&&time>=c.at?[c.from[0]+Math.sin(c.yaw)*1.8,c.from[1]+2.4,c.from[2]+Math.cos(c.yaw)*1.8]:helperProjectile(c,time,local)}:undefined);
  const orbs=c&&!dead?helperOrbs(c,now):[];this.orbs.update(undefined,now,orbs.map((p,i)=>({id:i,at:c!.release,angle:c!.yaw+i*Math.PI/3,p,from:c!.from,distance:2.1+(now-c!.release)/1000*HELPER.orbSpeed})));
  this.sparks.update(c?now-c.release:0,!!c&&c.ability===2&&!warning&&casting);this.c.updateKnightBladeGlow(now,casting,!dead);
  const beat=c?c.returned?'reflect':warning?'warn':now<c.end?'release':'rest':'';const key=c?`${s.id}:${c.at}:${beat}`:'';
  if(key&&key!==this.soundKey){this.soundKey=key;if(beat==='warn')this.cue(c!.meteor?'cosmic-meteor-draw':'warn');if(beat==='release'){this.cue(c!.ability===1?c!.meteor?'cosmic-meteor-throw':'slash':c!.ability===2?'thrust':'cosmic-spin');if(c!.ability===1&&!c!.meteor)this.cue('shot');}if(beat==='reflect')this.cue(c!.meteor?'cosmic-meteor-reflect':'reflect');if(beat==='rest'&&c!.ability===3)this.cue('cosmic-tired');}
  if(p.hp<this.hp)this.cue('hit');this.hp=p.hp;
 }
 dispose(){this.clear();this.motion.clear();this.sparks.dispose();this.stars.dispose();this.crescent.dispose();this.orbs.dispose();this.meteor.dispose();for(const lane of this.lanes)lane.geometry.dispose();for(const arrow of this.arrows){arrow.geometry.dispose();(arrow.material as T.Material).dispose();}this.warningMaterial.dispose();this.target.dispose();this.group.removeFromParent();this.lighting.removeFromParent();}
}
