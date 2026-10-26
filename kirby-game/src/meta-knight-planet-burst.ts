import * as T from 'three';
import {softMist,softMistMaterial} from './soft-mist';
import {makeFruitMist} from './fruit-mist';
import {planetFractureGeometry,planetFractureMaterial} from './meta-knight-planet-fracture';

const hash=(i:number)=>{const n=Math.sin(i*127.1+63.9)*43758.5453;return n-Math.floor(n);};
/** A short impact flash, irregular crust, hot debris and expanding dust share one collision clock. */
export class MetaKnightPlanetBurst{
 readonly group=new T.Group();
 private rockGeometry=planetFractureGeometry();private chipGeometry=new T.IcosahedronGeometry(1,0);
 private surfaces=new Map<number,T.ShaderMaterial>();
 private rocks?:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
 private sparks=new T.InstancedMesh(this.chipGeometry,new T.MeshBasicMaterial({color:0xffdb84,transparent:true,toneMapped:false}),180);
 private clouds:ReturnType<typeof softMist>[]=[];private rings:T.Mesh<T.PlaneGeometry,T.ShaderMaterial>[]=[];
 private flash=makeFruitMist(0);readonly light=new T.PointLight(0xffd398,0,145,1.5);
 private dummy=new T.Object3D();private direction=new T.Vector3();private away=new T.Vector3();private tint=new T.Color();private up=new T.Vector3(0,1,0);
 constructor(){
  this.group.name='Planet collision: incandescent crust, ejecta and shock front';
  this.sparks.instanceMatrix.setUsage(T.DynamicDrawUsage);this.sparks.frustumCulled=false;
  for(let i=0;i<14;i++){const cloud=softMist(softMistMaterial('#ffc77f',.15));this.clouds.push(cloud);this.group.add(cloud);}
  for(let i=0;i<3;i++){const ring=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,uniforms:{strength:{value:0}},vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 p;uniform float strength;void main(){float r=length(p),a=atan(p.y,p.x),band=exp(-pow((r-.78)*35.,2.));float wisps=.65+.2*sin(a*19.)+.15*sin(a*41.);gl_FragColor=vec4(1.,.78,.42,band*wisps*strength);}'}));this.rings.push(ring);this.group.add(ring);}
  this.flash.material=this.flash.material.clone();this.flash.material.color.set('#fff5d5');this.flash.material.blending=T.AdditiveBlending;
  this.group.add(this.sparks,this.flash,this.light);this.group.visible=false;
 }
 bindSurface(source:T.ShaderMaterial,world:number){
  let material=this.surfaces.get(world);if(!material){material=planetFractureMaterial(source);this.surfaces.set(world,material);}
  if(this.rocks)this.rocks.material=material;else{this.rocks=new T.Mesh(this.rockGeometry,material);this.rocks.frustumCulled=false;this.group.add(this.rocks);}
 }
 update(ageMs:number,origin:T.Vector3,contact:T.Vector3,_world:number,camera?:T.Camera,orientation?:T.Quaternion){
  this.group.visible=ageMs>=0&&ageMs<2200;if(!this.group.visible)return;const t=ageMs/1000,f=t/2.2,fade=1-T.MathUtils.smoothstep(f,.52,1);
  this.group.position.copy(origin);this.away.subVectors(origin,contact).normalize();
  if(this.rocks){this.rocks.material.uniforms.blastAge.value=t;const away=this.rocks.material.uniforms.blastAway.value as T.Vector3;away.copy(this.away);if(orientation){this.rocks.quaternion.copy(orientation);away.applyQuaternion(orientation.clone().invert());}this.rocks.material.uniforms.clock.value=t;this.rocks.material.depthWrite=fade>.8;}
  for(let i=0;i<180;i++){
   const a=i*2.399963,y=hash(i+71)*2-1,r=Math.sqrt(1-y*y);this.direction.set(Math.cos(a)*r,y,Math.sin(a)*r).addScaledVector(this.away,.75).normalize();
   this.dummy.position.copy(contact).sub(origin).addScaledVector(this.direction,(8+hash(i+41)*42)*t);this.dummy.position.y-=t*t*2;
   this.dummy.quaternion.setFromUnitVectors(this.up,this.direction);const size=(.015+hash(i+91)*.035)*(1-f);this.dummy.scale.set(size,size*(2+Math.min(8,t*16)),size);this.dummy.updateMatrix();this.sparks.setMatrixAt(i,this.dummy.matrix);
  }
  this.sparks.material.opacity=Math.exp(-t*1.5)*fade;this.sparks.instanceMatrix.needsUpdate=true;
  this.clouds.forEach((cloud,i)=>{const a=i*2.399,y=hash(i+33)*1.3-.4,r=Math.sqrt(Math.max(0,1-y*y));cloud.position.set(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(8+t*(8+hash(i+8)*5)).addScaledVector(this.away,t*14);cloud.scale.setScalar(3.5+t*(5+hash(i+55)*3));cloud.material.color.set('#4c5365').lerp(this.tint.set('#ffd799'),Math.exp(-t*4));cloud.material.opacity=Math.sin(Math.min(1,t/.25)*Math.PI*.5)*.16*fade;});
  this.flash.position.copy(contact).sub(origin);this.flash.scale.setScalar(6+30*Math.min(1,t/.3));this.flash.material.opacity=.85*Math.exp(-t*12);
  this.rings.forEach((ring,i)=>{const k=Math.max(0,t-i*.055);ring.position.copy(contact).sub(origin);if(i===0&&camera)ring.quaternion.copy(camera.getWorldQuaternion(new T.Quaternion()));else ring.rotation.set(Math.PI/2+i*.24,.18*i,.4*i);ring.scale.setScalar(3+k*(46-i*8));ring.material.uniforms.strength.value=(i===0?.65:.35)*Math.exp(-k*(3+i))*Math.min(1,k*45);});
  // BattleView keeps lights outside hidden effect groups so their shader slots stay fixed.
  this.light.position.copy(contact);if(this.light.parent===this.group)this.light.position.sub(origin);this.light.intensity=190*Math.exp(-t*10);
 }
 dispose(){this.group.removeFromParent();this.sparks.dispose();this.rockGeometry.dispose();this.chipGeometry.dispose();this.surfaces.forEach(m=>m.dispose());this.surfaces.clear();this.sparks.material.dispose();this.clouds.forEach(c=>c.material.dispose());this.rings.forEach(r=>{r.geometry.dispose();r.material.dispose();});this.flash.material.dispose();}
}
