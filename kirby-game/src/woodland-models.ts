import * as T from 'three';
import {CraftedProps} from './crafted-props';

let timber:T.Group|undefined;
const mushrooms=new Map<number,T.Group>();
const freckle=new T.SphereGeometry(1,6,3);
const barkRadius=(radius:number,a:number,t:number,stump:boolean)=>radius*(1+.035*Math.cos(a*7)+.018*Math.sin(a*11+t*2)+(stump?.27*(1-t)**5:.025*Math.sin(t*8+a*2)));
let barkMap:T.DataTexture|undefined;
function barkSurface(){
 if(barkMap)return barkMap;const size=128,data=new Uint8Array(size*size*4);let seed=371;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const groove=Math.sin(v*Math.PI*24+.45*Math.sin(u*Math.PI*4)+.14*Math.sin(u*Math.PI*12));
  const value=Math.round(230+groove*11-Math.pow(Math.max(0,groove),18)*65+(seed/4294967296-.5)*14),i=(y*size+x)*4;
  data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
 }
 barkMap=new T.DataTexture(data,size,size);barkMap.name='Longitudinal oak bark fissures';barkMap.colorSpace=T.SRGBColorSpace;
 barkMap.wrapS=barkMap.wrapT=T.RepeatWrapping;barkMap.magFilter=T.LinearFilter;barkMap.minFilter=T.LinearMipmapLinearFilter;barkMap.generateMipmaps=true;barkMap.anisotropy=4;barkMap.needsUpdate=true;return barkMap;
}

function bark(radius:number,height:number,stump=false){
 const sides=28,rows=6,p:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[];
 const dark=new T.Color('#53402f'),light=new T.Color('#96734e');
 for(let row=0;row<=rows;row++)for(let i=0;i<=sides;i++){
  const a=i/sides*Math.PI*2,t=row/rows;
  const r=barkRadius(radius,a,t,stump),y=t*height+(stump?t*.038*Math.sin(a*3):0);
  p.push(Math.cos(a)*r,y,Math.sin(a)*r);uv.push(t*height*.8,i/sides*3);
  const c=dark.clone().lerp(light,.28+.4*(.5+.5*Math.sin(a*13+t*.9)));colors.push(c.r,c.g,c.b);
  if(row<rows&&i<sides){const k=row*(sides+1)+i,n=k+sides+1;indices.push(k,n,k+1,k+1,n,n+1);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** Growth rings are coloured bands in one surface, with no stacked discs. */
function endGrain(radius:number,wavy=false,t=1,mirror=false){
 const p:number[]=[],uv:number[]=[],colors:number[]=[],sides=28,rings=radius<.3?4:9;
 const vertex=(r:number,a:number,c:T.Color)=>{
  const edge=barkRadius(1,mirror?Math.PI-a:a,t,wavy),x=Math.cos(a)*r*edge,z=Math.sin(a)*r*edge;
  p.push(x,wavy?Math.pow(r/radius,2)*.038*Math.sin(a*3):0,z);uv.push(x,z);colors.push(c.r,c.g,c.b);
 };
 for(let ring=0;ring<rings;ring++){
  const inner=ring/rings*radius,outer=(ring+1)/rings*radius;
  for(const [lo,hi,color] of [[inner,outer-.012,ring%2?'#c9a46d':'#c09a62'],[outer-.012,outer,ring===rings-1?'#755637':'#a98250']] as const){
   const c=new T.Color(color);
   for(let i=0;i<sides;i++){
    const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;
    vertex(lo,a,c);vertex(hi,b,c);vertex(hi,a,c);vertex(lo,a,c);vertex(lo,b,c);vertex(hi,b,c);
   }
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}

const colored=(mesh:T.Mesh)=>{(mesh.material as T.MeshStandardMaterial).vertexColors=true;return mesh;};
const barkMesh=(mesh:T.Mesh)=>{colored(mesh);(mesh.material as T.MeshStandardMaterial).roughness=.99;return mesh;};

export function makeWoodlandTimber(){
 if(timber)return timber.clone();const b=new CraftedProps();
 barkMesh(b.mesh(bark(1.12,1.3,true),'#feffff',-2,0,0,1,1,1,'oak'));
 colored(b.mesh(endGrain(1.12,true),'#ffffff',-2,1.3,0,1,1,1,'oak'));
 // Roots enter the soil, and bark ridges follow the trunk instead of floating.
 for(let i=0;i<7;i++){
  const a=i*Math.PI*2/7,from=new T.Vector3(-2+Math.cos(a)*.78,.43,Math.sin(a)*.78),to=new T.Vector3(-2+Math.cos(a)*1.62,.045,Math.sin(a)*1.62),mid=from.clone().add(to).multiplyScalar(.5);
  const m=b.cylinder(i%2?'#6c5034':'#795a3c',mid.x,mid.y,mid.z,.065,.24,from.distanceTo(to),'oak',8);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),to.sub(from).normalize());
 }
 const log=barkMesh(b.mesh(bark(.65,6),'#feffff',0,.65,1,1,1,1,'oak'));log.rotation.z=-Math.PI/2;
 for(const x of [0,6]){const cut=colored(b.mesh(endGrain(.65,false,x===0?0:1,x===0),'#ffffff',x,.65,1,1,1,1,'oak'));cut.rotation.z=x===0?Math.PI/2:-Math.PI/2;}
 // Short broken branches, each with a pale exposed end.
 for(const [x,z,lean] of [[1.3,.82,-.7],[4.5,1.18,.6]]){
  const branch=barkMesh(b.mesh(bark(.18,.72),'#feffff',x,1.12,z,1,1,1,'oak'));branch.rotation.z=lean;
  const tip=new T.Vector3(0,.72,0).applyAxisAngle(new T.Vector3(0,0,1),lean).add(new T.Vector3(x,1.12,z));
  const cut=colored(b.mesh(endGrain(.18),'#ffffff',tip.x,tip.y,tip.z,1,1,1,'oak'));cut.rotation.z=lean;
 }
 // Dark radial splits break the smooth rings; shallow relief avoids z fighting.
 for(const a of [.4,2.6,4.5]){
  const p:number[]=[],uv:number[]=[];
  for(const [r,angle] of [[.55,a-.006],[1.1,a-.006],[1.1,a+.006],[.55,a+.006]]){
   const edge=barkRadius(1,angle,1,true);p.push(Math.cos(angle)*r*edge,.038*(r/1.12)**2*Math.sin(angle*3)+.002,Math.sin(angle)*r*edge);uv.push(r,angle);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();b.mesh(g,'#735238',-2,1.3,0,1,1,1,'oak');
 }
 // Moss pads and small ferns hug the roots and the shaded side of the log.
 for(let i=0;i<19;i++){
  const a=i*2.4,x=i<9?-2+Math.sin(a)*1.18:.3+(i-9)*.53,z=i<9?Math.cos(a)*1.02:.45;
  b.ball(i%3?'#667c45':'#8a9758',x,.11+(i%3)*.045,z,.23+(i%2)*.08,.12,.2,'leaf');
 }
 for(const [x,z] of [[-3.35,-.45],[4.8,.1]])for(let j=0;j<5;j++){
  const a=j*1.256,tip=new T.Vector3(x+Math.cos(a)*.53,.45+Math.sin(j)*.08,z+Math.sin(a)*.53);
  b.stem('#637a42',new T.Vector3(x,.05,z),tip,.013);
  for(let k=1;k<5;k++)for(const side of [-1,1]){
   const t=k/5,leaf=b.leaf(k%2?'#829657':'#607e45',T.MathUtils.lerp(x,tip.x,t),tip.y*Math.sin(t*1.57),T.MathUtils.lerp(z,tip.z,t),.18*(1-t*.45),a+side*.8,-.4);leaf.rotation.z=side*.35;
  }
 }
 timber=b.finish('Weathered stump and fallen oak with moss');timber.traverse(o=>{if(o instanceof T.Mesh&&o.material instanceof T.MeshStandardMaterial&&o.material.roughness===.99){o.material.map=o.material.bumpMap=barkSurface();o.material.bumpScale=.045;}});return timber.clone();
}

export function makeWoodlandMushroom(variant=0){
 variant%=3;const known=mushrooms.get(variant);if(known)return known.clone();const b=new CraftedProps();
 const russet=variant===2,cap=russet?'#a87848':variant===1?'#bd6650':'#b94837';
 b.lathe('#e7d6af',0,0,0,[[0,0],[russet?.16:.12,0],[russet?.19:.14,.09],[russet?.14:.09,.48],[russet?.11:.075,.79],[0,.82]],'linen');
 const profile:[number,number][]=[[0,1.18],[.14,1.17],[.34,1.09],[.53,.94],[.61,.79],[.59,.74],[.42,.77],[.12,.83],[0,.85]];
 const head=b.mesh(new T.LatheGeometry(profile.reverse().map(p=>new T.Vector2(...p)),20),cap,0,0,0,1,1,1,'paint');
 // Pale underside and radial gills sit below the rim, rather than on the cap.
 b.lathe('#cdb78e',0,0,0,[[.09,.809],[.4,.75],[.57,.723]],'linen');
 const gillPositions:number[]=[],gillUvs:number[]=[],gillIndices:number[]=[];
 for(let i=0;i<16;i++){
  const a=i*Math.PI/8,base=gillPositions.length/3;
  for(const [r,y,side] of [[.15,.8,1],[.15,.8,-1],[.54,.714,-1],[.54,.714,1]]){gillPositions.push(Math.cos(a)*r-Math.sin(a)*side*.006,y,Math.sin(a)*r+Math.cos(a)*side*.006);gillUvs.push(r,side);}
  gillIndices.push(base,base+1,base+2,base,base+2,base+3);
 }
 const gills=new T.BufferGeometry();gills.setAttribute('position',new T.Float32BufferAttribute(gillPositions,3));gills.setAttribute('uv',new T.Float32BufferAttribute(gillUvs,2));gills.setIndex(gillIndices);gills.computeVertexNormals();b.mesh(gills,'#af936d',0,0,0,1,1,1,'linen');
 if(!russet){
  b.lathe('#f0dfba',0,0,0,[[.095,.55],[.21,.57],[.18,.62],[.09,.64]],'linen');
  // Flat freckles conform to the cap's slope, with a physical surface gap.
  for(let i=0;i<7;i++){
   const a=i*2.4,r=.17+(i%3)*.13,y=r<.34?1.17-(r-.14)*.4:1.09-(r-.34)*.79;
   const spot=b.mesh(freckle,'#f5e5c6',Math.cos(a)*r,y+.013,Math.sin(a)*r,.055,.014,.043,'linen');
   spot.rotation.z=-Math.cos(a)*.46;spot.rotation.x=Math.sin(a)*.46;
  }
 }
 head.name='Sculpted woodland mushroom cap';
 const result=b.finish('Woodland mushroom '+variant);mushrooms.set(variant,result);return result.clone();
}
