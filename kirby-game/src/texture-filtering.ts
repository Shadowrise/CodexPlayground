import * as T from 'three';
const prepared=new WeakSet<T.Texture>();
const maps=['map','normalMap','bumpMap','roughnessMap','metalnessMap','alphaMap','emissiveMap','aoMap','lightMap'] as const;
/** One-time filtering for static surface images; never touch render targets/data samplers. */
export function prepareSurfaceTextures(material:T.Material,maxAnisotropy:number){
 for(const key of maps){
  const texture=(material as unknown as Record<string,unknown>)[key];
  if(!(texture instanceof T.Texture)||prepared.has(texture))continue;
  if(texture.isRenderTargetTexture||texture instanceof T.DepthTexture||texture instanceof T.VideoTexture||texture instanceof T.CompressedTexture||texture instanceof T.CubeTexture||texture.type!==T.UnsignedByteType)continue;
  prepared.add(texture);
  const anisotropy=Math.min(Math.max(1,maxAnisotropy),4,Math.max(2,texture.anisotropy));
  const mipmaps=texture.mipmaps.length===0;
  const changed=texture.magFilter!==T.LinearFilter||texture.minFilter!==T.LinearMipmapLinearFilter||texture.anisotropy!==anisotropy||texture.generateMipmaps!==mipmaps;
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.anisotropy=anisotropy;texture.generateMipmaps=mipmaps;
  if(changed)texture.needsUpdate=true;
 }
}
