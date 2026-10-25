import * as T from 'three';
import type {KnightBattle} from './meta-knight-battle';
import {COSMIC} from './meta-knight-cosmic';
import {COSMIC_SPIN,cosmicOrbs,cosmicSpinAngle} from './meta-knight-cosmic-spin';
import {CosmicLightning} from './meta-knight-cosmic-view';

const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
/** Shared-clock orbs: three pooled draws plus pooled, genuinely branching arcs. */
export class MetaKnightCosmicOrbs{
 readonly group=new T.Group();readonly electricity=new CosmicLightning();
 private coreGeometry=new T.SphereGeometry(COSMIC_SPIN.orbRadius,20,12);
 private haloGeometry=new T.PlaneGeometry(2,2);
 private power=new T.InstancedBufferAttribute(new Float32Array(COSMIC_SPIN.capacity),1);
 private seed=new T.InstancedBufferAttribute(new Float32Array(COSMIC_SPIN.capacity),1);
 private clock={value:0};
 private coreMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms:{clock:this.clock},
  vertexShader:`attribute float orbPower;attribute float orbSeed;varying vec3 p;varying vec3 n;varying vec3 v;varying float power;varying float seed;
   void main(){p=position/.72;power=orbPower;seed=orbSeed;vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);n=normalize(normalMatrix*mat3(instanceMatrix)*normal);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying vec3 p;varying vec3 n;varying vec3 v;varying float power;varying float seed;uniform float clock;
   void main(){
    float facing=max(0.,dot(normalize(n),normalize(v))),rim=pow(1.-facing,2.4);
    float flow=sin(p.x*13.+sin(p.y*11.+clock*8.+seed)*2.+p.z*7.-clock*15.);
    float fork=sin(p.y*19.+sin(p.z*14.-clock*11.)*2.+seed+clock*7.);
    float filament=pow(1.-abs(flow),13.)+pow(1.-abs(fork),19.)*.7;
    float boiling=.5+.5*sin(p.z*14.+p.x*11.+clock*23.+seed);
    vec3 amber=vec3(1.,.42,.015),gold=vec3(1.,.82,.18),white=vec3(1.,.99,.76);
    vec3 color=mix(gold,white,.48+.38*facing);color=mix(color,amber,rim*.68);color+=white*filament*.7+gold*boiling*.10;
    gl_FragColor=vec4(color,(.90+.10*filament)*power);
    #include <colorspace_fragment>
   }`});
 private haloMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,uniforms:{clock:this.clock},
  vertexShader:`attribute float orbPower;attribute float orbSeed;varying vec2 vUv;varying float power;varying float seed;
   void main(){vUv=uv;power=orbPower;seed=orbSeed;vec4 mv=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);float scale=length(instanceMatrix[0].xyz);mv.xy+=position.xy*scale;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying vec2 vUv;varying float power;varying float seed;uniform float clock;
   void main(){vec2 p=vUv*2.-1.;float r=length(p),angle=atan(p.y,p.x);float corona=exp(-r*r*5.);
    float flare=pow(max(0.,1.-abs(p.y)*10.),6.)*exp(-abs(p.x)*4.);float flicker=.88+.12*sin(clock*31.+seed);
    float strands=pow(max(0.,sin(angle*7.+sin(angle*13.-clock*4.)+clock*7.+seed)),12.)*exp(-pow((r-.35)*8.,2.));
    vec3 color=mix(vec3(1.,.17,.005),vec3(1.,.72,.11),exp(-r*r*18.));
    gl_FragColor=vec4(color,(corona*.48+flare*.22+strands*.24)*power*flicker);
    #include <colorspace_fragment>
   }`});
 readonly cores=new T.InstancedMesh(this.coreGeometry,this.coreMaterial,COSMIC_SPIN.capacity);
 readonly halos=new T.InstancedMesh(this.haloGeometry,this.haloMaterial,COSMIC_SPIN.capacity);
 private warningMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,uniforms:{clock:this.clock,progress:{value:0},charged:{value:0}},
  vertexShader:'varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 p;uniform float clock;uniform float progress;uniform float charged;
   void main(){float r=length(p),angle=atan(p.x,p.y);float edge=exp(-pow((r-10.4)*10.,2.));float pulse=exp(-pow(mod(r-clock*3.,2.8)-1.4,2.)*10.);
    float ticks=pow(max(0.,sin(angle*24.)),24.)*smoothstep(9.7,10.4,r);float timer=step(fract(angle/6.2831853+1.),progress)*edge;
    vec3 color=mix(vec3(1.,.72,.08),vec3(1.,.24,.025),charged);gl_FragColor=vec4(color,(edge*.30+timer*.35+ticks*.22+pulse*.025)*(charged>.5?.45:1.));
    #include <colorspace_fragment>
   }`});
 private warning=new T.Mesh(new T.RingGeometry(2.7,COSMIC_SPIN.emitRadius+.14,128,1),this.warningMaterial);
 private matrix=new T.Matrix4();private position=new T.Vector3();private rotation=new T.Quaternion();private scale=new T.Vector3();
 private a=new T.Vector3();private b=new T.Vector3();private previous=new T.Vector3();
 constructor(){
  this.group.name='Cosmic rotating lightning orbs';this.group.visible=false;
  for(const geometry of [this.coreGeometry,this.haloGeometry]){geometry.setAttribute('orbPower',this.power);geometry.setAttribute('orbSeed',this.seed);}
  this.power.setUsage(T.DynamicDrawUsage);this.seed.setUsage(T.DynamicDrawUsage);
  this.cores.name='Cosmic electric orb cores';this.halos.name='Cosmic electric orb coronas';
  this.cores.renderOrder=6;this.halos.renderOrder=5;
  for(const mesh of [this.cores,this.halos]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.count=0;}
  this.warning.name='Charged blade inner sweep warning';this.warning.rotation.x=-Math.PI/2;this.warning.position.y=COSMIC.height+COSMIC_SPIN.orbHeight;
  this.group.add(this.halos,this.cores,this.electricity.group,this.warning);
  this.electricity.begin(0);this.electricity.end();
 }
 update(s:KnightBattle|undefined,now:number){
  const visible=s?.phase===4&&['cosmic-spin-warn','cosmic-spin','cosmic-open'].includes(s.stage);this.group.visible=visible;
  if(!visible){this.cores.count=this.halos.count=0;this.electricity.begin(0);this.electricity.end();return;}
  const time=now/1000;this.clock.value=time;this.electricity.begin(.94,time);
  this.warning.visible=s.stage!=='cosmic-open';this.warningMaterial.uniforms.progress.value=Math.min(1,(now-s.since)/Math.max(1,s.until-s.since));this.warningMaterial.uniforms.charged.value=s.stage==='cosmic-spin'?1:0;
  const shots=cosmicOrbs(s,now);let count=0;
  for(const shot of shots){
   if(count>=COSMIC_SPIN.capacity||shot.distance>COSMIC_SPIN.outerRadius)continue;
   const x=shot.p[0],y=shot.p[1],z=shot.p[2],dx=Math.sin(shot.angle),dz=Math.cos(shot.angle),key=shot.id*7.31;
   const strength=1-Math.max(0,(shot.distance-46)/2),age=(now-shot.at)/1000;
   this.position.set(x,y,z);this.scale.setScalar(1);this.rotation.setFromAxisAngle(T.Object3D.DEFAULT_UP,time*2+key);this.matrix.compose(this.position,this.rotation,this.scale);this.cores.setMatrixAt(count,this.matrix);
   this.rotation.identity();this.scale.setScalar(2.7);this.matrix.compose(this.position,this.rotation,this.scale);this.halos.setMatrixAt(count,this.matrix);this.power.setX(count,strength);this.seed.setX(count++,key);
   // Two differently tilted, broken plasma filaments wrap the actual sphere.
   for(let band=0;band<2;band++){
    const spin=time*(2.4+hash(key))+key+band*2.1;
    for(let i=0;i<=12;i++){
     const a=i/12*Math.PI*2,spike=.81+(hash(key+i+Math.floor(time*23))-.5)*.25;
     this.b.set(Math.cos(a)*spike,Math.sin(a)*spike*.72,Math.sin(a+spin)*spike*.65).applyAxisAngle(T.Object3D.DEFAULT_UP,spin).add(this.position);
     if(i)this.electricity.segment(this.previous.x,this.previous.y,this.previous.z,this.b.x,this.b.y,this.b.z,.028,strength);this.previous.copy(this.b);
    }
   }
   const tail=Math.min(3.2,.4+age*COSMIC_SPIN.speed);
   this.a.set(x-dx*.3,y,z-dz*.3);this.b.set(x-dx*tail,y+.25*Math.sin(time*19+key),z-dz*tail);
   this.electricity.arc(this.a,this.b,key,.032,time,6,1.1);
   this.a.lerp(this.b,.45);this.b.add(this.previous.set(dz*.5,.5,-dx*.5));this.electricity.arc(this.a,this.b,key+37,.022,time,3,.7);
   if(shot.id%3===0){this.a.set(x,y,z);this.b.set(x+dz*.9,y+.65*Math.sin(time*21+key),z-dx*.9);this.electricity.arc(this.a,this.b,key+19,.026,time,3,.7);}
  }
  // A short curved wake makes the visibly accelerating sword easy to follow.
  if(s.stage==='cosmic-spin'&&s.cosmicSpin){
   const elapsed=(now-s.cosmicSpin.at)/1000;
   for(let line=0;line<3;line++){
    const r=COSMIC_SPIN.emitRadius-line*.25;
    for(let i=0;i<=22;i++){
     const a=s.cosmicSpin.yaw+cosmicSpinAngle(Math.max(0,elapsed-i*.008));
     this.b.set(Math.sin(a)*r,COSMIC.height+COSMIC_SPIN.orbHeight+line*.08,Math.cos(a)*r);
     if(i)this.electricity.segment(this.previous.x,this.previous.y,this.previous.z,this.b.x,this.b.y,this.b.z,.045*(1-i/28),1-i/28);this.previous.copy(this.b);
    }
   }
  }
  this.cores.count=this.halos.count=count;this.cores.instanceMatrix.needsUpdate=this.halos.instanceMatrix.needsUpdate=this.power.needsUpdate=this.seed.needsUpdate=true;this.electricity.end();
 }
 dispose(){this.group.removeFromParent();this.electricity.dispose();this.cores.dispose();this.halos.dispose();this.coreGeometry.dispose();this.haloGeometry.dispose();this.coreMaterial.dispose();this.haloMaterial.dispose();this.warning.geometry.dispose();this.warningMaterial.dispose();}
}
