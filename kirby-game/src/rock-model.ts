import * as T from 'three';

export type RockDetail='near'|'middle'|'far';
let surface:T.DataTexture|undefined;

/** One quiet mineral-grain map, shared by every stone and LOD. No bump/specular
 * pass: soft facets and moss colour are part of the actual geometry. */
function rockSurface(){
 if(surface)return surface;
 const size=256,data=new Uint8Array(size*size*4);
 const hash=(x:number,y:number)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
 const noise=(x:number,y:number)=>{
  const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,s=u*u*(3-2*u),t=v*v*(3-2*v);
  return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),s),T.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),s),t);
 };
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,grain=hash(x,y),cloud=noise(u*7,v*7),fine=noise(u*23,v*23);
  const seam=Math.abs(Math.sin(u*11+v*7+cloud*2.8));
  let value=230+32*(cloud-.5)+24*(fine-.5)+24*(grain-.5);
  value-=38*Math.exp(-Math.pow(seam/.045,2));
  if(grain>.985)value+=18;else if(grain<.035)value-=32;
  const i=(y*size+x)*4,c=T.MathUtils.clamp(Math.round(value),0,255);data[i]=data[i+1]=data[i+2]=c;data[i+3]=255;
 }
 surface=new T.DataTexture(data,size,size);surface.generateMipmaps=true;surface.minFilter=T.LinearMipmapLinearFilter;surface.magFilter=T.LinearFilter;surface.needsUpdate=true;return surface;
}

/** Rounded, weathered boulders with a seated bottom. Low-frequency shape and
 * moss fields are identical at every detail level, so LOD doesn't move them. */
export function createRockGeometry(variant=0,detail:RockDetail='near'){
 const [width,height]=detail==='near'?[16,10]:detail==='middle'?[10,6]:[6,4];
 const geometry=new T.SphereGeometry(1,width,height),p=geometry.attributes.position,colors=new Float32Array(p.count*3);
 const base=new T.Color('#838779'),moss=new T.Color('#617044'),point=new T.Vector3();
 for(let i=0;i<p.count;i++){
  point.fromBufferAttribute(p,i);
  const x=point.x,y=point.y,z=point.z;
  const shape=1+.075*Math.sin(x*4.7+z*3.1+variant*1.9)*Math.cos(y*3.8-variant)+.035*Math.sin(z*7-y*2+variant);
  const power=[.84,1.03,.72][variant%3],bend=(v:number)=>Math.sign(v)*Math.pow(Math.abs(v),power);
  let nx=(bend(x)*shape+.10*y*y*Math.sin(variant+1))*(variant===1?1.04:.91),nz=(bend(z)*shape+.065*x*y)*(variant===1?.81:.93);
  const ny=Math.min(.86+.06*nx-.035*nz,Math.max(-.76,y*(.91+.06*Math.sin(x*3+variant))+.065*Math.sin(x*3.8+z*2.9+variant)*(1-y*y)));
  nx=Math.min(nx,.91+.12*ny-.04*nz);nz=Math.max(nz,-.94+.07*nx);
  p.setXYZ(i,nx,ny,nz);
  const patch=.55+.22*Math.sin(x*5+z*3+variant*2)+.19*Math.cos(z*6-y*2-variant);
  const green=T.MathUtils.smoothstep(patch,.53,.80)*T.MathUtils.smoothstep(y,.05,.65)*.8;
  const shade=.93+.1*Math.sin(x*2.1+y*3+variant)*Math.cos(z*4.1-y);
  const tint=base.clone().lerp(moss,green);colors.set([tint.r/base.r*shade,tint.g/base.g*shade,tint.b/base.b*shade],i*3);
 }
 // Even a broad squared-off variant stays inside the former clearance radius.
 let extent=0;for(let i=0;i<p.count;i++)extent=Math.max(extent,Math.hypot(p.getX(i)*1.2,p.getZ(i)));
 const fit=Math.min(1,1.36/extent);geometry.scale(fit,1,fit);
 geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();
 geometry.userData.kind='naturalRock';geometry.userData.variant=variant;geometry.userData.detail=detail;return geometry;
}

export function createRockMaterial(){return new T.MeshLambertMaterial({map:rockSurface(),vertexColors:true});}
