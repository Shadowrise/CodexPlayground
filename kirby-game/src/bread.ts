import * as T from 'three';
import {breadCarryScale,breadPosition,newBread,type BreadState} from './bread-state';
import {softMist,softMistMaterial} from './soft-mist';

function sparkleTexture(){
 const size=64,pixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(x+.5-size/2)/(size/2),dy=(y+.5-size/2)/(size/2),r=Math.hypot(dx,dy);
  const glow=Math.exp(-r*r*6)*Math.max(0,1-r);
  const rays=Math.exp(-Math.min(Math.abs(dx),Math.abs(dy))*35)*Math.max(0,1-r);
  const i=(y*size+x)*4;pixels.set([255,220,112,Math.round(Math.min(1,glow*.8+rays)*255)],i);
 }
 const map=new T.DataTexture(pixels,size,size);map.colorSpace=T.SRGBColorSpace;map.needsUpdate=true;return map;
}

/** One shared loaf, animated in world space so it never belongs to a disposable rig. */
export class BreadWorld{
 readonly group=new T.Group();
 readonly loaf=new T.Group();
 readonly aura=new T.Group();
 state:BreadState=newBread();
 private sparkles:T.Points;
 private mist:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;
 private halfThickness=.15;
 private scratch=new T.Vector3();
 constructor(){
  this.group.name='Golden mountain bread';this.loaf.name='Carryable white bread slice';this.aura.name='Golden bread aura';this.group.add(this.loaf,this.aura);
  this.mist=softMist(softMistMaterial('#f2c653',.4));this.mist.name='Golden bread volume mist';this.aura.add(this.mist);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(48*3),3));
  this.sparkles=new T.Points(geometry,new T.PointsMaterial({map:sparkleTexture(),color:'#fff0a4',size:.28,transparent:true,opacity:1,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
  this.sparkles.frustumCulled=false;this.aura.add(this.sparkles);this.update(0,new Map());
 }
 setModel(source:T.Object3D){
  const bounds=new T.Box3().setFromObject(source),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),factor=1.55/size.y;
  const normalized=new T.Group();normalized.name='Textured Tiny Treats bread';source.position.sub(center);normalized.add(source);normalized.scale.setScalar(factor);
  source.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=o.receiveShadow=true;});
  this.halfThickness=size.z*factor/2;this.loaf.clear();this.loaf.add(normalized);
 }
 reset(state?:BreadState){this.state=state?structuredClone(state):newBread();}
 holds(id:string){return this.state.owner===id;}
 update(now:number,actors:ReadonlyMap<string,T.Object3D>){
  const b=this.state,owner=actors.get(b.owner),seconds=now/1000;
  const held=!!b.owner,scale=owner?breadCarryScale(owner.scale.x):b.scale;
  this.loaf.visible=!held||!!owner;this.aura.visible=this.loaf.visible&&!b.offering;this.loaf.scale.setScalar(scale);
  if(owner){
   // The sword stays in the right fist; the free gauntlet carries the loaf.
   const knightHand=owner.getObjectByName('Left_hand_attachment');
   const shoulder=owner.getObjectByName(knightHand?'Left_shoulder':'Right_shoulder'),wing=owner.getObjectByName('Right_wing');
   if(shoulder)shoulder.rotation.set(-.38,-.3,.24);else if(wing)wing.rotation.set(-.9,-.25,.85);
   owner.updateWorldMatrix(true,true);
   const arm=owner.getObjectByName('Right_arm') as T.Mesh|undefined;
   if(knightHand){knightHand.getWorldPosition(this.scratch);}
   else if(arm?.geometry){
    if(!arm.geometry.boundingBox)arm.geometry.computeBoundingBox();const bounds=arm.geometry.boundingBox!;bounds.getCenter(this.scratch);this.scratch.x=bounds.max.x-.06;arm.localToWorld(this.scratch);
   }else if(wing){
    const vane=owner.getObjectByName('Right_wing_vane');let feather:T.Mesh|undefined;vane?.traverse(o=>{if(!feather&&o instanceof T.Mesh)feather=o;});
    if(feather){if(!feather.geometry.boundingBox)feather.geometry.computeBoundingBox();const bounds=feather.geometry.boundingBox!;bounds.getCenter(this.scratch);this.scratch.y=bounds.min.y+.08;feather.localToWorld(this.scratch);}
    else{this.scratch.set(.2,-.4,.2);wing.localToWorld(this.scratch);}
   }
   else this.scratch.set(1.3*owner.scale.x,.9*owner.scale.x,.25*owner.scale.x).applyQuaternion(owner.quaternion).add(owner.position);
   this.loaf.position.copy(this.scratch).add(new T.Vector3(.18*scale,.42*scale,.16*scale).applyQuaternion(owner.quaternion));this.loaf.quaternion.copy(owner.quaternion);
  }else{
   this.loaf.position.fromArray(breadPosition(b,now));this.loaf.position.y+=this.halfThickness*scale;this.loaf.rotation.set(-Math.PI/2,0,b.yaw);
  }
  this.aura.position.copy(this.loaf.position);this.aura.scale.setScalar(scale*(held?.6:1));
  const swell=1+Math.sin(seconds*.7)*.035,mistY=held?0:.65,mistHeight=held?2.2:1.65;
  this.mist.position.set(Math.sin(seconds*.7)*.03,mistY,0);this.mist.scale.set(2.2*swell,mistHeight*swell,2.2*swell);this.mist.material.opacity=.4+Math.sin(seconds*1.4)*.025;
  const positions=this.sparkles.geometry.getAttribute('position') as T.BufferAttribute;
  for(let i=0;i<positions.count;i++){
   const t=(seconds*(.16+i%5*.013)+i/positions.count)%1,angle=i*2.399+seconds*.32,y=(t-.5)*1.5;
   const radius=Math.sqrt(1-y*y)*(.3+(i%7)/12)*2.2;
   positions.setXYZ(i,Math.cos(angle)*radius,mistY+y*mistHeight,Math.sin(angle)*radius);
  }
  positions.needsUpdate=true;
 }
}
