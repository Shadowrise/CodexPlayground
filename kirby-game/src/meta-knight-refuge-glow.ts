import * as T from 'three';
import {makeFruitMist} from './fruit-mist';

/** The labyrinth blessing's gold body, soft aura and 28 orbiting glints, without its speed power. */
export class MetaKnightRefugeGlow{
 readonly group=new T.Group();
 private originals=new Map<T.MeshStandardMaterial|T.MeshLambertMaterial,{color:T.Color;intensity:number}>();
 private sparks=new T.InstancedMesh(new T.OctahedronGeometry(.07),new T.MeshBasicMaterial({color:'#fff0a2'}),28);
 private mist=makeFruitMist(0);private dummy=new T.Object3D();private active=false;
 constructor(actor:T.Object3D){
  this.group.name='Golden refuge safety blessing';this.group.visible=false;
  actor.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if((m instanceof T.MeshStandardMaterial||m instanceof T.MeshLambertMaterial)&&!this.originals.has(m))this.originals.set(m,{color:m.emissive.clone(),intensity:m.emissiveIntensity});});
  this.mist.material=this.mist.material.clone();this.mist.material.color.set('#ffe6a1');this.mist.material.opacity=.22;this.mist.position.y=1;this.mist.scale.set(3.8,4,1);
  this.sparks.frustumCulled=false;this.group.add(this.mist,this.sparks);actor.add(this.group);
 }
 update(now:number,safe:boolean){
  this.group.visible=safe;
  if(!safe){if(this.active)for(const [m,original] of this.originals){m.emissive.copy(original.color);m.emissiveIntensity=original.intensity;}this.active=false;return;}
  const clock=now/1000;this.active=true;
  for(const m of this.originals.keys()){m.emissive.set('#ffbe4a');m.emissiveIntensity=.25+.07*Math.sin(clock*2);}
  for(let i=0;i<28;i++){const a=i*2.399+clock*.7,t=(clock*.35+i/28)%1;this.dummy.position.set(Math.cos(a)*(1.05+.25*Math.sin(i)),.1+t*2.5,Math.sin(a)*(1.05+.25*Math.sin(i)));this.dummy.rotation.set(clock,i,a);this.dummy.scale.setScalar(Math.sin(t*Math.PI)*(.7+.4*Math.sin(clock*3+i)**2));this.dummy.updateMatrix();this.sparks.setMatrixAt(i,this.dummy.matrix);}this.sparks.instanceMatrix.needsUpdate=true;
 }
 dispose(){this.update(0,false);this.group.removeFromParent();this.mist.material.dispose();this.sparks.geometry.dispose();this.sparks.material.dispose();this.sparks.dispose();this.originals.clear();}
}
