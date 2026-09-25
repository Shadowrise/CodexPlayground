import type {KirbyNpc} from './npcs';
import {reconcileBugLanding} from './firefly-landing';
import type {ActorState} from './network-protocol';
import {ACTOR_DISTANCE,MIST_DISTANCE} from './visibility';
import { awardFirst } from './score';
import * as T from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { CharacterController, Input } from './controller';
import { constrainToMeadow } from './world-bounds';
import { inWater } from './pond-layout';
import { Firefly } from './firefly';
import { sceneryClearance } from './landmarks';
import { makeFruitMist } from './fruit-mist';
type Bug={carrier:T.Group;firefly:Firefly;home:T.Vector3;halo:T.Sprite;color:T.Color;phase:number;land:boolean;lightPosition:T.Vector3};
export class NightFireflies {
  readonly group=new T.Group();
  readonly lights:T.PointLight[]=[];
  readonly bugs:Bug[]=[];
  private time=0;
  private npcAfter=3;
  private npcRiders=new Map<number,KirbyNpc>();
  private npcCooldown=new Map<KirbyNpc,number>();
  private occupiedByNpc(index:number){const n=this.npcRiders.get(index);return n?.fireflyIndex===index&&!n.approachingFirefly;}
  private rider?:CharacterController;
  private mount?:Bug;
  private altitude=0;
  private moving=false;
  private safeGround=new T.Vector3();
  get riding(){return !!this.rider;}
  get fruitPickupPosition(){return this.rider && this.mount?.land && !this.moving && this.altitude<=.05 ? this.mount.carrier.position : undefined;}
  networkBlocked=new Set<number>();
  private landings=new Map<number,number[]>();
  private pendingLandings=new Map<number,number[]>();
  syncLandings(rows:Record<string,number[]>){
    for(const [key,row] of Object.entries(rows)){
      const i=Number(key),old=this.landings.get(i);if(old&&old[0]===row[0]&&old[3]===row[3])continue;
      this.landings.set(i,row);
      const pending=this.pendingLandings.get(i);
      if(pending&&[1,2,3].every(j=>Math.abs(pending[j]-row[j])<.0011))this.pendingLandings.delete(i);
      const b=this.bugs[i];if(b&&b!==this.mount&&!this.networkBlocked.has(i)&&!this.pendingLandings.has(i))this.applyBugState(b,row);
    }
  }
  private applyBugState(b:Bug,v:number[]){b.home.set(v[1],0,v[2]);b.phase=v[3];b.carrier.position.fromArray(v.slice(4,7));b.carrier.rotation.y=v[7];b.land=!!v[8];b.firefly.object.scale.setScalar(v[9]??.65);b.firefly.setMode(b.land?'Sit':'Fly');}

  networkKey(c:CharacterController){const b=this.mount??this.nearby(c);return b?'bug:'+this.bugs.indexOf(b):undefined;}
  networkState(){return this.bugs.map(b=>[this.time,b.home.x,b.home.z,b.phase,...b.carrier.position.toArray(),b.carrier.rotation.y,Number(b.land),b.firefly.object.scale.x]);}
  networkApply(rows:number[][]){rows.forEach((row,i)=>{const b=this.bugs[i];if(!b||!row||b===this.mount||this.networkBlocked.has(i))return;this.time=row[0];this.applyBugState(b,reconcileBugLanding(row,this.pendingLandings.get(i)??this.landings.get(i)));});}
  private remoteOffsets=new Map<number,T.Vector3>();
  syncRemoteRider(index:number,rider:CharacterController,state:ActorState,dt:number){
    const bug=this.bugs[index],v=state.ride?.data as number[]|undefined;if(!bug||!v||bug===this.mount)return;
    const target=new T.Vector3(v[4]-state.p[0],v[5]-state.p[1],v[6]-state.p[2]);
    let offset=this.remoteOffsets.get(index);if(!offset){offset=target.clone();this.remoteOffsets.set(index,offset);}
    offset.lerp(target,1-Math.exp(-16*dt));
    bug.carrier.position.copy(rider.actor.position).add(offset);bug.carrier.quaternion.copy(rider.actor.quaternion);
    bug.firefly.object.scale.setScalar(T.MathUtils.damp(bug.firefly.object.scale.x,v[9],16,dt));
    bug.land=!!v[8];bug.firefly.setMode(bug.land?'Sit':'Fly');
  }
  outlineBug(c:CharacterController){return !c.flight.active && !c.swimming ? this.nearby(c)?.firefly.object : undefined;}
  private nearby(c:CharacterController){return this.group.visible?this.bugs.filter(b=>!this.networkBlocked.has(this.bugs.indexOf(b)) && !this.occupiedByNpc(this.bugs.indexOf(b)) && b.carrier.position.y<3.6 && Math.abs(c.actor.position.y)<.7 && Math.hypot(c.actor.position.x-b.carrier.position.x,c.actor.position.z-b.carrier.position.z)<4+c.actor.scale.x).sort((a,b)=>a.carrier.position.distanceToSquared(c.actor.position)-b.carrier.position.distanceToSquared(c.actor.position))[0]:undefined;}
  prompt(c:CharacterController){return this.riding?'E — слезть со светлячка':this.nearby(c)?'E — прокатиться на светлячке':'';}
  board(c:CharacterController){
    if(this.riding || c.flight.active || c.swimming)return false;
    const bug=this.nearby(c);if(!bug)return false;
    this.pendingLandings.delete(this.bugs.indexOf(bug));
    this.rider=c;this.mount=bug;this.safeGround.copy(c.actor.position);this.altitude=0;this.moving=false;
    c.setActivity('FireflyRide');c.swimming=false;c.surfaceY=0;return true;
  }
  savePosition(c:CharacterController|KirbyNpc){if(this.rider===c)return this.safeGround.clone();for(const [i,n] of this.npcRiders)if(n===c)return this.bugs[i].home.clone();return undefined;}
  prepareNpcs(npcs:readonly KirbyNpc[],authority:boolean,dt:number,focus?:T.Vector3){
    for(const [n,remaining] of this.npcCooldown){if(remaining<=dt)this.npcCooldown.delete(n);else this.npcCooldown.set(n,remaining-dt);}
    // Observe completed rides on guests too, so a new host retains the cooldown.
    for(const [i,n] of this.npcRiders)if(n.fireflyIndex!==i)this.npcCooldown.set(n,30);
    this.npcRiders.clear();for(const n of npcs)if(n.fireflyIndex!==undefined&&this.bugs[n.fireflyIndex])this.npcRiders.set(n.fireflyIndex,n);
    if(!authority)return;
    for(const [i,n] of this.npcRiders){if(!n.approachingFirefly)continue;const b=this.bugs[i];
      if(b===this.mount||this.networkBlocked.has(i)||n.fireflyRideTime>45){n.endBalloon();this.npcCooldown.set(n,30);this.npcRiders.delete(i);continue;}
      const delta=b.home.clone().sub(n.actor.position);delta.y=0;const distance=delta.length();
      if(distance<2.5){if(b.land)n.beginFirefly(i);continue;}
      const next=n.actor.position.clone().addScaledVector(delta,Math.min(distance,4*n.actor.scale.x*dt)/distance);
      if(!inWater(next.x,next.z)&&sceneryClearance(next.x,next.z,n.actor.scale.x)){n.actor.position.copy(next);n.yaw=Math.atan2(delta.x,delta.z);n.actor.rotation.y=n.yaw;}
    }
    this.npcAfter-=dt;if(this.npcAfter>0||this.npcRiders.size>=4)return;
    this.npcAfter=4+Math.random()*4;
    const candidates:{n:KirbyNpc;i:number;cost:number}[]=[];
    for(let i=0;i<this.bugs.length;i++){
      const b=this.bugs[i];if(b===this.mount||this.networkBlocked.has(i)||this.npcRiders.has(i))continue;
      for(const n of npcs){const distance=n.actor.position.distanceTo(b.home);if(this.npcCooldown.has(n)||!n.canBoardBalloon||n.actor.position.y>.1||distance>80)continue;
        let clear=true;for(let j=1;j<=12;j++){const p=n.actor.position.clone().lerp(b.home,j/12);if(inWater(p.x,p.z)||!sceneryClearance(p.x,p.z,n.actor.scale.x)){clear=false;break;}}
        if(clear)candidates.push({n,i,cost:distance+(focus?b.home.distanceTo(focus)*.25:0)});
      }
    }
    candidates.sort((a,b)=>a.cost-b.cost);const pick=candidates[0];
    if(pick){const b=this.bugs[pick.i];if(b.land&&pick.n.actor.position.distanceTo(b.carrier.position)<3)pick.n.beginFirefly(pick.i);else pick.n.beginFireflyApproach(pick.i);this.npcRiders.set(pick.i,pick.n);}
  }

  syncNpcRiders(npcs:readonly KirbyNpc[],authority:boolean,dt:number){
    for(const n of npcs){const i=n.fireflyIndex;if(i===undefined||n.approachingFirefly)continue;const b=this.bugs[i];if(!b)continue;
      if(authority){
        // Human riders always have priority, including a simultaneous online claim.
        if(b===this.mount||this.networkBlocked.has(i)||(n.fireflyRideTime>12&&b.land)){
          n.actor.position.copy(b.home);n.actor.position.y=0;n.endBalloon();this.npcCooldown.set(n,30);this.npcRiders.delete(i);continue;
        }
        const target=b.carrier.position.clone();target.y+=b.firefly.object.scale.x*.95;
        if(!b.land&&n.fireflyRideTime>2)awardFirst(n,'firefly');
        n.actor.position.lerp(target,1-Math.exp(-8*dt));n.yaw=b.carrier.rotation.y;n.actor.rotation.set(0,n.yaw,0);
      }else if(b!==this.mount&&!this.networkBlocked.has(i)){
        // Use the same interpolated NPC position for the mount, avoiding independent jitter.
        b.firefly.object.scale.setScalar(n.actor.scale.x*1.8);b.carrier.position.copy(n.actor.position);b.carrier.position.y=Math.max(0,b.carrier.position.y-b.firefly.object.scale.x*.95);b.carrier.rotation.y=n.yaw;
      }
      n.poseFirefly();
    }
  }
  disembark(){
    const c=this.rider,bug=this.mount;if(!c||!bug)return;
    const landing=bug.carrier.position.clone();landing.y=0;
    const position=c.actor.position.clone();position.y=0;
    if(inWater(position.x,position.z)||!sceneryClearance(position.x,position.z,c.actor.scale.x))position.copy(this.safeGround);
    c.actor.position.copy(position);c.actor.rotation.set(0,c.yaw,0);c.surfaceY=0;c.setActivity('Idle');
    bug.home.copy(landing);bug.phase=25-this.time;bug.carrier.position.copy(landing);bug.land=true;bug.firefly.setMode('Sit');
    const index=this.bugs.indexOf(bug);this.pendingLandings.set(index,this.networkState()[index]);
    this.rider=undefined;this.mount=undefined;this.moving=false;
  }
  moveRider(dt:number,input:Input){
    const c=this.rider;if(!c)return;
    // Keep growth and controller timers alive without playing a walking animation.
    c.state='Idle';c.update(dt,{forward:false,left:false,right:false});c.state='FireflyRide';
    c.yaw+=(input.steer??(Number(input.left)-Number(input.right)))*Math.PI*.55*dt;c.actor.rotation.set(0,c.yaw,0);
    const direction=Number(input.forward)-Number(!!input.backward);this.moving=direction!==0;
    const speed=(direction>0?c.speed*(input.sprint?2:1):c.backwardSpeed)*2;
    c.actor.position.x+=Math.sin(c.yaw)*speed*direction*dt;c.actor.position.z+=Math.cos(c.yaw)*speed*direction*dt;
    constrainToMeadow(c.actor.position,c.actor.scale.x*2);
  }
  syncRider(dt:number){
    const c=this.rider,bug=this.mount;if(!c||!bug)return;
    if(!inWater(c.actor.position.x,c.actor.position.z)&&sceneryClearance(c.actor.position.x,c.actor.position.z,c.actor.scale.x))this.safeGround.set(c.actor.position.x,0,c.actor.position.z);
    const overWater=inWater(c.actor.position.x,c.actor.position.z),target=this.moving?2.4*c.actor.scale.x:overWater?.5:0;
    this.altitude=T.MathUtils.damp(this.altitude,target,4,dt);if(this.altitude<.015)this.altitude=0;
    if(this.moving && this.altitude>.15)awardFirst(c,'firefly');
    bug.carrier.position.set(c.actor.position.x,this.altitude,c.actor.position.z);bug.carrier.rotation.y=c.yaw;
    const flying=this.moving||this.altitude>.05;bug.land=!flying;bug.firefly.setMode(flying?'Fly':'Sit');
    bug.firefly.object.scale.setScalar(T.MathUtils.damp(bug.firefly.object.scale.x,c.actor.scale.x*1.8,5,dt));
    const seatHeight=bug.firefly.object.scale.x*.95;
    c.actor.position.y=T.MathUtils.damp(c.actor.position.y,this.altitude+seatHeight,12,dt);
    for(const side of ['Left','Right']){
      const foot=c.actor.getObjectByName(`${side}_foot_pivot`),arm=c.actor.getObjectByName(`${side}_shoulder`);
      if(foot)foot.rotation.x=-.85;if(arm){arm.rotation.x=-.45;arm.rotation.z=(side==='Left'?-1:1)*.25;}
    }
  }
  constructor(gltf:GLTF){
    this.group.name='Forty meadow fireflies';
    for(let i=0;i<40;i++){
      const object=gltf.scene.clone(true);const imported:T.Object3D[]=[];object.traverse(o=>{if(o instanceof T.PointLight)imported.push(o);});imported.forEach(o=>o.removeFromParent());
      // Spread 39 saturated hues evenly; permute them so nearby bugs contrast.
      const color=i===39?new T.Color('#ffffff'):new T.Color().setHSL(((i*16)%39)/39,1,.5,T.SRGBColorSpace);
      const firefly=new Firefly({...gltf,scene:object},color);
      object.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;});object.scale.setScalar(.65);
      const home=new T.Vector3((i%8-3.5)*54,0,(Math.floor(i/8)-2)*78);
      for(let j=0;j<600;j++){const x=home.x+Math.sin(j*2.399+i)*j*.32,z=home.z+Math.cos(j*2.399+i)*j*.32;if(Math.abs(x)<210 && Math.abs(z)<210 && sceneryClearance(x,z,15)){home.set(x,0,z);break;}}
      const carrier=new T.Group();carrier.add(object);this.group.add(carrier);
      const halo=makeFruitMist(0);halo.material=halo.material.clone();halo.material.color.copy(color);halo.material.opacity=.4;halo.material.blending=T.AdditiveBlending;halo.material.fog=false;halo.scale.set(3.5,3.5,1);carrier.add(halo);
      this.bugs.push({carrier,firefly,home,halo,color,phase:i*1.87,land:true,lightPosition:new T.Vector3()});
    }
    // A fixed light pool avoids forty point lights on every terrain fragment.
    for(let i=0;i<4;i++){const light=new T.PointLight('#ffffff',0,11,2);light.castShadow=false;this.lights.push(light);}
    this.group.visible=false;
  }
  buzzLevel(listener:T.Vector3){
    if(!this.group.visible)return 0;
    let level=this.mount && !this.mount.land ? .7 : 0;
    for(const bug of this.bugs)if(!bug.land)level=Math.max(level,Math.max(0,1-bug.carrier.position.distanceTo(listener)/16)**2);
    return level;
  }
  update(dt:number,night:boolean|number,camera:T.Vector3){
    this.group.visible=true;
    for(const index of this.remoteOffsets.keys())if(!this.networkBlocked.has(index))this.remoteOffsets.delete(index);
    this.time+=dt;
    for(const bug of this.bugs){
      if(bug!==this.mount && !this.networkBlocked.has(this.bugs.indexOf(bug))){
      const passenger=this.npcRiders.get(this.bugs.indexOf(bug));
      bug.firefly.object.scale.setScalar(T.MathUtils.damp(bug.firefly.object.scale.x,passenger&&!passenger.approachingFirefly?passenger.actor.scale.x*1.8:.65,4,dt));
      const cycle=((this.time+bug.phase)%32+32)%32,flying=cycle<23;
      const t=cycle/23,fade=Math.sin(Math.PI*Math.min(1,t));
      const x=flying?Math.sin(t*Math.PI*2)*11:0,z=flying?(1-Math.cos(t*Math.PI*2))*5:0;
      bug.carrier.position.copy(bug.home).add(new T.Vector3(x,flying?Math.max(0,fade)*3.4:0,z));bug.carrier.rotation.y=flying?Math.atan2(Math.cos(t*Math.PI*2),Math.sin(t*Math.PI*2)):bug.phase;
      if(bug.land===flying){bug.firefly.setMode(flying?'Fly':'Sit');bug.land=!flying;}
      }
      const flying=!bug.land;
      const distance=bug.carrier.position.distanceTo(camera);
      bug.halo.visible=distance<=MIST_DISTANCE;
      const visible=bug===this.mount || distance<=ACTOR_DISTANCE;bug.firefly.object.visible=visible;if(visible)bug.firefly.update(dt);
      // Keep the light on the luminous rear end even when the detailed mesh is culled.
      bug.carrier.updateWorldMatrix(true,false);bug.lightPosition.set(0,.5+(flying?.23:0),-.58).multiplyScalar(bug.firefly.object.scale.x/.65).applyMatrix4(bug.carrier.matrixWorld);
      bug.halo.position.set(0,.5+(flying?.23:0),-.58).multiplyScalar(bug.firefly.object.scale.x/.65);bug.halo.scale.setScalar(3.5*bug.firefly.object.scale.x/.65);bug.halo.material.opacity=.325+.075*Math.sin(this.time*2+bug.phase);
    }
    const sources=[...this.bugs].sort((a,b)=>a.lightPosition.distanceToSquared(camera)-b.lightPosition.distanceToSquared(camera));
    this.lights.forEach((light,i)=>{const bug=sources[i];light.position.copy(bug.lightPosition);light.color.copy(bug.color);light.intensity=(4+5*Number(night))*T.MathUtils.clamp(1-light.position.distanceTo(camera)/48,0,1);});
  }
}
