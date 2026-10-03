import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const RAINBOW_COLORS=['#f04459','#ff982f','#ffe04c','#50ca65','#45ccf5','#4263de','#a34dde'] as const;
let stripes:T.DataTexture|undefined;
const stripedGeometry=new WeakMap<T.BufferGeometry,T.BufferGeometry>();

/** A small shared texture, mapped by height, wraps seamlessly around the body. */
export function rainbowSkin(geometry:T.BufferGeometry,material:T.MeshStandardMaterial){
 if(!stripes){
  const data=new Uint8Array(4*896*4);
  for(let y=0;y<896;y++){
   const hex=RAINBOW_COLORS[6-Math.floor(y/128)].slice(1);
   for(let x=0;x<4;x++)data.set([parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16),255],(y*4+x)*4);
  }
  stripes=new T.DataTexture(data,4,896);stripes.colorSpace=T.SRGBColorSpace;
  stripes.magFilter=T.LinearFilter;stripes.minFilter=T.LinearMipmapLinearFilter;stripes.generateMipmaps=true;stripes.needsUpdate=true;
 }
 let copy=stripedGeometry.get(geometry);
 if(!copy){
  copy=geometry.clone();const p=copy.getAttribute('position'),uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){uv[i*2]=.5;uv[i*2+1]=T.MathUtils.clamp((p.getY(i)-.21)/1.92,0,1);}
  copy.setAttribute('uv',new T.BufferAttribute(uv,2));stripedGeometry.set(geometry,copy);
 }
 material.color.set('#ffffff');material.map=stripes;material.roughness=.32;material.metalness=.04;
 return copy;
}

let crownGold:T.BufferGeometry|undefined,crownGems:T.BufferGeometry|undefined;
export function rainbowCrown(){
 if(!crownGold||!crownGems){
  const gold:T.BufferGeometry[]=[],gems:T.BufferGeometry[]=[];
  const bake=(g:T.BufferGeometry,list:T.BufferGeometry[],p:T.Vector3,color?:string,scale?:T.Vector3)=>{
   g.deleteAttribute('uv');
   if(scale)g.scale(scale.x,scale.y,scale.z);g.translate(p.x,p.y,p.z);
   if(color){const c=new T.Color(color),colors=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<colors.length;i+=3)colors.set([c.r,c.g,c.b],i);g.setAttribute('color',new T.BufferAttribute(colors,3));}
   list.push(g.index?g.toNonIndexed():g);
  };
  // A continuous seven-point crown with an inner wall and a rounded rim.
  const vertices:number[]=[];
  const point=(i:number,inner:boolean,top:boolean)=>{
   const a=i/56*Math.PI*2,y=top?.2+.38*Math.max(0,1-Math.abs((i%8)-4)/4):0;
   const r=.53+(top?.085:0)-(inner?.045:0);return [Math.sin(a)*r,y,Math.cos(a)*r];
  };
  const quad=(a:number[],b:number[],c:number[],d:number[])=>vertices.push(...a,...b,...c,...a,...c,...d);
  for(let i=0;i<56;i++){
   const a=point(i,false,false),b=point(i+1,false,false),c=point(i+1,false,true),d=point(i,false,true);
   const e=point(i,true,false),f=point(i+1,true,false),g=point(i+1,true,true),h=point(i,true,true);
   quad(a,b,c,d);quad(f,e,h,g);quad(d,c,g,h);quad(e,f,b,a);
  }
  const wall=new T.BufferGeometry();wall.setAttribute('position',new T.Float32BufferAttribute(vertices,3));wall.computeVertexNormals();gold.push(wall);
  for(const y of [.025,.15]){const rim=new T.TorusGeometry(.54,.028,8,56);rim.rotateX(Math.PI/2);bake(rim,gold,new T.Vector3(0,y,0));}
  for(let i=0;i<7;i++){
   const a=(i+.5)/7*Math.PI*2;
   const jewel=new T.OctahedronGeometry(.09);jewel.rotateY(a);bake(jewel,gems,new T.Vector3(Math.sin(a)*.575,.13,Math.cos(a)*.575),RAINBOW_COLORS[i],new T.Vector3(1,1.3,1));
   bake(new T.SphereGeometry(.045,10,6),gold,new T.Vector3(Math.sin(a)*.615,.58,Math.cos(a)*.615));
  }
  crownGold=mergeGeometries(gold)!;crownGems=mergeGeometries(gems)!;
  for(const g of [...gold,...gems])g.dispose();
 }
 const crown=new T.Group();crown.name='Rainbow crown';crown.position.set(0,.79,0);
 const gold=new T.Mesh(crownGold,new T.MeshStandardMaterial({color:'#ffc94e',metalness:.68,roughness:.25}));
 const gems=new T.Mesh(crownGems,new T.MeshStandardMaterial({vertexColors:true,metalness:.2,roughness:.16}));
 crown.add(gold,gems);return crown;
}
