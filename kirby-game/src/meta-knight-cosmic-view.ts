import * as T from 'three';
import type {KnightBattle} from './meta-knight-battle';
import {COSMIC,cosmicStage,cosmicCombat,cosmicElapsed,cosmicHeight,easeCosmic} from './meta-knight-cosmic';
import {META_KNIGHT_ARENA as SITE} from './meta-knight-arena-site';
import {cosmicRefugeStage} from './meta-knight-cosmic-refuge';
import {GALAXIA_GLOW_COLOR} from './meta-knight-blade-glow';
import {buildCosmicSurface,surfaceEnergy} from './meta-knight-cosmic-electricity';
import {CosmicPlasma} from './meta-knight-cosmic-plasma';

const UP=new T.Vector3(0,1,0),CAPACITY=8192;
const ELECTRIC_GOLD=new T.Color(GALAXIA_GLOW_COLOR),ELECTRIC_CORE=ELECTRIC_GOLD.clone().multiplyScalar(1.6);
const GRAVITY_BLUE=new T.Color('#215cff'),GRAVITY_CORE=new T.Color('#609aff');
const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
/** Finite pooled branching bolts. The hot filament and soft corona share paths. */
export class CosmicLightning{
 readonly group=new T.Group();
 private geometry=new T.PlaneGeometry(2,1);
 readonly hotMaterial=new T.MeshBasicMaterial({color:ELECTRIC_CORE,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false});
 readonly glowMaterial=new T.MeshBasicMaterial({color:GALAXIA_GLOW_COLOR,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false});
 readonly hot=new T.InstancedMesh(this.geometry,this.hotMaterial,CAPACITY);
 readonly glow=new T.InstancedMesh(this.geometry,this.glowMaterial,CAPACITY);
 private a=new T.Vector3();private b=new T.Vector3();private center=new T.Vector3();private delta=new T.Vector3();private scale=new T.Vector3();private rotation=new T.Quaternion();private matrix=new T.Matrix4();private count=0;
 private energy=new T.InstancedBufferAttribute(new Float32Array(CAPACITY),1);
 private seeds=new T.InstancedBufferAttribute(new Float32Array(CAPACITY),1);private clock={value:0};
 constructor(blue=false){
  this.geometry.setAttribute('boltEnergy',this.energy);this.geometry.setAttribute('boltSeed',this.seeds);this.energy.setUsage(T.DynamicDrawUsage);this.seeds.setUsage(T.DynamicDrawUsage);
  for(const material of [this.hotMaterial,this.glowMaterial]){material.customProgramCacheKey=()=>`${blue?'gravity-blue':'cosmic-gold'}-${material===this.hotMaterial?'core':'corona'}-v5`;material.onBeforeCompile=shader=>{
   shader.uniforms.boltClock=this.clock;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float boltEnergy;attribute float boltSeed; varying float vBoltEnergy;varying float vBoltSeed;varying vec2 vBoltUv;varying float vBoltAspect;varying float vBoltAlong;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBoltEnergy=boltEnergy;vBoltSeed=boltSeed;vBoltAlong=uv.y;');
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 boltA=modelViewMatrix*instanceMatrix*vec4(0.,-.5,0.,1.);
    vec4 boltB=modelViewMatrix*instanceMatrix*vec4(0.,.5,0.,1.);
    vec2 tangent=normalize(boltB.xy-boltA.xy+vec2(.00001,0.)),side=vec2(tangent.y,-tangent.x);
    float radius=length((modelViewMatrix*instanceMatrix*vec4(1.,0.,0.,0.)).xyz);
    vBoltAspect=length(boltB.xy-boltA.xy)/max(radius,.00001);vBoltUv=vec2(position.x,(uv.y-.5)*(vBoltAspect+2.6));
    vec4 mvPosition=mix(boltA,boltB,uv.y);mvPosition.xy+=side*position.x*radius+tangent*(uv.y*2.-1.)*radius*1.3;
    gl_Position=projectionMatrix*mvPosition;`);
   const profile=blue?(material===this.hotMaterial?
    `float white=exp(-boltDistance2*12.);diffuseColor.rgb=mix(vec3(.04,.26,1.),vec3(.70,.95,1.),white);diffuseColor.a*=exp(-boltDistance2*5.)*vBoltEnergy;`:
    `diffuseColor.rgb=vec3(.03,.26,1.);diffuseColor.a*=exp(-boltDistance2*6.)*vBoltEnergy;`):material===this.hotMaterial?
    `float white=exp(-boltDistance2*12.);diffuseColor.rgb=mix(vec3(1.,.63,.10),vec3(1.,.98,.83),white);diffuseColor.a*=exp(-boltDistance2*5.)*vBoltEnergy;`:
    `float gold=exp(-boltDistance2*12.);diffuseColor.rgb=mix(vec3(1.,.12,.005),vec3(1.,.42,.04),gold);diffuseColor.a*=exp(-boltDistance2*6.)*vBoltEnergy*(.88+.12*sin(vBoltAlong*20.-boltClock*31.+vBoltSeed));`;
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vBoltEnergy;varying float vBoltSeed;varying vec2 vBoltUv;varying float vBoltAspect;varying float vBoltAlong;uniform float boltClock;').replace('#include <color_fragment>','#include <color_fragment>\nfloat capDistance=max(0.,abs(vBoltUv.y)-vBoltAspect*.5);float boltDistance2=vBoltUv.x*vBoltUv.x+capDistance*capDistance;\n'+profile);
  };}
  this.hot.frustumCulled=this.glow.frustumCulled=false;this.hot.instanceMatrix.setUsage(T.DynamicDrawUsage);this.glow.instanceMatrix.setUsage(T.DynamicDrawUsage);this.hot.renderOrder=6;this.glow.renderOrder=5;this.group.add(this.glow,this.hot);
 }
 begin(strength:number,clock=0){this.count=0;this.clock.value=clock;this.hotMaterial.opacity=Math.min(1,strength);this.glowMaterial.opacity=Math.min(.48,strength*.42);}
 segment(ax:number,ay:number,az:number,bx:number,by:number,bz:number,width:number,energy=1){
  if(this.count>=CAPACITY)return;
  this.a.set(ax,ay,az);this.b.set(bx,by,bz);this.delta.subVectors(this.b,this.a);const length=this.delta.length();if(length<.0001)return;
  this.center.addVectors(this.a,this.b).multiplyScalar(.5);this.rotation.setFromUnitVectors(UP,this.delta.multiplyScalar(1/length));
  this.scale.set(width*1.8,length+.015,width*1.8);this.matrix.compose(this.center,this.rotation,this.scale);this.hot.setMatrixAt(this.count,this.matrix);
  this.scale.x=this.scale.z=width*17;this.matrix.compose(this.center,this.rotation,this.scale);this.glow.setMatrixAt(this.count,this.matrix);this.energy.setX(this.count,energy);this.seeds.setX(this.count,this.count*.719);this.count++;
 }
 arc(a:T.Vector3,b:T.Vector3,seed:number,width:number,clock:number,steps=12,jaggedness=1,bow:readonly number[]=[0,0,0]){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,length=Math.hypot(dx,dy,dz),sideX=dz/(Math.hypot(dx,dz)||1),sideZ=-dx/(Math.hypot(dx,dz)||1);
  const tick=Math.floor(clock*18)*313;
  let x=a.x,y=a.y,z=a.z;
  for(let i=1;i<=steps;i++){
   const f=i/steps,edge=Math.sin(Math.PI*f),w=(hash(seed+i*3+tick)-.5)*Math.min(1.2*jaggedness,length*.16)*edge,jitter=Math.sin(clock*19+seed+i*7)*.13*edge;
   const nx=a.x+dx*f+bow[0]*edge+sideX*w+jitter,ny=a.y+dy*f+bow[1]*edge+(hash(seed+i*11+tick)-.5)*Math.min(.55*jaggedness,length*.1)*edge,nz=a.z+dz*f+bow[2]*edge+sideZ*w-jitter;
   this.segment(x,y,z,nx,ny,nz,width*(1-.35*f));x=nx;y=ny;z=nz;
  }
 }
 end(){this.hot.count=this.glow.count=this.count;this.hot.instanceMatrix.needsUpdate=this.glow.instanceMatrix.needsUpdate=this.energy.needsUpdate=this.seeds.needsUpdate=true;this.group.visible=this.count>0;}
 dispose(){this.group.removeFromParent();this.hot.dispose();this.glow.dispose();this.geometry.dispose();this.hotMaterial.dispose();this.glowMaterial.dispose();}
}

/** Presentation follows the shared encounter clock; it never changes combat. */
export class MetaKnightCosmicView{
 readonly group=new T.Group();readonly lightning=new CosmicLightning();readonly plasma=new CosmicPlasma();
 private eyes:T.Object3D;private blade:T.Object3D;
 private eyeHalos:T.Sprite[][]=[];private eyeTexture:T.DataTexture;
 private eyeMaterials:{mesh:T.Mesh;original:T.Material|T.Material[];clones:T.MeshStandardMaterial[];gravity:T.MeshBasicMaterial[]}[]=[];
 private light=new T.PointLight(GALAXIA_GLOW_COLOR,0,100,1.4);
 readonly surface=buildCosmicSurface(0);private surfaceId=-1;
 private dust:T.Points<T.BufferGeometry,T.ShaderMaterial>;
 private a=new T.Vector3();private b=new T.Vector3();private eye=new T.Vector3();
 private active=false;
 constructor(private actor:T.Object3D,private scene:T.Scene){
  this.group.name='Meta Knight fourth phase lightning';this.group.visible=false;this.group.add(this.lightning.group,this.plasma.group,this.light);
  this.blade=actor.getObjectByName('Galaxia')!;this.eyes=actor.getObjectByName('Eyes_glow')!;
  const pixels=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const d=((x-15.5)**2+(y-15.5)**2)/240,index=(y*32+x)*4;pixels[index]=pixels[index+1]=pixels[index+2]=255;pixels[index+3]=Math.round(255*Math.exp(-d*6)*Math.max(0,1-d));}
  this.eyeTexture=new T.DataTexture(pixels,32,32,T.RGBAFormat);this.eyeTexture.needsUpdate=true;this.eyeTexture.magFilter=this.eyeTexture.minFilter=T.LinearFilter;
  for(let side=0;side<2;side++){
   const halo=new T.Sprite(new T.SpriteMaterial({map:this.eyeTexture,color:0xffd16b,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false})),flare=new T.Sprite(new T.SpriteMaterial({map:this.eyeTexture,color:0xffe6a6,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
   halo.scale.set(2.1,1.3,1);flare.scale.set(3.8,.20,1);halo.renderOrder=flare.renderOrder=7;halo.name='Golden visor glow '+side;flare.name='Visor light streak '+side;this.eyeHalos.push([halo,flare]);this.group.add(halo,flare);
  }
  this.eyes.traverse(o=>{if(!(o instanceof T.Mesh))return;const original=o.material,clones=(Array.isArray(original)?original:[original]).map(m=>m.clone() as T.MeshStandardMaterial),gravity=clones.map(m=>new T.MeshBasicMaterial({color:'#53adff',side:m.side,toneMapped:false,fog:false}));o.material=Array.isArray(original)?clones:clones[0];this.eyeMaterials.push({mesh:o,original,clones,gravity});});
  const p:number[]=[],seeds:number[]=[];
  for(let i=0;i<180;i++){p.push((hash(i+8)-.5)*85,hash(i+77)*70,(hash(i+192)-.5)*85);seeds.push(hash(i+87));}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('seed',new T.Float32BufferAttribute(seeds,1));
  const m=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,uniforms:{clock:{value:0},height:{value:0},drift:{value:new T.Vector2()},strength:{value:0}},vertexShader:'attribute float seed;uniform float clock;uniform float height;uniform vec2 drift;varying float fade;void main(){vec3 p=position;float lag=mod(p.y+clock*(18.+seed*24.),70.);p.y=height-lag;p.xz-=drift*lag;fade=1.-lag/70.;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=min(12.,(140.+seed*220.)/max(1.,-mv.z));gl_Position=projectionMatrix*mv;}',fragmentShader:'uniform float strength;varying float fade;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(1.,.70,.16,pow(max(0.,1.-r),2.)*fade*strength);}' });
  this.dust=new T.Points(g,m);this.dust.frustumCulled=false;this.dust.name='Cosmic ascent ion dust';this.group.add(this.dust);
 }
 update(s:KnightBattle|undefined,now:number){
  const active=cosmicStage(s);this.group.visible=active;
  if(!active){if(this.active)this.setEyes(0);this.active=false;return;}
  this.active=true;
  const stage=s.stage,f=Math.max(0,Math.min(1,(now-s.since)/(s.until-s.since))),clock=cosmicElapsed(s,now)/1000;
  if(stage==='cosmic-descent'){
   this.setEyes(0);for(const halo of this.eyeHalos.flat())halo.material.opacity=0;this.light.intensity=0;this.dust.visible=false;
   const fade=1-easeCosmic((now-s.since)/180);this.lightning.begin(fade,clock);this.plasma.begin(clock);
   if(fade>0){this.actor.updateWorldMatrix(true,true);this.group.updateWorldMatrix(true,false);this.blade.localToWorld(this.a.set(-.06,.1,0));this.blade.localToWorld(this.b.set(-.315,2.05,0));this.group.worldToLocal(this.a);this.group.worldToLocal(this.b);this.lightning.arc(this.a,this.b,99,.035,clock,16);this.plasma.add(this.a,this.b,.6,fade*.5,13);}
   this.lightning.end();this.plasma.end();return;
  }
  const tired=['cosmic-open','cosmic-hit','cosmic-star-stun','cosmic-recover'].includes(stage),blue=stage==='cosmic-planet-draw'||stage==='cosmic-planet-sweep',stunned=stage==='cosmic-star-stun';
  const charge=stage==='cosmic-charge'?easeCosmic(f):tired?.45:1,flight=stage==='cosmic-flight'||cosmicCombat(s),height=cosmicHeight(s,now),pulse=.85+.15*Math.sin(clock*29)**2;
  this.setEyes(.25+.75*charge,cosmicRefugeStage(s)?5.2:3.5,blue);this.light.intensity=(flight?8*charge:12+charge*22)*pulse+(stage==='cosmic-surge'?90*Math.exp(-f*9):0);this.light.position.set(0,height+6,3);
  this.lightning.begin((flight?.88*charge:.65+.35*charge)*pulse,clock);this.plasma.begin(clock);
  this.actor.updateWorldMatrix(true,true);this.group.updateWorldMatrix(true,false);
  // Short, irregular branches spring OUT from the visor, with real world depth.
  for(const side of [-1,1]){
   this.eyes.localToWorld(this.eye.set(side*.30,-.015,.81));this.group.worldToLocal(this.eye);
   for(const halo of this.eyeHalos[side===-1?0:1]){halo.position.copy(this.eye);halo.material.color.copy(blue?GRAVITY_BLUE:ELECTRIC_GOLD);halo.material.opacity=stunned?0:(.3+.6*charge)*pulse;}
   for(let k=0;k<5;k++){
    this.b.copy(this.eye).add(this.a.set(side*(.8+k*.24)*charge,.22*Math.sin(clock*8+k)+.15*k,.14+.12*k));
    if(!blue&&!stunned)this.lightning.arc(this.eye,this.b,61+k+side*7,.025+charge*.018,clock,5);
   }
  }
  // The same soft plasma and irregular filaments wrap the sword and flight wakes.
  this.blade.localToWorld(this.a.set(-.06,.02,0));this.blade.localToWorld(this.b.set(-.315,2.15,0));this.group.worldToLocal(this.a);this.group.worldToLocal(this.b);this.plasma.add(this.a,this.b,1.1,.65+.25*charge,13);
  for(let k=0;k<6;k++){
   const spin=clock*(1.6+hash(k)) +k*1.047,r=.12+hash(k+11)*.2;
   this.blade.localToWorld(this.a.set(-.05+Math.cos(spin)*r,.13+hash(k+7)*.35,Math.sin(spin)*r));
   this.blade.localToWorld(this.b.set(-.315+Math.cos(spin+1.8)*r,1.5+hash(k+23)*.65,Math.sin(spin+1.8)*r));this.group.worldToLocal(this.a);this.group.worldToLocal(this.b);
   this.lightning.arc(this.a,this.b,30+k,.045+charge*.022,clock,18,1.6,[Math.sin(spin)*.35,.12,Math.cos(spin)*.35]);
  }
  const grounded=stage==='cosmic-surge'||stage==='cosmic-lift',fade=stage==='cosmic-lift'?1-f*.95:1;
  if(grounded){
   if(this.surfaceId!==s.id){Object.assign(this.surface,buildCosmicSurface(s.id));this.surfaceId=s.id;}
   const elapsed=now-s.since+(stage==='cosmic-lift'?COSMIC.surgeMs:0);
   for(const path of this.surface.segments){
    const age=elapsed-path.at;if(age<=0)continue;const t=Math.min(1,age/Math.max(.01,path.duration)),a=path.a,b=path.b,energy=surfaceEnergy(age,path.seed,clock)*fade;
    this.lightning.segment(a[0],a[1],a[2],a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,path.width,energy);
    if(t<1){
     const x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;
     for(let k=0;k<2;k++){const angle=clock*23+path.seed+k*2;this.lightning.segment(x,.25,z,x+Math.sin(angle)*.65,.35+hash(path.seed+k)*.8,z+Math.cos(angle)*.65,.038,fade);}
    }
   }
   for(const tip of this.surface.tips){
    const age=elapsed-tip.at;if(age<0||age>400)continue;
    for(let k=0;k<3;k++){const angle=tip.seed+k*2.3,energy=(1-age/400)*fade;this.a.fromArray(tip.p);this.b.set(this.a.x+Math.sin(angle)*1.4,this.a.y+.5+hash(k+tip.seed)*1.8,this.a.z+Math.cos(angle)*1.4);this.lightning.arc(this.a,this.b,tip.seed+k,.045*energy,clock,4);}
   }
  }else if(stage==='cosmic-charge'){
   const density=easeCosmic(f/.75);
   // Unequal overhead arches, with varied origins along the live blade.
   for(let i=0;i<24;i++){
    const intensity=easeCosmic((density-i/24)*6);if(intensity<=0)continue;
    this.blade.localToWorld(this.a.set(-.16,.45+hash(i+17)*1.45,0));this.group.worldToLocal(this.a);
    const angle=i*2.399+Math.sin(clock*.6+i)*.18,r=4+charge*(3+hash(i)*5);this.b.set(Math.sin(angle)*r,2.4+hash(i+31)*5.6,Math.cos(angle)*r);
    this.lightning.arc(this.a,this.b,i+19,(.035+hash(i+87)*.025)*charge*intensity,clock,24,1.8,[Math.cos(angle)*2,2+hash(i+41)*5,Math.sin(angle)*2]);
   }
   for(let i=0;i<12;i++){
    const intensity=easeCosmic((density-i/12)*6);if(intensity<=0)continue;
    const angle=i*2.399+clock*.12,r=4+hash(i+11)*4,turn=angle+.9+hash(i+25)*1.4;
    this.a.set(Math.sin(angle)*r,2.5+hash(i+18)*5,Math.cos(angle)*r);this.b.set(Math.sin(turn)*(r+1),3+hash(i+51)*5,Math.cos(turn)*(r+1));
    this.lightning.arc(this.a,this.b,91+i,.04*intensity,clock,24,1.6,[hash(i+73)*3-1.5,3+hash(i+97)*4,hash(i+101)*3-1.5]);
   }
  }
  if(stage==='cosmic-rise'){
   const strength=Math.sin(Math.PI*f)**.5;
   const drift=this.actor.parent?.position,dx=height>.001?(drift?.x??0)/height:0,dz=height>.001?(drift?.z??0)/height:0;
   this.dust.material.uniforms.drift.value.set(dx,dz);
   const actors=[this.actor,...(this.actor.parent??this.scene).children.filter(o=>o!==this.actor&&o.userData.location==='meta-knight-arena'&&Math.abs(o.position.y-height)<2)];
   for(let j=0;j<actors.length;j++){
    const p=actors[j].position,tail=24+strength*30;this.a.set(p.x-SITE.x,height-1,p.z);this.b.set(p.x-SITE.x-dx*tail,height-tail,p.z-dz*tail);this.plasma.add(this.a,this.b,j===0?4:2.2,strength*.8,71+j);
    for(let i=0;i<12;i++){
    const p=actors[j].position,angle=i*2.399+clock*.35+hash(i+j*13)*.5,r=(j===0?1.25:.65)+hash(i+7)*.8,length=16+strength*(20+hash(i+j*23)*36),bend=strength*(2+hash(i+21)*7);
    this.a.set(p.x-SITE.x+Math.sin(angle)*r,height+.1,p.z+Math.cos(angle)*r);this.b.set(this.a.x+Math.sin(angle)*(2+strength*2)-dx*length,height-length,this.a.z+Math.cos(angle)*(2+strength*2)-dz*length);
    this.lightning.arc(this.a,this.b,j*37+i,(i%4===0?.10:.035)*strength,clock,24,3.5,[Math.sin(angle)*bend,0,Math.cos(angle)*bend]);
    if(i%2===0){this.a.lerp(this.b,.55);this.b.add(new T.Vector3(Math.sin(angle+.7)*5,-5,Math.cos(angle+.7)*5));this.lightning.arc(this.a,this.b,211+j*17+i,.025*strength,clock,5);}
   }}
  }
  this.lightning.end();this.plasma.end();
  this.dust.visible=stage==='cosmic-rise';this.dust.material.uniforms.clock.value=clock;this.dust.material.uniforms.height.value=height;this.dust.material.uniforms.strength.value=stage==='cosmic-rise'?Math.sin(Math.PI*f)**.5:0;
 }
 private setEyes(strength:number,power=3.5,blue=false){
  for(const {mesh,original,clones,gravity} of this.eyeMaterials){mesh.material=Array.isArray(original)?blue?gravity:clones:blue?gravity[0]:clones[0];clones.forEach((m,i)=>{const source=(Array.isArray(original)?original[i]:original) as T.MeshStandardMaterial;m.color.copy(source.color).lerp(blue?GRAVITY_CORE:ELECTRIC_CORE,strength);m.emissive.copy(source.emissive).lerp(blue?GRAVITY_BLUE:ELECTRIC_GOLD,strength);m.emissiveIntensity=T.MathUtils.lerp(source.emissiveIntensity,power,strength);});}
 }
 dispose(){this.group.removeFromParent();this.lightning.dispose();this.plasma.dispose();this.eyeTexture.dispose();this.eyeHalos.flat().forEach(halo=>halo.material.dispose());this.dust.geometry.dispose();this.dust.material.dispose();for(const {mesh,original,clones,gravity} of this.eyeMaterials){mesh.material=original;clones.forEach(m=>m.dispose());gravity.forEach(m=>m.dispose());}}
}
