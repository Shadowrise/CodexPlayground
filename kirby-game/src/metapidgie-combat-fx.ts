import * as T from 'three';
import {ease} from './metapidgie-ease';
import {PIDGEY_MELEE_FX,meleeTrailTimes,meleeBeakGlow} from './metapidgie-melee';

// Same sector as KNIGHT.slashRadius / KNIGHT.modelScale and slashHalfAngle.
export {PIDGEY_MELEE_FX} from './metapidgie-melee';
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fogFragment=`
 precision highp float;
 varying vec2 vUv;
 uniform sampler2D uBirth;
 uniform float uElapsed,uSweep,uFade,uLayer,uCore;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 float fbm(vec2 p){return .57*noise(p)+.28*noise(p*2.03+4.2)+.15*noise(p*4.13-1.7);}
 void main(){
  float born=texture2D(uBirth,vec2(vUv.x,.5)).r*uSweep;
  float age=uElapsed-born;
  if(age<0.||age>uFade)discard;
  float radial=smoothstep(.10,.22,vUv.y)*(1.-smoothstep(.94,1.,vUv.y));
  float sides=smoothstep(0.,.028,vUv.x)*(1.-smoothstep(.972,1.,vUv.x));
  float fade=1.-smoothstep(.025,uFade,age);
  vec2 flow=vec2(vUv.x*9.+uLayer*1.73-age*.48,vUv.y*7.-age*1.1);
  float mist=fbm(flow);
  float filaments=pow(fbm(flow*2.+vec2(age*.5,-age)),2.);
  float edge=exp(-pow(age/.032,2.));
  float rim=exp(-pow((vUv.y-.952)/.027,2.));
  float alpha;
  vec3 color;
  if(uCore>.5){
   alpha=(edge*.70*radial+rim*.32*fade)*sides*fade;
   color=mix(vec3(1.,.55,.025),vec3(1.,.94,.57),edge*.70+rim*.20);
  }else{
   alpha=(.09+.33*mist+.15*filaments)*radial*sides*fade*(.38+.62*vUv.y);
   alpha*=smoothstep(.0,.020,age+.012);
   color=mix(vec3(1.,.49,.015),vec3(1.,.78,.21),mist*.65);
  }
  gl_FragColor=vec4(color,alpha);
  #include <colorspace_fragment>
 }`;

function sectorGeometry(){
 const p:number[]=[],uv:number[]=[],ix:number[]=[],angular=104,radial=24,{inner,radius,halfAngle}=PIDGEY_MELEE_FX;
 for(let a=0;a<=angular;a++)for(let r=0;r<=radial;r++){
  const theta=-halfAngle+2*halfAngle*a/angular,reach=inner+(radius-inner)*r/radial;
  p.push(Math.sin(theta)*reach,0,Math.cos(theta)*reach);uv.push(a/angular,r/radial);
  if(a<angular&&r<radial){const i=a*(radial+1)+r,j=i+radial+1;ix.push(i,j,i+1,i+1,j,j+1);}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(ix);return geometry;
}
function birthTexture(){
 const bytes=new Uint8Array(256*4);
 for(let i=0;i<256;i++){let lo=0,hi=1;for(let j=0;j<18;j++){const mid=(lo+hi)/2;if(ease(mid)<i/255)lo=mid;else hi=mid;}bytes[i*4]=Math.round((lo+hi)/2*255);bytes[i*4+3]=255;}
 const texture=new T.DataTexture(bytes,256,1,T.RGBAFormat);texture.magFilter=texture.minFilter=T.LinearFilter;texture.needsUpdate=true;return texture;
}
const sparkVertex=`
 uniform sampler2D uBirth;uniform float uElapsed,uSweep,uFade,uDirection;
 attribute vec4 aSpark;attribute float aSize;varying float vAlpha;varying float vWarm;
 void main(){
  float birth=texture2D(uBirth,vec2(aSpark.x,.5)).r*uSweep;
  float age=uElapsed-birth-aSpark.w*.065;
  float life=.36+.24*aSpark.w;
  float alive=step(0.,age)*(1.-smoothstep(.04,life,age));
  float flicker=.48+.52*pow(.5+.5*sin(age*43.+aSpark.w*39.),3.);
  float theta=(-1.05+2.10*aSpark.x)*uDirection;
  vec3 p=vec3(sin(theta)*aSpark.y,aSpark.z+max(0.,age)*(.08+.14*aSpark.w),cos(theta)*aSpark.y);
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;gl_PointSize=aSize*min(2.2,9./max(1.,-mv.z));
  vAlpha=alive*flicker;vWarm=aSpark.w;
 }`;
const sparkFragment=`
 varying float vAlpha;varying float vWarm;
 void main(){vec2 p=(gl_PointCoord-.5)*2.;float r=length(p);float core=exp(-r*r*13.);float rays=exp(-abs(p.x)*24.)*exp(-abs(p.y)*3.)+exp(-abs(p.y)*24.)*exp(-abs(p.x)*3.);float a=(core+rays*.32)*vAlpha;if(a<.005)discard;gl_FragColor=vec4(mix(vec3(1.,.64,.10),vec3(1.,.97,.75),core),a);#include <colorspace_fragment>}`.replace(';#include',';\n#include');

/** Procedural mist and scintillation stay deterministic when paused or scrubbed. */
export function createMetapidgieCombatFx(model:T.Group,clips:T.AnimationClip[]){
 const group=new T.Group();group.name='Phase1_runtime_fx';group.userData.phase1Effects=true;model.add(group);
 model.traverse(node=>{if(node.name.startsWith('Phase1_beak_sweep')||node.name.startsWith('Phase1_beak_charge_glow'))node.visible=false;});
 const birth=birthTexture(),geometry=sectorGeometry();
 const trails=[1,-1].map((direction,index)=>{
  const root=new T.Group();root.name=index?'Golden_backhand_mist':'Golden_forehand_mist';group.add(root);
  const clip=clips.find(c=>c.name===(index?'Boss_slash-backhand':'Boss_slash'));
  const track=clip?.tracks.find(t=>t.name==='Phase1_beak_sweep.position');
  const height=track?track.InterpolantFactoryMethodLinear().evaluate(.125)[1]:2.40;
  root.position.y=height;
  const uniforms={uBirth:{value:birth},uElapsed:{value:-1},uSweep:{value:PIDGEY_MELEE_FX.sweep},uFade:{value:PIDGEY_MELEE_FX.fade}};
  const layers=[-.065,.055,0].map((y,layer)=>{
   const core=layer===2,material=new T.ShaderMaterial({uniforms:{...uniforms,uLayer:{value:layer},uCore:{value:core?1:0}},vertexShader:vertex,fragmentShader:fogFragment,transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,blending:core?T.AdditiveBlending:T.NormalBlending,toneMapped:false});
   const mesh=new T.Mesh(geometry,material);mesh.name=`${root.name}_${core?'bright_edge':`fog_${layer}`}`;mesh.position.y=y;mesh.scale.x=direction;mesh.renderOrder=core?8:6+layer;mesh.frustumCulled=false;root.add(mesh);return mesh;
  });
  const attributes:number[]=[],sizes:number[]=[],positions:number[]=[];
  for(let i=0;i<310;i++){
   const seed=((i*73+19)%997)/997,angle=((i*139+7)%991)/991,reach=PIDGEY_MELEE_FX.inner+(PIDGEY_MELEE_FX.radius-PIDGEY_MELEE_FX.inner)*Math.pow(((i*211+31)%983)/983,.53);
   attributes.push(angle,reach,(seed-.5)*.15,seed);sizes.push(2.3+4.5*seed);positions.push(0,0,0);
  }
  const sparkGeometry=new T.BufferGeometry();sparkGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));sparkGeometry.setAttribute('aSpark',new T.Float32BufferAttribute(attributes,4));sparkGeometry.setAttribute('aSize',new T.Float32BufferAttribute(sizes,1));
  const sparks=new T.Points(sparkGeometry,new T.ShaderMaterial({uniforms:{...uniforms,uDirection:{value:direction}},vertexShader:sparkVertex,fragmentShader:sparkFragment,transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false}));sparks.name=`${root.name}_sparkles`;sparks.frustumCulled=false;sparks.renderOrder=9;root.add(sparks);
  return {root,uniforms,layers,sparks,elapsed:-1};
 });
 const goldMaterials=new Map<T.MeshStandardMaterial,number>(),auraMaterials=new Map<T.Material,number>();
 model.traverse(node=>{if(!(node instanceof T.Mesh))return;for(const material of Array.isArray(node.material)?node.material:[node.material]){
  if(node.userData.goldenBeak&&material instanceof T.MeshStandardMaterial)goldMaterials.set(material,material.emissiveIntensity);
  if(node.userData.goldenBeakAura)auraMaterials.set(material,material.opacity);
 }});
 const halo=new T.Mesh(new T.PlaneGeometry(.95,.95),new T.ShaderMaterial({uniforms:{uPower:{value:0}},vertexShader:vertex,fragmentShader:`varying vec2 vUv;uniform float uPower;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float soft=exp(-r*r*5.5);float core=exp(-r*r*38.);float ray=(exp(-abs(p.x)*55.)*exp(-abs(p.y)*7.)+exp(-abs(p.y)*55.)*exp(-abs(p.x)*7.))*.22;float a=(soft*.27+core*.30+ray)*uPower;gl_FragColor=vec4(1.,.66,.06,a);\n#include <colorspace_fragment>}`,transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false}));halo.name='Charged_gold_beak_halo';halo.renderOrder=10;group.add(halo);
 const light=new T.PointLight(0xffc126,0,2.0,2);light.name='Gold_beak_spill_light';group.add(light);
 const tip=model.getObjectByName('Metapidgie_beak_tip')!,point=new T.Vector3(),rotation=new T.Quaternion();
 group.traverse(node=>{node.userData.phase1Effect=true;});
 const originalEmission=new Map([...goldMaterials].map(([m])=>[m,m.emissive.clone()]));let power=0;
 function extentPoints(name:string){
  if(!['Boss_slash-warn','Boss_slash','Boss_slash-warn-backhand','Boss_slash-backhand','Boss_open','Boss_open-melee'].includes(name))return [];
  const points:T.Vector3[]=[];
  for(let i=0;i<=32;i++){const angle=-PIDGEY_MELEE_FX.halfAngle+2*PIDGEY_MELEE_FX.halfAngle*i/32;for(const r of [PIDGEY_MELEE_FX.inner,PIDGEY_MELEE_FX.radius])for(const y of [2.20,2.70])points.push(new T.Vector3(Math.sin(angle)*r,y,Math.cos(angle)*r));}
  return points;
 }
 return {group,trails,light,goldMaterials,extentPoints,reset(){for(const [m,base] of goldMaterials){m.emissive.copy(originalEmission.get(m)!);m.emissiveIntensity=base;}for(const [m,base] of auraMaterials)m.opacity=base;light.intensity=0;halo.visible=false;for(const t of trails)t.root.visible=false;},parameters:PIDGEY_MELEE_FX,get glow(){return power;},bounds(name:string){
  if(!['Boss_slash-warn','Boss_slash','Boss_slash-warn-backhand','Boss_slash-backhand','Boss_open','Boss_open-melee'].includes(name))return new T.Box3();
  const width=PIDGEY_MELEE_FX.radius*Math.sin(PIDGEY_MELEE_FX.halfAngle);
  return new T.Box3(new T.Vector3(-width-.12,1.9,0),new T.Vector3(width+.12,2.95,PIDGEY_MELEE_FX.radius+.12));
 },update(name:string,time:number,duration:number,camera:T.Camera,retainedTimes?:readonly number[],glowGain=1){
  const elapsed=meleeTrailTimes(name,time);
  elapsed.forEach((value,i)=>{if(value<0&&retainedTimes)elapsed[i]=retainedTimes[i];});
  trails.forEach((trail,i)=>{trail.elapsed=elapsed[i];trail.uniforms.uElapsed.value=elapsed[i];trail.root.visible=elapsed[i]>=0&&elapsed[i]<PIDGEY_MELEE_FX.sweep+PIDGEY_MELEE_FX.fade;});
  power=Math.max(meleeBeakGlow(name,time,duration),...elapsed.map(t=>t>=PIDGEY_MELEE_FX.strike?.62*(1-ease((t-PIDGEY_MELEE_FX.strike)/.30)):0));
  for(const [material,base] of goldMaterials){material.emissive.setHex(0xffbc18);material.emissiveIntensity=base*(.45+.55*glowGain)+power*glowGain*2.0;}
  for(const [material,base] of auraMaterials)material.opacity=Math.min(.75,base*(.45+.55*glowGain)*(1+power*glowGain*4));
  tip.getWorldPosition(point);model.worldToLocal(point);halo.position.copy(point);light.position.copy(point);light.position.z+=.055;
  model.getWorldQuaternion(rotation).invert();halo.quaternion.copy(rotation).multiply(camera.getWorldQuaternion(new T.Quaternion()));
  halo.material.uniforms.uPower.value=power*glowGain;halo.visible=power>.001;light.intensity=power*glowGain*2.8;
 }};
}
