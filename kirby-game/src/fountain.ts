import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {CharacterController} from './controller';
import {awardFirst} from './score';
import {FOUNTAIN_SITE,FOUNTAIN_WATER_Y,inFountain} from './fountain-site';

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
 private water:T.ShaderMaterial;
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
  const tile=new T.BoxGeometry(.43,.035,.48),bead=new T.SphereGeometry(.1,8,6);
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
  this.water=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
   uniforms:{time:{value:0},brightness:{value:1}},
   vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec3 p;uniform float time;uniform float brightness;void main(){
    float wave=sin(length(p.xy)*12.-time*2.3)+sin(p.x*5.+p.y*7.+time*1.7);
    float glint=pow(max(0.,wave*.5),8.);
    vec3 c=mix(vec3(.07,.42,.49),vec3(.38,.79,.84),.5+.18*wave)+glint*.24;
    gl_FragColor=vec4(c*brightness,.76);
   }`});
  const surface=new T.Mesh(new T.CircleGeometry(9.4,96),this.water);surface.rotation.x=-Math.PI/2;surface.position.y=FOUNTAIN_WATER_Y;this.group.add(surface);
  for(const [r,y] of [[2.45,1.28],[1.75,3.58],[1.02,5.73]]){const pool=new T.Mesh(new T.CircleGeometry(r,48),this.water);pool.rotation.x=-Math.PI/2;pool.position.y=y;this.group.add(pool);}
  const flow=new T.MeshStandardMaterial({color:'#8ed9e7',transparent:true,opacity:.56,roughness:.21,metalness:.12,depthWrite:false});
  const streams:T.BufferGeometry[]=[];
  for(let i=0;i<14;i++){
   const a=i/14*Math.PI*2,points=Array.from({length:25},(_,j)=>this.jet(i,j/24));
   streams.push(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.038,5,false));
   for(const [y,r] of [[3.62,1.95],[5.8,1.2]]){
    const p=Array.from({length:17},(_,j)=>{const t=j/16;return new T.Vector3(Math.cos(a)*(r+.55*t),y-2.2*t*t,Math.sin(a)*(r+.55*t));});
    streams.push(new T.TubeGeometry(new T.CatmullRomCurve3(p),16,.028,4,false));
   }
  }
  const streamsMesh=new T.Mesh(mergeGeometries(streams),flow);streamsMesh.name='Fountain water arcs';this.group.add(streamsMesh);streams.forEach(g=>g.dispose());
  this.drops=new T.InstancedMesh(new T.SphereGeometry(.055,6,4),new T.MeshStandardMaterial({color:'#c4ebef',roughness:.2,metalness:.1}),168);this.drops.instanceMatrix.setUsage(T.DynamicDrawUsage);this.drops.frustumCulled=false;this.group.add(this.drops);
  this.rings=new T.InstancedMesh(new T.TorusGeometry(1,.022,4,32),new T.MeshBasicMaterial({color:'#a2e1e5',transparent:true,opacity:.34,depthWrite:false}),28);this.rings.frustumCulled=false;this.group.add(this.rings);
  this.petals=new T.Group();this.petals.position.y=6.6;this.group.add(this.petals);
  for(let i=0;i<14;i++){
   const a=i/7*Math.PI*2,m=new T.Mesh(leaf,enamel[i%7]);m.position.set(Math.cos(a)*(i<7?.65:.38),i<7?0:.35,Math.sin(a)*(i<7?.65:.38));m.scale.set(.32,.16,.8);m.rotation.set(-.5,Math.PI/2-a,0);this.petals.add(m);
  }
  const pearl=new T.Mesh(new T.IcosahedronGeometry(.38,1),new T.MeshStandardMaterial({color:'#fff0bd',emissive:'#a97936',emissiveIntensity:.12,metalness:.35,roughness:.18}));pearl.position.y=.35;this.petals.add(pearl);
  this.bubbles=new T.InstancedMesh(new T.SphereGeometry(1,10,6),new T.MeshStandardMaterial({color:'white',transparent:true,opacity:.4,roughness:.16,metalness:.2,depthWrite:false}),21);
  for(let i=0;i<21;i++)this.bubbles.setColorAt(i,new T.Color(COLORS[i%7]));
  this.bubbles.frustumCulled=false;this.bubbles.visible=false;this.group.add(this.bubbles);
  if(typeof document!=='undefined'){
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext('2d')!;
   ctx.fillStyle='#235969';ctx.fillRect(0,0,768,160);ctx.strokeStyle='#edc575';ctx.lineWidth=8;ctx.strokeRect(4,4,760,152);ctx.fillStyle='#fff0cf';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 60px sans-serif';ctx.fillText('РАДУЖНЫЙ ФОНТАН',384,80);
   const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
   const sign=new T.Mesh(new T.BoxGeometry(5.8,1.2,.18),stone);sign.position.set(0,1.35,12.1);this.group.add(sign);
   const label=new T.Mesh(new T.PlaneGeometry(5.7,1.12),new T.MeshBasicMaterial({map:texture}));label.position.set(0,1.35,12.2);this.group.add(label);
   for(const x of [-2.4,2.4]){const post=new T.Mesh(new T.CylinderGeometry(.09,.12,1.2,8),gold);post.position.set(x,.6,12.1);this.group.add(post);}
  }
  this.update(0,1);
 }
 private jet(i:number,t:number){const a=i/14*Math.PI*2,r=2.7+4.8*t;return new T.Vector3(Math.cos(a)*r,1.25*(1-t)+.29*t+(i%2?3.6:5.2)*4*t*(1-t),Math.sin(a)*r);}
 bathe(dt:number,c:CharacterController){
  if(!c.swimming||c.flight.active||!inFountain(c.actor.position.x,c.actor.position.z)){this.bathTime=0;this.bathing=undefined;return false;}
  this.bathing=c;
  this.bathTime+=dt;c.shrink(.2*dt);
  if(this.bathTime>=1.2)awardFirst(c,'fountain');
  return true;
 }
 update(dt:number,day:number){
  this.time+=dt;this.water.uniforms.time.value=this.time;this.water.uniforms.brightness.value=.32+.68*day;
  this.petals.rotation.y=Math.sin(this.time*.3)*.07;
  this.bubbles.visible=!!this.bathing;
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
