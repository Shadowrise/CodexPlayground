import * as T from 'three';

/** Smooth periodic gradient noise. Warping this field avoids both crossing
 * sine-wave diamonds and a visible lattice, without any per-frame generation. */
function rippleNoise(width:number,height:number,seed:number){
 const gradients=new Float32Array(width*height*2);
 for(let i=0;i<gradients.length;i+=2){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const angle=seed/4294967296*Math.PI*2;gradients[i]=Math.cos(angle);gradients[i+1]=Math.sin(angle);
 }
 const fade=(v:number)=>v*v*v*(v*(v*6-15)+10);
 return (u:number,v:number)=>{
  const x=(u-Math.floor(u))*width,y=(v-Math.floor(v))*height,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const dot=(dx:number,dy:number)=>{const i=(((iy+dy)%height)*width+(ix+dx)%width)*2;return gradients[i]*(fx-dx)+gradients[i+1]*(fy-dy);};
  return T.MathUtils.lerp(T.MathUtils.lerp(dot(0,0),dot(1,0),fade(fx)),T.MathUtils.lerp(dot(0,1),dot(1,1),fade(fx)),fade(fy));
 };
}

/** One periodic tile packs ripple slopes (RG), water tone (B) and roughness (A).
 * Bake once; colour and normal detail use the same texture fetch, with no
 * reflection pass, extra normal map, geometry or animated texture uploads. */
export function createWaterSurface(){
 const size=512,tileMetres=10,slopeRange=.15,height=new Float32Array(size*size),data=new Uint8Array(size*size*4);
 const warp=rippleNoise(4,4,191),wide=rippleNoise(12,20,811),small=rippleNoise(24,40,137),fine=rippleNoise(48,80,923);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,a=u+.09*warp(u,v),b=v+.12*warp(u+.37,v+.19);
  height[y*size+x]=.6*wide(a,b)+.28*small(a+.17,b-.21)+.12*fine(a-.43,b+.31);
 }
 const sample=(x:number,y:number)=>height[((y+size)%size)*size+(x+size)%size];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const h=sample(x,y),i=(y*size+x)*4;
  const dx=(sample(x+1,y)-sample(x-1,y))*size/(tileMetres*2)*.018;
  const dz=(sample(x,y+1)-sample(x,y-1))*size/(tileMetres*2)*.018;
  data[i]=Math.round(127.5*(1+T.MathUtils.clamp(-dx/slopeRange,-1,1)));
  // ShapeGeometry's v coordinate points against world Z on horizontal water.
  data[i+1]=Math.round(127.5*(1+T.MathUtils.clamp(dz/slopeRange,-1,1)));
  data[i+2]=Math.round(255*T.MathUtils.clamp(.5+h*.4,0,1));
  data[i+3]=Math.round(255*(.5+.35*warp(x/size+.23,y/size-.17)));
 }
 const texture=new T.DataTexture(data,size,size);texture.name='Soft flowing water: packed ripples';
 texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(1/tileMetres,1/tileMetres);
 texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=2;texture.needsUpdate=true;
 const material=new T.MeshStandardMaterial({map:texture,roughness:.76,metalness:0});material.name='Natural matte teal water';
 material.onBeforeCompile=shader=>{
  shader.uniforms.waterDeep={value:new T.Color('#1c515b')};shader.uniforms.waterCrest={value:new T.Color('#326d75')};
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 waterDeep;\nuniform vec3 waterCrest;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   vec4 waterDetail=texture2D(map,vMapUv);
   diffuseColor.rgb*=mix(waterDeep,waterCrest,waterDetail.b);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
   float roughnessFactor=roughness*(.9+.2*waterDetail.a);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
   normal=normalize(mat3(viewMatrix)*vec3((waterDetail.r*2.-1.)*${slopeRange.toFixed(2)},1.,(waterDetail.g*2.-1.)*${slopeRange.toFixed(2)}));
  `);
 };
 material.customProgramCacheKey=()=> 'packed-water-ripples-v2';
 return {texture,material};
}
