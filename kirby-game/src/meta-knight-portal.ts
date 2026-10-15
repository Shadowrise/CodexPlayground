import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PORTAL_STEPS} from './meta-knight-arena-site';

/** A small self-lit gateway; no lights, external assets or arena imports. */
export function createMetaKnightPortal(){
 const root=new T.Group();root.name='Meta Knight portal';
 const silver=new T.MeshStandardMaterial({color:'#c6cce4',metalness:.65,roughness:.28});
 const gold=new T.MeshStandardMaterial({color:'#ddc794',metalness:.5,roughness:.35});
 const glow=new T.MeshBasicMaterial({color:'#a88bff'});
 const gemMaterial=new T.MeshStandardMaterial({color:'#bfa3ed',metalness:.25,roughness:.2,emissive:'#8953df',emissiveIntensity:.8,flatShading:true});
 const plinth=new T.MeshStandardMaterial({color:'#29283e',roughness:.8,metalness:.12});
 const stone=new T.MeshStandardMaterial({color:'#777087',roughness:.85});
 const paleStone=new T.MeshStandardMaterial({color:'#a09aac',roughness:.8});
 const lift=PORTAL_STEPS.at(-1)!.height;
 const add=(g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0)=>{const o=new T.Mesh(g,m);o.position.set(x,y+lift,z);root.add(o);return o;};
 const floor=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number)=>{const o=add(g,m,x,y-lift,z);o.rotation.x=-Math.PI/2;return o;};
 // Three real walkable treads: dark risers, individually cut stone wedges,
 // brass nosings and small luminous diamonds, all batched by material below.
 for(let step=0;step<PORTAL_STEPS.length;step++){
  const {radius,height}=PORTAL_STEPS[step],bottom=step?PORTAL_STEPS[step-1].height:0,inner=step===2?0:PORTAL_STEPS[step+1].radius;
  add(new T.CylinderGeometry(radius,radius+.06,height-bottom,64),plinth,0,(height+bottom)/2-lift);
  for(let i=0;i<24;i++){
   const a=i*Math.PI/12+.009;
   floor(new T.RingGeometry(Math.max(.05,inner),radius-.07,3,1,a,Math.PI/12-.018),i%3===0?paleStone:stone,0,height+.003,0);
  }
  const edge=add(new T.TorusGeometry(radius-.04,.027,4,96),gold,0,height+.008-lift);edge.rotation.x=Math.PI/2;
  const inlay=add(new T.TorusGeometry(radius-.25,.018,4,96),gold,0,height+.013-lift);inlay.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6,x=Math.sin(a)*(radius+.02),z=Math.cos(a)*(radius+.02);
   const panel=add(new T.BoxGeometry(.32,.095,.035),gold,x,(height+bottom)/2-lift,z);panel.rotation.y=a;
   const inset=add(new T.BoxGeometry(.085,.055,.045),glow,x,(height+bottom)/2-lift,z);inset.rotation.y=a;
  }
 }
 const starShape=new T.Shape();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?.12:.58;i?starShape.lineTo(Math.cos(a)*r,Math.sin(a)*r):starShape.moveTo(Math.cos(a)*r,Math.sin(a)*r);}starShape.closePath();
 floor(new T.ShapeGeometry(starShape),gold,0,lift+.018,2.3);
 for(const side of [-1,1])floor(new T.RingGeometry(.17,.23,16),glow,side*2.35,lift+.018,2.4);
 root.userData.platformHeight=lift;root.userData.steps=PORTAL_STEPS;
 add(new T.TorusGeometry(3.25,.23,8,64),silver,0,3.3);
 add(new T.TorusGeometry(3.01,.07,6,64),glow,0,3.3,.04);
 add(new T.TorusGeometry(3.54,.045,5,64),gold,0,3.3);
 add(new T.TorusGeometry(3.65,.085,5,64),silver,0,3.3,-.12);
 for(let i=0;i<24;i++){
  const a=i*Math.PI/12,x=Math.sin(a)*3.27,y=3.3+Math.cos(a)*3.27;
  const seam=add(new T.BoxGeometry(.06,.39,.045),plinth,x,y,.23);seam.rotation.z=-a;
  const stud=add(new T.SphereGeometry(.065,6,4),gold,x,y,.27);stud.scale.z=.5;
 }
 for(const side of [-1,1]){
  add(new T.CylinderGeometry(.57,.8,.55,8),silver,side*3.7,.28,.05);
  add(new T.CylinderGeometry(.59,.59,.12,8),gold,side*3.7,.62,.05);
  const gem=add(new T.OctahedronGeometry(.6),gemMaterial,side*3.7,1.45,.05);gem.scale.set(.7,1.7,.7);
  const wing=new T.Shape();wing.moveTo(0,0);wing.quadraticCurveTo(side*.55,.55,side*1.35,.35);wing.lineTo(side*.82,-.3);wing.lineTo(side*.45,-.12);wing.lineTo(side*.15,-.5);wing.closePath();
  add(new T.ExtrudeGeometry(wing,{depth:.12,bevelEnabled:true,bevelSize:.045,bevelThickness:.045,bevelSegments:1,steps:1}),silver,side*3.13,3.8,-.1);
 }
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,x=Math.sin(a)*3.55,y=3.3+Math.cos(a)*3.55;
  const crystal=add(new T.OctahedronGeometry(i===0?.54:.27),gemMaterial,x,y,.06);crystal.scale.y=1.65;
 }
 // A portal is an opaque window into its own scene. Write depth so ground
 // shadow overlays behind it cannot blend over the veil during transparent draws.
 const material=new T.ShaderMaterial({uniforms:{time:{value:0}},side:T.DoubleSide,depthWrite:true,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 vUv;uniform float time;
   void main(){vec2 p=vUv*2.-1.;float r=length(p),a=atan(p.y,p.x);float swirl=sin(23.*r-4.*a-time*1.4)*.5+.5;
   vec3 c=mix(vec3(.12,.10,.42),vec3(.53,.25,.95),swirl*.55+.3);c+=vec3(.20,.55,.74)*pow(r,8.);
   float spark=pow(max(0.,sin(a*13.+r*35.-time)),32.)*.22;c+=spark;
   gl_FragColor=vec4(c,1.);#include <tonemapping_fragment>
   #include <colorspace_fragment>}`.replace(';#include',';\n#include')});
 const veil=add(new T.CircleGeometry(2.93,64),material,0,3.3,.015);veil.name='Portal swirling surface';
 const dormant=add(new T.CircleGeometry(2.93,64),new T.MeshBasicMaterial({color:'#242238',side:T.DoubleSide,transparent:true,opacity:.48}),0,3.3,0);dormant.name='Dormant portal surface';
 let working=true;
 const setWorking=(value:boolean)=>{if(value===working)return;working=value;root.userData.working=value;veil.visible=value;dormant.visible=!value;glow.color.set(value?'#a88bff':'#484055');gemMaterial.color.set(value?'#bfa3ed':'#625570');gemMaterial.emissiveIntensity=value?.8:0;};
 root.userData.working=true;dormant.visible=false;
 const batches=new Map<T.Material,T.Mesh[]>();root.updateMatrixWorld(true);
 for(const o of [...root.children])if(o instanceof T.Mesh&&o!==veil&&o!==dormant){const m=o.material as T.Material,list=batches.get(m)??[];list.push(o);batches.set(m,list);}
 for(const [m,parts] of batches){const gs=parts.map(p=>{p.updateMatrix();const g=p.geometry.index?p.geometry.toNonIndexed():p.geometry.clone();g.applyMatrix4(p.matrix);return g;});const geometry=mergeGeometries(gs);if(!geometry)throw Error('Cannot batch portal');const merged=new T.Mesh(geometry,m);merged.name='Portal silverwork and crystals';root.add(merged);for(const p of parts){p.removeFromParent();p.geometry.dispose();}gs.forEach(g=>g.dispose());}
 return {group:root,get working(){return working;},setWorking,update:(seconds:number)=>{if(working)material.uniforms.time.value=seconds;},dispose:()=>{
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();
 }};
}
