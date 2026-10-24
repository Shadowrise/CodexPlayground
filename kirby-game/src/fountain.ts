import {drawLocalizedText,localizedCanvasTexture} from './localized-sign';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {CharacterController} from './controller';
import {awardFirst} from './score';
import {FOUNTAIN_SITE,FOUNTAIN_WATER_Y,inFountain} from './fountain-site';
import {batchRigidMeshes} from './rigid-batch';
import {createWaterSurface,waterPlanarUVs} from './water-surface';

const COLORS=['#ef557e','#f6a044','#f5d75b','#62be91','#54bbd9','#627ed3','#a375d0'];
/** Batched enamel/stone ornament, animated water and instanced droplets; no extra lights. */
export class RainbowFountain {
 readonly group=new T.Group();
 private time=0;
 private bathTime=0;
 private dummy=new T.Object3D();
 private drops:T.InstancedMesh;
 private rings:T.InstancedMesh;
 private petals:T.Group;
 private bubbles:T.InstancedMesh;
 private bathing?:CharacterController;
 private readonly water=createWaterSurface({opacity:.9});
 private readonly flowingWater=createWaterSurface({flow:true,opacity:.72});
 private readonly view=new T.Frustum();
 private readonly viewProjection=new T.Matrix4();
 private readonly bounds=new T.Sphere(new T.Vector3(FOUNTAIN_SITE.x,4,FOUNTAIN_SITE.z),16);
 constructor(){
  this.group.name='Rainbow wishing fountain';this.group.position.set(FOUNTAIN_SITE.x,0,FOUNTAIN_SITE.z);
  const stone=new T.MeshStandardMaterial({color:'#e8d8bb',roughness:.66});
  const gold=new T.MeshStandardMaterial({color:'#dca754',metalness:.5,roughness:.3});
  const enamel=COLORS.map(color=>new T.MeshStandardMaterial({color,roughness:.27,metalness:.16}));
  const pieces:T.Mesh[]=[];
  const mesh=(geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);pieces.push(m);return m;};
  const ring=(radius:number,tube:number,y:number,mat:T.Material)=>{const m=mesh(new T.TorusGeometry(radius,tube,8,96),mat,0,y);m.rotation.x=Math.PI/2;return m;};
  // A low bevelled curb can be walked over from every direction.
  mesh(new T.CylinderGeometry(11.2,11.8,.12,96),stone,0,.06);
  mesh(new T.CylinderGeometry(9.6,9.6,.09,96),new T.MeshStandardMaterial({color:'#538b9c',roughness:.32}),0,.14);
  ring(9.65,.22,.23,stone);ring(10.75,.045,.14,gold);ring(11.5,.035,.06,gold);
  // Narrow joints keep neighbouring mosaic tiles from sharing the same top plane.
  const tile=new T.BoxGeometry(.39,.035,.4),bead=new T.SphereGeometry(.1,8,6);
  for(let row=0;row<3;row++)for(let i=0;i<140;i++){
   const a=i/140*Math.PI*2+(row%2)*.023,r=10+row*.43;
   const m=mesh(tile,enamel[(Math.floor(i/20)+row)%7],Math.cos(a)*r,.15,Math.sin(a)*r);m.rotation.y=-a;
  }
  for(let i=0;i<84;i++){const a=i/84*Math.PI*2;mesh(bead,gold,Math.cos(a)*9.66,.43,Math.sin(a)*9.66);}
  // Three sculpted bowls, scalloped rims and coloured petal inlays.
  for(const [level,y,r] of [[0,.3,2.7],[1,2.6,1.95],[2,4.75,1.2]]){
   const points=[new T.Vector2(.55,0),new T.Vector2(.65,.2),new T.Vector2(r*.6,.42),new T.Vector2(r*.93,.78),new T.Vector2(r,.95),new T.Vector2(r*.98,1.06),new T.Vector2(r*.83,.95),new T.Vector2(.4,.55)];
   mesh(new T.LatheGeometry(points,64),stone,0,y);
   ring(r,.07,y+1,gold);
   mesh(new T.CylinderGeometry(.42,.64,2.4,24),enamel[level*2],0,y+1.15);
   const petal=new T.SphereGeometry(1,10,8);
   for(let j=0;j<28;j++){
    const a=j/28*Math.PI*2;
    const m=mesh(petal,enamel[j%7],Math.cos(a)*r*.79,y+.73,Math.sin(a)*r*.79);
    m.scale.set(.13,.32,.25);m.rotation.set(0,-a,.35);
   }
  }
  // Ground rosettes and four lily beds leave broad, unobstructed bathing spaces.
  const leaf=new T.SphereGeometry(1,12,8),stem=new T.CylinderGeometry(.035,.035,.5,6);
  const green=new T.MeshStandardMaterial({color:'#3e9875',roughness:.65});
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6,r=8.4;
   const l=mesh(leaf,green,Math.cos(a)*r,.3,Math.sin(a)*r);l.scale.set(.55,.035,.4);l.rotation.y=a;
   for(let j=0;j<6;j++){const b=j*Math.PI/3,p=mesh(leaf,enamel[(i+2)%7],Math.cos(a)*r+Math.cos(b)*.15,.39,Math.sin(a)*r+Math.sin(b)*.15);p.scale.set(.17,.065,.09);p.rotation.y=-b;}
   mesh(bead,gold,Math.cos(a)*r,.43,Math.sin(a)*r);
  }
  for(let i=0;i<14;i++){
   const a=i*Math.PI/7;
   const nozzle=mesh(stem,gold,Math.cos(a)*2.7,1.22,Math.sin(a)*2.7);nozzle.rotation.z=.5;nozzle.rotation.y=-a;
  }
  const batches=new Map<string,T.Mesh[]>();
  for(const p of pieces){p.updateMatrix();const key=p.geometry.uuid+(p.material as T.Material).uuid;const list=batches.get(key)??[];list.push(p);batches.set(key,list);}
  for(const list of batches.values()){
   const m=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);list.forEach((p,i)=>m.setMatrixAt(i,p.matrix));m.receiveShadow=true;
   // Only substantial stone pieces cast shadows; mosaic/trim cannot produce shimmer.
   m.castShadow=list[0].material===stone;this.group.add(m);
  }
  batchRigidMeshes(this.group);
  const surface=new T.Mesh(waterPlanarUVs(new T.CircleGeometry(9.4,96)),this.water.material);surface.name='Fountain pool water';surface.rotation.x=-Math.PI/2;surface.position.y=FOUNTAIN_WATER_Y;this.group.add(surface);
  for(const [r,y] of [[2.45,1.28],[1.75,3.58],[1.02,5.73]]){const pool=new T.Mesh(waterPlanarUVs(new T.CircleGeometry(r,48)),this.water.material);pool.name='Fountain bowl water';pool.rotation.x=-Math.PI/2;pool.position.y=y;this.group.add(pool);}
  const flow=this.flowingWater.material;
  const streams:T.BufferGeometry[]=[];
  const stream=(points:T.Vector3[],segments:number,radius:number,sides:number)=>{
   const curve=new T.CatmullRomCurve3(points),jet=new T.TubeGeometry(curve,segments,radius,sides,false),uv=jet.getAttribute('uv'),length=curve.getLength();
   // Tube U follows the arc, whereas the shared flow material runs towards -V.
   for(let j=0;j<uv.count;j++){const u=uv.getX(j),v=uv.getY(j);uv.setXY(j,v*Math.PI*radius*2,-u*length);}streams.push(jet);
  };
  for(let i=0;i<14;i++){
   const a=i/14*Math.PI*2,points=Array.from({length:25},(_,j)=>this.jet(i,j/24).clone());
   stream(points,24,.038,5);
   for(const [y,r] of [[3.62,1.95],[5.8,1.2]]){
    const p=Array.from({length:17},(_,j)=>{const t=j/16;return new T.Vector3(Math.cos(a)*(r+.55*t),y-2.2*t*t,Math.sin(a)*(r+.55*t));});
    stream(p,16,.028,4);
   }
  }
  const streamsMesh=new T.Mesh(mergeGeometries(streams),flow);streamsMesh.name='Fountain water arcs';this.group.add(streamsMesh);streams.forEach(g=>g.dispose());
  this.drops=new T.InstancedMesh(new T.SphereGeometry(.055,6,4),new T.MeshStandardMaterial({color:'#b4d8dc',roughness:.42,metalness:0}),168);this.drops.instanceMatrix.setUsage(T.DynamicDrawUsage);this.drops.frustumCulled=false;this.group.add(this.drops);
  this.rings=new T.InstancedMesh(new T.TorusGeometry(1,.022,4,32),new T.MeshBasicMaterial({color:'#a2e1e5',transparent:true,opacity:.34,depthWrite:false}),28);this.rings.frustumCulled=false;this.group.add(this.rings);
  this.petals=new T.Group();this.petals.position.y=6.6;this.group.add(this.petals);
  for(let i=0;i<14;i++){
   const a=i/7*Math.PI*2,m=new T.Mesh(leaf,enamel[i%7]);m.position.set(Math.cos(a)*(i<7?.65:.38),i<7?0:.35,Math.sin(a)*(i<7?.65:.38));m.scale.set(.32,.16,.8);m.rotation.set(-.5,Math.PI/2-a,0);this.petals.add(m);
  }
  const pearl=new T.Mesh(new T.IcosahedronGeometry(.38,1),new T.MeshStandardMaterial({color:'#fff0bd',emissive:'#a97936',emissiveIntensity:.12,metalness:.35,roughness:.18}));pearl.position.y=.35;this.petals.add(pearl);
  batchRigidMeshes(this.petals);
  this.bubbles=new T.InstancedMesh(new T.SphereGeometry(1,10,6),new T.MeshStandardMaterial({color:'white',transparent:true,opacity:.4,roughness:.16,metalness:.2,depthWrite:false}),21);
  for(let i=0;i<21;i++)this.bubbles.setColorAt(i,new T.Color(COLORS[i%7]));
  this.bubbles.frustumCulled=false;this.bubbles.visible=false;this.group.add(this.bubbles);
  if(typeof document!=='undefined'){
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext('2d')!;
   ctx.fillStyle='#235969';ctx.fillRect(0,0,768,160);ctx.strokeStyle='#edc575';ctx.lineWidth=8;ctx.strokeRect(4,4,760,152);ctx.fillStyle='#fff0cf';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 60px sans-serif';drawLocalizedText(ctx,'РАДУЖНЫЙ ФОНТАН',384,80);
   const texture=localizedCanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
   const sign=new T.Mesh(new T.BoxGeometry(5.8,1.2,.18),stone);sign.position.set(0,1.35,12.1);this.group.add(sign);
   const label=new T.Mesh(new T.PlaneGeometry(5.7,1.12),new T.MeshBasicMaterial({map:texture}));label.position.set(0,1.35,12.2);this.group.add(label);
   for(const x of [-2.4,2.4]){const post=new T.Mesh(new T.CylinderGeometry(.09,.12,1.2,8),gold);post.position.set(x,.6,12.1);this.group.add(post);}
  }
  this.update(0,1);
 }
 private readonly jetPoint=new T.Vector3();
 private jet(i:number,t:number){const a=i/14*Math.PI*2,r=2.7+4.8*t;return this.jetPoint.set(Math.cos(a)*r,1.25*(1-t)+.29*t+(i%2?3.6:5.2)*4*t*(1-t),Math.sin(a)*r);}
 bathe(dt:number,c:CharacterController){
  if(!c.swimming||c.flight.active||!inFountain(c.actor.position.x,c.actor.position.z)){this.bathTime=0;this.bathing=undefined;return false;}
  this.bathing=c;
  this.bathTime+=dt;c.shrink(.2*dt);
  if(this.bathTime>=1.2)awardFirst(c,'fountain');
  return true;
 }
 update(dt:number,day:number,camera?:T.Camera){
  this.time+=dt;this.water.phase.value=this.flowingWater.phase.value=this.time;
  this.petals.rotation.y=Math.sin(this.time*.3)*.07;
  let seen=true;
  if(camera){this.viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.view.setFromProjectionMatrix(this.viewProjection);seen=this.view.intersectsSphere(this.bounds);}
  this.drops.visible=this.rings.visible=seen;
  this.bubbles.visible=!!this.bathing&&seen;
  if(!seen)return;
  if(this.bathing){const c=this.bathing,size=c.actor.scale.x;
   for(let i=0;i<21;i++){
    const t=(this.time*.42+i/21)%1,a=i*2.399+this.time*.3,r=size*(.8+.3*t);
    this.dummy.position.set(c.actor.position.x-FOUNTAIN_SITE.x+Math.cos(a)*r,.3+t*2.8*size,c.actor.position.z-FOUNTAIN_SITE.z+Math.sin(a)*r);
    this.dummy.scale.setScalar((.055+i%3*.025)*size*Math.sin(Math.PI*t));this.dummy.rotation.set(0,0,0);this.dummy.updateMatrix();this.bubbles.setMatrixAt(i,this.dummy.matrix);
   }this.bubbles.instanceMatrix.needsUpdate=true;
  }
  for(let i=0;i<168;i++){
   const t=(this.time*.48+(i%12)/12)%1,p=this.jet(Math.floor(i/12),t);
   this.dummy.position.copy(p);this.dummy.rotation.set(this.time+i,i,0);this.dummy.scale.setScalar(.65+.55*Math.sin(Math.PI*t));this.dummy.updateMatrix();this.drops.setMatrixAt(i,this.dummy.matrix);
  }
  for(let i=0;i<28;i++){
   const t=(this.time*.7+i%2*.5)%1,p=this.jet(Math.floor(i/2),1);
   this.dummy.position.set(p.x,.29,p.z);this.dummy.rotation.set(Math.PI/2,0,0);this.dummy.scale.setScalar(.12+t*.6);this.dummy.updateMatrix();this.rings.setMatrixAt(i,this.dummy.matrix);
  }
  this.drops.instanceMatrix.needsUpdate=true;this.rings.instanceMatrix.needsUpdate=true;
 }
}
