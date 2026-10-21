import * as T from 'three';
import {knightJumpOpening,type KnightBattle} from './meta-knight-battle';

const DURATION=720,UP=new T.Vector3(0,1,0),SEGMENTS=176;
type Bolt={a:T.Vector3;b:T.Vector3;distance:number};
/** Decorative ground arcs, without colliders or encounter mutations. */
export class MetaKnightImpactLightning{
 readonly group=new T.Group();
 private geometry=new T.CylinderGeometry(1,1,1,5,1);
 private coreMaterial=new T.MeshBasicMaterial({color:0xfff6cf,transparent:true,depthWrite:false,toneMapped:false});
 private glowMaterial=new T.MeshBasicMaterial({color:0x9eabff,transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending});
 private core=new T.InstancedMesh(this.geometry,this.coreMaterial,SEGMENTS);
 private glow=new T.InstancedMesh(this.geometry,this.glowMaterial,SEGMENTS);
 private flashMaterial=new T.MeshBasicMaterial({color:0xd4deff,transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending});
 private flash=new T.Mesh(new T.RingGeometry(.4,.7,64),this.flashMaterial);
 private bolts:Bolt[]=[];private key='';private battleId=0;private started=-Infinity;
 private p=new T.Vector3();private direction=new T.Vector3();private scale=new T.Vector3();private rotation=new T.Quaternion();private matrix=new T.Matrix4();
 constructor(){
  this.group.name='Meta Knight decorative sword impact lightning';this.group.visible=false;this.core.name='Sword impact lightning cores';this.glow.name='Sword impact lightning glow';
  this.core.frustumCulled=this.glow.frustumCulled=false;this.core.instanceMatrix.setUsage(T.DynamicDrawUsage);this.glow.instanceMatrix.setUsage(T.DynamicDrawUsage);this.core.renderOrder=5;this.glow.renderOrder=6;
  this.flash.rotation.x=-Math.PI/2;this.flash.position.y=.03;this.group.add(this.core,this.glow,this.flash);
 }
 private build(seed:number){
  const noise=(n:number)=>{const value=Math.sin(seed*.001+n*127.1)*43758.5453;return value-Math.floor(value);};this.bolts=[];
  for(let ray=0;ray<8;ray++){
   const angle=ray*Math.PI/4+(noise(ray)-.5)*.35,length=7+noise(ray+19)*5,points:T.Vector3[]=[new T.Vector3()];
   for(let step=1;step<=12;step++){
    const r=length*step/12,side=(noise(ray*31+step)-.5)*1.1,b=new T.Vector3(Math.sin(angle)*r+Math.cos(angle)*side,.05+noise(ray*37+step)*.24,Math.cos(angle)*r-Math.sin(angle)*side);
    this.bolts.push({a:points[step-1],b,distance:step/12});points.push(b);
   }
   for(const start of [5,8]){
    let a=points[start];const turn=angle+(noise(ray+start*9)>.5?1:-1)*(.45+noise(ray+53)*.5);
    for(let step=1;step<=5;step++){
     const b=a.clone().add(new T.Vector3(Math.sin(turn)*.6+(noise(ray*51+step)-.5)*.4,(noise(ray*61+step)-.5)*.15,Math.cos(turn)*.6));b.y=Math.max(.04,b.y);
     this.bolts.push({a,b,distance:(start+step*.6)/12});a=b;
    }
   }
  }
 }
 update(s:KnightBattle|undefined,now:number,bladeTip:T.Vector3){
  if(!s||s.id!==this.battleId||['cancelled','won','lost'].includes(s.stage)){this.started=-Infinity;this.key='';this.battleId=s?.id??0;}
  const impact=!!s&&(knightJumpOpening(s)||s.stage==='slam'||s.stage==='shield');
  if(impact){const key=`${s!.id}:${s!.since}:${s!.stage}`;if(key!==this.key){this.key=key;this.started=s!.since;this.group.position.set(bladeTip.x,.12,bladeTip.z);this.build(s!.id+s!.since);}}
  const elapsed=now-this.started;this.group.visible=elapsed>=0&&elapsed<DURATION;if(!this.group.visible)return;
  const age=elapsed/DURATION,growth=Math.min(1,elapsed/190),flicker=.72+.28*Math.sin(elapsed*.083)**2;
  this.coreMaterial.opacity=(1-age)**1.3*flicker;this.glowMaterial.opacity=(1-age)**1.6*.38*flicker;this.flashMaterial.opacity=(1-age)**3*.8;this.flash.scale.setScalar(1+age*15);
  let count=0;
  for(const bolt of this.bolts){
   if(bolt.distance>growth)continue;
   this.direction.subVectors(bolt.b,bolt.a);this.p.copy(bolt.a).add(bolt.b).multiplyScalar(.5);const length=this.direction.length();this.direction.normalize();this.rotation.setFromUnitVectors(UP,this.direction);
   const width=.035*(1-age*.6)*(1.15-bolt.distance*.5);this.scale.set(width,length,width);this.matrix.compose(this.p,this.rotation,this.scale);this.core.setMatrixAt(count,this.matrix);
   this.scale.x=this.scale.z=width*4.2;this.matrix.compose(this.p,this.rotation,this.scale);this.glow.setMatrixAt(count,this.matrix);count++;
  }
  this.core.count=this.glow.count=count;this.core.instanceMatrix.needsUpdate=this.glow.instanceMatrix.needsUpdate=true;
 }
 dispose(){this.group.removeFromParent();this.core.dispose();this.glow.dispose();this.geometry.dispose();this.flash.geometry.dispose();this.coreMaterial.dispose();this.glowMaterial.dispose();this.flashMaterial.dispose();}
}
