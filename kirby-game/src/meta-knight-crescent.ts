import * as T from 'three';
import {KNIGHT,knightShotOrigin,knightProjectile,type KnightBattle} from './meta-knight-battle';

/** The release flash joins the body to the real blade tip, matching close-range contact. */
export class MetaKnightCrescentLaunch{
 readonly group=new T.Group();
 private material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,blending:T.AdditiveBlending,
  uniforms:{span:{value:1},progress:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 vUv;uniform float span;uniform float progress;void main(){
   float radius=${KNIGHT.projectileRadius.toFixed(2)};vec2 p=(vUv-.5)*vec2(radius*2.,span+radius*2.);
   float distance=length(vec2(p.x,max(abs(p.y)-span*.5,0.)));float mask=1.-smoothstep(radius*.8,radius,distance);
   float streak=pow(.5+.5*sin(p.x*7.+p.y*.8-progress*12.),8.);
   float rim=exp(-pow((distance-radius*.82)*5.,2.));vec3 gold=mix(vec3(1.,.38,.045),vec3(1.,.94,.61),rim*.7+streak*.25);
   gl_FragColor=vec4(gold,mask*(.26+.24*streak+.25*rim)*pow(1.-progress,.7));
   #include <colorspace_fragment>
  }`});
 private mesh=new T.Mesh(new T.PlaneGeometry(1,1),this.material);
 constructor(){this.group.name='Crescent launch connecting sword flash';this.group.visible=false;this.mesh.rotation.x=-Math.PI/2;this.mesh.renderOrder=9;this.group.add(this.mesh);}
 update(s:KnightBattle|undefined,now:number,bladeTip?:T.Vector3){
  const elapsed=s?now-s.since-KNIGHT.shotReleaseMs:-1;this.group.visible=s?.stage==='shot'&&elapsed>=0&&elapsed<KNIGHT.shotLaunchMs;if(!this.group.visible||!s)return;
  const origin=bladeTip??new T.Vector3().fromArray(knightShotOrigin(s)),shot=knightProjectile(s,now)!;
  const dx=shot[0]-origin.x,dz=shot[2]-origin.z,span=Math.hypot(dx,dz);
  this.group.position.copy(origin);this.group.rotation.y=span>.001?Math.atan2(dx,dz):s.yaw;this.mesh.position.z=span/2;
  this.mesh.scale.set(KNIGHT.projectileRadius,span+KNIGHT.projectileRadius*2,1);this.material.uniforms.span.value=span;this.material.uniforms.progress.value=elapsed/KNIGHT.shotLaunchMs;
 }
}

/** +X is forward. The centered, bevelled solid stays clear of the arena floor. */
export class MetaKnightCrescent{
 readonly group=new T.Group();
 private gold=new T.Color(0xffc044);private blue=new T.Color(0x8cf4ff);
 private coreMaterial=new T.MeshPhysicalMaterial({color:0xffca53,metalness:.58,roughness:.2,clearcoat:.8,clearcoatRoughness:.18,emissive:0xffa21a,emissiveIntensity:.5,depthWrite:true});
 private rimMaterial=new T.MeshBasicMaterial({color:0xffeead,toneMapped:false});
 private glowMaterial=new T.MeshBasicMaterial({color:0xffba32,side:T.BackSide,transparent:true,opacity:.38,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
 private trailMaterial=new T.ShaderMaterial({transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false,uniforms:{tint:{value:new T.Color(0xffbe45)}},
  vertexShader:'varying vec2 trailUv;void main(){trailUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 trailUv;uniform vec3 tint;void main(){float taper=pow(1.-trailUv.y,2.);float feather=pow(sin(trailUv.x*3.14159265),2.);gl_FragColor=vec4(tint,taper*feather*.3);\n#include <colorspace_fragment>\n}'});
 private sparks=new T.InstancedMesh(new T.OctahedronGeometry(.065),new T.MeshBasicMaterial({color:0xffe5a0,toneMapped:false}),12);
 private matrix=new T.Matrix4();private quaternion=new T.Quaternion();private position=new T.Vector3();private size=new T.Vector3();private reflected=false;
 constructor(){
  this.group.name='Galaxia solid crescent and magical wake';this.group.scale.setScalar(KNIGHT.effectScale);
  const shape=new T.Shape();shape.moveTo(-.58,.98);shape.bezierCurveTo(.28,1.06,1.1,.55,1.1,0);shape.bezierCurveTo(1.1,-.55,.28,-1.06,-.58,-.98);shape.bezierCurveTo(0,-.57,.2,-.2,.12,0);shape.bezierCurveTo(.2,.2,0,.57,-.58,.98);
  const geometry=new T.ExtrudeGeometry(shape,{depth:.36,bevelEnabled:true,bevelThickness:.1,bevelSize:.09,bevelSegments:3,curveSegments:40,steps:1});geometry.translate(0,0,-.18);geometry.computeVertexNormals();
  const core=new T.Mesh(geometry,this.coreMaterial);core.name='Solid golden beveled crescent';core.renderOrder=8;this.group.add(core);
  const shell=new T.Mesh(geometry,this.glowMaterial);shell.scale.setScalar(1.1);shell.renderOrder=10;this.group.add(shell);
  const contour=shape.getSpacedPoints(100);
  for(const z of [-.29,.29]){const curve=new T.CatmullRomCurve3(contour.slice(0,-1).map(p=>new T.Vector3(p.x,p.y,z)),true);const edge=new T.Mesh(new T.TubeGeometry(curve,100,.022,5,true),this.rimMaterial);edge.renderOrder=9;this.group.add(edge);}
  const tail=new T.Mesh(new T.ConeGeometry(.34,2.2,20,1,true),this.trailMaterial);tail.position.x=-1.8;tail.rotation.z=Math.PI/2;tail.renderOrder=7;this.group.add(tail);
  const aura=new T.Mesh(new T.SphereGeometry(1,16,10),this.glowMaterial);aura.scale.set(1.12,1.08,.47);aura.renderOrder=11;this.group.add(aura);
  this.sparks.frustumCulled=false;this.sparks.renderOrder=12;this.group.add(this.sparks);
  const plane=new T.Group();plane.name='Crescent parallel to the ground';plane.rotation.x=Math.PI/2;plane.scale.y=KNIGHT.projectileWidthScale;
  plane.add(...this.group.children.slice());this.group.add(plane);
 }
 update(now:number,reflected:boolean){
  if(reflected!==this.reflected){this.reflected=reflected;const tint=reflected?this.blue:this.gold;
   this.coreMaterial.color.copy(tint);this.coreMaterial.emissive.copy(tint);this.glowMaterial.color.copy(tint);this.trailMaterial.uniforms.tint.value.copy(tint);this.rimMaterial.color.setHex(reflected?0xd6ffff:0xffeead);(this.sparks.material as T.MeshBasicMaterial).color.copy(tint);
  }
  this.coreMaterial.emissiveIntensity=.55+Math.sin(now*.012)*.12;
  // The horizontal blade keeps its convex +X edge ahead of the short wake.
  this.group.rotation.z=0;
  for(let i=0;i<12;i++){const u=((i/12+now*.0005)%1),a=i*2.399+now*.004;this.position.set(-1-u*1.9,Math.sin(a)*.28*(1-u),Math.cos(a)*.32);this.size.setScalar((1-u)*(.6+.3*Math.sin(a)**2));this.matrix.compose(this.position,this.quaternion,this.size);this.sparks.setMatrixAt(i,this.matrix);}
  this.sparks.instanceMatrix.needsUpdate=true;
 }
 dispose(){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();this.group.traverse(o=>{if(o instanceof T.Mesh){if(o instanceof T.InstancedMesh)o.dispose();geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.group.removeFromParent();}
}
