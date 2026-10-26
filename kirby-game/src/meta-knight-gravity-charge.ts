import * as T from 'three';
import type {KnightBattle} from './meta-knight-battle';
import type {CosmicLightning} from './meta-knight-cosmic-view';
import {gravityChargeRadius} from './meta-knight-gravity-charge-state';

const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};

/** A shared-clock charge at the upper blade; the pulling bolts emerge from its surface. */
export class MetaKnightGravityCharge{
 readonly group=new T.Group();
 private clock={value:0};
 private core=new T.Mesh(new T.SphereGeometry(1,48,32),new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
  uniforms:{clock:this.clock},vertexShader:`varying vec3 p;varying vec3 n;varying vec3 v;
   void main(){p=position;n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying vec3 p;varying vec3 n;varying vec3 v;uniform float clock;
   void main(){
    float rim=pow(1.-max(0.,dot(normalize(n),normalize(v))),2.2);
    float flow=sin(p.x*9.+sin(p.y*11.+clock*4.)*1.6+p.z*7.-clock*7.);
    float branch=sin(p.y*13.+sin(p.z*9.-clock*5.)*1.4+p.x*5.+clock*6.);
    float filament=pow(1.-abs(flow),18.)+pow(1.-abs(branch),24.)*.65;
    float cloud=.5+.5*sin(p.z*7.+sin(p.x*9.+clock*3.)+p.y*6.-clock*4.);
    vec3 color=mix(vec3(.015,.06,.50),vec3(.025,.30,1.),rim)+vec3(.20,.58,1.)*filament;
    gl_FragColor=vec4(color,.045+rim*.16+cloud*.035+filament*.40);
    #include <colorspace_fragment>
   }`}));
 private halo=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
  uniforms:{clock:this.clock},vertexShader:`varying vec2 p;void main(){p=position.xy;vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);float scale=length(modelMatrix[0].xyz);mv.xy+=position.xy*scale;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying vec2 p;uniform float clock;void main(){float r=length(p),mist=exp(-r*r*5.)*(1.-smoothstep(.65,1.,r));gl_FragColor=vec4(.015,.20,1.,mist*(.15+.018*sin(clock*17.)));\n#include <colorspace_fragment>\n}`}));
 private a=new T.Vector3();private b=new T.Vector3();private direction=new T.Vector3();
 constructor(){
  this.group.name='Growing blue electrical charge around Galaxia';this.group.visible=false;
  this.core.name='Blue gravity charge sphere';this.halo.name='Blue gravity charge corona';
  this.core.renderOrder=5;this.halo.renderOrder=4;this.halo.scale.setScalar(2.5);this.group.add(this.core,this.halo);
 }
 get radius(){return this.group.scale.x;}
 clear(){this.group.visible=false;}
 update(s:KnightBattle,now:number,blade:T.Object3D,root:T.Object3D,arcs:CosmicLightning){
  const radius=gravityChargeRadius(s,now),active=radius>0;
  this.group.visible=active;if(!active)return;
  const clock=Math.max(0,now-s.cosmicRefuge!.at)/1000;
  this.clock.value=clock;this.group.scale.setScalar(radius);
  blade.localToWorld(this.group.position.set(-.315,1.75,0));root.worldToLocal(this.group.position);
  const tick=Math.floor(clock*18);
  for(let strand=0;strand<4;strand++){
   const spin=clock*(.7+strand*.17)+strand*1.9;
   for(let i=0;i<=22;i++){
    const angle=i/22*Math.PI*2,r=radius*(1.01+(hash(tick*79+strand*31+i%22)-.5)*.16);
    this.b.set(Math.cos(angle)*r,Math.sin(angle)*r,Math.sin(angle*3+spin)*radius*.13).applyAxisAngle(T.Object3D.DEFAULT_UP,spin).applyAxisAngle(this.direction.set(1,0,0),strand*.74).add(this.group.position);
    if(i&&(i+strand*7)%11!==0)arcs.segment(this.a.x,this.a.y,this.a.z,this.b.x,this.b.y,this.b.z,.035+radius*.008,.65+.25*hash(strand+tick));this.a.copy(this.b);
   }
  }
 }
 originToward(target:T.Vector3,out:T.Vector3){return out.subVectors(target,this.group.position).normalize().multiplyScalar(this.radius*.96).add(this.group.position);}
 dispose(){this.group.removeFromParent();this.core.geometry.dispose();this.core.material.dispose();this.halo.geometry.dispose();this.halo.material.dispose();}
}
