import * as T from 'three';
import type { CharacterController } from './controller';
import { HOME_SITE } from './home-site';
export class KirbyHome {
  readonly group=new T.Group();
  readonly entrance=new T.Vector3(HOME_SITE.x,0,HOME_SITE.z+6);
  night=false;
  blackout=0;
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
    for(const side of [-1,1])for(let row=0;row<10;row++)for(let col=0;col<18;col++){
      const tile=part(['#b9516b','#c7687d','#a94764'][(col+row)%3],side*(row+.5)*.55,7.9-row*.27,-4.8+col*.51,.7,.15,.55,false,this.roof);tile.rotation.z=-side*.46;
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
    part('#869dc4',0,1.02,.1,3.5,.2,2.9);part('#fff5df',0,1.13,-2,2.5,.25,.65,true);
    for(let i=0;i<7;i++)part('#b9c8df',-1.5+i*.5,1.13,.1,.025,.015,2.85);
    for(const x of [-1.8,1.8])for(const z of [-2.9,1.7]){part('#9c704b',x,.8,z,.14,1.6,.14);part('#d3b376',x,1.65,z,.15,.15,.15,true);}
    part('#966b48',0,1.25,-2.9,3.8,.7,.15);part('#c892a4',0,.34,3,4,.04,1.6);
    part('#b58a58',3.1,.85,-1.8,1.25,1.15,1);part('#f3d590',3.1,1.65,-1.8,.35,.55,.35,true);
    for(let i=0;i<7;i++)part('#c5b593',0,.08,5+i*.7,3.2,.16,.57);
    if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#704f49';ctx.fillRect(0,0,512,128);ctx.fillStyle='#fff0c4';ctx.textAlign='center';ctx.font='bold 45px sans-serif';ctx.fillText('ДОМИК КИРБИ',256,78);const sign=new T.Mesh(new T.PlaneGeometry(4.6,1.15),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas)}));sign.position.set(0,4.7,3.44);this.group.add(sign);}}
    // Merge repeated decoration into a small number of draws.
    for(const parent of [this.group,this.roof]){const batches=new Map<string,T.Mesh[]>();for(const o of [...parent.children])if(o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial){o.updateMatrix();const key=o.geometry.uuid+o.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key)!.push(o);}for(const list of batches.values()){const mesh=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);list.forEach((m,i)=>{mesh.setMatrixAt(i,m.matrix);parent.remove(m);});mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();parent.add(mesh);}}
  }
  prompt(position:T.Vector3){return this.active?'Сладких снов…':position.distanceTo(this.entrance)<6 && position.y<.6 ? `E — лечь в кровать · проснуться ${this.night?'днём':'ночью'}`:'';}
  start(c:CharacterController){if(this.active || !this.prompt(c.actor.position) || c.flight.active)return false;this.sleeper=c;this.from.copy(c.actor.position);this.fromRotation.copy(c.actor.quaternion);this.elapsed=0;c.setActivity('Sleep');this.roof.visible=false;return true;}
  savePosition(c:CharacterController){return this.sleeper===c?this.entrance.clone():undefined;}
  update(dt:number){
    this.windows.emissiveIntensity=this.night?1.5:.12;const c=this.sleeper;if(!c)return;
    const before=this.elapsed;this.elapsed+=dt;const t=this.elapsed;
    this.blackout=t<2?T.MathUtils.smoothstep(t,1,2):t<4?1:1-T.MathUtils.smoothstep(t,4,5.3);
    if(before<2.2 && t>=2.2)this.night=!this.night;
    c.mixer.update(dt);const bed=new T.Vector3(HOME_SITE.x,1.1,HOME_SITE.z+.7),sleepRotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2);
    if(t<1){const u=T.MathUtils.smoothstep(t,0,1);c.actor.position.lerpVectors(this.from,bed,u);c.actor.quaternion.slerpQuaternions(this.fromRotation,sleepRotation,u);}
    else if(t<3.2){c.actor.position.copy(bed);c.actor.quaternion.copy(sleepRotation);for(const side of ['Left','Right']){const eye=c.actor.getObjectByName(`${side}_eyelid_pivot`);if(eye)eye.scale.y=.06;}c.animationRoot.scale.setScalar(1+.008*Math.sin(t*4));}
    else {const u=T.MathUtils.smoothstep(t,3.2,4);c.actor.position.lerpVectors(bed,this.entrance,u);c.actor.quaternion.slerpQuaternions(sleepRotation,new T.Quaternion(),u);}
    if(t>=5.3){c.actor.position.copy(this.entrance);c.yaw=0;c.actor.rotation.set(0,0,0);c.setActivity('Idle');this.sleeper=undefined;this.blackout=0;this.roof.visible=true;}
  }
  constrain(p:T.Vector3,size:number){
    const x=p.x-HOME_SITE.x,z=p.z-HOME_SITE.z,r=.6*size;
    if(Math.abs(x)<5.3+r && z>-4.5-r && z<3.4+r){const ds=[x+5.3+r,5.3+r-x,z+4.5+r,3.4+r-z],side=ds.indexOf(Math.min(...ds));if(side<2)p.x=HOME_SITE.x+(side===0?-5.3-r:5.3+r);else p.z=HOME_SITE.z+(side===2?-4.5-r:3.4+r);}
  }
}
