import * as T from 'three';
import type {Biome} from './forest';
import {BIOME_STYLE} from './biome-style';

export type PlantDetail='near'|'middle'|'far';
type Surface='blade'|'seed'|'pad'|'petal'|'plain';
const regions={blade:[0,0],seed:[.5,0],pad:[0,.5],petal:[.5,.5]} as const;
let texture:T.DataTexture|undefined;

/** Reed ribs, seed grain, branching lily veins and petal fibres share one
 * opaque atlas. Mipmaps keep fine detail quiet as the camera moves. */
function plantSurface(){
 if(texture)return texture;
 const size=256,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x%128)/127,v=(y%128)/127;let value=246;
  if(y<128&&x<128){
   value-=58*Math.exp(-Math.pow((u-.5)/.025,2));
   for(const rib of [.17,.31,.69,.83])value-=25*Math.exp(-Math.pow((u-rib)/.016,2));
   value+=3*Math.sin(v*71+u*9);
  }else if(y<128){
   const grain=Math.sin(x*12.9898+y*78.233)*43758.5453;
   value=215+32*(grain-Math.floor(grain))+9*Math.sin(u*33+v*17);
  }else if(x<128){
   const px=(u-.5)*2,pz=(v-.5)*2,r=Math.hypot(px,pz),a=Math.atan2(px,pz);
   const vein=Math.abs(Math.sin(a*6));
   value-=62*Math.exp(-Math.pow(vein/.055,2))*T.MathUtils.smoothstep(r,.06,.22);
   const branches=Math.abs(Math.sin(r*23+a*3));
   value-=24*Math.exp(-Math.pow(branches/.13,2))*T.MathUtils.smoothstep(r,.15,.35);
   value-=12*Math.exp(-Math.pow((r-.88)/.025,2));value+=3*Math.sin(px*29+pz*17);
  }else{
   value-=20*Math.exp(-Math.pow((u-.5)/.035,2));
   value-=16*Math.pow(Math.sin(u*29+v*2),8);value+=4*Math.sin(v*17);
  }
  // Opaque white texels are used by stems/pistils instead of another material.
  if(x>=250&&y>=250)value=255;
  const i=(y*size+x)*4,c=T.MathUtils.clamp(Math.round(value),0,255);data[i]=data[i+1]=data[i+2]=c;data[i+3]=255;
 }
 texture=new T.DataTexture(data,size,size);texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.needsUpdate=true;return texture;
}

export function createWaterPlantMaterial(){
 const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,map:plantSurface()});
 // Reuse the tree leaves' thin-surface lighting; shaded petals stay readable.
 material.userData.leafLightTransmission=.32;return material;
}

class PlantMesh {
 positions:number[]=[];colors:number[]=[];uvs:number[]=[];indices:number[]=[];
 vertex(point:T.Vector3,color:T.Color,role:Surface='plain',u=.5,v=.5,shade=1){
  const i=this.positions.length/3;this.positions.push(point.x,point.y,point.z);this.colors.push(color.r*shade,color.g*shade,color.b*shade);
  const r=role==='plain'?undefined:regions[role];this.uvs.push(r?r[0]+.012+u*.476:.992,r?r[1]+.012+v*.476:.992);return i;
 }
 tube(points:T.Vector3[],radius:number,color:T.Color,sides:number,role:Surface='plain',taper=.3){
  const start=this.positions.length/3,axis=new T.Vector3(0,0,1);
  for(let row=0;row<points.length;row++){
   const t=row/(points.length-1),tangent=points[Math.min(row+1,points.length-1)].clone().sub(points[Math.max(0,row-1)]).normalize();
   const side=axis.clone().cross(tangent).normalize(),normal=tangent.clone().cross(side).normalize();
   for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,r=radius*(1-taper*t)*(role==='seed'?.6+.4*Math.sin(t*Math.PI):1);this.vertex(points[row].clone().addScaledVector(side,Math.cos(a)*r).addScaledVector(normal,Math.sin(a)*r),color,role,j/sides,t,.92+.08*Math.sin(a));}
  }
  for(let row=0;row<points.length-1;row++)for(let j=0;j<sides;j++){const a=start+row*(sides+1)+j,b=a+1,c=a+sides+1,d=c+1;this.indices.push(a,b,c,b,d,c);}
  for(const [row,flip] of [[0,true],[points.length-1,false]] as const){const c=this.vertex(points[row],color);for(let j=0;j<sides;j++){const a=start+row*(sides+1)+j;this.indices.push(c,flip?a+1:a,flip?a:a+1);}}
 }
 blade(base:T.Vector3,direction:T.Vector3,length:number,width:number,color:T.Color,rows:number,role:Surface='blade',rise=.4,droop=.27){
  const side=new T.Vector3(direction.z,0,-direction.x).normalize(),start=this.vertex(base,color,role,.5,0,.76);
  let previous:number[]|undefined;
  for(let row=0;row<rows;row++){
   const t=(row+1)/(rows+1),w=width*Math.pow(Math.sin(t*Math.PI),.8)*.5;
   const c=base.clone().addScaledVector(direction,t*length);c.y+=length*(rise*t-droop*t*t);
   const ids=[this.vertex(c.clone().addScaledVector(side,-w),color,role,0,t,.86),this.vertex(c.clone().add(new T.Vector3(0,width*.06,0)),color,role,.5,t,1.04),this.vertex(c.clone().addScaledVector(side,w),color,role,1,t,.92)];
   if(previous)this.indices.push(previous[0],ids[0],previous[1],ids[0],ids[1],previous[1],previous[1],ids[1],previous[2],ids[1],ids[2],previous[2]);
   else this.indices.push(start,ids[0],ids[1],start,ids[1],ids[2]);previous=ids;
  }
  const tip=base.clone().addScaledVector(direction,length);tip.y+=length*(rise-droop);
  const id=this.vertex(tip,color,role,.5,1,.95);this.indices.push(previous![0],id,previous![1],previous![1],id,previous![2]);
 }
 geometry(kind:string,detail:PlantDetail){
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(this.positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(this.colors,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(this.uvs,2));geometry.setIndex(this.indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();geometry.userData.kind=kind;geometry.userData.detail=detail;return geometry;
 }
}

export function createReedGeometry(biome:Biome='birch',variant=0,detail:PlantDetail='near'){
 const mesh=new PlantMesh(),stems:T.Vector3[][]=[],attachments:T.Vector3[]=[],palette=BIOME_STYLE[biome];
 const stalk=new T.Color(palette.leaf),leaf=new T.Color(palette.grass[1]),seedColor=new T.Color('#765334');
 let seed=1247+variant*131;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const segments=detail==='near'?5:detail==='middle'?3:2,sides=detail==='near'?5:4,rows=detail==='near'?5:detail==='middle'?3:1;
 for(let i=0;i<6;i++){
  const angle=i*2.399+.2*variant,r=.08+random()*.23,h=1.05+random()*.55;
  const base=new T.Vector3(Math.sin(angle)*r,0,Math.cos(angle)*r),tip=base.clone().add(new T.Vector3(Math.sin(angle+.5)*.12,h,Math.cos(angle+.5)*.12));
  const control=base.clone().lerp(tip,.5);control.x-=Math.cos(angle)*.1;control.z+=Math.sin(angle)*.1;
  const points=new T.QuadraticBezierCurve3(base,control,tip).getPoints(segments);stems.push(points);mesh.tube(points,.016,stalk,sides);
  if(i%2===0){
   const d=points.at(-1)!.clone().sub(points.at(-2)!).normalize(),head=tip.clone().addScaledVector(d,-.22),end=tip.clone().addScaledVector(d,.065);
   const bulge=head.clone().lerp(end,.5);mesh.tube([head,bulge,end],.048,seedColor,detail==='near'?8:5,'seed',.06);
   mesh.tube([end,end.clone().addScaledVector(d,.09)],.008,seedColor,3);
  }
  for(let j=0;j<2;j++){
   const t=.24+j*.23,u=t*segments,index=Math.min(segments-1,Math.floor(u)),anchor=points[index].clone().lerp(points[index+1],u-index);attachments.push(anchor);
   const dir=new T.Vector3(Math.sin(angle+j*1.5),0,Math.cos(angle+j*1.5));
   mesh.blade(anchor,dir,.5+j*.06,.038+j*.008,leaf,rows,'blade',.82,.53);
  }
 }
 const geometry=mesh.geometry('reeds',detail);geometry.scale(.72,1,.72);geometry.computeBoundingSphere();geometry.computeBoundingBox();
 for(const points of stems)for(const p of points){p.x*=.72;p.z*=.72;}
 for(const p of attachments){p.x*=.72;p.z*=.72;}
 geometry.userData.stems=stems;geometry.userData.attachments=attachments;return geometry;
}

export function createWaterLilyGeometry(variant=0,detail:PlantDetail='near'){
 const mesh=new PlantMesh(),segments=detail==='near'?40:detail==='middle'?24:12,rows=detail==='near'?4:detail==='middle'?2:1;
 const pad=(cx:number,cz:number,radius:number,rotation:number,y:number)=>{
  const green=new T.Color(variant?'#517946':'#487b49'),centre=new T.Vector3(cx,y,cz),origin=mesh.vertex(centre,green,'pad',.5,.5,.8),rings:number[][]=[];
  for(const r of [.45,1]){
   const ids:number[]=[];
   for(let j=0;j<=segments;j++){
    const a=.30+j/segments*(Math.PI*2-.60),outline=1+.026*Math.sin(a*9+variant),x=Math.sin(a)*radius*r*outline,z=Math.cos(a)*radius*r*outline;
    const p=new T.Vector3(cx+x*Math.cos(rotation)+z*Math.sin(rotation),y+.012*r*r*Math.sin(a*3+variant),cz-x*Math.sin(rotation)+z*Math.cos(rotation));
    ids.push(mesh.vertex(p,green,'pad',.5+x/(radius*2.1),.5+z/(radius*2.1),.88+.12*r));
   }rings.push(ids);
  }
  for(let j=0;j<segments;j++){mesh.indices.push(origin,rings[0][j],rings[0][j+1],rings[0][j],rings[1][j],rings[0][j+1],rings[1][j],rings[1][j+1],rings[0][j+1]);}
  // A tiny rolled rim gives the pad thickness without a floating lower disc.
  const outer=rings[1],bottom=outer.map(i=>mesh.vertex(new T.Vector3(mesh.positions[i*3],mesh.positions[i*3+1]-.018,mesh.positions[i*3+2]),green,'plain',.5,.5,.7));
  for(let j=0;j<segments;j++)mesh.indices.push(outer[j],bottom[j],outer[j+1],bottom[j],bottom[j+1],outer[j+1]);
 };
 pad(0,0,.66,variant*.7,.032);pad(-.62,-.37,.34,1.3+variant*.3,.04);
 const flower=new T.Vector3(.09,.055,-.10);mesh.tube([new T.Vector3(.09,.015,-.10),flower],.035,new T.Color('#6f8a45'),5);
 for(let ring=0;ring<3;ring++){
  const count=8-ring,base=flower.clone().add(new T.Vector3(0,ring*.034,0)),color=new T.Color(['#dca0bb','#efd0dc','#fff0df'][ring]);
  for(let j=0;j<count;j++){
   const a=j/count*Math.PI*2+ring*.38+variant*.4;
   mesh.blade(base,new T.Vector3(Math.sin(a),0,Math.cos(a)),.36-ring*.085,.18-ring*.035,color,rows,'petal',.14+ring*.5,-.25);
  }
 }
 const gold=new T.Color('#dba743');
 for(let i=0;i<9;i++){const a=i*2.399,x=flower.x+Math.sin(a)*.052,z=flower.z+Math.cos(a)*.052;mesh.tube([new T.Vector3(x,.14,z),new T.Vector3(x,.21+(i%3)*.013,z)],.012,gold,detail==='near'?4:3);}
 return mesh.geometry('waterLily',detail);
}
