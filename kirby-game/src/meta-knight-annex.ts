import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {META_KNIGHT_ANNEX as SITE} from './meta-knight-arena-site';

/** A separate portal landing and a duel gate; the portal itself always stays open. */
export function createMetaKnightAnnex(){
 const group=new T.Group();group.name='Meta Knight portal annex';group.rotation.y=SITE.angle;
 const silver=new T.MeshStandardMaterial({color:'#b5bfdc',metalness:.6,roughness:.32}),dark=new T.MeshStandardMaterial({color:'#363554',metalness:.3,roughness:.55});
 const floor=new T.MeshStandardMaterial({color:'#30365f',metalness:.24,roughness:.5}),gold=new T.MeshStandardMaterial({color:'#cfb985',metalness:.55,roughness:.35});
 const glow=new T.MeshBasicMaterial({color:'#a5ccff',toneMapped:false});
 const add=(geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number)=>{const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
 const length=SITE.portalRadius-SITE.start;
 add(new T.BoxGeometry(10,1.2,length),silver,0,-.7,SITE.start+length/2);
 add(new T.BoxGeometry(9.6,.12,length),floor,0,-.09,SITE.start+length/2).receiveShadow=true;
 add(new T.CylinderGeometry(SITE.radius,SITE.radius-.5,1.4,64),silver,0,-.8,SITE.portalRadius);
 add(new T.CylinderGeometry(SITE.radius-.3,6,3,64),dark,0,-2.9,SITE.portalRadius);
 add(new T.CylinderGeometry(6,1,4,48),dark,0,-6.3,SITE.portalRadius);
 const landing=add(new T.CircleGeometry(SITE.radius-.24,64),floor,0,-.025,SITE.portalRadius);landing.rotation.x=-Math.PI/2;landing.receiveShadow=true;
 for(const side of [-1,1]){
  add(new T.BoxGeometry(.18,.16,length),gold,side*4.82,.025,SITE.start+length/2);
  add(new T.BoxGeometry(.07,.045,length),glow,side*4.51,.025,SITE.start+length/2);
  const post=add(new T.CylinderGeometry(.42,.7,7,8),silver,side*5.25,3.3,SITE.gate);post.name='Duel gate pillar';
  add(new T.CylinderGeometry(.73,.73,.15,8),gold,side*5.25,.12,SITE.gate);
  const gem=add(new T.OctahedronGeometry(.6),glow,side*5.25,7.25,SITE.gate);gem.scale.y=1.7;
 }
 for(const radius of [8.65,7.9]){const ring=add(new T.TorusGeometry(radius,.055,5,96),gold,0,.025,SITE.portalRadius);ring.rotation.x=Math.PI/2;}
 for(let i=0;i<5;i++){const seam=add(new T.BoxGeometry(8.9,.015,.025),gold,0,.005,SITE.start+3+i*4.3);seam.name='Portal bridge inlay';}
 // Batch the static landing and rails by material. The animated veil stays separate.
 group.updateMatrixWorld(true);const batches=new Map<T.Material,T.Mesh[]>();
 for(const object of group.children)if(object instanceof T.Mesh){const material=object.material as T.Material,list=batches.get(material)??[];list.push(object);batches.set(material,list);}
 for(const [material,meshes] of batches){const parts=meshes.map(mesh=>{mesh.updateMatrix();const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrix);return geometry;}),geometry=mergeGeometries(parts)!;
  const mesh=new T.Mesh(geometry,material);mesh.name='Portal annex stone and inlay';mesh.receiveShadow=true;group.add(mesh);for(const part of meshes){part.removeFromParent();part.geometry.dispose();}parts.forEach(g=>g.dispose());
 }
 const material=new T.ShaderMaterial({transparent:true,side:T.DoubleSide,depthWrite:false,toneMapped:false,uniforms:{time:{value:0}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 vUv;uniform float time;void main(){
   vec2 p=vUv;float top=1.-smoothstep(.65,1.,p.y),edge=pow(abs(p.x-.5)*2.,12.);
   float sweep=pow(.5+.5*sin(p.y*55.-time*2.4+p.x*5.),12.);
   vec2 cell=abs(fract(p*vec2(9.,30.)+vec2(0.,time*.025))-.5);float lattice=1.-smoothstep(.025,.055,min(cell.x,cell.y));
   float shimmer=pow(max(0.,sin(p.x*35.+p.y*79.-time*1.6)),28.);
   vec3 colour=mix(vec3(.26,.32,.9),vec3(.7,.88,1.),edge*.6+sweep*.35)+shimmer*.4;
   gl_FragColor=vec4(colour,(.21+.13*lattice+.22*sweep+.2*edge)*top);
   #include <colorspace_fragment>
  }`});
 const gate=new T.Mesh(new T.PlaneGeometry(10.5,26),material);gate.name='Closed duel bridge barrier';gate.position.set(0,13,SITE.gate);gate.visible=false;gate.renderOrder=4;group.add(gate);
 return {group,gate,setClosed:(closed:boolean)=>{gate.visible=closed;group.userData.closed=closed;},update:(seconds:number)=>{material.uniforms.time.value=seconds;}};
}
