import * as T from 'three';
import type {KnightBattle} from './meta-knight-battle';
import {COSMIC_METEOR as M,meteorPoint} from './meta-knight-cosmic-meteor';
import {CosmicLightning} from './meta-knight-cosmic-view';

const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const BODY_FLAMES=28,TAIL_FLAMES=64,FLAMES=BODY_FLAMES+TAIL_FLAMES;
const noise=`float mh(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float mn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(mh(i),mh(i+vec3(1,0,0)),f.x),mix(mh(i+vec3(0,1,0)),mh(i+vec3(1,1,0)),f.x),f.y),mix(mix(mh(i+vec3(0,0,1)),mh(i+vec3(1,0,1)),f.x),mix(mh(i+vec3(0,1,1)),mh(i+vec3(1)),f.x),f.y),f.z);}
float mf(vec3 p){return .57*mn(p)+.28*mn(p*2.07)+.15*mn(p*4.11);}`;
/** Real rough geometry stays visible inside an irregular bow shock and curved, sampled wake. */
export class MetaKnightCosmicMeteorView{
 readonly group=new T.Group();readonly lightning=new CosmicLightning();
 readonly rock:T.Mesh<T.IcosahedronGeometry,T.MeshStandardMaterial>;
 private clock={value:0};private returned={value:0};private matrix=new T.Matrix4();private quaternion=new T.Quaternion();private rotation=new T.Quaternion();
 private p=new T.Vector3();private old=new T.Vector3();private velocity=new T.Vector3();private tailDirection=new T.Vector3();private scale=new T.Vector3();private tip=new T.Vector3();private up=new T.Vector3(0,1,0);
 private flameMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,uniforms:{clock:this.clock,returned:this.returned},vertexShader:`attribute float age;varying float vAge;varying vec3 vLocal;varying float facing;void main(){vAge=age;vLocal=position;vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);facing=abs(dot(normalize(normalMatrix*mat3(instanceMatrix)*normal),normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform float clock;uniform float returned;varying float vAge;varying vec3 vLocal;varying float facing;${noise}
 void main(){float n=mf(vLocal*4.+vec3(0,clock*10.,vAge*13.)),edge=pow(max(0.,1.-abs(vLocal.y)),.40);vec3 fire=mix(vec3(1.,.035,.001),vec3(1.,.38,.012),1.-vAge);fire=mix(fire,vec3(1.,.85,.34),pow(1.-vAge,3.)*smoothstep(.35,.7,n));fire=mix(fire,vec3(1.,.67,.16),returned*.16);float alpha=(.30+.48*n)*pow(1.-vAge,.85)*edge*smoothstep(.17,.59,n)*pow(facing,.85);gl_FragColor=vec4(fire*1.6,alpha);}`});
 private flame=new T.InstancedMesh(new T.SphereGeometry(1,16,10),this.flameMaterial,FLAMES);
 private smoke=new T.InstancedMesh(new T.SphereGeometry(1,12,10),new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{clock:this.clock},vertexShader:'varying vec3 p;varying float facing;void main(){p=position;vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);facing=abs(dot(normalize(normalMatrix*mat3(instanceMatrix)*normal),normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}',fragmentShader:`uniform float clock;varying vec3 p;varying float facing;${noise}void main(){float density=mf(p*5.+clock*.8);gl_FragColor=vec4(vec3(.095,.045,.025),.07*pow(facing,2.)*smoothstep(.2,.75,density));}`}),18);
 private embers=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshBasicMaterial({color:0xff9c29,toneMapped:false}),72);
 private fireShell=new T.Mesh(new T.SphereGeometry(1,48,32),new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,uniforms:{clock:this.clock},vertexShader:`uniform float clock;varying vec3 p;varying vec3 n;varying vec3 v;${noise}void main(){p=position;float billow=mf(position*5.+vec3(0,clock*6.,clock));vec3 hot=position*(1.+.14*billow);hot.y-=max(0.,-position.y)*(.20+.28*billow);n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(hot,1.);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform float clock;varying vec3 p;varying vec3 n;varying vec3 v;${noise}void main(){float detail=mf(p*6.+vec3(0,clock*8.,clock*.8)),rim=pow(1.-abs(dot(normalize(n),normalize(v))),.8),tongues=smoothstep(.38,.70,detail);vec3 colour=mix(vec3(1.,.045,.001),vec3(1.,.55,.035),detail);colour=mix(colour,vec3(1.,.87,.38),smoothstep(.66,.85,detail));gl_FragColor=vec4(colour*1.9,tongues*(.18+.50*rim));}`}));
 private light=new T.PointLight(0xff982d,0,32,1.5);
 constructor(private blade:T.Object3D){
  this.group.name='Meta Knight curved meteor, fire and rock';
  const geometry=new T.IcosahedronGeometry(1,4),positions=geometry.getAttribute('position'),colours:number[]=[],point=new T.Vector3(),craters=Array.from({length:9},(_,i)=>new T.Vector3(hash(i+1)-.5,hash(i+21)-.5,hash(i+91)-.5).normalize());
  for(let i=0;i<positions.count;i++){
   point.fromBufferAttribute(positions,i).normalize();let radius=.96+.045*Math.sin(point.x*19+point.y*7)*Math.cos(point.z*17-point.y*11)+.022*Math.sin(point.x*43+point.z*27);
   for(const crater of craters){const d=point.distanceTo(crater);radius-=.13*Math.exp(-d*d/.025);radius+=.045*Math.exp(-(((d-.24)/.055)**2));}
   const ash=.68+.24*Math.sin(point.x*31+point.z*17)*Math.cos(point.y*24);colours.push(ash,ash*.85,ash*.72);point.multiplyScalar(radius);positions.setXYZ(i,point.x*1.08,point.y*.90,point.z*1.04);
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const material=new T.MeshStandardMaterial({color:0x685548,vertexColors:true,roughness:.96,metalness:.12});material.customProgramCacheKey=()=> 'cosmic-basalt-meteor-v1';
  material.onBeforeCompile=shader=>{
   shader.uniforms.meteorClock=this.clock;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 meteorLocal;').replace('#include <begin_vertex>','#include <begin_vertex>\nmeteorLocal=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 meteorLocal;uniform float meteorClock;${noise}`)
    .replace('#include <color_fragment>','#include <color_fragment>\nfloat grain=mf(meteorLocal*28.);diffuseColor.rgb*=.65+grain*.65;')
    .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nvec3 mp=meteorLocal*3.5;float ridge=abs(mf(mp+mf(mp*2.)*1.4)-.48);float fissure=1.-smoothstep(.012,.036,ridge);totalEmissiveRadiance+=mix(vec3(1.,.045,.001),vec3(1.,.52,.07),pow(fissure,3.))*fissure*(1.7+.25*sin(meteorClock*8.+mp.x*4.));');
  };
  this.rock=new T.Mesh(geometry,material);this.rock.name='Cratered basalt meteor with incandescent cracks';this.rock.castShadow=true;
  const age=new T.InstancedBufferAttribute(Float32Array.from({length:FLAMES},(_,i)=>i<BODY_FLAMES?.025+.07*i/BODY_FLAMES:(i-BODY_FLAMES)/TAIL_FLAMES),1);this.flame.geometry.setAttribute('age',age);
  for(const mesh of [this.flame,this.smoke,this.embers]){mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;}
  this.group.add(this.smoke,this.flame,this.rock,this.fireShell,this.embers,this.light,this.lightning.group);this.group.visible=false;
 }
 update(s:KnightBattle|undefined,now:number){
  const point=s?meteorPoint(s,now):undefined;this.group.visible=!!point;if(!s||!point)return;
  const m=s.cosmicMeteor!,clock=now/1000;this.clock.value=clock;this.returned.value=s.stage==='cosmic-meteor-return'?1:0;this.p.fromArray(point);this.old.fromArray(meteorPoint(s,Math.max(s.since,now-16))??point);this.velocity.subVectors(this.p,this.old);
  const speed=this.velocity.length()/.016;if(this.velocity.lengthSq()<.00001)this.velocity.set(Math.sin(m.yaw),.1,Math.cos(m.yaw));this.velocity.normalize();
  this.rock.position.copy(this.p);this.rock.rotation.set(clock*1.2+m.index,clock*.83,clock*.49);this.rock.scale.setScalar(M.radius);
  this.rotation.setFromUnitVectors(this.up,this.velocity);this.fireShell.position.copy(this.p);this.fireShell.quaternion.copy(this.rotation);this.fireShell.scale.set(1.43,1.55,1.43);
  this.light.position.copy(this.p);this.light.intensity=22+6*Math.sin(clock*27)**2;
  for(let i=0;i<BODY_FLAMES;i++){
   const a=i*2.399+clock*.7,y=1-2*(i+.5)/BODY_FLAMES,r=Math.sqrt(1-y*y),pulse=.8+.2*Math.sin(clock*17+i*5);
   this.old.set(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(M.radius*(.97+.12*pulse)).add(this.p).addScaledVector(this.velocity,-.30);
   this.scale.set(.32+.17*pulse,.78+.65*pulse,.32+.17*pulse);this.matrix.compose(this.old,this.rotation,this.scale);this.flame.setMatrixAt(i,this.matrix);
  }
  for(let i=0;i<TAIL_FLAMES;i++){
   const age=i/TAIL_FLAMES,t=now-age*540,past=meteorPoint(s,Math.max(s.since,t))??point,earlier=meteorPoint(s,Math.max(s.since,t-16))??past;this.old.fromArray(past);
   this.tailDirection.set(past[0]-earlier[0],past[1]-earlier[1],past[2]-earlier[2]);if(this.tailDirection.lengthSq()<.00001)this.tailDirection.copy(this.velocity);this.quaternion.setFromUnitVectors(this.up,this.tailDirection.normalize());
   this.old.addScaledVector(this.velocity,-age*4*(1-Math.min(1,speed/10)));
   const a=i*2.399+clock*3,r=(.12+age*.70)*Math.sin(age*Math.PI);this.old.x+=Math.cos(a)*r;this.old.y+=Math.sin(a)*r;this.old.z+=Math.cos(a*.7)*r;
   this.scale.setScalar((1.55+age*.20)*(1-age)**.65*(.86+.14*Math.sin(clock*23+i*7)));this.scale.y*=2.0;this.matrix.compose(this.old,this.quaternion,this.scale);this.flame.setMatrixAt(BODY_FLAMES+i,this.matrix);
  }
  for(let i=0;i<18;i++){
   const age=(i+3)/21,past=meteorPoint(s,Math.max(s.since,now-age*490))??point;this.old.fromArray(past).add(new T.Vector3(Math.sin(i*13+clock)*age,age*.9,Math.cos(i*7+clock)*age));
   this.scale.setScalar((1.1+age)*(.8+.2*Math.sin(i+clock*3)));this.matrix.compose(this.old,this.quaternion,this.scale);this.smoke.setMatrixAt(i,this.matrix);
  }
  for(let i=0;i<72;i++){
   const age=(i/72+clock*.35)%1,past=meteorPoint(s,Math.max(s.since,now-age*450))??point,a=i*2.399;this.old.fromArray(past).add(new T.Vector3(Math.sin(a)*age*2.8,Math.cos(a*1.3)*age*2.3,Math.cos(a)*age*2.8));
   this.scale.set(.045,.10+.24*age,.045).multiplyScalar(1-age*.75);this.matrix.compose(this.old,this.rotation,this.scale);this.embers.setMatrixAt(i,this.matrix);
  }
  this.flame.instanceMatrix.needsUpdate=this.smoke.instanceMatrix.needsUpdate=this.embers.instanceMatrix.needsUpdate=true;
  this.lightning.begin(1,clock);
  if(s.stage==='cosmic-meteor-draw'||s.stage==='cosmic-meteor-cast'&&now<m.at){
   this.blade.localToWorld(this.tip.set(-.315,2.05,0));this.group.worldToLocal(this.tip);
   for(let k=0;k<5;k++){this.old.copy(this.p).add(new T.Vector3(Math.sin(clock*6+k)*M.radius,Math.cos(clock*8+k)*M.radius,Math.cos(clock*6+k)*M.radius));this.lightning.arc(this.tip,this.old,421+k,.035,clock,22,1.6,[0,2,0]);}
  }
  this.lightning.end();
 }
 dispose(){this.lightning.dispose();this.group.removeFromParent();for(const mesh of [this.rock,this.flame,this.smoke,this.embers,this.fireShell]){mesh.geometry.dispose();mesh.material.dispose();if(mesh instanceof T.InstancedMesh)mesh.dispose();}}
}
