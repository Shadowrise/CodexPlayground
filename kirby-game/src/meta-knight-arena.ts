import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {META_KNIGHT_ARENA as SITE} from './meta-knight-arena-site';
import {createMetaKnightPortal} from './meta-knight-portal';
import {createMetaKnightAnnex} from './meta-knight-annex';

function arenaFloor(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;const c=canvas.getContext('2d')!,n=2048;
 c.fillStyle='#242b55';c.fillRect(0,0,n,n);
 // Deterministic marble veins, baked once on arrival rather than evaluated per frame.
 let seed=81;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
 for(let i=0;i<170;i++){
  c.beginPath();const start=random()*n,phase=random()*20;
  for(let x=0;x<=n;x+=8){const y=start+Math.sin(x*.005+phase)*90+Math.sin(x*.019+phase)*22+Math.sin(x*.061+phase)*5;x?c.lineTo(x,y):c.moveTo(x,y);}
  c.strokeStyle=i%3?'#444a7142':'#919ac14a';c.lineWidth=i%3?.8:1.8;c.stroke();
 }
 const unit=n/92;c.translate(n/2,n/2);
 const circle=(r:number,color:string,width:number)=>{c.beginPath();c.arc(0,0,r*unit,0,Math.PI*2);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
 for(const r of [9.1,10,23.4,24,31,35.5,39.3,40,43.8,45])circle(r,r===40?'#abd7ed':'#c5b88d',r===40?5:2);
 const star=(x:number,y:number,r:number,inner:number,fill:string)=>{
  c.beginPath();for(let j=0;j<8;j++){const a=j*Math.PI/4-Math.PI/2,rr=j%2?inner:r;j?c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr):c.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle='#f1dbb1';c.lineWidth=1.5;c.stroke();
 };
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4;c.save();c.rotate(a);
  c.beginPath();c.moveTo(0,-10.5*unit);c.lineTo(-1.5*unit,-18*unit);c.lineTo(0,-23*unit);c.lineTo(1.5*unit,-18*unit);c.closePath();
  const g=c.createLinearGradient(-unit,0,unit,0);g.addColorStop(0,'#9689b8');g.addColorStop(.5,'#e0d4da');g.addColorStop(.51,'#736c9c');g.addColorStop(1,'#b3abd0');c.fillStyle=g;c.fill();
  c.beginPath();c.moveTo(0,-24.2*unit);c.lineTo(0,-43.8*unit);c.strokeStyle='#c4af884f';c.lineWidth=2;c.stroke();
  star(0,-31*unit,1.5*unit,.32*unit,'#b2a7dc');star(0,-43.6*unit,.8*unit,.18*unit,'#a2dbea');c.restore();
 }
 // Flat silver mask and bat wings echo the approved concept without floor obstacles.
 for(const side of [-1,1]){c.save();c.scale(side,1);c.beginPath();c.moveTo(9.6*unit,-3.3*unit);c.bezierCurveTo(13*unit,-6.1*unit,17*unit,-3.8*unit,20*unit,-1.2*unit);c.bezierCurveTo(16*unit,-2*unit,14.7*unit,1.8*unit,15.8*unit,3.4*unit);c.bezierCurveTo(12.5*unit,1.3*unit,11.6*unit,3*unit,10.3*unit,3.8*unit);c.closePath();c.fillStyle='#a9a8c4';c.fill();c.strokeStyle='#e4dced';c.lineWidth=2;c.stroke();c.restore();}
 c.save();c.scale(unit,unit);c.beginPath();c.moveTo(-6.5,-4.4);c.quadraticCurveTo(0,-6,6.5,-4.4);c.lineTo(5.8,2.4);c.lineTo(0,5.6);c.lineTo(-5.8,2.4);c.closePath();c.fillStyle='#c0bdd4';c.fill();
 c.beginPath();c.moveTo(-5.7,-2.8);c.lineTo(0,-.7);c.lineTo(5.7,-2.8);c.lineTo(4,1.5);c.lineTo(0,3.5);c.lineTo(-4,1.5);c.closePath();c.fillStyle='#313354';c.fill();
 for(const side of [-1,1]){c.beginPath();c.moveTo(side*.8,-.1);c.lineTo(side*4.3,-1.1);c.lineTo(side*3.5,.9);c.lineTo(side*.8,1.3);c.closePath();c.fillStyle='#e6d59a';c.fill();}c.restore();
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}

function nebula(){
 return new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},
 vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`varying vec3 direction;
 float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float fbm(vec3 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.03+3.1;a*=.5;}return n;}
 void main(){vec3 d=normalize(direction);float clouds=fbm(d*5.+vec3(7.,1.,4.));float fine=fbm(d*22.+clouds*3.);
 float ribbon=pow(max(0.,1.-abs(d.y*.65+d.x*.4+sin(d.z*4.)*.2)),9.);
 float density=smoothstep(.30,.78,clouds)*ribbon;vec3 c=vec3(.005,.008,.033);
 c+=mix(vec3(.11,.022,.28),vec3(.025,.16,.36),smoothstep(.3,.7,fine))*density*2.;c+=vec3(.24,.10,.35)*pow(density,3.)*fine;
 gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});
}

/** Imported only at the portal. Every resource here is released on departure. */
export function createMetaKnightArena(renderer:T.WebGLRenderer){
 const scene=new T.Scene();scene.name='Meta Knight cosmic arena';scene.background=new T.Color('#07091f');
 const root=new T.Group();root.position.set(SITE.x,0,SITE.z);scene.add(root);
 const ownedTextures:T.Texture[]=[];
 const crystals:T.Mesh[]=[];
 const silver=new T.MeshStandardMaterial({color:'#afb9d5',metalness:.6,roughness:.32});
 const dark=new T.MeshStandardMaterial({color:'#44365d',metalness:.35,roughness:.46});
 const violet=new T.MeshStandardMaterial({color:'#7356b1',emissive:'#452779',emissiveIntensity:.17,metalness:.35,roughness:.3});
 const gold=new T.MeshStandardMaterial({color:'#cbb47d',metalness:.55,roughness:.35});
 const cyan=new T.MeshBasicMaterial({color:'#80d9ff',toneMapped:false});
 const purple=new T.MeshBasicMaterial({color:'#a979f5',toneMapped:false});
 const crystal=new T.MeshStandardMaterial({color:'#ba9fe8',emissive:'#8f4ae8',emissiveIntensity:.75,metalness:.25,roughness:.22,flatShading:true});
 const add=(g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);root.add(mesh);return mesh;};
 const ring=(r:number,tube:number,m:T.Material,y:number)=>add(new T.TorusGeometry(r,tube,6,192),m,0,y,0,Math.PI/2);
 add(new T.CylinderGeometry(46,45,2,192),silver,0,-1.14);
 add(new T.CylinderGeometry(45,33,4,128),dark,0,-4.1);
 add(new T.CylinderGeometry(33,14,5,96),violet,0,-8.5);
 add(new T.CylinderGeometry(14,2,5,64),dark,0,-13.5);
 const floorTexture=arenaFloor();ownedTextures.push(floorTexture);
 const floorMaterial=new T.MeshStandardMaterial({map:floorTexture,roughness:.59,metalness:.18});
 const floor=add(new T.CircleGeometry(45.5,192),floorMaterial,0,-.035,0,-Math.PI/2);floor.name='Cosmic marble fighting floor';floor.receiveShadow=true;
 for(const [r,t,m,y] of [[45.7,.24,silver,.05],[44.7,.055,gold,.03],[40,.10,cyan,.04],[39.6,.055,silver,.04],[36,.035,gold,.03],[45.4,.1,purple,-1.8],[37,.13,purple,-6.4],[15,.10,purple,-11]] as const)ring(r,t,m,y);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,x=Math.sin(a)*44.6,z=Math.cos(a)*44.6;
  add(new T.CylinderGeometry(1.5,1.9,.7,8),dark,x,.18,z,0,a);
  add(new T.CylinderGeometry(1.5,1.5,.12,8),gold,x,.59,z,0,a);
  add(new T.CylinderGeometry(1.2,1.35,.55,8),silver,x,.91,z,0,a);
  const gem=add(new T.OctahedronGeometry(1.15),crystal,x,2.5,z,0,a);gem.scale.set(.65,1.6,.65);
  gem.name='Cosmic arena crystal '+i;crystals.push(gem);
  const bottom=add(new T.OctahedronGeometry(1),crystal,x,-3.1,z,0,a);bottom.scale.set(.55,1.9,.55);
  // Architectural ribs tie each crystal into the tapered underside.
  const start=new T.Vector3(x,-1.8,z),end=new T.Vector3(Math.sin(a)*14,-11,Math.cos(a)*14),delta=end.clone().sub(start);
  const rib=add(new T.CylinderGeometry(.19,.32,delta.length(),6),silver);rib.position.copy(start).add(end).multiplyScalar(.5);rib.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
  for(let j=0;j<5;j++){const r=20+j*4.4;const g=add(new T.OctahedronGeometry(.3),purple,Math.sin(a)*r,-10+(r-20)*.33,Math.cos(a)*r);g.scale.y=1.7;}
 }
 // Merge architecture by material; the quiet floor remains one separate mesh.
 root.updateMatrixWorld(true);const groups=new Map<T.Material,T.Mesh[]>();
 for(const object of [...root.children])if(object instanceof T.Mesh&&object!==floor&&!crystals.includes(object)){const m=object.material as T.Material;const list=groups.get(m)??[];list.push(object);groups.set(m,list);}
 for(const [material,meshes] of groups){const geometries=meshes.map(mesh=>{const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(mesh.matrix);return g;});const geometry=mergeGeometries(geometries);if(!geometry)throw Error('Cannot batch cosmic arena');const merged=new T.Mesh(geometry,material);merged.name='Cosmic arena architecture';root.add(merged);for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}geometries.forEach(g=>g.dispose());}
 const annex=createMetaKnightAnnex();root.add(annex.group);
 const portal=createMetaKnightPortal();portal.group.position.set(SITE.exitX,0,SITE.exitZ);portal.group.rotation.y=Math.PI+annex.group.rotation.y;root.add(portal.group);
 // A camera outside the rim should see the arena, not the back of its veil.
 for(const name of ['Portal swirling surface','Dormant portal surface'])((portal.group.getObjectByName(name) as T.Mesh).material as T.Material).side=T.FrontSide;
 const sky=new T.Mesh(new T.SphereGeometry(650,32,20),nebula());sky.name='Cosmic nebula sky';root.add(sky);
 let seed=177;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
 const positions:number[]=[],colors:number[]=[];for(let i=0;i<2600;i++){const z=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-z*z),d=540+random()*60;positions.push(Math.cos(a)*r*d,z*d,Math.sin(a)*r*d);const tint=new T.Color().setHSL(.58+random()*.18,.15+random()*.35,.55+random()*.4);colors.push(...tint.toArray());}
 const starsGeometry=new T.BufferGeometry();starsGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));starsGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 const stars=new T.Points(starsGeometry,new T.PointsMaterial({size:1.45,sizeAttenuation:false,vertexColors:true,toneMapped:false}));stars.name='Distant stars';root.add(stars);
 const planetCanvas=document.createElement('canvas');planetCanvas.width=512;planetCanvas.height=256;const pc=planetCanvas.getContext('2d')!;
 for(let y=0;y<256;y++){const light=31+Math.sin(y*.08)*5+Math.sin(y*.31)*2;pc.fillStyle=`hsl(${260+Math.sin(y*.04)*18} 27% ${light}%)`;pc.fillRect(0,y,512,1);}
 const planetTexture=new T.CanvasTexture(planetCanvas);planetTexture.colorSpace=T.SRGBColorSpace;ownedTextures.push(planetTexture);
 const planet=new T.Mesh(new T.SphereGeometry(62,48,32),new T.MeshStandardMaterial({map:planetTexture,roughness:1}));planet.position.set(110,-15,-340);planet.rotation.z=-.3;root.add(planet);
 const planetRing=new T.Mesh(new T.RingGeometry(80,115,128),new T.MeshBasicMaterial({color:'#b7a3c7',side:T.DoubleSide,transparent:true,opacity:.46,depthWrite:false}));planetRing.rotation.set(1.16,-.2,.35);planet.add(planetRing);
 const ringDetail=new T.Mesh(new T.RingGeometry(87,89,128),new T.MeshBasicMaterial({color:'#656083',side:T.DoubleSide}));ringDetail.rotation.copy(planetRing.rotation);planet.add(ringDetail);
 const moon=new T.Mesh(new T.IcosahedronGeometry(15,3),new T.MeshStandardMaterial({color:'#928aa7',roughness:1,flatShading:true}));moon.position.set(-135,8,-240);root.add(moon);
 scene.add(new T.HemisphereLight('#bbc9ff','#50416c',2.1));
 const light=new T.DirectionalLight('#f1e4ff',3.4);light.position.set(SITE.x-50,90,30);light.target.position.set(SITE.x,0,0);scene.add(light,light.target);
 light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:180});light.shadow.normalBias=.05;light.shadow.bias=-.0001;
 const fill=new T.DirectionalLight('#9698ff',1.3);fill.position.set(SITE.x+70,20,-45);fill.target.position.set(SITE.x,0,0);scene.add(fill,fill.target);
 // One small environment map is prepared behind the loading screen.
 const generator=new T.PMREMGenerator(renderer),environment=generator.fromScene(scene,.04,.1,1400,{size:128,position:new T.Vector3(SITE.x,4,0)});scene.environment=environment.texture;generator.dispose();
 return {scene,root,portal,annex,update:(seconds:number)=>{portal.update(seconds);annex.update(seconds);},dispose:()=>{
  portal.dispose();const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
  scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose());environment.dispose();light.shadow.dispose();scene.clear();
 }};
}
export type MetaKnightArenaScene=ReturnType<typeof createMetaKnightArena>;
