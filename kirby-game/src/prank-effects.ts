import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {Prank} from './pranks';
export type PrankTarget={actor:T.Object3D;root:T.Object3D;grounded:boolean};
export type PrankSound='hiccup'|'step'|'unbox'|'quack';
type Stamp={p:T.Vector3;q:T.Quaternion;at:number;color:T.Color;scale:number};
type Effect={event:Prank;group:T.Group;parts:T.Object3D[];lastSound:number;lastPosition?:T.Vector3;stamps:Stamp[];step:number};
const rainbow=[0xff597b,0xffa347,0xffe96a,0x75ec98,0x62ddff,0x7484ff,0xda7aff];
const smooth=(t:number)=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
const mat=(color:number,roughness=.32)=>new T.MeshStandardMaterial({color,roughness,metalness:.08});
function ball(parent:T.Object3D,material:T.Material,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){const m=new T.Mesh(new T.SphereGeometry(1,20,12),material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
function box(parent:T.Object3D,material:T.Material,x:number,y:number,z:number,w:number,h:number,d:number,r=.08){const m=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,r),material);m.position.set(x,y,z);parent.add(m);return m;}
function tube(parent:T.Object3D,points:T.Vector3[],radius:number,material:T.Material){const mesh=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,radius,5,false),material);parent.add(mesh);return mesh;}
function dispose(group:T.Group){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();group.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof T.InstancedMesh)o.dispose();}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.removeFromParent();}
function bubbles(){
 const group=new T.Group();group.name='Veterok iridescent hiccup bubbles';
 const sphere=new T.SphereGeometry(1,24,16),arc=new T.TorusGeometry(.82,.032,5,22,1.1);
 for(let i=0;i<12;i++){const b=new T.Group(),color=rainbow[i%7];const shell=new T.Mesh(sphere,new T.MeshPhysicalMaterial({color,roughness:.1,metalness:.05,clearcoat:1,iridescence:1,iridescenceIOR:1.3,transparent:true,opacity:.32,depthWrite:false}));b.add(shell);
  const shine=new T.Mesh(arc,new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.8,depthWrite:false}));shine.position.z=.54;shine.rotation.z=.65;b.add(shine);
  const rim=new T.Mesh(new T.TorusGeometry(.97,.016,4,32),new T.MeshBasicMaterial({color,transparent:true,opacity:.6,depthWrite:false}));b.add(rim);group.add(b);
 }return group;
}
function footprints(){
 const shape=new T.Shape();shape.moveTo(-.14,-.27);shape.bezierCurveTo(-.31,-.15,-.3,.23,-.16,.34);shape.bezierCurveTo(.02,.49,.26,.29,.22,.09);shape.bezierCurveTo(.13,-.08,.18,-.3,-.02,-.32);shape.closePath();
 const toes=Array.from({length:3},(_,i)=>{const toe=new T.Shape();toe.absellipse(-.15+i*.145,.48-Math.abs(i-1)*.045,.055,.075,0,Math.PI*2,false,0);return toe;});
 const geometry=new T.ShapeGeometry([shape,...toes],16);geometry.rotateX(-Math.PI/2);geometry.rotateY(Math.PI);
 const mesh=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.78,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),36);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;const group=new T.Group();group.name='Veterok rainbow footprints';group.add(mesh);return group;
}
function gift(){
 const group=new T.Group();group.name='Veterok parachute surprise';
 const present=new T.Group();group.add(present);
 const pink=mat(0xf766aa),ribbon=mat(0xffdf79,.22),inner=mat(0x863e75),white=mat(0xfff6df),gold=mat(0xffb53b);
 // Open box with thick walls and contrasting lining, rather than a solid cube.
 box(present,pink,0,.08,0,1.65,.16,1.5);box(present,inner,0,.18,0,1.43,.08,1.28);
 for(const x of [-.77,.77])box(present,pink,x,.53,0,.14,.95,1.5);
 for(const z of [-.695,.695]){box(present,pink,0,.53,z,1.5,.95,.14);box(present,ribbon,0,.53,z*1.015,.22,.95,.04,.015);}
 for(const x of [-.79,.79])box(present,ribbon,x,.53,0,.035,.95,.23,.012);
 for(let i=0;i<10;i++)ball(present,white,(i%5-2)*.29,.3+Math.floor(i/5)*.37,.774,.045,.045,.009);
 const lid=new T.Group();lid.position.y=1.05;present.add(lid);box(lid,pink,0,0,0,1.78,.21,1.63);box(lid,ribbon,0,.12,0,.24,.028,1.64,.01);box(lid,ribbon,0,.13,0,1.79,.028,.24,.01);
 for(const side of [-1,1])tube(lid,[new T.Vector3(0,.22,0),new T.Vector3(side*.35,.54,0),new T.Vector3(side*.58,.35,0),new T.Vector3(0,.22,0)],.055,ribbon);
 ball(lid,ribbon,0,.22,0,.12,.1,.12);
 const tag=box(present,white,.45,.75,.8,.36,.25,.025,.04);tag.rotation.z=-.18;
 // Embossed breeze emblem on the parcel tag.
 tube(present,[new T.Vector3(.32,.76,.83),new T.Vector3(.49,.76,.83),new T.Vector3(.55,.82,.83)],.013,gold);
 const chute=new T.Group();present.add(chute);chute.position.y=3.1;
 for(let i=0;i<7;i++){const panel=new T.Mesh(new T.SphereGeometry(1,10,8,i*Math.PI*2/7,Math.PI*2/7,0,Math.PI/2),new T.MeshStandardMaterial({color:rainbow[i],roughness:.7,side:T.DoubleSide}));panel.scale.set(1.45,.8,1.45);chute.add(panel);const a=i*Math.PI*2/7;const x=Math.cos(a)*1.4,z=Math.sin(a)*1.4;tube(chute,[new T.Vector3(x,0,z),new T.Vector3(x*.6,-1.1,z*.6),new T.Vector3(x*.45,-2,z*.45)],.012,white);}
 const duck=new T.Group();present.add(duck);duck.visible=false;
 const yellow=mat(0xffdc36,.22),orange=mat(0xff8b28,.26),black=mat(0x20283d),blush=mat(0xff9865);
 ball(duck,yellow,0,.4,0,.55,.44,.7);ball(duck,yellow,0,.91,.34,.4,.42,.4);
 ball(duck,orange,0,.81,.71,.27,.105,.23);ball(duck,orange,0,.755,.72,.23,.035,.2);
 for(const side of [-1,1]){ball(duck,black,side*.19,1,.68,.062,.078,.035);ball(duck,white,side*.19-.014,1.023,.711,.018);ball(duck,blush,side*.3,.87,.59,.062,.04,.018);const wing=ball(duck,gold,side*.46,.45,-.03,.16,.25,.4);wing.rotation.z=side*-.28;}
 ball(duck,yellow,0,.5,-.61,.18,.27,.23).rotation.x=-.5;ball(duck,yellow,.05,1.29,.32,.085,.18,.085).rotation.z=-.4;
 const halo=new T.Mesh(new T.TorusGeometry(.83,.026,6,48),new T.MeshBasicMaterial({color:0xffe8a1,transparent:true,opacity:.65,depthWrite:false}));halo.rotation.x=Math.PI/2;duck.add(halo);
 const confetti=new T.InstancedMesh(new T.PlaneGeometry(.09,.18),new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide,transparent:true,opacity:.9,depthWrite:false}),56);confetti.frustumCulled=false;present.add(confetti);confetti.visible=false;
 group.userData={present,lid,chute,duck,confetti};return group;
}
/** All motion is client-side, based on shared event time and interpolated actors. */
export class PrankEffects{
 readonly group=new T.Group();private effects=new Map<string,Effect>();
 private restores:{root:T.Object3D;p:T.Vector3;s:T.Vector3}[]=[];
 constructor(private sound:(kind:PrankSound,gain:number)=>void){}
 beginFrame(){for(const r of this.restores){r.root.position.copy(r.p);r.root.scale.copy(r.s);}this.restores=[];}
 update(events:readonly Prank[],now:number,resolve:(id:string)=>PrankTarget|undefined,listener:T.Vector3){
  const active=events.filter(e=>now>=e.startsAt&&now<e.endsAt&&resolve(e.playerId));const ids=new Set(active.map(e=>e.id));
  for(const [id,e] of this.effects)if(!ids.has(id)){dispose(e.group);this.effects.delete(id);}
  for(const event of active){const target=resolve(event.playerId)!;let e=this.effects.get(event.id);const t=(now-event.startsAt)/1000;
   if(!e){const group=event.kind==='hiccup'?bubbles():event.kind==='rainbow'?footprints():gift();e={event,group,parts:[...group.children],lastSound:Math.floor(t/(event.kind==='hiccup'?2:1))-1,stamps:[],step:0};this.effects.set(event.id,e);this.group.add(group);if(event.kind==='gift'){group.position.fromArray(event.p);group.position.x+=2.5*event.scale;group.scale.setScalar(event.scale);}}
   const distance=(event.kind==='gift'?e.group.position:target.actor.position).distanceTo(listener);e.group.visible=distance<100;if(distance>=100)continue;
   const gain=Math.max(0,1-distance/38),remaining=(event.endsAt-now)/1000;
   if(event.kind==='hiccup'){
    const phase=t%2,pulse=Math.exp(-phase*13)*Math.sin(Math.min(1,phase/.18)*Math.PI),root=target.root;
    this.restores.push({root,p:root.position.clone(),s:root.scale.clone()});root.position.y+=pulse*.12;root.scale.multiply(new T.Vector3(1+pulse*.07,1-pulse*.055,1+pulse*.07));
    e.group.position.copy(target.actor.position);e.group.quaternion.copy(target.actor.quaternion);e.group.scale.copy(target.actor.scale);
    for(let i=0;i<12;i++){const b=e.parts[i],age=phase-i*.065;b.visible=age>=0&&age<1.75;if(!b.visible)continue;const radius=(.1+(i%4)*.037)*Math.min(1,age*8)*smooth(Math.min(remaining,1.75-age)*4);b.scale.setScalar(radius);b.position.set(Math.sin(i*2.4+age)*(.18+age*.42),1.18+age*(.75+(i%3)*.12),.92+age*.45);b.rotation.z=age*.3+i;}
    const beat=Math.floor(t/2);if(beat>e.lastSound){e.lastSound=beat;if(phase<.2)this.sound('hiccup',gain*.55);}
   }else if(event.kind==='rainbow'){
    const pos=target.actor.position,s=target.actor.scale.x;
    if(!e.lastPosition)e.lastPosition=pos.clone();const moved=pos.distanceTo(e.lastPosition);
    if(!target.grounded||moved>8*s)e.lastPosition.copy(pos);
    else if(moved>.48*s){e.lastPosition.copy(pos);const side=e.step++%2?1:-1;const p=new T.Vector3(side*.32*s,.045,0).applyQuaternion(target.actor.quaternion).add(pos);e.stamps.push({p,q:target.actor.quaternion.clone(),at:now,color:new T.Color(rainbow[e.step%7]),scale:s});if(e.step%2===0)this.sound('step',gain*.12);}
    e.stamps=e.stamps.filter(p=>now-p.at<3400).slice(-36);const mesh=e.parts[0] as T.InstancedMesh,object=new T.Object3D();mesh.count=e.stamps.length;
    e.stamps.forEach((stamp,i)=>{const fade=smooth(Math.min((now-stamp.at)/100+.15,(3400-now+stamp.at)/650,remaining/.5));object.position.copy(stamp.p);object.quaternion.copy(stamp.q);object.scale.setScalar(stamp.scale*fade);object.updateMatrix();mesh.setMatrixAt(i,object.matrix);mesh.setColorAt(i,stamp.color);});mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   }else{
    const {present,lid,chute,duck,confetti}=e.group.userData;const land=smooth(t/3),open=smooth((t-3.4)/.8),fade=smooth(remaining/1.2);
    e.group.scale.setScalar(event.scale*fade);present.position.y=(1-land)*6;present.rotation.z=Math.sin(t*2.3)*(1-land)*.1;
    chute.visible=t<4;chute.scale.setScalar(1-smooth((t-3)/1));lid.position.set(open*2.1,1.05+Math.sin(open*Math.PI)*1.8-open*.9,-open*.6);lid.rotation.set(Math.sin(open*Math.PI)*1.6,open*.35,-Math.sin(open*Math.PI)*.8);
    duck.visible=t>3.6;duck.position.y=smooth((t-3.6)/.6)*1.12+Math.max(0,Math.sin((t-4.2)*4))*.18;duck.rotation.y=Math.sin(t*1.8)*.2;duck.rotation.z=Math.sin(t*3)*.06;
    confetti.visible=t>3.6&&t<8;const object=new T.Object3D();for(let i=0;i<56;i++){const age=Math.max(0,t-3.6-i*.004),a=i*2.399;object.position.set(Math.cos(a)*age*(.5+i%5*.18),1.2+age*(2+i%3*.4)-age*age*.95,Math.sin(a)*age*(.5+i%4*.17));object.rotation.set(age*3+i,age*2,i);object.scale.setScalar(Math.max(0,1-age/4));object.updateMatrix();confetti.setMatrixAt(i,object.matrix);confetti.setColorAt(i,new T.Color(rainbow[i%7]));}confetti.instanceMatrix.needsUpdate=true;if(confetti.instanceColor)confetti.instanceColor.needsUpdate=true;
    const beat=t>=4.3?2:t>=3.6?1:0;if(beat>e.lastSound){e.lastSound=beat;if(beat===1&&t<3.9)this.sound('unbox',gain*.55);if(beat===2&&t<4.6)this.sound('quack',gain*.65);}
   }
  }
 }
 dispose(){this.beginFrame();for(const e of this.effects.values())dispose(e.group);this.effects.clear();this.group.removeFromParent();}
}
