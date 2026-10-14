import * as T from 'three';

let sharedSurface:T.DataTexture|undefined;
/** Fine longitudinal veins follow the blade's bend through UVs. Opaque,
 * grayscale and shared: biome colour still comes from the instance palette. */
function grassSurface(){
 if(sharedSurface)return sharedSurface;
 const width=64,height=128,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=x/(width-1)-.5,v=y/(height-1);
  const stem=.9+.1*Math.sin(Math.PI*v);
  let value=245+2*Math.sin(v*35+u*11);
  value-=74*Math.exp(-Math.pow(u/.035,2))*stem;
  value+=12*Math.exp(-Math.pow((u-.048)/.022,2))*stem;
  for(const side of [-1,1]){
   const bend=.024*Math.sin(v*Math.PI);
   for(const rib of [.2,.37]){
    const centre=side*(rib+bend*(rib===.2?1:-1));
    value-=52*Math.exp(-Math.pow((u-centre)/.019,2));
    value+=8*Math.exp(-Math.pow((u-centre-.024)/.016,2));
   }
  }
  const i=(y*width+x)*4,c=Math.max(0,Math.min(255,Math.round(value)));
  data[i]=data[i+1]=data[i+2]=c;data[i+3]=255;
 }
 const texture=new T.DataTexture(data,width,height);
 texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;texture.needsUpdate=true;
 sharedSurface=texture;return texture;
}

/** Three slender curved blades. Five triangles per blade keep the extra curve
 * cheap; their narrow silhouette also cuts fragment work compared with broad leaves. */
export function createGrassGeometry(){
 const geometry=new T.BufferGeometry(),positions:number[]=[],indices:number[]=[],colors:number[]=[],uvs:number[]=[];
 for(let j=0;j<3;j++){
  const a=j*2.399,co=Math.cos(a),si=Math.sin(a),base=positions.length/3,h=.44+j*.065;
  const point=(t:number,side:number)=>{
   const halfWidth=(.025+j*.003)*(1-t*.8);
   const x=(j-1)*.015+(.06+j*.015)*t*t+halfWidth*side,z=(.18+j*.02)*t*t,y=h*t*(1-.08*t);
   positions.push(x*co+z*si,y,-x*si+z*co);uvs.push((side+1)/2,t);
   const light=.72+.28*t;colors.push(light,light,light);
  };
  for(const t of [0,.35,.7]){point(t,-1);point(t,1);}
  point(1,0);
  for(let row=0;row<2;row++){
   const b=base+row*2;indices.push(b,b+1,b+2,b+1,b+3,b+2);
  }
  indices.push(base+4,base+5,base+6);
 }
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function createGrassMaterial(map:T.Texture=grassSurface()){
 const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,map});
 // Keep the existing distance fade; no alpha blending or additional passes.
 material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vec4 meadowPosition=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 meadowPosition=instanceMatrix*meadowPosition;
 #endif
 meadowPosition=modelMatrix*meadowPosition;
 transformed.y*=1.0-smoothstep(65.0,105.0,length(meadowPosition.xz-cameraPosition.xz));`);};
 material.customProgramCacheKey=()=> 'meadow-grass-distance-veins-v2';return material;
}
