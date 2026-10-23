import * as T from 'three';
import type {KnightBattle} from './meta-knight-battle';
import {crossPairs,crystalPoint} from './meta-knight-star-assault';
import {GALAXIA_GLOW_COLOR} from './meta-knight-blade-glow';

const UP=new T.Vector3(0,1,0),STEPS=32;
export const CRYSTAL_LIGHTNING_SEGMENTS_PER_LINK=STEPS+12;
/** Four thin, branching bolts pinned to the live sword tip and charged crystals. */
export class MetaKnightCrystalLightning{
 readonly group=new T.Group();
 private geometry=new T.CylinderGeometry(1,1,1,5,1);
 private coreMaterial=new T.MeshBasicMaterial({color:new T.Color(GALAXIA_GLOW_COLOR).multiplyScalar(1.6),transparent:true,opacity:.97,depthWrite:false,toneMapped:false});
 private glowMaterial=new T.MeshBasicMaterial({color:GALAXIA_GLOW_COLOR,transparent:true,opacity:.32,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending});
 readonly cores=new T.InstancedMesh(this.geometry,this.coreMaterial,4*CRYSTAL_LIGHTNING_SEGMENTS_PER_LINK);
 private glow=new T.InstancedMesh(this.geometry,this.glowMaterial,4*CRYSTAL_LIGHTNING_SEGMENTS_PER_LINK);
 private direction=new T.Vector3();private side=new T.Vector3();private normal=new T.Vector3();
 private start=new T.Vector3();private end=new T.Vector3();private a=new T.Vector3();private b=new T.Vector3();private delta=new T.Vector3();private position=new T.Vector3();private scale=new T.Vector3();private rotation=new T.Quaternion();private matrix=new T.Matrix4();
 constructor(){
  this.group.name='Meta Knight golden crystal lightning';this.group.visible=false;this.cores.name='Golden crystal lightning cores';this.glow.name='Golden crystal lightning glow';
  for(const mesh of [this.cores,this.glow]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);}
  this.cores.renderOrder=6;this.glow.renderOrder=7;this.group.add(this.cores,this.glow);
 }
 private segment(index:number,a:T.Vector3,b:T.Vector3,width:number){
  this.delta.subVectors(b,a);this.position.copy(a).add(b).multiplyScalar(.5);const length=this.delta.length();this.rotation.setFromUnitVectors(UP,this.delta.normalize());
  this.scale.set(width,length,width);this.matrix.compose(this.position,this.rotation,this.scale);this.cores.setMatrixAt(index,this.matrix);
  this.scale.x=this.scale.z=width*3.5;this.matrix.compose(this.position,this.rotation,this.scale);this.glow.setMatrixAt(index,this.matrix);
 }
 update(s:KnightBattle|undefined,now:number,bladeTip:T.Vector3){
  this.group.visible=!!s&&s.phase===3&&s.stage==='cross-warn';if(!s||!this.group.visible)return;
  const seed=s.id+s.cycle*7919+s.step*719+Math.floor(now/55)*313,noise=(n:number)=>{const v=Math.sin(seed*.01+n*127.1)*43758.5453;return (v-Math.floor(v))*2-1;};let count=0;
  crossPairs(s).flat().forEach((crystal,link)=>{
   this.start.copy(bladeTip);this.end.fromArray(crystalPoint(crystal));this.direction.subVectors(this.end,this.start).normalize();
   this.side.crossVectors(this.direction,Math.abs(this.direction.y)>.95?new T.Vector3(1,0,0):UP).normalize();this.normal.crossVectors(this.direction,this.side).normalize();this.a.copy(this.start);
   for(let i=1;i<=STEPS;i++){
    const t=i/STEPS,envelope=Math.sin(t*Math.PI),n=link*101+i;
    this.b.lerpVectors(this.start,this.end,t).addScaledVector(this.side,noise(n)*.65*envelope).addScaledVector(this.normal,noise(n+43)*.45*envelope);
    if(i===STEPS)this.b.copy(this.end);this.segment(count++,this.a,this.b,.055);this.a.copy(this.b);
   }
   for(let branch=0;branch<3;branch++){
    const step=8+branch*8,t=step/STEPS,envelope=Math.sin(t*Math.PI),n=link*101+step,sign=noise(link*51+branch)>0?1:-1;
    this.a.lerpVectors(this.start,this.end,t).addScaledVector(this.side,noise(n)*.65*envelope).addScaledVector(this.normal,noise(n+43)*.45*envelope);
    for(let i=1;i<=4;i++){
     this.b.copy(this.a).addScaledVector(this.direction,.5).addScaledVector(this.side,sign*(.32+noise(i+branch*7+link*71)*.18)).addScaledVector(this.normal,noise(i+link*31)*.2);
     this.segment(count++,this.a,this.b,.032*(1-i*.12));this.a.copy(this.b);
    }
   }
  });
  this.cores.count=this.glow.count=count;this.cores.instanceMatrix.needsUpdate=this.glow.instanceMatrix.needsUpdate=true;this.glowMaterial.opacity=.26+.08*Math.sin(now*.039)**2;
 }
 dispose(){this.group.removeFromParent();this.cores.dispose();this.glow.dispose();this.geometry.dispose();this.coreMaterial.dispose();this.glowMaterial.dispose();}
}
