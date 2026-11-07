import {knightCosmicAlly} from './meta-knight-cosmic-ally';
import * as T from 'three';
import type {CharacterController} from './controller';
import type {KnightBattle} from './meta-knight-battle';
import {HELPER,type KnightHelper} from './meta-knight-helper';
import {createMetapidgieCombatFx} from './metapidgie-combat-fx';
import {duetActive} from './meta-knight-duet';

const ease=(v:number)=>T.MathUtils.smootherstep(v,0,1);
type Binding={node:T.Object3D;property:string;sample:ReturnType<T.KeyframeTrack['InterpolantFactoryMethodLinear']>};
/** Reversible full native pose, applied after the player's controller. No sword joints. */
export class MetapidgieHelperMotion{
 private clips=new Map<string,{clip:T.AnimationClip;bindings:Binding[]}>();
 private originals=new Map<T.Object3D,{p:T.Vector3;q:T.Quaternion;s:T.Vector3;m?:number[]}>();
 private fx:ReturnType<typeof createMetapidgieCombatFx>;
 constructor(private c:CharacterController,clips:readonly T.AnimationClip[]){
  for(const clip of clips)this.clips.set(clip.name,{clip,bindings:clip.tracks.map(t=>{const b=T.PropertyBinding.parseTrackName(t.name),node=T.PropertyBinding.findNode(c.actor,b.nodeName) as T.Object3D;return {node,property:b.propertyName,sample:t.InterpolantFactoryMethodLinear()};}).filter(b=>b.node)});
  this.fx=createMetapidgieCombatFx(c.actor,[...clips]);
 }
 clear(){for(const [n,r] of this.originals){n.position.copy(r.p);n.quaternion.copy(r.q);n.scale.copy(r.s);if(n instanceof T.Mesh&&r.m)r.m.forEach((v,i)=>n.morphTargetInfluences![i]=v);}this.originals.clear();}
 apply(name:string,time:number){const entry=this.clips.get(name);if(!entry)return false;
  for(const b of entry.bindings){const n=b.node;if(!this.originals.has(n))this.originals.set(n,{p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone(),m:n instanceof T.Mesh?n.morphTargetInfluences?.slice():undefined});const value=b.sample.evaluate(T.MathUtils.clamp(time,0,entry.clip.duration));
   if(b.property==='position')n.position.fromArray(value);else if(b.property==='quaternion')n.quaternion.fromArray(value).normalize();else if(b.property==='scale')n.scale.fromArray(value);else if(b.property==='morphTargetInfluences'&&n instanceof T.Mesh)(Array.from(value) as number[]).forEach((v,i)=>n.morphTargetInfluences![i]=v);
  }return true;
 }
 update(s:KnightBattle|undefined,id:string,now:number,camera?:T.Camera){
  const p=s?.players[id],h=p?.helper,cast=h?.cast;let name='Idle',time=0;
  if(s&&h&&p&&!p.withdrawn&&p.hp>0&&!['won','lost','cancelled'].includes(s.stage)){
   const ally=knightCosmicAlly(s,id,now);
   if(ally){name=ally.waiting?'Boss_cosmic-open':ally.gather?ally.kind==='planet'?'Boss_cosmic-flight':'Boss_duet-gather':`Boss_${s.stage}`;const duration=this.clips.get(name)?.clip.duration??1;time=ally.gather||ally.waiting?((now-s.since)/1000)%duration:T.MathUtils.clamp((now-s.since)/(s.until-s.since),0,1)*duration;}
   else if(duetActive(s)&&s.duet?.owner===id){name=s.stage==='duet-gather'&&s.phase===4?'Boss_cosmic-flight':`Boss_${s.stage}`;const d=this.clips.get(name)?.clip.duration??1;time=s.stage==='duet-gather'?((now-s.since)/1000)%d:T.MathUtils.clamp((now-s.since)/(s.until-s.since),0,1)*d;}
   else if(cast&&now>=cast.at&&now<cast.recoverUntil&&now>=(h.stunnedUntil??0)){
    if(cast.ability===1&&!cast.meteor){
     if(now<cast.release-220){name='Boss_shot-warn';time=T.MathUtils.clamp((now-cast.at)/(cast.release-cast.at-220),0,1)*(this.clips.get(name)?.clip.duration??1);}
     else{name='Boss_shot';time=Math.min(1.8,(now-cast.release+220)/1000);}
    }else if(cast.ability===3){
     if(now<cast.release){name='Boss_cosmic-spin-warn';const d=this.clips.get(name)?.clip.duration??2.8,u=T.MathUtils.clamp((now-cast.at)/(cast.release-cast.at),0,1);time=u*d;this.c.yaw=cast.yaw+.55*Math.sin(Math.PI*ease(u/.65));}
     else if(now<cast.end){name='Boss_cosmic-spin';time=((now-cast.release)/1000)%.9;this.c.yaw=cast.yaw+(now-cast.release)/(cast.end-cast.release)*Math.PI*2;}
     else{name='Boss_cosmic-open';time=((now-cast.end)/1000)%2.4;this.c.yaw=cast.yaw;}
     this.c.actor.rotation.y=this.c.yaw;
    }
   }
  }
  if(name!=='Idle')this.apply(name,time);
  this.c.actor.updateMatrixWorld(true);if(camera&&name!=='Idle')this.fx.update(name,time,this.clips.get(name)?.clip.duration??1,camera,undefined,.65);else this.fx.reset();
 }
 dispose(){this.clear();this.fx.reset();this.fx.group.removeFromParent();const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();this.fx.group.traverse(n=>{if(n instanceof T.Mesh||n instanceof T.Points){geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);}});this.fx.trails[0].uniforms.uBirth.value.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
}
