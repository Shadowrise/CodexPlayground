import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Three small draws, only while a target is open. No lights or shadow maps. */
export class CentipedeTargetCue{
 readonly group=new T.Group();
 readonly arrow:T.Mesh;
 readonly ring=new T.Mesh(new T.TorusGeometry(1.05,.055,6,48),new T.ShaderMaterial({
  transparent:true,depthWrite:false,depthTest:false,toneMapped:false,uniforms:{progress:{value:-1}},
  vertexShader:'varying vec2 ringPoint;void main(){ringPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 ringPoint;uniform float progress;void main(){
   float angle=fract(atan(ringPoint.x,ringPoint.y)/6.283185307+1.);
   float end=progress*6.283185307;vec2 tip=1.05*vec2(sin(end),cos(end));
   float cap=1.-smoothstep(.045,.058,min(distance(ringPoint,tip),distance(ringPoint,vec2(0.,1.05))));
   float timer=progress>0.?max(step(angle,progress),cap):0.;
   float shine=1.-smoothstep(.015,.055,abs(length(ringPoint)-1.05));
   vec3 green=vec3(.49,.95,.59)*(.88+.12*shine),red=vec3(1.,.10,.20)+vec3(.25,.15,.04)*cap;
   gl_FragColor=vec4(mix(green,red,timer),.94);
   #include <colorspace_fragment>
  }`,
 }));
 private readonly aura=new T.Group();
 constructor(){
  this.group.name='Topotushka available target';this.group.visible=false;this.group.renderOrder=this.aura.renderOrder=1000;
  const glow=new T.Mesh(new T.PlaneGeometry(3.6,3.6),new T.ShaderMaterial({
   transparent:true,depthWrite:false,depthTest:false,toneMapped:false,
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float a=(1.-smoothstep(.48,1.,r))*smoothstep(.05,.38,r)*.38;gl_FragColor=vec4(.24,.86,.36,a);}',
  }));
  this.ring.name='Available target window countdown';this.ring.position.z=.02;this.aura.add(glow,this.ring);
  const shape=new T.Shape();shape.moveTo(-.18,.8);shape.lineTo(.18,.8);shape.lineTo(.18,.06);shape.lineTo(.48,.06);shape.lineTo(0,-.48);shape.lineTo(-.48,.06);shape.lineTo(-.18,.06);shape.closePath();
  const front=new T.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:true,bevelSize:.045,bevelThickness:.025,bevelSegments:2,steps:1,curveSegments:8});
  const border=front.clone();border.scale(1.16,1.10,1);border.translate(0,0,-.075);
  for(const [geometry,color] of [[border,'#123e2b'],[front,'#b1ffc0']] as const){
   const c=new T.Color(color),colours=new Float32Array(geometry.getAttribute('position').count*3);
   for(let i=0;i<colours.length;i+=3){colours[i]=c.r;colours[i+1]=c.g;colours[i+2]=c.b;}
   geometry.setAttribute('color',new T.BufferAttribute(colours,3));
  }
  this.arrow=new T.Mesh(mergeGeometries([border,front])!,new T.MeshBasicMaterial({vertexColors:true,toneMapped:false,transparent:true,depthWrite:false,depthTest:false}));border.dispose();front.dispose();
  glow.renderOrder=1000;this.ring.renderOrder=1001;this.arrow.renderOrder=1002;
  this.arrow.name='Floating downward target arrow';this.group.add(this.aura,this.arrow);
 }
 update(target:T.Vector3|readonly number[],now:number,camera?:T.Camera,large=false,progress?:number){
  if(target instanceof T.Vector3)this.group.position.copy(target);else this.group.position.fromArray(target);
  const pulse=1+.06*Math.sin(now*.004),size=large?1.18:1;
  this.aura.scale.setScalar(pulse*size);this.arrow.position.y=1.8*size+.12*Math.sin(now*.003);
  this.ring.material.uniforms.progress.value=progress!==undefined&&Number.isFinite(progress)?T.MathUtils.clamp(progress,0,1):-1;
  if(camera){this.aura.quaternion.copy(camera.quaternion);this.arrow.quaternion.copy(camera.quaternion);}
 }
}
