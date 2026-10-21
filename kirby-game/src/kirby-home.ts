import {drawLocalizedText,localizedCanvasTexture} from './localized-sign';
import {batchRigidMeshes} from './rigid-batch';
import {DogHouse} from './dog-house';
import {makeHomeModel} from './home-model';
import {BedQuilt,BED_REST,BED_MATTRESS_Y,BED_COVER_FOLD,BED_PIGEON_REST,BED_PIGEON_COVER_FOLD,BED_META_KNIGHT_REST,BED_META_KNIGHT_COVER_FOLD,type BedQuiltProfile} from './bed-quilt';
import {fitRider,restoreRider,riderFit} from './rider-size';
import { awardFirst } from './score';
import * as T from 'three';
import type { CharacterController } from './controller';
import { HOME_SITE } from './home-site';
export class KirbyHome {
  readonly group=new T.Group();
  readonly dogHouse=new DogHouse();
  readonly entrance=new T.Vector3(HOME_SITE.x,0,HOME_SITE.z+6);
  night=false;
  nightAmount?:number;
  private quilt=new BedQuilt();
  private quiltLift=0;
  private quiltFold=0;
  private wakeQuiltLift=0;
  private wakeQuiltFold=0;
  private remoteWakeElapsed=0;
  private remoteWasWaking=false;
  private quiltProfile:BedQuiltProfile='kirby';
  private get coverFold(){return this.quiltProfile==='meta-knight'?BED_META_KNIGHT_COVER_FOLD:this.quiltProfile==='pigeon'?BED_PIGEON_COVER_FOLD:BED_COVER_FOLD;}
  private quiltSize=1;
  private quiltPose(lift:number,fold:number){this.quilt.setPose(lift,fold,this.quiltProfile,this.quiltSize);}
  private waking=false;
  private wakeScale=1;
  private sleeper?:CharacterController;
  private elapsed=0;
  private from=new T.Vector3();
  private fromRotation=new T.Quaternion();
  private roof=new T.Group();
  private windows=new T.MeshStandardMaterial({color:'#ffe0a2',emissive:'#ffc36b',emissiveIntensity:.12});
  get active(){return !!this.sleeper;}
  constructor(){
    this.group.name='Kirby home and bed';this.group.position.set(HOME_SITE.x,0,HOME_SITE.z);
    this.group.add(makeHomeModel(this.windows,this.roof));
    if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#704f49';ctx.fillRect(0,0,512,128);ctx.fillStyle='#fff0c4';ctx.textAlign='center';ctx.font='bold 45px sans-serif';drawLocalizedText(ctx,'ДОМИК КИРБИ',256,78);const sign=new T.Mesh(new T.PlaneGeometry(4.6,1.15),new T.MeshBasicMaterial({map:localizedCanvasTexture(canvas)}));sign.position.set(0,4.7,3.44);this.group.add(sign);}}
    batchRigidMeshes(this.dogHouse);
    this.group.add(this.quilt);
    this.group.add(this.dogHouse);
  }
  prompt(position:T.Vector3,size=1){return this.active?'E — встать с кровати':position.distanceTo(this.entrance)<6+.6*size && position.y<.6 ? 'E — лечь в кровать':'';}
  private fit(c:CharacterController,amount=1){this.group.scale.setScalar(1);fitRider(c,1,amount);}
  private bed(){const s=this.group.scale.x,rest=this.quiltProfile==='meta-knight'?BED_META_KNIGHT_REST:this.quiltProfile==='pigeon'?BED_PIGEON_REST:BED_REST;return new T.Vector3(HOME_SITE.x,(BED_MATTRESS_Y+(rest.y-BED_MATTRESS_Y)*this.quiltSize)*s,HOME_SITE.z+rest.z*s);}
  private door(){
    const size=this.sleeper?.actor.scale.x??1,p=new T.Vector3(HOME_SITE.x,0,HOME_SITE.z+Math.max(6,3.9+.6*size));
    // Enlarged Kirby must also clear the neighbouring dog house after waking.
    for(let i=0;i<4;i++)this.constrain(p,size);
    return p;
  }
  start(c:CharacterController){if(this.active || !this.prompt(c.actor.position,c.actor.scale.x) || c.flight.active)return false;this.sleeper=c;this.quiltProfile=c.isMetaKnight?'meta-knight':c.isPigeon?'pigeon':'kirby';this.quiltSize=Math.min(1,c.actor.scale.x);this.from.copy(c.actor.position);this.fromRotation.copy(c.actor.quaternion);this.elapsed=0;this.waking=false;c.setActivity('Sleep');this.fit(c,0);return true;}
  savePosition(c:CharacterController){return this.sleeper===c?this.door():undefined;}
  wake(){
    if(!this.sleeper || this.waking)return;
    this.sleeper.setActivity('Wake');
    if(this.sleeper.hasNativeAnimations)this.sleeper.actions.get('Wake')!.setEffectiveTimeScale(this.sleeper.actions.get('Wake')!.getClip().duration/.95);
    this.wakeQuiltLift=this.quiltLift;this.wakeQuiltFold=this.quiltFold;this.wakeScale=riderFit(this.sleeper);this.waking=true;this.elapsed=0;this.from.copy(this.sleeper.actor.position);this.fromRotation.copy(this.sleeper.actor.quaternion);
  }
  cancel(){
    if(!this.sleeper)return;
    for(const side of ['Left','Right']){const eye=this.sleeper.actor.getObjectByName(`${side}_eyelid_pivot`);if(eye)eye.scale.y=1;}
    restoreRider(this.sleeper);this.sleeper.setActivity('Idle');this.sleeper=undefined;this.waking=false;
    this.quiltLift=this.quiltFold=0;this.quiltPose(0,0);
  }
  private uncover(t:number){
    // Pull the leading edge past the feet first. Lower it only after it clears
    // Kirby; spread it back across the mattress once he has left the bed.
    this.quiltLift=this.wakeQuiltLift*(1-T.MathUtils.smoothstep(t,.32,.5));
    this.quiltFold=T.MathUtils.lerp(this.wakeQuiltFold,1,T.MathUtils.smoothstep(t,0,.32))*(1-T.MathUtils.smoothstep(t,.7,.95));
    this.quiltPose(this.quiltLift,this.quiltFold);
  }
  update(dt:number,remoteSleeper?:Pick<CharacterController,'actor'|'state'> & Partial<Pick<CharacterController,'isPigeon'|'isMetaKnight'>>){
    this.windows.emissiveIntensity=.12+1.38*(this.nightAmount??Number(this.night));const c=this.sleeper;
    if(!c){
      if(remoteSleeper)this.quiltProfile=remoteSleeper.isMetaKnight?'meta-knight':remoteSleeper.isPigeon?'pigeon':'kirby';
      // Use the existing online actor/bed lock; no new network messages.
      if(remoteSleeper?.state==='Wake'){
        if(!this.remoteWasWaking){this.remoteWakeElapsed=0;this.wakeQuiltLift=this.quiltLift;this.wakeQuiltFold=this.quiltFold;}
        this.remoteWasWaking=true;this.remoteWakeElapsed+=dt;this.uncover(this.remoteWakeElapsed);return;
      }
      this.remoteWasWaking=false;
      if(remoteSleeper?.state==='Sleep')this.quiltSize=Math.min(1,remoteSleeper.actor.scale.x);
      const occupied=remoteSleeper?.state==='Sleep'&&remoteSleeper.actor.position.distanceToSquared(this.bed())<.64;
      const target=occupied?1:0,blend=1-Math.exp(-dt*7);
      this.quiltLift=T.MathUtils.lerp(this.quiltLift,target,blend);
      if(Math.abs(this.quiltLift-target)<.001)this.quiltLift=target;
      this.quiltFold=T.MathUtils.lerp(this.quiltFold,target*this.coverFold,blend);
      if(Math.abs(this.quiltFold-target*this.coverFold)<.001)this.quiltFold=target*this.coverFold;
      this.quiltPose(this.quiltLift,this.quiltFold);
      return;
    }
    this.elapsed+=dt;const t=this.elapsed;c.mixer.update(dt);
    if(this.waking){
      this.uncover(t);
      const u=T.MathUtils.smoothstep(t,.5,.95),door=this.door();
      c.actor.position.lerpVectors(this.from,door,u);
      c.actor.position.y=T.MathUtils.lerp(this.from.y,door.y,T.MathUtils.smoothstep(t,.7,.95));
      c.actor.quaternion.slerpQuaternions(this.fromRotation,new T.Quaternion(),T.MathUtils.smoothstep(t,.32,.55));
      c.animationRoot.parent!.scale.setScalar(T.MathUtils.lerp(this.wakeScale,1,T.MathUtils.smoothstep(t,.7,.95)));c.animationRoot.scale.setScalar(1);
      for(const side of ['Left','Right']){const eye=c.actor.getObjectByName(`${side}_eyelid_pivot`);if(eye)eye.scale.y=1;}
      if(t>=.95){restoreRider(c);this.group.scale.setScalar(1);c.actor.position.copy(this.door());c.yaw=0;c.actor.rotation.set(0,0,0);c.setActivity('Idle');this.sleeper=undefined;}
      return;
    }
    // Fold down during the approach, then pull up over Kirby, leaving his face free.
    this.quiltSize=Math.min(1,c.actor.scale.x);
    const cover=T.MathUtils.smoothstep(t,.8,1.55);
    this.quiltLift=cover;
    this.quiltFold=T.MathUtils.smoothstep(t,0,.45)*(1-cover)+this.coverFold*cover;
    this.quiltPose(this.quiltLift,this.quiltFold);
    this.fit(c,T.MathUtils.smoothstep(t,0,1));
    const bed=this.bed(),sleepRotation=c.isMetaKnight?new T.Quaternion():c.isPigeon?new T.Quaternion().setFromEuler(new T.Euler(0,BED_PIGEON_REST.yaw,0)):new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),BED_REST.pitch);
    const u=T.MathUtils.smoothstep(t,0,1);c.actor.position.lerpVectors(this.from,bed,u);c.actor.quaternion.slerpQuaternions(this.fromRotation,sleepRotation,u);
    if(t>=1){awardFirst(c,'sleep');for(const side of ['Left','Right']){const eye=c.actor.getObjectByName(`${side}_eyelid_pivot`);if(eye)eye.scale.y=.06;}c.animationRoot.scale.setScalar(1+.008*Math.sin(t*4));}
  }
  constrain(p:T.Vector3,size:number){
    this.dogHouse.constrain(p,.6*size);
    const s=this.group.scale.x,x=p.x-HOME_SITE.x,z=p.z-HOME_SITE.z,r=.6*size,hx=5.3*s,hz0=4.5*s,hz1=3.4*s;
    if(Math.abs(x)<hx+r && z>-hz0-r && z<hz1+r){const ds=[x+hx+r,hx+r-x,z+hz0+r,hz1+r-z],side=ds.indexOf(Math.min(...ds));if(side<2)p.x=HOME_SITE.x+(side===0?-hx-r:hx+r);else p.z=HOME_SITE.z+(side===2?-hz0-r:hz1+r);}
  }
}
