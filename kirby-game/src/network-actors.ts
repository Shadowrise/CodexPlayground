import type {PlayerSnapshots} from './player-snapshots';
import {makeSwimRing} from './ponds';
import {updateFlightCloud} from './flight';
import * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from './controller';
import {cloneVariant,KIRBY_VARIANTS} from './variants';
import type {KirbyNpc} from './npcs';
import type {ActorState} from './network-protocol';
import {validAchievements} from './score';
const round=(v:number)=>Math.round(v*1000)/1000;
function poseNodes(c:CharacterController){return [c.animationRoot,...['Left_shoulder','Right_shoulder','Left_foot_pivot','Right_foot_pivot'].map(n=>c.actor.getObjectByName(n)!)];}
export function actorState(c:CharacterController|KirbyNpc,name:string,variant:number):ActorState{
 return {p:c.actor.position.toArray().map(round),q:c.actor.quaternion.toArray().map(round),s:round(c.actor.scale.x),state:c.state,pose:c instanceof CharacterController&&c.state!=='Idle'?poseNodes(c).map(n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()].map(round)):[],fruits:c.fruitsEaten,achievements:[...c.achievements],name,variant,star:c instanceof CharacterController?round(c.starRemaining):0};
}
export function applyActor(c:CharacterController|KirbyNpc,a:ActorState,dt:number,snap=false){
 const blend=snap?1:1-Math.exp(-dt*16);c.actor.position.lerp(new T.Vector3().fromArray(a.p),blend);c.actor.quaternion.slerp(new T.Quaternion().fromArray(a.q).normalize(),blend);c.actor.scale.setScalar(T.MathUtils.lerp(c.actor.scale.x,a.s,blend));c.yaw=new T.Euler().setFromQuaternion(c.actor.quaternion).y;
 c.fruitsEaten=a.fruits;if(validAchievements(a.achievements)){c.achievements.clear();for(const v of a.achievements)c.achievements.add(v);}
 if(c instanceof CharacterController){
  if(c.state!==a.state){c.setActivity(a.state);c.actions.forEach(x=>x.stop());const action=c.actions.get(a.state)??c.actions.get('Idle');action?.reset().play();}
  c.mixer.update(dt);poseNodes(c).forEach((n,i)=>{const pose=a.pose[i];if(!pose)return;n.position.fromArray(pose);n.quaternion.fromArray(pose.slice(3,7));n.scale.fromArray(pose.slice(7,10));});
  c.flight.active=a.state==='Jump'||a.state==='Fly';c.flight.height=c.flight.active?Math.max(0,a.p[1]/a.s):0;updateFlightCloud(c.cloud,c.flight);
 }else {c.networkAnimate(a.state,dt);updateFlightCloud(c.cloud,c.flight);}
}
export class RemotePlayers{
 readonly players=new Map<string,CharacterController>();
 readonly renderedStates=new Map<string,ActorState>();
 constructor(private scene:T.Scene,private model:GLTF){}
 update(actors:Map<string,ActorState>,dt:number,snapshots?:Map<string,PlayerSnapshots>){
  const now=performance.now();
  for(const [id,c] of this.players)if(!actors.has(id)){this.scene.remove(c.actor);c.actor.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});this.players.delete(id);this.renderedStates.delete(id);}
  for(const [id,latest] of actors){const a=snapshots?.get(id)?.sample(now)??latest;this.renderedStates.set(id,a);let c=this.players.get(id);const fresh=!c;if(!c){c=new CharacterController(cloneVariant(this.model.scene,KIRBY_VARIANTS[a.variant],false),this.model.animations);this.players.set(id,c);this.scene.add(c.actor);const ring=makeSwimRing();ring.visible=false;ring.position.y=.55;c.actor.add(ring);

  }applyActor(c,a,dt,!!snapshots||fresh);c.actor.getObjectByName('Rainbow swim ring')!.visible=a.state==='Swim';}
 }
}
