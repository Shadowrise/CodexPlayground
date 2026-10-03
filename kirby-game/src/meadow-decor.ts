import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {biomeAt,type Biome} from './forest';
import {sceneryClearance} from './landmarks';
import {dryGround} from './pond-layout';
import {MEADOW_HALF_SIZE} from './world-bounds';
import {spatialInstances} from './spatial-instances';

type Tree={x:number;z:number;crownRadius:number};
type Kind='flowers'|'mushrooms'|'stump'|'bush'|'fern';
export type DecorSite={x:number;z:number;radius:number;kind:Kind;biome:Biome};
const PALETTES={
 spruce:{grass:['#376b48','#527c46','#719454'],leaf:'#366548',flowers:['#aa9fdc','#e7d5ec'],cap:'#c77d39',bush:'#46694c'},
 birch:{grass:['#689148','#87a75b','#a8b876'],leaf:'#608846',flowers:['#fff4df','#779bd8'],cap:'#c2573e',bush:'#759853'},
 orchard:{grass:['#42804b','#5a9c51','#87b764'],leaf:'#467d43',flowers:['#f6a6c5','#ffe59a'],cap:'#b48045',bush:'#458758'},
 autumn:{grass:['#87904b','#b79b51','#b77e46'],leaf:'#978248',flowers:['#e4b74e','#e49471'],cap:'#ce833b',bush:'#bc7943'},
};
const leaf=new T.BufferGeometry();
leaf.setAttribute('position',new T.Float32BufferAttribute([0,0,-.5,-.35,.015,0,0,.08,0,.35,.015,0,0,0,.5],3));
leaf.setIndex([0,1,2,1,4,2,4,3,2,3,0,2]);leaf.computeVertexNormals();
const stem=new T.CylinderGeometry(1,1,1,5),ball=new T.IcosahedronGeometry(1,0);
const cap=new T.SphereGeometry(1,10,5,0,Math.PI*2,0,Math.PI/2);
const trunk=new T.CylinderGeometry(.82,1,1,10),disk=new T.CylinderGeometry(1,1,.04,12);
const ring=new T.RingGeometry(.96,1,24);ring.rotateX(-Math.PI/2);
const crack=new T.BoxGeometry(1,1,1);

function prototype(kind:Kind,biome:Biome,variant:number){
 const palette=PALETTES[biome],parts:T.BufferGeometry[]=[],object=new T.Object3D();let seed=197+variant*113;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const add=(geometry:T.BufferGeometry,color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,ry=0,rz=0)=>{
  object.position.set(x,y,z);object.scale.set(sx,sy,sz);object.rotation.set(rx,ry,rz);object.updateMatrix();
  const copy=geometry.index?geometry.toNonIndexed():geometry.clone();copy.deleteAttribute('uv');copy.applyMatrix4(object.matrix);
  const c=new T.Color(color),colors=new Float32Array(copy.getAttribute('position').count*3);
  for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}copy.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(copy);
 };
 if(kind==='flowers'){
  const petals=variant?6:8,h=variant?.74:.52;
  add(stem,palette.leaf,0,h/2,0,.022,h,.022);
  add(leaf,palette.leaf,.12,h*.4,0,.38,1,.6,0,.5,-.65);
  add(leaf,palette.grass[1],-.11,h*.62,0,.33,1,.52,0,-.5,.75);
  for(let i=0;i<petals;i++){const a=i/petals*Math.PI*2;add(leaf,palette.flowers[variant],Math.sin(a)*.17,h,Math.cos(a)*.17,.35,.5,.45,-.2,a);}
  add(ball,variant?'#ce7a3b':'#eac65a',0,h+.055,0,.1,.075,.1);
  for(let i=0;i<3;i++){const a=i*2.399;add(ball,'#fff0b6',Math.sin(a)*.06,h+.105,Math.cos(a)*.06,.013,.018,.013);}
 }else if(kind==='mushrooms'){
  add(stem,'#e1ceb0',0,.26,0,.1,.52,.1,0,0,.08);
  add(cap,palette.cap,0,.51,0,.42,.22,.42);
  add(disk,'#edcf9e',0,.509,0,.4,1,.4);
  for(let i=0;i<7;i++){const a=i*2.399,r=.13+.15*(i%3)/2;add(ball,biome==='birch'?'#fff0d4':'#e2b772',Math.sin(a)*r,.51+.22*Math.sqrt(1-(r/.42)**2),Math.cos(a)*r,.045,.018,.04);}
  for(let i=0;i<8;i++){const a=i*Math.PI/4;add(leaf,'#b99a73',Math.sin(a)*.22,.485,Math.cos(a)*.22,.03,.15,.3,0,a);}
 }else if(kind==='stump'){
  add(trunk,biome==='birch'?'#a7a493':'#725440',0,.48,0,.68,.96,.64,0,.2);
  add(disk,'#d8b781',0,.967,0,.55,1,.52);
  for(const r of [.18,.32,.46])add(ring,'#a27a50',.015,.99,0,r,1,r*.94);
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9;add(crack,i%2?'#4f4034':'#9a7651',Math.sin(a)*.57,.46,Math.cos(a)*.56,.035,.72,.022,0,a,.05*Math.sin(i));}
  for(let i=0;i<15;i++){const a=i*2.399;add(leaf,palette.leaf,Math.sin(a)*.52,.12+random()*.15,Math.cos(a)*.52,.28,.8,.45,-.25,a);}
 }else if(kind==='bush'){
  for(let j=0;j<4;j++)add(stem,'#766044',Math.sin(j)*.24,.43,Math.cos(j)*.2,.035,.85,.035,.2,j,.25);
  for(let i=0;i<80;i++){
   const a=i*2.399,y=.15+random()*1.2,r=Math.sqrt(Math.max(0,1-((y-.65)/.85)**2))*(.5+random()*.5);
   add(leaf,i%4?palette.bush:palette.grass[1],Math.sin(a)*r,y,Math.cos(a)*r*.82,.32+random()*.2,1,.48,-.5+random(),a);
  }
  if(biome==='orchard')for(let i=0;i<12;i++){const a=i*2.399;add(ball,'#e7a4ba',Math.sin(a)*.7,.7+random()*.3,Math.cos(a)*.6,.08,.065,.08);}
 }else{
  for(let f=0;f<5;f++){
   const a=f*Math.PI*2/5;
   for(let i=1;i<=7;i++){
    const u=i/8,r=u*.85,y=Math.sin(u*Math.PI*.8)*.68;
    add(stem,palette.leaf,Math.sin(a)*r,y,Math.cos(a)*r,.012,.15,.012,.7,a);
    for(const side of [-1,1])add(leaf,i%2?palette.leaf:palette.grass[1],Math.sin(a)*r+Math.cos(a)*side*.11,y,Math.cos(a)*r-Math.sin(a)*side*.11,.18*(1-u*.65),.8,.5*(1-u*.75),.1,a+side*.9);
   }
  }
 }
 const result=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return result;
}

function distanceLod(mesh:T.Mesh,center:T.Vector3,distance:number){
 const lod=new T.LOD();lod.name=mesh.name;lod.position.copy(center);mesh.position.sub(center);lod.addLevel(mesh,0);lod.addLevel(new T.Group(),distance,.12);return lod;
}

/** Static, seeded undergrowth. Grass stays within the former 144k-blade budget;
 * detailed plants merge per region into a single draw, with no shadow passes.
 */
export function createMeadowDecor(trees:readonly Tree[]){
 const root=new T.Group();root.name='Biome meadow details';
 const grassRoot=new T.Group();grassRoot.name='Meadow grass';root.add(grassRoot);
 const sites:DecorSite[]=[];root.userData.sites=sites;
 let seed=73219;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const dummy=new T.Object3D(),color=new T.Color();
 const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
 const grassGeometry=new T.BufferGeometry(),positions:number[]=[],indices:number[]=[],colors:number[]=[];
 for(let j=0;j<3;j++){
  const a=j*2.399,co=Math.cos(a),si=Math.sin(a),base=positions.length/3,h=.48+j*.09;
  for(const [x,y,z] of [[-.065,0,0],[.065,0,0],[-.04,h*.5,.035],[.04,h*.5,.035],[.11,h,.14]]){positions.push(x*co+z*si,y,-x*si+z*co);const light=.62+.38*y/h;colors.push(light,light,light);}
  indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
 }
 grassGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));grassGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));grassGeometry.setIndex(indices);grassGeometry.computeVertexNormals();
 const grassMaterial=material.clone();
 grassMaterial.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vec4 meadowPosition=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 meadowPosition=instanceMatrix*meadowPosition;
 #endif
 meadowPosition=modelMatrix*meadowPosition;
 transformed.y*=1.0-smoothstep(65.0,105.0,length(meadowPosition.xz-cameraPosition.xz));`);};
 grassMaterial.customProgramCacheKey=()=> 'meadow-grass-distance-v1';
 const grass=new T.InstancedMesh(grassGeometry,grassMaterial,48000);grass.name='Meadow grass';let blades=0;
 const prototypes=new Map<string,T.BufferGeometry>(),cells=new Map<string,T.BufferGeometry[]>();
 const nearTrunk=(x:number,z:number,r:number)=>trees.some(t=>(t.x-x)**2+(t.z-z)**2<(r+.6)**2);
 const tuft=(x:number,z:number,scale:number)=>{
  if(blades>=48000||nearTrunk(x,z,.2))return;
  dummy.position.set(x,0,z);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.setScalar(scale);dummy.updateMatrix();grass.setMatrixAt(blades,dummy.matrix);
  color.set(PALETTES[biomeAt(x,z)].grass[Math.floor(random()*3)]);grass.setColorAt(blades++,color);
 };
 const plant=(kind:Kind,x:number,z:number,scale:number,variant=0)=>{
  const radius=({flowers:.42,mushrooms:.48,stump:.8,bush:1.3,fern:1.15}[kind])*scale;
  if(!sceneryClearance(x,z,radius+.4)||!dryGround(x,z,radius+.2)||nearTrunk(x,z,radius))return;
  if(sites.some(p=>(p.x-x)**2+(p.z-z)**2<(p.radius+radius+.2)**2))return;
  const biome=biomeAt(x,z),key=kind+biome+variant;
  if(!prototypes.has(key))prototypes.set(key,prototype(kind,biome,variant));
  dummy.position.set(x,0,z);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.setScalar(scale);dummy.updateMatrix();
  const copy=prototypes.get(key)!.clone();copy.applyMatrix4(dummy.matrix);
  const cell=`${Math.floor(x/48)},${Math.floor(z/48)}`;if(!cells.has(cell))cells.set(cell,[]);cells.get(cell)!.push(copy);
  sites.push({x,z,radius,kind,biome});
 };
 // First cover every open part of the meadow. Jittered cells prevent random
 // patches from repeatedly covering the same places and leaving bare holes.
 const edge=MEADOW_HALF_SIZE-3,spacing=2.8;
 for(let x=-edge;x<edge;x+=spacing)for(let z=-edge;z<edge;z+=spacing){
  const px=x+spacing*(.15+random()*.7),pz=z+spacing*(.15+random()*.7);
  if(sceneryClearance(px,pz,.45)&&dryGround(px,pz,.45))tuft(px,pz,.8+random()*.7);
 }
 // Understorey follows the actual tree positions, not random grass patches.
 // Keep the trunk clear while putting shrubs inside the crown's footprint.
 for(const tree of trees){
  const start=random()*Math.PI*2;
  for(let i=0;i<2;i++){
   const a=start+i*2.399,scale=.65+random()*.35,r=1.6+random()*Math.max(.1,tree.crownRadius*.65-1.6);
   plant('bush',tree.x+Math.cos(a)*r,tree.z+Math.sin(a)*r,scale);
   if(i%2===0)plant('mushrooms',tree.x+Math.cos(a+.65)*(r+.4),tree.z+Math.sin(a+.65)*(r+.4),.65+random()*.4);
  }
 }
 // A loose, irregular shrub belt along all four mountain edges.
 for(let side=0;side<4;side++)for(let along=-edge+4;along<edge-4;along+=6){
  const inward=MEADOW_HALF_SIZE-6-random()*13,offset=along+(random()-.5)*3;
  const x=side<2?offset:inward*(side===2?1:-1),z=side<2?inward*(side===0?1:-1):offset;
  plant('bush',x,z,.85+random()*.5);
 }
 for(let patch=0;patch<5000;patch++){
  const x=(random()*2-1)*(MEADOW_HALF_SIZE-8),z=(random()*2-1)*(MEADOW_HALF_SIZE-8),radius=2.3+random()*2.8;
  if(!sceneryClearance(x,z,radius+.8)||!dryGround(x,z,radius+.8))continue;
  const biome=biomeAt(x,z);
  for(let i=0;i<12&&blades<48000;i++){
   const a=random()*Math.PI*2,r=Math.sqrt(random())*radius,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;
   tuft(px,pz,.65+random()*.85);
  }
  const chance=random();
  if(chance<.13){const kind:Kind=biome==='spruce'?'fern':'flowers';for(let i=0;i<(kind==='flowers'?7:2);i++){const a=random()*Math.PI*2,r=random()*2.2;plant(kind,x+Math.cos(a)*r,z+Math.sin(a)*r,.7+random()*.6,i%2);}}
  else if(chance<.2){for(let i=0;i<3;i++)plant('mushrooms',x+(random()-.5)*2,z+(random()-.5)*2,.7+random()*.8);}
  else if(chance<.24)plant('bush',x,z,.7+random()*.65);
  else if(chance<.255)plant('stump',x,z,.7+random()*.7);
 }
 grass.count=blades;
 const batches=spatialInstances(grass,48);
 for(const mesh of [...batches.children] as T.InstancedMesh[]){mesh.computeBoundingSphere();grassRoot.add(distanceLod(mesh,mesh.boundingSphere!.center,145));}
 for(const [key,parts] of cells){
  const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,material);mesh.name='Flowers, ferns, mushrooms and shrubs '+key;
  root.add(distanceLod(mesh,geometry.boundingSphere!.center,145));
 }
 for(const p of prototypes.values())p.dispose();
 root.userData.grassBlades=blades*3;return root;
}
