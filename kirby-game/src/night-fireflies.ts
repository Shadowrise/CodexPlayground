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
  private rider?:CharacterController;
  private mount?:Bug;
  private altitude=0;
  private moving=false;
  private safeGround=new T.Vector3();
  get riding(){return !!this.rider;}
  private nearby(c:CharacterController){return this.group.visible?this.bugs.filter(b=>b.carrier.position.y<3.6 && Math.abs(c.actor.position.y)<.7 && Math.hypot(c.actor.position.x-b.carrier.position.x,c.actor.position.z-b.carrier.position.z)<4+c.actor.scale.x).sort((a,b)=>a.carrier.position.distanceToSquared(c.actor.position)-b.carrier.position.distanceToSquared(c.actor.position))[0]:undefined;}
  prompt(c:CharacterController){return this.riding?'E — слезть со светлячка':this.nearby(c)?'E — прокатиться на светлячке':'';}
  board(c:CharacterController){
    if(this.riding || c.flight.active || c.swimming)return false;
    const bug=this.nearby(c);if(!bug)return false;
    this.rider=c;this.mount=bug;this.safeGround.copy(c.actor.position);this.altitude=0;this.moving=false;
    c.setActivity('FireflyRide');c.swimming=false;c.surfaceY=0;return true;
  }
  savePosition(c:CharacterController){return this.rider===c?this.safeGround.clone():undefined;}
  disembark(){
    const c=this.rider,bug=this.mount;if(!c||!bug)return;
    const position=c.actor.position.clone();position.y=0;
    if(inWater(position.x,position.z)||!sceneryClearance(position.x,position.z,c.actor.scale.x))position.copy(this.safeGround);
    c.actor.position.copy(position);c.actor.rotation.set(0,c.yaw,0);c.surfaceY=0;c.setActivity('Idle');
    bug.home.copy(position);bug.phase=25-this.time;bug.carrier.position.copy(position);bug.land=true;bug.firefly.setMode('Sit');
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
      const color=new T.Color().setHSL((i*.618)%1,1,.46),firefly=new Firefly({...gltf,scene:object},color);
      object.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;});object.scale.setScalar(.65);
      const home=new T.Vector3((i%8-3.5)*54,0,(Math.floor(i/8)-2)*78);
      for(let j=0;j<600;j++){const x=home.x+Math.sin(j*2.399+i)*j*.32,z=home.z+Math.cos(j*2.399+i)*j*.32;if(Math.abs(x)<210 && Math.abs(z)<210 && sceneryClearance(x,z,15)){home.set(x,0,z);break;}}
      const carrier=new T.Group();carrier.add(object);this.group.add(carrier);
      const halo=makeFruitMist(0);halo.material=halo.material.clone();halo.material.color.copy(color);halo.material.opacity=.8;halo.material.blending=T.AdditiveBlending;halo.material.fog=false;halo.scale.set(3.5,3.5,1);carrier.add(halo);
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
  update(dt:number,night:boolean,camera:T.Vector3){
    this.group.visible=true;
    this.time+=dt;
    const nearest=[...this.bugs].sort((a,b)=>a.carrier.position.distanceToSquared(camera)-b.carrier.position.distanceToSquared(camera));
    const detailed=new Set(nearest.slice(0,5));
    for(const bug of this.bugs){
      if(bug!==this.mount){
      bug.firefly.object.scale.setScalar(T.MathUtils.damp(bug.firefly.object.scale.x,.65,4,dt));
      const cycle=((this.time+bug.phase)%32+32)%32,flying=cycle<23;
      const t=cycle/23,fade=Math.sin(Math.PI*Math.min(1,t));
      const x=flying?Math.sin(t*Math.PI*2)*11:0,z=flying?(1-Math.cos(t*Math.PI*2))*5:0;
      bug.carrier.position.copy(bug.home).add(new T.Vector3(x,flying?Math.max(0,fade)*3.4:0,z));bug.carrier.rotation.y=flying?Math.atan2(Math.cos(t*Math.PI*2),Math.sin(t*Math.PI*2)):bug.phase;
      if(bug.land===flying){bug.firefly.setMode(flying?'Fly':'Sit');bug.land=!flying;}
      }
      const flying=!bug.land;
      const visible=bug===this.mount || detailed.has(bug)&&bug.carrier.position.distanceTo(camera)<42;bug.firefly.object.visible=visible;if(visible)bug.firefly.update(dt);
      // Keep the light on the luminous rear end even when the detailed mesh is culled.
      bug.carrier.updateWorldMatrix(true,false);bug.lightPosition.set(0,.5+(flying?.23:0),-.58).multiplyScalar(bug.firefly.object.scale.x/.65).applyMatrix4(bug.carrier.matrixWorld);
      bug.halo.position.set(0,.5+(flying?.23:0),-.58).multiplyScalar(bug.firefly.object.scale.x/.65);bug.halo.scale.setScalar(3.5*bug.firefly.object.scale.x/.65);bug.halo.material.opacity=.65+.15*Math.sin(this.time*2+bug.phase);
    }
    const sources=[...this.bugs].sort((a,b)=>a.lightPosition.distanceToSquared(camera)-b.lightPosition.distanceToSquared(camera));
    this.lights.forEach((light,i)=>{const bug=sources[i];light.position.copy(bug.lightPosition);light.color.copy(bug.color);light.intensity=(night?9:4)*T.MathUtils.clamp(1-light.position.distanceTo(camera)/48,0,1);});
  }
}
