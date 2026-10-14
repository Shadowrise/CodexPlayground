import * as T from 'three';
import type {Daylight} from './day-cycle';
import {CELESTIAL_MAX_HEIGHT} from './day-cycle';
import {spatialInstances} from './spatial-instances';
import {createBroadleafTree} from './broadleaf-tree';
import {spruceGeometries,spruceParts} from './spruce-shape';

const direction={value:new T.Vector2(0,1)},stretch={value:1};
let material:T.MeshBasicMaterial|undefined,geometry:T.BufferGeometry|undefined;
let projectionAspects=[1,1],spruceHalfWidth=1;

/** Project an actual birch or conifer prototype once. Keep the model's trunk,
 * branching outline and natural gaps rather than drawing circles and holes.
 * This CPU bake happens only on creation, never while the sun/camera moves. */
export function createTreeShadowTexture(kind:'birch'|'spruce'='birch'){
 const size=256,resolution=size*2,slope=1.35;
 let parts:T.BufferGeometry[],dispose:T.BufferGeometry[];
 if(kind==='spruce'){
  const shapes=spruceGeometries();parts=spruceParts().map(p=>shapes[p.kind].clone().applyMatrix4(p.matrix));
  dispose=[...parts,...Object.values(shapes)];
 }else{
  const tree=createBroadleafTree('birch',1);parts=[tree.wood,tree.leaves];dispose=[tree.wood,tree.leaves,tree.fruit,tree.shadow];
 }
 const mask=new Float32Array(resolution*resolution);
 let halfWidth=0,length=0;
 for(const part of parts){const p=part.attributes.position;for(let i=0;i<p.count;i++){halfWidth=Math.max(halfWidth,Math.abs(p.getX(i)));length=Math.max(length,p.getZ(i)+p.getY(i)*slope);}}
 halfWidth*=1.06;length*=1.04;
 const edge=(ax:number,ay:number,bx:number,by:number,x:number,y:number)=>(x-ax)*(by-ay)-(y-ay)*(bx-ax);
 for(const part of parts){
  const p=part.attributes.position,index=part.index!,points=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){points[i*2]=(.5+p.getX(i)/(2*halfWidth))*resolution;points[i*2+1]=(p.getZ(i)+p.getY(i)*slope)/length*resolution;}
  for(let i=0;i<index.count;i+=3){
   const a=index.getX(i)*2,b=index.getX(i+1)*2,c=index.getX(i+2)*2;
   const ax=points[a],ay=points[a+1],bx=points[b],by=points[b+1],cx=points[c],cy=points[c+1],area=edge(ax,ay,bx,by,cx,cy);
   if(Math.abs(area)<.001)continue;
   const minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxX=Math.min(resolution-1,Math.ceil(Math.max(ax,bx,cx)));
   const minY=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxY=Math.min(resolution-1,Math.ceil(Math.max(ay,by,cy)));
   const sign=Math.sign(area);
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(
    edge(ax,ay,bx,by,x+.5,y+.5)*sign>=0&&edge(bx,by,cx,cy,x+.5,y+.5)*sign>=0&&edge(cx,cy,ax,ay,x+.5,y+.5)*sign>=0)mask[y*resolution+x]=1;
  }
 }
 for(const part of dispose)part.dispose();
 // Slightly join very fine leaf/petiole edges, then feather at supersampled
 // resolution. Broad irregular gaps survive; subpixel details cannot sparkle.
 let pixels=new Float32Array(mask.length);
 for(let y=1;y<resolution-1;y++)for(let x=1;x<resolution-1;x++){
  const i=y*resolution+x;pixels[i]=Math.max(mask[i],mask[i-1],mask[i+1],mask[i-resolution],mask[i+resolution]);
 }
 let scratch=new Float32Array(mask.length);
 for(let pass=0;pass<3;pass++)for(const horizontal of [true,false]){
  const stride=horizontal?1:resolution,offset=horizontal?resolution:1;
  for(let line=0;line<resolution;line++){
   const start=line*offset;let sum=0;
   for(let p=0;p<=2;p++)sum+=pixels[start+p*stride];
   for(let p=0;p<resolution;p++){
    scratch[start+p*stride]=sum/5;
    if(p>=2)sum-=pixels[start+(p-2)*stride];
    if(p+3<resolution)sum+=pixels[start+(p+3)*stride];
   }
  }
  [pixels,scratch]=[scratch,pixels];
 }
 const data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4,p=y*2*resolution+x*2;
  data[i+3]=Math.round(255*(pixels[p]+pixels[p+1]+pixels[p+resolution]+pixels[p+resolution+1])/4);
 }
 const texture=new T.DataTexture(data,size,size);texture.generateMipmaps=true;
 texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.anisotropy=4;texture.needsUpdate=true;
 texture.userData.projection={kind,variation:kind==='birch'?1:0,slope,halfWidth,length,aspect:length/(2*halfWidth)};
 return texture;
}

function shadowMaterial(){
 if(material)return material;
 const masks=[createTreeShadowTexture(),createTreeShadowTexture('spruce')],size=256,padding=16,tile=size+padding*2,width=tile*2;
 const data=new Uint8Array(width*tile*4);
 for(const [index,mask] of masks.entries()){
  const pixels=mask.image.data as Uint8Array;
  for(let y=0;y<size;y++)data.set(pixels.subarray(y*size*4,(y+1)*size*4),((y+padding)*width+index*tile+padding)*4);
 }
 const map=new T.DataTexture(data,width,tile);map.generateMipmaps=true;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.anisotropy=4;map.needsUpdate=true;
 map.userData.projections=masks.map(m=>m.userData.projection);map.userData.atlas={size,padding,tile};
 projectionAspects=map.userData.projections.map((p:{aspect:number})=>p.aspect);spruceHalfWidth=map.userData.projections[1].halfWidth;
 masks.forEach(m=>m.dispose());
 material=new T.MeshBasicMaterial({color:'black',map,transparent:true,opacity:.64*.8,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 return restoreTreeShadowMaterial(material);
}

export function restoreTreeShadowMaterial(restored:T.MeshBasicMaterial){
 material=restored;
 const {size,padding,tile}=material.map!.userData.atlas as {size:number;padding:number;tile:number},width=tile*2;
 projectionAspects=material.map!.userData.projections.map((p:{aspect:number})=>p.aspect);
 spruceHalfWidth=material.map!.userData.projections[1].halfWidth;
 material.customProgramCacheKey=()=> 'painted-tree-shadows-atlas-v3';
 material.onBeforeCompile=shader=>{
  shader.uniforms.treeShadowDirection=direction;shader.uniforms.treeShadowStretch=stretch;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec2 treeShadowDirection;\nuniform float treeShadowStretch;')
   .replace('#include <uv_vertex>',`#include <uv_vertex>
    vMapUv=vec2((vMapUv.x*${size.toFixed(1)}+${padding.toFixed(1)}+instanceColor.r*${tile.toFixed(1)})/${width.toFixed(1)},(vMapUv.y*${size.toFixed(1)}+${padding.toFixed(1)})/${tile.toFixed(1)});`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    float shadowLength=transformed.z*treeShadowStretch*instanceColor.g;
    transformed.xz=vec2(treeShadowDirection.y*transformed.x+treeShadowDirection.x*shadowLength,
                       -treeShadowDirection.x*transformed.x+treeShadowDirection.y*shadowLength);`);
 };
 return material;
}

/** Ground-only approximation. Instances share one quad/map and move on the GPU
 * with the sun/moon direction; the tree's real foliage never enters a shadow map.
 * Broadleaf matrices carry crown radius; conifer matrices carry tree scale. */
export function treeShadows(matrices:readonly T.Matrix4[],spruces:readonly T.Matrix4[]=[]){
 const mat=shadowMaterial();
 if(!geometry){
  geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-1,0,0,1,0,0,-1,0,2,1,0,2],3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));geometry.setIndex([0,2,1,2,3,1]);
  // Conservative bounds include the longest GPU-stretched silhouette.
  const bound=Math.hypot(1,Math.max(...projectionAspects)*1.55*2)+.1;
  geometry.boundingSphere=new T.Sphere(new T.Vector3(),bound);geometry.boundingBox=new T.Box3(new T.Vector3(-bound,0,-bound),new T.Vector3(bound,0,bound));
 }
 const mesh=new T.InstancedMesh(geometry,mat,matrices.length+spruces.length);mesh.name='Soft patterned tree shadows';
 // The black material needs no tint. Its instance-colour channels carry atlas
 // selection and projected aspect, retaining one draw per spatial cell.
 const profile=new T.Color(),scale=new T.Matrix4().makeScale(spruceHalfWidth,1,spruceHalfWidth);
 for(const [kind,list] of [matrices,spruces].entries())list.forEach((matrix,i)=>{
  const index=i+(kind?matrices.length:0);mesh.setMatrixAt(index,kind?matrix.clone().multiply(scale):matrix);
  mesh.setColorAt(index,profile.setRGB(kind,projectionAspects[kind],0,T.LinearSRGBColorSpace));
 });
 return spatialInstances(mesh);
}

export function updateTreeShadows(time:Daylight){
 direction.value.set(time.shadowDirection[0],time.shadowDirection[2]);
 if(direction.value.lengthSq()>.0001)direction.value.normalize();else direction.value.set(0,1);
 stretch.value=.85+.7*(1-Math.abs(time.sunDirection[1])/CELESTIAL_MAX_HEIGHT);
 // Original near-normal calibration softened by 20% for both day and night.
 // Night needs a denser overlay because the reflected sky light is weaker.
 if(material)material.opacity=(.64+.10*time.night)*.8*time.shadowStrength;
}
