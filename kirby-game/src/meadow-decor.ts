import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {biomeAt,type Biome} from './forest';
import {sceneryClearance} from './landmarks';
import {flatGround as dryGround,WATER_REGIONS} from './pond-layout';
import {MeadowLayout,meadowPathHalfWidth,type MeadowTree} from './meadow-layout';
import {MeadowIndex} from './meadow-index';
import {MEADOW_HALF_SIZE} from './world-bounds';
import {spatialInstances} from './spatial-instances';
import {BIOME_STYLE as PALETTES} from './biome-style';

type Kind='flowers'|'mushrooms'|'stump'|'bush'|'fern'|'reeds';
export type DecorSite={x:number;z:number;radius:number;kind:Kind;biome:Biome};
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
  for(let i=0;i<52;i++){
   const a=i*2.399,y=.15+random()*1.2,r=Math.sqrt(Math.max(0,1-((y-.65)/.85)**2))*(.5+random()*.5);
   add(leaf,i%4?palette.bush:palette.grass[1],Math.sin(a)*r,y,Math.cos(a)*r*.82,.4+random()*.22,1,.58,-.5+random(),a);
  }
  if(biome==='orchard')for(let i=0;i<5;i++){const a=i*2.399;add(ball,palette.flowers[0],Math.sin(a)*.7,.7+random()*.3,Math.cos(a)*.6,.09,.075,.09);}
 }else if(kind==='reeds'){
  for(let i=0;i<6;i++){
   const a=i*2.399,r=.12+random()*.32,x=Math.sin(a)*r,z=Math.cos(a)*r,h=.8+random()*.5;
   add(stem,palette.leaf,x,h/2,z,.019,h,.019);
   if(i%2===0)add(stem,'#896c4b',x,h-.08,z,.046,.24,.046);
   for(let j=0;j<2;j++)add(leaf,palette.grass[j],x+Math.sin(a+j)*.12,.23+j*.22,z+Math.cos(a+j)*.12,.09,1,.58,-.7,a+j);
  }
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
export function createMeadowDecor(trees:readonly MeadowTree[],layout=new MeadowLayout(trees)){
 const root=new T.Group();root.name='Biome meadow details';
 const grassRoot=new T.Group();grassRoot.name='Meadow grass';root.add(grassRoot);
 const sites:DecorSite[]=[];root.userData.sites=sites;
 let seed=73219;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const dummy=new T.Object3D(),color=new T.Color();
 const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
 const grassGeometry=new T.BufferGeometry(),positions:number[]=[],indices:number[]=[],colors:number[]=[];
 for(let j=0;j<3;j++){
  const a=j*2.399,co=Math.cos(a),si=Math.sin(a),base=positions.length/3,h=.34+j*.045;
  for(const [x,y,z] of [[-.09,0,0],[.09,0,0],[-.055,h*.55,.1],[.055,h*.55,.1],[.16,h,.24]]){positions.push(x*co+z*si,y,-x*si+z*co);const light=.72+.28*y/h;colors.push(light,light,light);}
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
 const prototypes=new Map<string,T.BufferGeometry>(),cells=new Map<string,T.BufferGeometry[]>();let plantTriangles=0,plantLimit=850000;
 const treeIndex=new MeadowIndex(12,trees),plantIndex=new MeadowIndex<DecorSite>(8);
 const fruitIndex=new MeadowIndex(16,layout.fruitClearings);
 const nearTrunk=(x:number,z:number,r:number)=>treeIndex.some(x,z,r+.6,t=>(t.x-x)**2+(t.z-z)**2<(r+.6)**2);
 const tuft=(x:number,z:number,scale:number)=>{
  if(blades>=48000||nearTrunk(x,z,.2)||!layout.clearOfTrails(x,z,.35))return;
  dummy.position.set(x,0,z);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.setScalar(scale);dummy.updateMatrix();grass.setMatrixAt(blades,dummy.matrix);
  color.set(PALETTES[biomeAt(x,z)].grass[Math.floor(random()*3)]);grass.setColorAt(blades++,color);
 };
 const plant=(kind:Kind,x:number,z:number,scale:number,variant=0,garden=false)=>{
  const initialKey=kind+biomeAt(x,z)+variant;
  if(!prototypes.has(initialKey))prototypes.set(initialKey,prototype(kind,biomeAt(x,z),variant));
  if(plantTriangles+prototypes.get(initialKey)!.attributes.position.count/3>plantLimit)return;
  const radius=({flowers:.42,mushrooms:.48,stump:.8,bush:1.3,fern:1.15,reeds:.68}[kind])*scale;
  const valid=(x:number,z:number)=>(garden||kind==='reeds'||sceneryClearance(x,z,radius+.4))&&dryGround(x,z,radius+.2)&&!nearTrunk(x,z,radius)&&!plantIndex.some(x,z,radius+2.5,p=>(p.x-x)**2+(p.z-z)**2<(p.radius+radius+.2)**2)
   && !fruitIndex.some(x,z,radius+3.3,p=>(p.x-x)**2+(p.z-z)**2<(radius+3.3)**2);
  if(!valid(x,z))return;
  if(!layout.clearOfTrails(x,z,radius)){
   const target=layout.moveOffTrail(x,z,radius,valid);if(!target)return;x=target.x;z=target.z;
  }
  const biome=biomeAt(x,z),key=kind+biome+variant;
  if(!prototypes.has(key))prototypes.set(key,prototype(kind,biome,variant));
  const triangles=prototypes.get(key)!.attributes.position.count/3;
  if(plantTriangles+triangles>plantLimit)return;plantTriangles+=triangles;
  dummy.position.set(x,0,z);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.setScalar(scale);dummy.updateMatrix();
  const copy=prototypes.get(key)!.clone();copy.applyMatrix4(dummy.matrix);
  const cell=`${Math.floor(x/48)},${Math.floor(z/48)}`;if(!cells.has(cell))cells.set(cell,[]);cells.get(cell)!.push(copy);
  const site={x,z,radius,kind,biome};sites.push(site);plantIndex.add(site);
 };
 const density=(x:number,z:number)=>.5+.24*Math.sin(x*.046+1.6*Math.sin(z*.026))+.22*Math.cos(z*.054+1.3*Math.sin(x*.033));
 // First cover every open part of the meadow. Jittered cells prevent random
 // patches from repeatedly covering the same places and leaving bare holes.
 const edge=MEADOW_HALF_SIZE-3,spacing=2.8;
 for(let x=-edge;x<edge;x+=spacing)for(let z=-edge;z<edge;z+=spacing){
  const px=x+spacing*(.15+random()*.7),pz=z+spacing*(.15+random()*.7);
  if(sceneryClearance(px,pz,.45)&&dryGround(px,pz,.45))tuft(px,pz,.6+density(px,pz)*.45+random()*.15);
 }
 // Low shrubs loosely frame both sides of the paths, never forming a hedge
 // across junctions or the worn entrance pads. Reuse the merged plant budget.
 let trailBushes=0;
 for(const path of layout.paths){
  let distance=0,next=6;
  for(let i=1;i<path.points.length;i++){
   const a=path.points[i-1],b=path.points[i],len=Math.hypot(b.x-a.x,b.z-a.z);distance+=len;if(distance<next||len<.001)continue;next=distance+7+random()*5;
   for(const side of [-1,1]){
    if(random()<.22)continue;
    const offset=meadowPathHalfWidth(path,b)+3.4+random()*2.2,x=b.x-(b.z-a.z)/len*offset*side,z=b.z+(b.x-a.x)/len*offset*side;
    const before=sites.length;plant('bush',x,z,.65+random()*.4);trailBushes+=sites.length-before;
   }
  }
 }
 root.userData.trailBushes=trailBushes;
 // Understorey follows the actual tree positions, not random grass patches.
 // Keep the trunk clear while putting shrubs inside the crown's footprint.
 // Interleave mature anchors and young groves so a capped plant budget remains
 // distributed across the whole map instead of being exhausted in one biome.
 plantLimit=650000;
 const order=trees.map((tree,i)=>({tree,key:Math.imul(i+1,2654435761)>>>0})).sort((a,b)=>a.key-b.key);
 for(const {tree} of order){
  const start=random()*Math.PI*2;
  const count=tree.crownRadius>3&&random()<.16?2:1;
  for(let i=0;i<count;i++){
   const scale=Math.min(.65+random()*.35,Math.max(.34,tree.crownRadius*.29));
   const r=Math.max(.72+1.3*scale,tree.crownRadius*.45)+random()*Math.max(.1,tree.crownRadius*.2);
   const a=start+i*2.399;
   for(let attempt=0;attempt<5;attempt++){
    const before=sites.length,angle=a+attempt*2.399,x=tree.x+Math.cos(angle)*r,z=tree.z+Math.sin(angle)*r;
    if(!layout.clearOfTrails(x,z,1.3*scale))continue;plant('bush',x,z,scale);if(sites.length>before)break;
   }
   if(i===0&&random()<.13)plant('mushrooms',tree.x+Math.cos(a+.65)*(r+.4),tree.z+Math.sin(a+.65)*(r+.4),.65+random()*.4);
  }
  // Dense grass and occasional ferns form a connected understorey around each
  // shrub, while the small tuft grid above keeps the open meadow readable.
  for(let i=0;i<15;i++){
   const a=start+i*2.399,r=1+Math.sqrt(random())*tree.crownRadius*.75,x=tree.x+Math.cos(a)*r,z=tree.z+Math.sin(a)*r;
   if(sceneryClearance(x,z,.45)&&dryGround(x,z,.45))tuft(x,z,.95+random()*.45);
   if(i===5&&biomeAt(x,z)==='spruce'&&random()<.12)plant('fern',x,z,.75);
  }
 }
 plantLimit=850000;
 // A loose, irregular shrub belt along all four mountain edges.
 for(let side=0;side<4;side++)for(let along=-edge+4;along<edge-4;along+=6){
  const inward=MEADOW_HALF_SIZE-6-random()*13,offset=along+(random()-.5)*3;
  const x=side<2?offset:inward*(side===2?1:-1),z=side<2?inward*(side===0?1:-1):offset;
  plant('bush',x,z,.85+random()*.5);
 }
 // Small gardens frame entrances/benches, leaving the worn approach clear.
 for(const bed of layout.flowerBeds)for(let i=0;i<22;i++){
  const a=i*2.399,r=Math.sqrt((i+.5)/22);
  plant('flowers',bed.x+Math.cos(a)*r*bed.rx,bed.z+Math.sin(a)*r*bed.rz,.7+random()*.2,i%2,true);
 }
 // Rare reed pockets stand on the dry side of the actual bank contour.
 for(const region of WATER_REGIONS)for(const ring of region)for(let i=1;i<ring.length;i+=9){
  const [ax,az]=ring[i-1],[bx,bz]=ring[i],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);if(!len||random()>.32)continue;
  const x=(ax+bx)/2+dz/len*3.5,z=(az+bz)/2-dx/len*3.5;
  if(!sceneryClearance(x,z,3,true))continue;
  for(let j=0;j<3;j++)plant('reeds',x+(random()-.5)*1.4,z+(random()-.5)*1.4,.75+random()*.25);
 }
 for(let patch=0;patch<5000;patch++){
  const x=(random()*2-1)*(MEADOW_HALF_SIZE-8),z=(random()*2-1)*(MEADOW_HALF_SIZE-8),radius=3.5+random()*4;
  if(!sceneryClearance(x,z,radius+.8)||!dryGround(x,z,radius+.8))continue;
  if(density(x,z)<.4)continue;
  const biome=biomeAt(x,z);
  for(let i=0;i<12&&blades<48000;i++){
   const a=random()*Math.PI*2,r=Math.sqrt(random())*radius,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r*.6;
   tuft(px,pz,.65+random()*.85);
  }
  const chance=random();
  if(chance<.15){const kind:Kind=biome==='spruce'?'fern':'flowers';for(let i=0;i<(kind==='flowers'?8:2);i++){const a=random()*Math.PI*2,r=random()*2.4;plant(kind,x+Math.cos(a)*r,z+Math.sin(a)*r,.7+random()*.6,i%2);}}
  else if(chance<.2){for(let i=0;i<3;i++)plant('mushrooms',x+(random()-.5)*2,z+(random()-.5)*2,.7+random()*.8);}
  else if(chance<.24){for(let i=0;i<2;i++)plant('bush',x+Math.sin(i*2.4)*1.7,z+Math.cos(i*2.4)*1.5,.7+random()*.5);}
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
 root.userData.grassBlades=blades*3;root.userData.plantTriangles=plantTriangles;return root;
}
