import * as T from 'three';
import {softMist,softMistMaterial} from './soft-mist';
export const DASH_SPARK_COUNT=40;

/** Soft luminous vapour and small twinkles, confined to the held blade. */
export class MetaKnightDashSparks{
 readonly group=new T.Group();
 private geometry=new T.OctahedronGeometry(.028);
 private material=new T.MeshBasicMaterial({color:new T.Color().setRGB(2.3,1.9,.95),transparent:true,opacity:.95,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
 private sparks=new T.InstancedMesh(this.geometry,this.material,DASH_SPARK_COUNT);
 private glowMaterial=new T.MeshBasicMaterial({color:0xffd483,transparent:true,opacity:.24,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
 private glow=new T.InstancedMesh(this.geometry,this.glowMaterial,DASH_SPARK_COUNT);
 private mistMaterial=softMistMaterial(new T.Color().setRGB(1.8,1.3,.55),.30);
 private auraMaterial=softMistMaterial(new T.Color().setRGB(1.2,.32,.035),.22);
 private mist=new T.Group();
 private matrix=new T.Matrix4();private position=new T.Vector3();private scale=new T.Vector3();private rotation=new T.Quaternion();
 constructor(blade:T.Object3D){
  this.group.name='Meta Knight flying sword sparks';this.group.visible=false;blade.add(this.group);this.group.add(this.sparks,this.glow);
  this.mist.name='Galaxia soft flying mist';this.group.add(this.mist);
  this.mistMaterial.blending=this.auraMaterial.blending=T.AdditiveBlending;
  for(let i=0;i<8;i++){const puff=softMist(i%4===0?this.auraMaterial:this.mistMaterial);puff.name='Galaxia blade mist '+i;puff.renderOrder=4;this.mist.add(puff);}
  this.sparks.frustumCulled=this.glow.frustumCulled=false;
  for(let i=0;i<DASH_SPARK_COUNT;i++)this.sparks.setColorAt(i,new T.Color(i%5===0?0xffffff:i%3===0?0xffdf91:0xffb85c));
 }
 update(elapsed:number,active:boolean){
  this.group.visible=active;if(!active)return;
  for(let i=0;i<DASH_SPARK_COUNT;i++){
   const age=(elapsed*.0016+i/DASH_SPARK_COUNT)%1,seed=i*2.399,angle=seed+elapsed*.0008;
   const along=.3+i/DASH_SPARK_COUNT*1.65,radius=.23+.16*(.5+.5*Math.sin(seed+elapsed*.0011));
   this.position.set(-.315*along/2.05+Math.cos(angle)*radius,along+.035*Math.sin(angle*1.7),Math.sin(angle)*radius);
   this.scale.set(1,1.3,1).multiplyScalar(Math.sin(Math.PI*age)**2*(.45+.45*Math.sin(seed)**2));
   this.matrix.compose(this.position,this.rotation,this.scale);this.sparks.setMatrixAt(i,this.matrix);
   this.scale.multiplyScalar(4.2);this.matrix.compose(this.position,this.rotation,this.scale);this.glow.setMatrixAt(i,this.matrix);
  }
  this.mist.children.forEach((puff,i)=>{
   const aura=i%4===0,along=aura?.78+i/7: .5+i/7*1.48,phase=elapsed*.0022+i*1.7,breath=.94+.11*Math.sin(phase);
   puff.position.set(-.315*along/2.05+.07*Math.sin(phase),along+.025*Math.cos(phase),.09*Math.sin(phase*.8));
   puff.scale.set((aura?.74:.44+i%3*.04)*breath,(aura?.52:.38)*breath,(aura?.62:.37)*breath);puff.rotation.y=phase*.4;
  });
  this.sparks.instanceMatrix.needsUpdate=this.glow.instanceMatrix.needsUpdate=true;
 }
 dispose(){this.group.removeFromParent();this.sparks.dispose();this.glow.dispose();this.geometry.dispose();this.material.dispose();this.glowMaterial.dispose();this.mistMaterial.dispose();this.auraMaterial.dispose();}
}
