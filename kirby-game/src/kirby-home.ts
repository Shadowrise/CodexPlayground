import {drawLocalizedText,localizedCanvasTexture} from './localized-sign';
import {DogHouse} from './dog-house';
import {roofTilePitch,roofTileSpan,roofTileLength} from './roof-tiles';
import {BedQuilt,BED_REST,BED_COVER_FOLD} from './bed-quilt';
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
    const box=new T.BoxGeometry(1,1,1),ball=new T.SphereGeometry(1,20,12),materials=new Map<string,T.MeshStandardMaterial>();
    const part=(color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,round=false,parent=this.group)=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.85}));const mesh=new T.Mesh(round?ball:box,materials.get(color));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;};
    part('#a38d72',0,.1,0,11,.2,10);
    for(let i=0;i<24;i++)part(i%2?'#c89d68':'#b98b57',-4.8+i*.42,.26,0,.39,.12,8.7);
    part('#efd8b1',0,2.7,-4.2,10,5.3,.28);
    for(const x of [-5,5]){part('#efd8b1',x,2.7,-.5,.28,5.3,7.5);for(const z of [-4.2,3.2])part('#976848',x,2.7,z,.3,5.5,.3);}
    part('#a4734d',0,5.4,3.25,10.4,.3,.3);
    this.group.add(this.roof);
    this.roof.name='Kirby home tiled roof';
    for(const side of [-1,1]){
      const backing=part('#a4734d',side*2.75,6.54,-.465,6.27,.08,9.22,false,this.roof);
      backing.rotation.z=-side*Math.atan2(.27,.55);
    }
    for(const side of [-1,1])for(let row=0;row<10;row++)for(let col=0;col<18;col++){
      const tile=part(['#b9516b','#c7687d','#a94764'][(col+row)%3],side*(row+.5)*.55,7.9-row*.27,-4.8+col*.51,roofTileLength(.55,.27,.15,row===0?.55:undefined),.15,roofTileSpan(.51),false,this.roof);tile.rotation.z=-side*roofTilePitch(.55,.27);
    }
    part('#e7bb81',0,8,-.3,.28,.25,9.6,false,this.roof);
    for(const x of [-3,3]){
      const pane=new T.Mesh(box,this.windows);pane.position.set(x,3.2,-4.02);pane.scale.set(1.55,1.6,.08);this.group.add(pane);
      for(const side of [-1,1])part('#8b6a4c',x+side*.84,3.2,-3.96,.12,1.9,.15);
      part('#8b6a4c',x,3.2,-3.94,.07,1.7,.15);part('#8b6a4c',x,3.2,-3.94,1.7,.08,.15);
      part('#ad7456',x,2.23,-3.75,2,.25,.5);
      for(let j=0;j<7;j++)part(j%2?'#e9adbd':'#e4c354',x-.65+j*.22,2.48,-3.75,.16,.2,.16,true);
    }
    // Bed, quilt seams, pillow and rounded wooden posts.
    part('#865d41',0,.48,-.6,3.7,.45,4.6);part('#f5e7ce',0,.83,-.6,3.5,.4,4.4);
    const pillow=part('#fff5df',0,1.23,-1.8,1.35,.2,.57,true);pillow.name='Bed pillow';
    for(const x of [-1.8,1.8])for(const z of [-2.9,1.7]){part('#9c704b',x,.8,z,.14,1.6,.14);part('#d3b376',x,1.65,z,.15,.15,.15,true);}
    part('#966b48',0,1.25,-2.9,3.8,.7,.15);part('#c892a4',0,.34,3,4,.04,1.6);
    part('#b58a58',3.1,.85,-1.8,1.25,1.15,1);part('#f3d590',3.1,1.65,-1.8,.35,.55,.35,true);
    for(let i=0;i<7;i++)part('#c5b593',0,.08,5+i*.7,3.2,.16,.57);
    if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#704f49';ctx.fillRect(0,0,512,128);ctx.fillStyle='#fff0c4';ctx.textAlign='center';ctx.font='bold 45px sans-serif';drawLocalizedText(ctx,'ДОМИК КИРБИ',256,78);const sign=new T.Mesh(new T.PlaneGeometry(4.6,1.15),new T.MeshBasicMaterial({map:localizedCanvasTexture(canvas)}));sign.position.set(0,4.7,3.44);this.group.add(sign);}}
    // Merge repeated decoration into a small number of draws.
    for(const parent of [this.group,this.roof]){const batches=new Map<string,T.Mesh[]>();for(const o of [...parent.children])if(o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial){o.updateMatrix();const key=o.geometry.uuid+o.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key)!.push(o);}for(const list of batches.values()){const mesh=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);list.forEach((m,i)=>{mesh.setMatrixAt(i,m.matrix);parent.remove(m);});mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();parent.add(mesh);}}
    this.group.add(this.quilt);
    this.group.add(this.dogHouse);
  }
  prompt(position:T.Vector3,size=1){return this.active?'E — встать с кровати':position.distanceTo(this.entrance)<6+.6*size && position.y<.6 ? 'E — лечь в кровать':'';}
  private fit(c:CharacterController,amount=1){this.group.scale.setScalar(1);fitRider(c,1,amount);}
  private bed(){const s=this.group.scale.x;return new T.Vector3(HOME_SITE.x,BED_REST.y*s,HOME_SITE.z+BED_REST.z*s);}
  private door(){
    const size=this.sleeper?.actor.scale.x??1,p=new T.Vector3(HOME_SITE.x,0,HOME_SITE.z+Math.max(6,3.9+.6*size));
    // Enlarged Kirby must also clear the neighbouring dog house after waking.
    for(let i=0;i<4;i++)this.constrain(p,size);
    return p;
  }
  start(c:CharacterController){if(this.active || !this.prompt(c.actor.position,c.actor.scale.x) || c.flight.active)return false;this.sleeper=c;this.from.copy(c.actor.position);this.fromRotation.copy(c.actor.quaternion);this.elapsed=0;this.waking=false;c.setActivity('Sleep');this.fit(c,0);return true;}
  savePosition(c:CharacterController){return this.sleeper===c?this.door():undefined;}
  wake(){
    if(!this.sleeper || this.waking)return;
    this.sleeper.state='Wake';this.wakeQuiltLift=this.quiltLift;this.wakeQuiltFold=this.quiltFold;this.wakeScale=riderFit(this.sleeper);this.waking=true;this.elapsed=0;this.from.copy(this.sleeper.actor.position);this.fromRotation.copy(this.sleeper.actor.quaternion);
  }
  private uncover(t:number){
    // Pull the leading edge past the feet first. Lower it only after it clears
    // Kirby; spread it back across the mattress once he has left the bed.
    this.quiltLift=this.wakeQuiltLift*(1-T.MathUtils.smoothstep(t,.32,.5));
    this.quiltFold=T.MathUtils.lerp(this.wakeQuiltFold,1,T.MathUtils.smoothstep(t,0,.32))*(1-T.MathUtils.smoothstep(t,.7,.95));
    this.quilt.setPose(this.quiltLift,this.quiltFold);
  }
  update(dt:number,remoteSleeper?:Pick<CharacterController,'actor'|'state'>){
    this.windows.emissiveIntensity=.12+1.38*(this.nightAmount??Number(this.night));const c=this.sleeper;
    if(!c){
      // Use the existing online actor/bed lock; no new network messages.
      if(remoteSleeper?.state==='Wake'){
        if(!this.remoteWasWaking){this.remoteWakeElapsed=0;this.wakeQuiltLift=this.quiltLift;this.wakeQuiltFold=this.quiltFold;}
        this.remoteWasWaking=true;this.remoteWakeElapsed+=dt;this.uncover(this.remoteWakeElapsed);return;
      }
      this.remoteWasWaking=false;
      const occupied=remoteSleeper?.state==='Sleep'&&remoteSleeper.actor.position.distanceToSquared(this.bed())<.64;
      const target=occupied?1:0,blend=1-Math.exp(-dt*7);
      this.quiltLift=T.MathUtils.lerp(this.quiltLift,target,blend);
      if(Math.abs(this.quiltLift-target)<.001)this.quiltLift=target;
      this.quiltFold=T.MathUtils.lerp(this.quiltFold,target*BED_COVER_FOLD,blend);
      if(Math.abs(this.quiltFold-target*BED_COVER_FOLD)<.001)this.quiltFold=target*BED_COVER_FOLD;
      this.quilt.setPose(this.quiltLift,this.quiltFold);
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
    const cover=T.MathUtils.smoothstep(t,.8,1.55);
    this.quiltLift=cover;
    this.quiltFold=T.MathUtils.smoothstep(t,0,.45)*(1-cover)+BED_COVER_FOLD*cover;
    this.quilt.setPose(this.quiltLift,this.quiltFold);
    this.fit(c,T.MathUtils.smoothstep(t,0,1));
    const bed=this.bed(),sleepRotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),BED_REST.pitch);
    const u=T.MathUtils.smoothstep(t,0,1);c.actor.position.lerpVectors(this.from,bed,u);c.actor.quaternion.slerpQuaternions(this.fromRotation,sleepRotation,u);
    if(t>=1){awardFirst(c,'sleep');for(const side of ['Left','Right']){const eye=c.actor.getObjectByName(`${side}_eyelid_pivot`);if(eye)eye.scale.y=.06;}c.animationRoot.scale.setScalar(1+.008*Math.sin(t*4));}
  }
  constrain(p:T.Vector3,size:number){
    this.dogHouse.constrain(p,.6*size);
    const s=this.group.scale.x,x=p.x-HOME_SITE.x,z=p.z-HOME_SITE.z,r=.6*size,hx=5.3*s,hz0=4.5*s,hz1=3.4*s;
    if(Math.abs(x)<hx+r && z>-hz0-r && z<hz1+r){const ds=[x+hx+r,hx+r-x,z+hz0+r,hz1+r-z],side=ds.indexOf(Math.min(...ds));if(side<2)p.x=HOME_SITE.x+(side===0?-hx-r:hx+r);else p.z=HOME_SITE.z+(side===2?-hz0-r:hz1+r);}
  }
}
