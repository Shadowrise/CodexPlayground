import * as T from 'three';import type {CharacterController} from './controller';import type {KnightBattle} from './meta-knight-battle';import {pidgeyFeast,PIDGEY_FEAST} from './metapidgie-feast';import {META_KNIGHT_ARENA as SITE} from './meta-knight-arena-site';
/** Reuses the very same native Joy and Peck clips as bread feeding in the meadow. */
export class MetapidgieCelebrationView{
 private action?:T.AnimationAction;private paused=false;
 constructor(private c:CharacterController){}
 clear(){if(this.action){this.action.paused=this.paused;this.action=undefined;}}
 update(s:KnightBattle|undefined,id:string,now:number,_dt:number){this.clear();const pose=pidgeyFeast(s,id,now);if(!pose)return false;const c=this.c;c.clearDuelDazedPose();if(c.state!==pose.birdClip)c.setActivity(pose.birdClip,true);const action=c.actions.get(pose.birdClip)!;this.paused=action.paused;c.mixer.stopAllAction();action.reset().setEffectiveWeight(1).play();action.paused=true;action.time=pose.clipTime;c.mixer.update(0);this.action=action;c.actor.position.set(SITE.x+pose.p[0],pose.p[1],pose.p[2]);c.yaw=pose.yaw;c.actor.rotation.set(0,pose.yaw,0);c.actor.visible=true;return true;}
 dispose(){this.clear();}
}
/** One decorative loaf; it is never inserted into inventory or shared bakery state. */
export class MetapidgieFeastBread{
 readonly group=new T.Group();private owned:T.Mesh[]=[];
 constructor(scene:T.Scene,source?:T.Object3D){this.group.name='Meta Pidgie victory feast bread';this.group.position.x=SITE.x;this.group.visible=false;scene.add(this.group);if(!source)return;const loaf=source.clone(true);loaf.traverse(n=>{if(n instanceof T.Mesh){n.geometry=n.geometry.clone();n.material=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone();n.castShadow=false;n.receiveShadow=true;this.owned.push(n);}});const bounds=new T.Box3().setFromObject(loaf),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),factor=1.55/size.y*PIDGEY_FEAST.breadScale;loaf.position.sub(center);const flat=new T.Group();flat.add(loaf);flat.scale.setScalar(factor);flat.rotation.x=-Math.PI/2;flat.position.y=size.z*factor/2+.04;this.group.add(flat);}
 update(s:KnightBattle|undefined,now:number){this.group.rotation.y=(s?.celebration?.facing??0)+Math.PI;this.group.visible=s?.boss==='metapidgie'&&s.stage==='lost'&&!!s.celebration&&now>=(s.celebration.landAt??s.celebration.at);}
 dispose(){this.group.removeFromParent();for(const n of this.owned){n.geometry.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();}}
}
