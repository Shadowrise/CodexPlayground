import * as T from 'three';
import type {Daylight} from './day-cycle';

/** Outdoor radiance for metal: open sky above, pale horizon and sunlit ground.
 * Prefilter once at startup; no scene captures or extra lights are needed. */
function skyTexture(){
 const width=256,height=128,data=new Float32Array(width*height*4);
 const top=new T.Color('#9ac9ee'),horizon=new T.Color('#e4eef1'),ground=new T.Color('#9ba779'),color=new T.Color();
 for(let y=0;y<height;y++){
  const elevation=Math.sin(((y+.5)/height-.5)*Math.PI);
  color.copy(horizon).lerp(elevation>=0?top:ground,T.MathUtils.smoothstep(Math.abs(elevation),0,elevation>=0?.8:.25));
  for(let x=0;x<width;x++){const i=(y*width+x)*4;data[i]=color.r;data[i+1]=color.g;data[i+2]=color.b;data[i+3]=1;}
 }
 const texture=new T.DataTexture(data,width,height,T.RGBAFormat,T.FloatType);
 texture.mapping=T.EquirectangularReflectionMapping;texture.needsUpdate=true;return texture;
}

export class MetaKnightReflections{
 private readonly materials=new Map<T.MeshStandardMaterial,number>();
 private strength=1;
 constructor(root:T.Object3D,private readonly environment:T.WebGLRenderTarget){
  this.add(root);
 }
 /** Player clones keep independent materials and the passengers' shared sky. */
 add(root:T.Object3D){
  root.traverse(object=>{
   if(!(object instanceof T.Mesh))return;
   for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if(!(material instanceof T.MeshStandardMaterial)||material.metalness<.5||this.materials.has(material))continue;
    const intensity=material.userData.metaKnightReflectionIntensity??material.envMapIntensity;
    material.userData.metaKnightReflectionIntensity=intensity;
    this.materials.set(material,intensity);
    material.envMap=this.environment.texture;material.envMapIntensity=intensity*this.strength;material.needsUpdate=true;
    material.addEventListener('dispose',()=>this.materials.delete(material));
   }
  });
 }
 update(time:Pick<Daylight,'day'>){
  this.strength=.12+.88*time.day;
  for(const [material,intensity] of this.materials)material.envMapIntensity=intensity*this.strength;
 }
 dispose(){this.materials.clear();this.environment.dispose();}
}

export function createMetaKnightReflections(renderer:T.WebGLRenderer,root:T.Object3D){
 const source=skyTexture(),generator=new T.PMREMGenerator(renderer);
 try{
  return new MetaKnightReflections(root,generator.fromEquirectangular(source));
 }finally{source.dispose();generator.dispose();}
}
