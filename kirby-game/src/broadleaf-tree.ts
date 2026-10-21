import * as T from 'three';
import {createVeinedLeafSurface} from './shrub-model';
import {woodlandBarkMaterial} from './tree-bark';

export type TreeKind='birch'|'orchard'|'autumn'|'oak';
export type TreeDetail='near'|'middle'|'far';
export type TreeBranch={points:T.Vector3[];radius:number;parent:number;anchor?:T.Vector3};
type LeafAttachment={branch:number;anchor:T.Vector3;base:T.Vector3;tip:T.Vector3};
type FruitAttachment={branch:number;anchor:T.Vector3;top:T.Vector3;center:T.Vector3};
type TreeGeometry={wood:T.BufferGeometry;leaves:T.BufferGeometry;fruit:T.BufferGeometry;shadow:T.BufferGeometry;branches:TreeBranch[];leavesAttached:LeafAttachment[];fruitAttached:FruitAttachment[];crown:T.Vector3;crownScale:T.Vector3};
const up=new T.Vector3(0,1,0);

/** Indexed tubes and folded blades, shared by every instance of a tree variant.
 * All joins are measured from the rendered branch polyline, including at LOD. */
class GeometryWriter {
 positions:number[]=[];colors:number[]=[];uvs:number[]=[];indices:number[]=[];
 private seams:[number,number][]=[];
 vertex(p:T.Vector3,c:T.Color,shade=1,u=0,v=0){const i=this.positions.length/3;this.positions.push(p.x,p.y,p.z);this.colors.push(c.r*shade,c.g*shade,c.b*shade);this.uvs.push(u,v);return i;}
 tube(points:T.Vector3[],radius:number,endRadius:number,color:T.Color,sides:number,root=false){
  const first=this.positions.length/3;let length=0;
  for(let i=0;i<points.length;i++){
   if(i)length+=points[i].distanceTo(points[i-1]);
   const direction=points[Math.min(points.length-1,i+1)].clone().sub(points[Math.max(0,i-1)]).normalize();
   const side=new T.Vector3(0,0,1).cross(direction).normalize();if(side.lengthSq()<.01)side.set(1,0,0);
   const normal=direction.clone().cross(side).normalize(),t=i/(points.length-1),taper=T.MathUtils.lerp(radius,endRadius,t);
   for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,flare=root?(.4+.12*Math.cos(a*3+.7))*Math.exp(-t*18):0,r=taper*(1+flare+.035*Math.sin(a*3+t*11)+.018*Math.cos(a*5-t*8));this.vertex(points[i].clone().addScaledVector(side,Math.cos(a)*r).addScaledVector(normal,Math.sin(a)*r),color,.93+.07*Math.cos(a),j/sides*Math.max(1,Math.round(radius*1.8)),length*.24);}
   this.seams.push([first+i*(sides+1),first+i*(sides+1)+sides]);
  }
  for(let i=0;i<points.length-1;i++)for(let j=0;j<sides;j++){const a=first+i*(sides+1)+j,b=a+1,c=a+sides+1,d=c+1;this.indices.push(a,b,c,b,d,c);}
 }
 geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.positions,3));g.setAttribute('color',new T.Float32BufferAttribute(this.colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.uvs,2));g.setIndex(this.indices);g.computeVertexNormals();const normals=g.attributes.normal,n=new T.Vector3(),other=new T.Vector3();for(const [a,b] of this.seams){n.fromBufferAttribute(normals,a).add(other.fromBufferAttribute(normals,b)).normalize();normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);}g.computeBoundingBox();g.computeBoundingSphere();return g;}
}
export function treeBranchPoint(branch:TreeBranch,t:number){const u=T.MathUtils.clamp(t,0,1)*(branch.points.length-1),i=Math.min(branch.points.length-2,Math.floor(u));return branch.points[i].clone().lerp(branch.points[i+1],u-i);}

export function createBroadleafTree(kind:TreeKind,variation=0,detail:TreeDetail='near'):TreeGeometry {
 const oak=kind==='oak',birch=kind==='birch',h=oak?36:birch?10.2:8.3;
 const crown=new T.Vector3(oak?.1:0,h*(oak?.94:.73),oak?-1:0),crownScale=new T.Vector3(oak?12:birch?4:2.85,oak?7.2:birch?3.15:2.5,oak?11:birch?3.9:2.85);
 const wood=new GeometryWriter(),leaves=new GeometryWriter(),fruit=new GeometryWriter(),shadow=new GeometryWriter();
 const branches:TreeBranch[]=[],leavesAttached:LeafAttachment[]=[],fruitAttached:FruitAttachment[]=[];
 let seed=7193+variation*7907+(oak?5501:birch?113:0);const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const bark=new T.Color(birch?'#ddd9c8':oak?'#85644b':'#896a4b'),twigBark=new T.Color(birch?'#817262':'#816449');
 const segments=detail==='near'?5:detail==='middle'?3:2,sides=detail==='near'?(oak?6:5):detail==='middle'?4:3;
 const addBranch=(points:T.Vector3[],radius:number,parent=-1,anchor?:T.Vector3,draw=true)=>{
  const id=branches.length;branches.push({points,radius,parent,anchor});if(draw)wood.tube(points,radius,radius*.2,parent<=0?bark:twigBark,parent<0?(detail==='near'?12:6):parent>0?(oak?Math.min(sides,4):3):sides,parent<0);
  if(parent<=0&&radius>(oak?.25:.06)){
   const coarse=parent<0?[points[0],points[3],points[6],points[8],points.at(-1)!]:[points[0],points[Math.floor(points.length/2)],points.at(-1)!];
   shadow.tube(coarse,radius,radius*.2,bark,4);
  }
  return id;
 };
 const trunkHeight=h*.84;
 const trunkPoints=Array.from({length:11},(_,i)=>{
  const t=i/10,lean=birch?.24:oak?.85:.38,phase=variation*1.6;
  return new T.Vector3(lean*(Math.sin(t*4+phase)-Math.sin(phase))*t,trunkHeight*t,oak?-1.05*t*t:.23*Math.sin(t*5+phase)*t);
 });
 const trunk=addBranch(trunkPoints,oak?1.82:birch?.26:.38);
 const boughs=oak?24:12,twigs=oak?6:4;
 const leaf=(id:number,t:number,angle:number,length:number,shade:number,roll:number)=>{
  const anchor=treeBranchPoint(branches[id],t),direction=new T.Vector3(Math.cos(angle),roll,Math.sin(angle)).normalize();
  const side=new T.Vector3(-Math.sin(angle),0,Math.cos(angle)),normal=side.clone().cross(direction).normalize();if(normal.y<0)normal.negate();
  const base=anchor.clone().addScaledVector(direction,length*.09),tip=base.clone().addScaledVector(direction,length).addScaledVector(normal,-length*.12);
  leavesAttached.push({branch:id,anchor,base,tip});
  // Flat petioles cost two triangles, stay joined and are hidden inside the crown.
  const petiole=oak?.014:.008,a=wood.vertex(anchor.clone().addScaledVector(side,-petiole),twigBark),b=wood.vertex(anchor.clone().addScaledVector(side,petiole),twigBark),c=wood.vertex(base.clone().addScaledVector(side,-petiole*.6),twigBark),d=wood.vertex(base.clone().addScaledVector(side,petiole*.6),twigBark);wood.indices.push(a,c,b,b,c,d);
  const tint=new T.Color().setRGB(shade*.94,shade,shade*.9),rows=detail==='far'?1:oak?3:2,width=length*(birch?.6:oak?.65:.64);
  const first=leaves.vertex(base,tint,.84,0,.5);let previous:number[]|undefined;
  for(let row=0;row<rows;row++){
   const u=(row+1)/(rows+1),spread=Math.pow(Math.sin(Math.PI*u),.78)*width*.5;
   const centre=base.clone().addScaledVector(direction,length*u).addScaledVector(normal,length*(.07*Math.sin(Math.PI*u)-.12*u*u));
   const ids=[leaves.vertex(centre.clone().addScaledVector(side,-spread),tint,.94,u,0),leaves.vertex(centre.clone().addScaledVector(normal,length*.035),tint,1.06,u,.5),leaves.vertex(centre.clone().addScaledVector(side,spread),tint,.96,u,1)];
   if(previous)leaves.indices.push(previous[0],ids[0],previous[1],ids[0],ids[1],previous[1],previous[1],ids[1],previous[2],ids[1],ids[2],previous[2]);
   else leaves.indices.push(first,ids[0],ids[1],first,ids[1],ids[2]);previous=ids;
  }
  const end=leaves.vertex(tip,tint,.91,1,.5);leaves.indices.push(previous![0],end,previous![1],previous![1],end,previous![2]);
 };
 const sphere=new T.SphereGeometry(1,8,6);
 const addFruit=(id:number,t:number,fruitKind:number,size:number)=>{
  const anchor=treeBranchPoint(branches[id],t),top=anchor.clone().add(new T.Vector3(0,-.12,0)),center=top.clone().add(new T.Vector3(0,-size*(fruitKind===2?1.5:.96),0));
  fruitAttached.push({branch:id,anchor,top,center});wood.tube([anchor,top],.015,.01,twigBark,3);
  const color=new T.Color(['#d95840','#e7a139','#a4bb42'][fruitKind]),p=sphere.attributes.position,idx=sphere.index!,start=fruit.positions.length/3;
  for(let i=0;i<p.count;i++){
   const y=p.getY(i),pear=fruitKind===2?1-.35*Math.max(0,y):1,point=new T.Vector3(p.getX(i)*size*pear,y*size*(fruitKind===2?1.5:.96),p.getZ(i)*size*pear).add(center);
   fruit.vertex(point,color,.95+.05*y);
  }
  for(let i=0;i<idx.count;i++)fruit.indices.push(start+idx.getX(i));
 };
 for(let i=0;i<boughs;i++){
  // The cropped leader splits into leafy upward shoots. Reuse three/four of
  // the existing boughs for a denser dome rather than adding more instances.
  const top=i>=boughs-(oak?4:3),angle=i*2.399963+variation*.83,ny=top?.82:-.64+1.32*((i*7%boughs)/(boughs-1));
  const root=treeBranchPoint(branches[trunk],top?.91+.03*(i%3):((oak?.55:.42)+.36*((i*5%boughs)/(boughs-1)))/.84);
  const radius=top?.35:Math.sqrt(1-ny*ny)*.66,end=new T.Vector3(Math.cos(angle)*crownScale.x*radius,crown.y+ny*crownScale.y*(top?1:.75),crown.z+Math.sin(angle)*crownScale.z*radius);
  const control=root.clone().lerp(end,.47).add(new T.Vector3(-Math.sin(angle)*(oak?.65:.24),oak?1:.45,Math.cos(angle)*(oak?.65:.24)));
  const main=addBranch(new T.QuadraticBezierCurve3(root,control,end).getPoints(segments),oak?.48:birch?.09:.115,trunk,root);
  for(let j=0;j<twigs;j++){
   const a=angle+(j-(twigs-1)*.5)*(top?.46:oak?.27:.33),y=T.MathUtils.clamp(ny+(j-(twigs-1)*.5)*(top?.065:.14)+random()*.16,-.83,.96),r=top?.19+random()*.28:Math.sqrt(1-y*y)*(.76+random()*.16);
   const from=treeBranchPoint(branches[main],.46+j/(twigs-1)*.5),to=new T.Vector3(Math.cos(a)*crownScale.x*r,crown.y+y*crownScale.y,crown.z+Math.sin(a)*crownScale.z*r);
   const bend=from.clone().lerp(to,.55).add(new T.Vector3(-Math.sin(a)*(oak?.35:.13),oak?.45:.2,Math.cos(a)*(oak?.35:.13)));
   const retained=detail!=='far'||j%2===1;
   const twig=addBranch(new T.QuadraticBezierCurve3(from,bend,to).getPoints(detail==='near'?3:detail==='middle'?2:1),oak?.07:birch?.021:.029,main,from,retained);
   // Keep the random stream/branch scaffold identical between detail levels.
   const size=(oak?1.3:birch?.8:.66)*(top?1.12:1.05)*(1+random()*.38),shade=.74+random()*.28;
   for(let k=0;k<4;k++)for(const sign of [-1,1]){
    const roll=(top?.4:.1)+(random()-.5)*.65,t=.28+k*.22;
    if(detail==='middle'&&(k!==1&&k!==3))continue;
    if(detail==='far'&&(!retained||k!==3||sign!==1))continue;
    leaf(twig,t,a+sign*(.85+(k%2)*.2),size*(detail==='far'?1.65:detail==='middle'?1.18:1),shade,roll);
   }
   if(kind==='orchard'&&detail==='near'&&j%2===0)addFruit(twig,.7,variation%3,.17+random()*.025);
   else if(kind==='orchard'&&j%2===0)random();
  }
 }
 sphere.dispose();
 const result={wood:wood.geometry(),leaves:leaves.geometry(),fruit:fruit.geometry(),shadow:shadow.geometry(),branches,leavesAttached,fruitAttached,crown,crownScale};
 // Identical LOD distances and bounds switch the woody shoots and their leaves
 // together; a distant crown can never lose its supporting branches first.
 const bounds=new T.Box3();for(const g of [result.wood,result.leaves,result.fruit])if(g.attributes.position.count)bounds.union(g.boundingBox!);
 const bound=bounds.getBoundingSphere(new T.Sphere());bound.radius+=oak?1:1.5;
 for(const g of [result.wood,result.leaves,result.fruit]){g.boundingSphere=bound.clone();g.userData.treeKind=kind;g.userData.detail=detail;}
 result.leaves.userData.attachments=leavesAttached;result.wood.userData.branches=branches;result.fruit.userData.attachments=fruitAttached;
 return result;
}

export function treeWoodMaterial(_birch=false){
 // Species colours live on the vertices; every living trunk shares the oak's
 // irregular plate texture instead of generating another striped map.
 return woodlandBarkMaterial();
}
let leafMaterial:T.MeshLambertMaterial|undefined,fruitMaterial:T.MeshLambertMaterial|undefined;
export function treeLeafMaterial(){
 if(!leafMaterial){leafMaterial=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,map:createVeinedLeafSurface()});leafMaterial.userData.leafLightTransmission=.32;}
 return leafMaterial;
}
export function treeFruitMaterial(){return fruitMaterial??=new T.MeshLambertMaterial({vertexColors:true});}

/** A continuous crooked support for the swing, sharing the tree's bark material. */
export function createTreeBough(points:T.Vector3[],radius:number,endRadius:number){const writer=new GeometryWriter();writer.tube(points,radius,endRadius,new T.Color('#85644b'),10);return writer.geometry();}
