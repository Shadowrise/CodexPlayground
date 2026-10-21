import * as T from 'three';
import {instancedLod,type InstanceLodPart} from './instanced-lod';
import {sceneryShadowBatch} from './scenery-shadows';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export type MazeWall={x:number;z:number;hx:number;hz:number;cell:number;neighbor:number};
let floorMaterial:T.MeshStandardMaterial|undefined,stoneMaterial:T.MeshStandardMaterial|undefined;
const fract=(n:number)=>n-Math.floor(n);
const hash=(x:number,y:number)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453);
function texture(data:Uint8Array,size:number,name:string,color=false){
 const map=new T.DataTexture(data,size,size);map.name=name;if(color)map.colorSpace=T.SRGBColorSpace;
 map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;return map;
}
function matteStone(){
 if(stoneMaterial)return stoneMaterial;
 return stoneMaterial=new T.MeshStandardMaterial({name:'Plain matte maze masonry',roughness:1,metalness:0});
}
function paving(){
 if(floorMaterial)return floorMaterial;
 const size=512,data=new Uint8Array(size*size*4),height=new Uint8Array(data.length);
 const rectangles=[[0,0,2,2],[2,0,2,1],[2,1,1,1],[3,1,1,2],[0,2,2,1],[2,2,1,2],[0,3,1,1],[1,3,1,1],[3,3,1,1]],grid=[[0,0,1,1],[0,0,2,3],[4,4,5,3],[6,7,5,8]];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,tx=Math.floor(u*2),ty=Math.floor(v*2);let px=fract(u*2)*4,py=fract(v*2)*4;if((tx+ty)%2)[px,py]=[py,4-px];
  const id=grid[Math.min(3,Math.floor(py))][Math.min(3,Math.floor(px))],[rx,ry,rw,rh]=rectangles[id],a=px-rx,b=py-ry;
  const warp=Math.sin(u*Math.PI*32)*Math.sin(v*Math.PI*24)*.004,dx=Math.min(a,rw-a),dy=Math.min(b,rh-b),edge=Math.min(dx,dy,(dx+dy-.025)*.707)+warp;
  const tile=T.MathUtils.smoothstep(edge,.009,.027),variant=hash(id+tx*11,ty*7),grain=hash(x,y),cloud=Math.sin(u*Math.PI*16+Math.sin(v*Math.PI*10))*Math.sin(v*Math.PI*12),wear=(variant-.5)*31+(grain-.5)*11+cloud*7-(grain<.018?15:0);
  const moss=(.6+.4*Math.sin(u*Math.PI*18+v*Math.PI*12))*(1-tile),i=(y*size+x)*4;
  data[i]=T.MathUtils.lerp(137,203+wear,tile)-moss*7;data[i+1]=T.MathUtils.lerp(139,194+wear,tile);data[i+2]=T.MathUtils.lerp(114,169+wear,tile)-moss*5;data[i+3]=255;
  const relief=64+tile*121+(grain-.5)*8+cloud*3;height[i]=height[i+1]=height[i+2]=relief;height[i+3]=255;
 }
 return floorMaterial=new T.MeshStandardMaterial({map:texture(data,size,'Worn maze paving and moss joints',true),bumpMap:texture(height,size,'Shallow maze paving relief'),bumpScale:.025,roughness:.96});
}

/** Rounded planes, quarter-cylinder edges and spherical corners. The radii
 * can differ by axis so shallow coping and tall mortar both have soft edges.
 * The open half keeps the two passage colours independent at the centre. */
export function mazeTrimGeometry(radii:T.Vector3,segments=2,half=true){
 const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[],s=new T.Vector3(.5,.5,.5).sub(radii);
 type Vertex={p:T.Vector3;n:T.Vector3};
 const vertex=(p:T.Vector3,n:T.Vector3):Vertex=>({p,n});
 const face=(source:Vertex[])=>{
  let polygon=source;
  if(half){polygon=[];for(let i=0;i<source.length;i++){const a=source[i],b=source[(i+1)%source.length],inside=a.p.z>=0,next=b.p.z>=0;if(inside)polygon.push(a);if(inside!==next){const t=-a.p.z/(b.p.z-a.p.z);polygon.push(vertex(a.p.clone().lerp(b.p,t),a.n.clone().lerp(b.n,t).normalize()));}}}
  if(polygon.length<3)return;
  const cross=polygon[1].p.clone().sub(polygon[0].p).cross(polygon[2].p.clone().sub(polygon[0].p));if(cross.lengthSq()<1e-12)return;if(cross.dot(polygon[0].n)<0)polygon.reverse();
  const first=positions.length/3;for(const {p,n} of polygon){positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);uvs.push((Math.abs(n.x)>.6?p.z:p.x)*1.3,(Math.abs(n.y)>.6?p.z:p.y)*.8);}
  for(let i=1;i<polygon.length-1;i++)indices.push(first,first+i,first+i+1);
 };
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const other=[0,1,2].filter(i=>i!==axis),normal=new T.Vector3().setComponent(axis,sign);
  face([[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>vertex(new T.Vector3().setComponent(axis,sign*.5).setComponent(other[0],a*s.getComponent(other[0])).setComponent(other[1],b*s.getComponent(other[1])),normal)));
 }
 for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)for(const sa of [-1,1])for(const sb of [-1,1]){
  const c=3-a-b,edge=(step:number,end:number)=>{
   const angle=step/segments*Math.PI/2,ca=Math.cos(angle),cb=Math.sin(angle),p=new T.Vector3().setComponent(a,sa*(s.getComponent(a)+radii.getComponent(a)*ca)).setComponent(b,sb*(s.getComponent(b)+radii.getComponent(b)*cb)).setComponent(c,end*s.getComponent(c));
   return vertex(p,new T.Vector3().setComponent(a,sa*ca/radii.getComponent(a)).setComponent(b,sb*cb/radii.getComponent(b)).normalize());
  };
  for(let j=0;j<segments;j++)face([edge(j,-1),edge(j,1),edge(j+1,1),edge(j+1,-1)]);
 }
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
  const sign=new T.Vector3(x,y,z),corner=(i:number,j:number)=>{
   const n=new T.Vector3(i,j,segments-i-j).normalize().multiply(sign);
   return vertex(s.clone().multiply(sign).add(n.clone().multiply(radii)),n.clone().divide(radii).normalize());
  };
  for(let i=0;i<segments;i++)for(let j=0;j<segments-i;j++){
   face([corner(i,j),corner(i+1,j),corner(i,j+1)]);
   if(i+j+1<segments)face([corner(i+1,j),corner(i+1,j+1),corner(i,j+1)]);
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();g.userData.kind='roundedMazeTrim';return g;
}

/** Only the exposed rounded face needs geometry: the dark mortar closes its
 * back. Three arc segments and interpolated rim normals soften the silhouette
 * for 22 triangles. Exposed ends get a curved return, closing their sides. */
export function mazeBrickGeometry(radius=.16,segments=3,returnSide=false){
 const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[],s=.5-radius,coarse=segments===1;
 const vertex=(x:number,y:number,z:number,n:T.Vector3)=>{const i=positions.length/3;positions.push(x,y,z);normals.push(n.x,n.y,n.z);uvs.push(x*1.3,y*.8);return i;};
 const triangle=(a:number,b:number,c:number)=>{const ax=positions[b*3]-positions[a*3],ay=positions[b*3+1]-positions[a*3+1],bx=positions[c*3]-positions[a*3],by=positions[c*3+1]-positions[a*3+1];if(ax*by-ay*bx>0)indices.push(a,b,c);else indices.push(a,c,b);};
 const front=new T.Vector3(0,0,1),corners:number[]=[],arcs:number[][]=[];
 for(let corner=0;corner<4;corner++){
  const angle=corner*Math.PI/2,cx=corner===0||corner===3?s:-s,cy=corner<2?s:-s;
  if(!coarse)corners.push(vertex(cx,cy,.5,front));const arc:number[]=[];
  for(let j=0;j<=segments;j++){const a=angle+j/segments*Math.PI/2,x=Math.cos(a),y=Math.sin(a);arc.push(vertex(cx+x*radius,cy+y*radius,coarse?.5:.43,coarse?front:new T.Vector3(x*.8,y*.8,.6)));}
  arcs.push(arc);
 }
 if(coarse){
  // At distance retain the corner silhouette with just six triangles.
  const rim=arcs.flat();for(let i=1;i<rim.length-1;i++)triangle(rim[0],rim[i],rim[i+1]);
 }else{
  triangle(corners[0],corners[1],corners[2]);triangle(corners[0],corners[2],corners[3]);
  for(let i=0;i<4;i++){
   const next=(i+1)%4,arc=arcs[i],nextArc=arcs[next];
   for(let j=0;j<segments;j++)triangle(corners[i],arc[j],arc[j+1]);
   triangle(corners[i],arc[segments],nextArc[0]);triangle(corners[i],nextArc[0],corners[next]);
  }
 }
 if(returnSide){
  const edge=[...arcs[3],...arcs[0]];
  if(coarse)for(const index of edge){const nx=(positions[index*3]-s)/radius,ny=(positions[index*3+1]-Math.sign(positions[index*3+1])*s)/radius;normals[index*3]=nx*.8;normals[index*3+1]=ny*.8;normals[index*3+2]=.6;}
  for(let j=0;j<edge.length-1;j++){
   const a=edge[j],b=edge[j+1],back=(index:number)=>{const x=positions[index*3],y=positions[index*3+1],nx=(x-s)/radius,ny=Math.max(-1,Math.min(1,(y-Math.sign(y)*s)/radius));return vertex(x,y,0,new T.Vector3(nx,ny,0).normalize());},aa=back(a),bb=back(b);
   // The return winds towards the exposed positive-X end. Its rim shares
   // the face normals, avoiding a lighting crease at the rounded shoulder.
   indices.push(a,aa,b,b,aa,bb);
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();g.userData.kind='mazeBrick';return g;
}

export function makeMazeMasonry(walls:readonly MazeWall[],routeColor:(cell:number)=>T.Color){
 const root=new T.Group();root.name='Dressed maze masonry';
 const faces:InstanceLodPart[]=[],ends:InstanceLodPart[]=[],caps:InstanceLodPart[]=[],bases:InstanceLodPart[]=[],feet:InstanceLodPart[]=[],shadows:T.Matrix4[]=[],dummy=new T.Object3D(),flipEnd=new T.Matrix4().makeRotationZ(Math.PI);
 const add=(list:InstanceLodPart[],x:number,y:number,z:number,sx:number,sy:number,sz:number,yaw:number,color:T.Color)=>{dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,yaw,0);dummy.updateMatrix();list.push({matrix:dummy.matrix.clone(),color,detail:0});};
 const tint=(cell:number)=>routeColor(cell).clone();
 const endpoints=new Map<string,number>(),endKey=(w:MazeWall,offset:number)=>`${w.x+(w.hx>w.hz?offset:0)},${w.z+(w.hx>w.hz?0:-offset)}`;
 for(const w of walls)for(const end of [-1,1]){const key=endKey(w,end*Math.max(w.hx,w.hz));endpoints.set(key,(endpoints.get(key)??0)+1);}
 for(const w of walls){
  const horizontal=w.hx>w.hz,length=Math.max(w.hx,w.hz)*2,yaw=horizontal?0:Math.PI/2;
  // Keep the dark backing behind the returning brick faces at exposed ends.
  // Connected wall segments retain their full backing, closing every joint.
  const start=-length/2+(endpoints.get(endKey(w,-length/2))===1?.04:0),end=length/2-(endpoints.get(endKey(w,length/2))===1?.04:0),bodyLength=end-start,bodyOffset=(start+end)/2,bx=w.x+(horizontal?bodyOffset:0),bz=w.z+(horizontal?0:-bodyOffset);
  const sideColor=(side:number)=>tint(side<0&&w.neighbor>=0?w.neighbor:w.cell);
  for(const side of [-1,1]){
   const angle=yaw+(side<0?Math.PI:0);
   add(bases,bx,2.725,bz,bodyLength,5.35,1.28,angle,sideColor(side).multiplyScalar(.38));
   add(feet,w.x,.13,w.z,length+.02,.25,1.53,angle,sideColor(side).multiplyScalar(.48));
  }
  for(let row=0;row<7;row++){
   const spacing=1.28,phase=row%2?spacing/2:0;
   for(let start=-length/2-phase;start<length/2;start+=spacing){
    const left=Math.max(start,-length/2),right=Math.min(start+spacing,length/2),width=right-left-.035;if(width<.05)continue;
    const offset=(left+right)/2,x=w.x+(horizontal?offset:0),z=w.z+(horizontal?0:-offset),y=.29+(row+.5)*.72;
    const end=left===-length/2?-1:right===length/2?1:0;
    for(const side of [-1,1]){const color=sideColor(side),parts=end?ends:faces;add(parts,x,y,z,width,.68,1.42,yaw+(side<0?Math.PI:0),color);if(end*side<0)parts[parts.length-1].matrix.multiply(flipEnd);}
   }
  }
  const count=Math.ceil(length/2),step=length/count;
  for(let i=0;i<count;i++){const offset=-length/2+(i+.5)*step;for(const side of [-1,1])add(caps,w.x+(horizontal?offset:0),5.43+(horizontal?0:.004),w.z+(horizontal?0:-offset),step-.025,.18,1.57,yaw+(side<0?Math.PI:0),sideColor(side).multiplyScalar(.58));}
  shadows.push(new T.Matrix4().compose(new T.Vector3(bx,0,bz),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw),new T.Vector3(bodyLength,1,1)));
 }
 const brick=mazeBrickGeometry(),coarseBrick=mazeBrickGeometry(.16,1),capRadius=new T.Vector3(.1,.42,.18),bodyRadius=new T.Vector3(.04,.025,.2),footRadius=new T.Vector3(.04,.36,.18),material=matteStone();
 const levels={middleDistance:70,farDistance:150,cellSize:48};
 const bricks=instancedLod('Maze brick faces',brick,material,faces,{...levels,middle:coarseBrick,far:coarseBrick},true),coarseEnd=mazeBrickGeometry(.16,1,true),endLod=instancedLod('Maze rounded brick ends',mazeBrickGeometry(.16,3,true),material,ends,{...levels,middle:coarseEnd,far:coarseEnd},true);bricks.add(...endLod.children);root.add(bricks);
 const roundedLod=(name:string,radius:T.Vector3,parts:InstanceLodPart[])=>{const near=mazeTrimGeometry(radius),coarse=mazeTrimGeometry(radius,1);return instancedLod(name,near,material,parts,{...levels,middle:coarse,far:coarse},true);};
 root.add(roundedLod('Maze coping stones',capRadius,caps));
 const base=new T.Group();base.name='Maze mortar and footing';base.add(roundedLod('Maze recessed mortar',bodyRadius,bases),roundedLod('Maze rounded footing',footRadius,feet));root.add(base);
 // Keep the proxy inside the brick faces. A full-width box matching the
 // overhanging cap would put every wall surface inside its own shadow caster.
 const bodyShadow=mazeTrimGeometry(bodyRadius,1,false).scale(1,5.35,1.24).translate(0,2.675,0),capShadow=mazeTrimGeometry(new T.Vector3(.02,.42,.18),1,false).scale(1,.18,1.5).translate(0,5.43,0),shadow=mergeGeometries([bodyShadow,capShadow])!;bodyShadow.dispose();capShadow.dispose();
 root.add(sceneryShadowBatch('Stable masonry shadows',shadow,shadows));
 const g=new T.PlaneGeometry(71.8,71.8);g.rotateX(-Math.PI/2);const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/5.6,p.getZ(i)/5.6);
 const floor=new T.Mesh(g,paving());floor.name='Maze paved floor';floor.position.y=.018;floor.receiveShadow=true;root.add(floor);
 root.userData.brickFaces=faces.length+ends.length;return root;
}
