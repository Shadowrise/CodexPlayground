import * as T from 'three';
import type {Biome} from './forest';
import {BIOME_STYLE} from './biome-style';

export type ShrubDetail='near'|'middle'|'far';
type Branch={points:T.Vector3[];radius:number};
type Attachment={branch:number;anchor:T.Vector3;base:T.Vector3};

/** Shared, indexed shrub prototypes. Leaves grow from real tapered shoots;
 * distant levels simplify the same plant, rather than adding foliage spheres. */
export function createShrubGeometry(biome:Biome,detail:ShrubDetail='near'){
 const positions:number[]=[],colors:number[]=[],uvs:number[]=[],indices:number[]=[],branches:Branch[]=[],attachments:Attachment[]=[];
 const palette=BIOME_STYLE[biome],leafColor=new T.Color(palette.bush),lightLeaf=new T.Color(palette.grass[1]),bark=new T.Color('#6e5940');
 let seed=9173;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const vertex=(p:T.Vector3,color:T.Color,shade=1,u=0,v=0)=>{const i=positions.length/3;positions.push(p.x,p.y,p.z);colors.push(color.r*shade,color.g*shade,color.b*shade);uvs.push(u,v);return i;};
 const branchPoint=(branch:Branch,t:number)=>{
  const u=t*(branch.points.length-1),i=Math.min(branch.points.length-2,Math.floor(u));
  return branch.points[i].clone().lerp(branch.points[i+1],u-i);
 };
 const shoot=(curve:T.QuadraticBezierCurve3,radius:number,secondary=false)=>{
  const segments=detail==='near'?(secondary?3:4):detail==='middle'?2:1;
  const points=curve.getPoints(segments),branch={points,radius},id=branches.length;branches.push(branch);
  const sides=detail==='near'?(secondary?4:5):3,base=positions.length/3;
  for(let i=0;i<points.length;i++){
   const direction=points[Math.min(i+1,segments)].clone().sub(points[Math.max(0,i-1)]).normalize();
   const side=new T.Vector3(0,0,1).cross(direction).normalize(),up=direction.clone().cross(side).normalize();
   for(let j=0;j<sides;j++){
    const a=j/sides*Math.PI*2,r=radius*(1-.8*i/segments);
    vertex(points[i].clone().addScaledVector(side,Math.cos(a)*r).addScaledVector(up,Math.sin(a)*r),bark,.9+.1*Math.sin(a));
   }
  }
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){
   const a=base+i*sides+j,b=base+i*sides+(j+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);
  }
  return id;
 };
 const leaf=(branchId:number,t:number,angle:number,length:number,shade:number)=>{
  const branch=branches[branchId],anchor=branchPoint(branch,t),side=new T.Vector3(Math.sin(angle),0,-Math.cos(angle));
  const direction=new T.Vector3(Math.cos(angle),.12+random()*.35,Math.sin(angle)).normalize();
  const normal=side.clone().cross(direction).normalize();if(normal.y<0)normal.negate();
  const base=anchor.clone().addScaledVector(direction,.07);
  attachments.push({branch:branchId,anchor,base});
  const tint=leafColor.clone().lerp(lightLeaf,.12+random()*.3);
  // A small petiole joins the blade to the actual woody branch.
  const a=vertex(anchor.clone().addScaledVector(side,-.008),bark),b=vertex(anchor.clone().addScaledVector(side,.008),bark),c=vertex(base.clone().addScaledVector(side,-.006),tint,.75),d=vertex(base.clone().addScaledVector(side,.006),tint,.75);
  indices.push(a,b,c,b,d,c);
  const width=length*(biome==='spruce'?.4:biome==='birch'?.6:biome==='autumn'?.62:.56),rows=detail==='near'?5:detail==='middle'?2:1;
  const first=vertex(base,tint,shade*.8,0,.5);let previous:number[]|undefined;
  for(let row=0;row<rows;row++){
   const u=rows===1?.5:rows===2?.3+row*.4:.14+row*.18;
   const spread=Math.pow(Math.sin(Math.PI*u),.85)*width*.5;
   const centre=base.clone().addScaledVector(direction,u*length).addScaledVector(normal,(.06*Math.sin(u*Math.PI)-.13*u*u)*length);
   const ids=[vertex(centre.clone().addScaledVector(side,-spread),tint,shade*.9,u,0),vertex(centre.clone().addScaledVector(normal,.045*length),tint,shade*1.08,u,.5),vertex(centre.clone().addScaledVector(side,spread),tint,shade*.94,u,1)];
   if(previous)indices.push(previous[0],ids[0],previous[1],ids[0],ids[1],previous[1],previous[1],ids[1],previous[2],ids[1],ids[2],previous[2]);
   else indices.push(first,ids[0],ids[1],first,ids[1],ids[2]);
   previous=ids;
  }
  const tip=vertex(base.clone().addScaledVector(direction,length).addScaledVector(normal,-.13*length),tint,shade*.92,1,.5);
  indices.push(previous![0],tip,previous![1],previous![1],tip,previous![2]);
 };
 for(let j=0;j<6;j++){
  const angle=j*2.399963,rad=.56+random()*.19,h=1.04+random()*.32;
  const root=new T.Vector3(Math.cos(angle)*.11,.055,Math.sin(angle)*.11);
  const tip=new T.Vector3(Math.cos(angle)*rad,h,Math.sin(angle)*rad*.86);
  const control=root.clone().lerp(tip,.42);control.y=h*.7;control.x-=Math.sin(angle)*.23;control.z+=Math.cos(angle)*.23;
  const main=shoot(new T.QuadraticBezierCurve3(root,control,tip),.027);
  const forkRoot=branchPoint(branches[main],.4),forkAngle=angle+.6;
  const forkTip=new T.Vector3(Math.cos(forkAngle)*.82,h*.62,Math.sin(forkAngle)*.8);
  const forkControl=forkRoot.clone().lerp(forkTip,.48);forkControl.y+=.13;
  const fork=shoot(new T.QuadraticBezierCurve3(forkRoot,forkControl,forkTip),.013,true);
  const size=.5+random()*.1;
  for(const id of [main,fork]){
   const a=id===main?angle:forkAngle;
   if(detail!=='far')for(const sign of [-1,1])leaf(id,id===main?.57:.68,a+sign*1.04,size,1);
   if(detail==='near'&&id===main)for(const sign of [-1,1])leaf(id,.24,a+sign*1.2,size*.86,.9);
   if(detail==='far'&&id===main)leaf(id,.62,a+1.04,size*1.2,.94);
   leaf(id,1,a-.25,size*(detail==='far'?1.45:detail==='middle'?1.12:1),1.02);
  }
 }
 // Keep the complete plant, including wind travel, inside its existing footprint.
 let radius=0;for(let i=0;i<positions.length;i+=3)radius=Math.max(radius,Math.hypot(positions[i],positions[i+2]));
 const fit=Math.min(1,1.16/radius);
 for(let i=0;i<positions.length;i+=3){positions[i]*=fit;positions[i+2]*=fit;}
 for(const branch of branches)for(const p of branch.points){p.x*=fit;p.z*=fit;}
 for(const a of attachments)for(const p of [a.anchor,a.base]){p.x*=fit;p.z*=fit;}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 geometry.userData.branches=branches;geometry.userData.attachments=attachments;geometry.userData.detail=detail;
 return geometry;
}

let sharedLeafSurface:T.DataTexture|undefined;
/** A single small, opaque vein map serves every biome and detail level. Wood
 * samples the white corner; leaf UVs follow the midrib from stem to pointed tip. */
export function createVeinedLeafSurface(){
 if(sharedLeafSurface)return sharedLeafSurface;
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/(size-1),v=y/(size-1)-.5;
  let value=244+2*Math.sin(x*2.7+y*1.3);
  if(u>.025&&u<.975){
   // Raised midrib: a pale crest with a soft, darker edge.
   value-=28*Math.exp(-Math.pow(v/.027,2))+70*Math.exp(-Math.pow(v/.012,2));
   value+=12*Math.exp(-Math.pow((v+.018)/.009,2));
   for(let rib=0;rib<6;rib++){
    const start=.105+rib*.13,reach=.22-rib*.015;
    const across=Math.abs(v)/.48;
    const curve=start+reach*(across*.8+across*across*.2);
    const taper=1-Math.pow(Math.min(1,across),6);
    value-=96*Math.exp(-Math.pow((u-curve)/.014,2))*taper;
    value+=12*Math.exp(-Math.pow((u-curve-.019)/.01,2))*taper;
   }
  }
  // Branches and petioles keep their original vertex colour.
  if(u<.04&&Math.abs(v)>.45)value=255;
  const i=(y*size+x)*4,c=Math.max(0,Math.min(255,Math.round(value)));
  data[i]=data[i+1]=data[i+2]=c;data[i+3]=255;
 }
 const texture=new T.DataTexture(data,size,size);
 texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;texture.needsUpdate=true;
 sharedLeafSurface=texture;return texture;
}

/** One time uniform; coherent height-based bending keeps every attachment intact.
 * Opaque Lambert leaves avoid alpha overdraw and additional lights/shadows. */
export function createShrubMaterial(time:{value:number}){
 const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,map:createVeinedLeafSurface()});
 material.onBeforeCompile=shader=>{
  shader.uniforms.shrubTime=time;
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
uniform float shrubTime;
vec2 shrubSway() {
 vec4 root=vec4(0.0,0.0,0.0,1.0);
 #ifdef USE_INSTANCING
 root=instanceMatrix*root;
 #endif
 root=modelMatrix*root;
 float phase=dot(root.xz,vec2(.37,.23));
 return vec2(sin(shrubTime*.9+phase)*.032+sin(shrubTime*1.7+phase)*.009,cos(shrubTime*.75+phase)*.022);
}`)
  .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
 vec2 shrubBending=shrubSway();
 objectNormal.y-=2.0*position.y*dot(objectNormal.xz,shrubBending);`)
  .replace('#include <begin_vertex>',`#include <begin_vertex>
 transformed.xz+=shrubBending*position.y*position.y;`);
 };
 material.customProgramCacheKey=()=> 'attached-shrub-wind-v1';
 return material;
}
