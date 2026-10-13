import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createVeinedLeafSurface} from './shrub-model';
import {MUSICAL_FLOWERS,MUSICAL_FLOWER_SITE,validFlowerIndex,canPlayFlower,FLOWER_NOTE_COOLDOWN_MS} from './musical-flower-site';
import {t} from './i18n';

/** Curved, solid petals share one geometry; their fine ribs are one small map. */
function petalSurface(){
 const positions:number[]=[],uvs:number[]=[],colours:number[]=[],indices:number[]=[];
 for(const [count,start,length,width,depth] of [[9,.2,.92,.28,.06],[9,.16,.61,.19,.26]])for(let petal=0;petal<count;petal++){
  const angle=petal/count*Math.PI*2+(length<.7?Math.PI/count:0),co=Math.cos(angle),si=Math.sin(angle),base=positions.length/3;
  const rows=9,cols=5;
  for(let side=0;side<2;side++)for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
   const u=i/(rows-1),v=j/(cols-1)*2-1;
   const spread=width*Math.pow(Math.sin(Math.PI*u),.65)*(1-.18*u)+.006;
   const radial=start+u*length,lateral=v*spread;
   const z=depth+.13*Math.sin(Math.PI*u)-.065*u*u+.055*v*v+(side?-.035:.035);
   positions.push(lateral*co+radial*si,radial*co-lateral*si,z);
   uvs.push(u,(v+1)/2);const shade=.79+.21*u-.065*Math.abs(v);colours.push(shade,shade,shade);
  }
  const layer=rows*cols;
  for(let side=0;side<2;side++)for(let i=0;i<rows-1;i++)for(let j=0;j<cols-1;j++){
   const a=base+side*layer+i*cols+j,b=a+cols;
   if(!side)indices.push(a,a+1,b,a+1,b+1,b);else indices.push(a,b,a+1,a+1,b,b+1);
  }
  // Close the thin edge: side views show a real petal rather than a flat card.
  for(let i=0;i<rows-1;i++)for(const j of [0,cols-1]){const a=base+i*cols+j,b=a+cols;indices.push(a,a+layer,b,b,a+layer,b+layer);}
  for(const i of [0,rows-1])for(let j=0;j<cols-1;j++){const a=base+i*cols+j;indices.push(a,a+1,a+layer,a+1,a+layer+1,a+layer);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setAttribute('color',new T.Float32BufferAttribute(colours,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function petalTexture(){
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/(size-1),v=y/(size-1)-.5;
  const veins=Math.cos((v+.028*Math.sin(u*5))*Math.PI*24)*Math.sin(Math.PI*u);
  const c=Math.round(246-6*veins-12*Math.exp(-((v/.03)**2)));const at=(y*size+x)*4;
  data[at]=data[at+1]=data[at+2]=c;data[at+3]=255;
 }
 const map=new T.DataTexture(data,size,size);map.magFilter=T.LinearFilter;map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.needsUpdate=true;return map;
}
function greenery(){
 const curve=new T.CubicBezierCurve3(new T.Vector3(),new T.Vector3(.12,.65,.03),new T.Vector3(-.13,1.65,-.06),new T.Vector3(0,2.5,0));
 const parts:T.BufferGeometry[]=[],tube=new T.TubeGeometry(curve,14,.065,7,false);
 // Tube UVs use the white corner of the shared leaf-vein map.
 const uv=tube.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,.01,.01);parts.push(tube);
 const calyx=new T.SphereGeometry(.25,10,6);calyx.translate(0,2.5,0);const calyxUv=calyx.getAttribute('uv');for(let i=0;i<calyxUv.count;i++)calyxUv.setXY(i,.01,.01);parts.push(calyx);
 for(const [time,sign,yaw] of [[.27,-1,-.35],[.48,1,.25],[.66,-1,.4]]){
  const root=curve.getPoint(time),direction=new T.Vector3(sign,.3,.12).normalize();
  const base=root.clone().addScaledVector(direction,.16);
  const petiole=new T.TubeGeometry(new T.LineCurve3(root,base),3,.024,5,false),uv=petiole.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setXY(i,.01,.01);parts.push(petiole);
  const p:number[]=[],u:number[]=[],idx:number[]=[],side=new T.Vector3(0,0,1).applyAxisAngle(new T.Vector3(0,1,0),yaw);
  for(let i=0;i<=10;i++)for(let j=0;j<=4;j++){
   const a=i/10,v=j/2-1,width=.2*Math.pow(Math.sin(Math.PI*a),.8);
   const point=base.clone().addScaledVector(direction,a*.83).addScaledVector(side,v*width);point.y+=Math.sin(Math.PI*a)*.09-.06*v*v;
   p.push(point.x,point.y,point.z);u.push(a,(v+1)/2);
   if(i<10&&j<4){const n=i*5+j;idx.push(n,n+5,n+1,n+1,n+5,n+6);}
  }
  const leaf=new T.BufferGeometry();leaf.setAttribute('position',new T.Float32BufferAttribute(p,3));leaf.setAttribute('uv',new T.Float32BufferAttribute(u,2));leaf.setIndex(idx);leaf.computeVertexNormals();parts.push(leaf);
 }
 const g=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());return g;
}
function pollen(){
 const parts:T.BufferGeometry[]=[],dome=new T.SphereGeometry(.32,18,10);dome.scale(1,1,.43);dome.translate(0,0,.4);parts.push(dome);
 for(let i=0;i<24;i++){
  const a=i*2.399,r=.27*Math.sqrt((i+.5)/24),g=new T.SphereGeometry(.025,5,3);
  g.translate(Math.sin(a)*r,Math.cos(a)*r,.42+.13*Math.sqrt(1-(r/.32)**2));parts.push(g);
 }
 const merged=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return merged;
}
export function musicalNoteGeometry(){
 // One continuous outline: a full tilted oval joins both sides of the stem.
 const note=new T.Shape();note.moveTo(.02,-.17);note.lineTo(.02,.48);note.lineTo(.11,.48);
 note.bezierCurveTo(.15,.35,.45,.38,.37,.06);note.bezierCurveTo(.33,.21,.17,.22,.11,.27);note.lineTo(.11,-.29);
 note.bezierCurveTo(.08,-.47,-.30,-.51,-.38,-.34);note.bezierCurveTo(-.46,-.17,-.08,-.08,.02,-.17);note.closePath();
 return new T.ExtrudeGeometry(note,{depth:.045,bevelEnabled:true,bevelThickness:.009,bevelSize:.009,bevelSegments:1,steps:1,curveSegments:16});
}
type Flower={root:T.Group;head:T.Group;halo:T.Mesh;haloMaterial:T.MeshBasicMaterial;playedAt:number;box:T.Box3};
type FloatingNote={mesh:T.Mesh;material:T.MeshBasicMaterial;index:number;born:number};

export class MusicalFlowers {
 readonly group=new T.Group();
 readonly flowers:Flower[]=[];
 private notes:FloatingNote[]=[];
 private lastPressed=-Infinity;
 private origin=new T.Vector3();
 private readonly petals:T.InstancedMesh;
 private readonly stems:T.InstancedMesh;
 private readonly centres:T.InstancedMesh;
 private readonly glow:T.InstancedBufferAttribute;
 private matrix=new T.Matrix4();
 constructor(){
  this.group.name='Seven musical flowers';
  const petals=petalSurface(),map=petalTexture(),stem=greenery(),centre=pollen(),halo=new T.TorusGeometry(1.2,.022,4,40);
  const green=new T.MeshLambertMaterial({color:'#598264',map:createVeinedLeafSurface(),side:T.DoubleSide}),gold=new T.MeshLambertMaterial({color:'#ebc776'});
  const bloomMaterial=new T.MeshLambertMaterial({map,vertexColors:true,side:T.DoubleSide});
  this.glow=new T.InstancedBufferAttribute(new Float32Array(7),1);petals.setAttribute('flowerPulse',this.glow);
  bloomMaterial.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float flowerPulse; varying float vFlowerPulse;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFlowerPulse=flowerPulse;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vFlowerPulse;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vFlowerPulse*vColor.rgb*.9;');
  };
  bloomMaterial.customProgramCacheKey=()=> 'musical-flower-glow-v1';
  this.petals=new T.InstancedMesh(petals,bloomMaterial,7);this.stems=new T.InstancedMesh(stem,green,7);this.centres=new T.InstancedMesh(centre,gold,7);
  this.petals.name='Instanced flower petals';this.stems.name='Instanced flower stems and veined leaves';this.centres.name='Instanced flower pollen';
  for(const mesh of [this.petals,this.stems,this.centres]){mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(mesh);}
  MUSICAL_FLOWERS.forEach((f,i)=>{
   const root=new T.Group(),head=new T.Group();root.name=`Musical flower ${i}`;root.position.set(f.x,0,f.z);root.rotation.y=f.yaw;
   head.position.y=f.height;head.rotation.x=-.24;head.rotation.z=(i-3)*-.025;
   const haloMaterial=new T.MeshBasicMaterial({color:f.color,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
   const ring=new T.Mesh(halo,haloMaterial);ring.position.z=-.12;ring.visible=false;head.add(ring);root.add(head);this.group.add(root);
   this.flowers.push({root,head,halo:ring,haloMaterial,playedAt:-Infinity,box:new T.Box3().setFromCenterAndSize(new T.Vector3(f.x,1.5,f.z),new T.Vector3(3,3.8,3))});
   this.petals.setColorAt(i,new T.Color(f.color));this.syncFlower(i);
  });
  for(const mesh of [this.petals,this.stems,this.centres]){mesh.computeBoundingSphere();mesh.boundingSphere!.radius+=.8;}
  const geometry=musicalNoteGeometry();
  for(let i=0;i<14;i++){
   const material=new T.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false});
   const mesh=new T.Mesh(geometry,material);mesh.visible=false;mesh.name='Floating musical note';this.group.add(mesh);this.notes.push({mesh,material,index:0,born:-Infinity});
  }
 }
 private syncFlower(index:number){
  const flower=this.flowers[index];flower.root.updateMatrix();flower.head.updateMatrix();
  this.matrix.makeScale(1,MUSICAL_FLOWERS[index].height/2.5,1).premultiply(flower.root.matrix);this.stems.setMatrixAt(index,this.matrix);
  this.matrix.multiplyMatrices(flower.root.matrix,flower.head.matrix);this.petals.setMatrixAt(index,this.matrix);this.centres.setMatrixAt(index,this.matrix);
  this.petals.instanceMatrix.needsUpdate=this.stems.instanceMatrix.needsUpdate=this.centres.instanceMatrix.needsUpdate=true;
 }
 target(index:number){const flower=this.flowers[index];return {key:flower,root:this.group,box:flower.box};}
 nearest(p:T.Vector3,size:number){
  let closest=-1,distance=Infinity;
  for(let i=0;i<MUSICAL_FLOWERS.length;i++)if(canPlayFlower(i,p,size)){
   const f=MUSICAL_FLOWERS[i],d=(p.x-f.x)**2+(p.z-f.z)**2;if(d<distance){distance=d;closest=i;}
  }
  return closest;
 }
 prompt(index:number){return t('E — Сыграть ноту {0}',[t(MUSICAL_FLOWERS[index].note)]);}
 press(index:number,now:number){if(!validFlowerIndex(index)||now-this.lastPressed<FLOWER_NOTE_COOLDOWN_MS/1000)return false;this.lastPressed=now;this.play(index,now);return true;}
 play(index:number,now:number){
  if(!validFlowerIndex(index))return;
  this.flowers[index].playedAt=now;
  const note=this.notes.find(n=>now-n.born>=1.6)??this.notes.reduce((a,b)=>a.born<b.born?a:b);
  note.index=index;note.born=now;note.material.color.set(MUSICAL_FLOWERS[index].color);note.material.opacity=1;note.mesh.visible=true;
 }
 update(now:number,camera:T.Camera){
  this.group.visible=(camera.position.x-MUSICAL_FLOWER_SITE.x)**2+camera.position.y**2+(camera.position.z-MUSICAL_FLOWER_SITE.z)**2<300*300;
  for(let i=0;i<this.flowers.length;i++){
   const flower=this.flowers[i],age=now-flower.playedAt,pulse=age>=0&&age<.95?Math.sin(Math.PI*Math.min(1,age/.95))*Math.exp(-age*.7):0;
   if(!pulse&&this.glow.getX(i)===0)continue;
   this.glow.setX(i,pulse);this.glow.needsUpdate=true;
   flower.root.rotation.z=pulse*Math.sin(age*10)*.028;
   flower.head.scale.setScalar(1+pulse*.055);flower.halo.visible=pulse>.015;
   flower.halo.scale.setScalar(1+Math.max(0,Math.min(1,age/.95))*.3);flower.haloMaterial.opacity=pulse*.42;
   this.syncFlower(i);
  }
  for(const note of this.notes){
   const age=now-note.born;if(age>=1.6||age<0){note.mesh.visible=false;continue;}
   const flower=this.flowers[note.index];flower.root.updateWorldMatrix(true,true);flower.head.getWorldPosition(this.origin);
   const yaw=MUSICAL_FLOWERS[note.index].yaw;
   note.mesh.position.copy(this.origin);note.mesh.position.y+=.4+age*1.45;note.mesh.position.x+=Math.sin(age*2.3)*.35+Math.sin(yaw)*.65;note.mesh.position.z+=Math.cos(yaw)*.65;
   note.mesh.quaternion.copy(camera.quaternion);note.mesh.rotateZ(Math.sin(age*3)*.12);
   note.mesh.scale.setScalar(.62+.24*Math.sin(Math.min(1,age/.4)*Math.PI*.5));
   note.material.opacity=1-T.MathUtils.smoothstep(age,1.05,1.6);
  }
 }
 reset(){this.lastPressed=-Infinity;this.flowers.forEach((flower,i)=>{flower.playedAt=-Infinity;this.glow.setX(i,0);flower.root.rotation.z=0;flower.head.scale.setScalar(1);flower.halo.visible=false;this.syncFlower(i);});this.glow.needsUpdate=true;for(const note of this.notes){note.born=-Infinity;note.mesh.visible=false;}}
}
