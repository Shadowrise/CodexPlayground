import {DepthTexture,LessEqualCompare,LinearFilter,NearestFilter,ShaderChunk,UnsignedIntType,WebGLRenderTarget} from 'three';
import type {Material} from 'three';
import type {CSM} from 'three/addons/csm/CSM.js';

// WebGL2 depth comparisons filter visibility, not packed RGBA depth. The depth
// texture replaces the target's existing depth renderbuffer; no extra scene pass.
export function prepareShadowDepth(csm:CSM){
  return csm.lights.map(light=>{
    const shadow=light.shadow;
    if(!shadow.map)shadow.map=new WebGLRenderTarget(shadow.mapSize.x,shadow.mapSize.y,{minFilter:NearestFilter,magFilter:NearestFilter});
    if(!shadow.map.depthTexture){
      const depth=new DepthTexture(shadow.mapSize.x,shadow.mapSize.y,UnsignedIntType);
      depth.compareFunction=LessEqualCompare;
      depth.minFilter=depth.magFilter=LinearFilter;
      shadow.map.depthTexture=depth;
    }
    return shadow.map.depthTexture;
  });
}

// A continuous 5x5 tent (1,3,4,3,1). Pair adjacent weights into hardware
// bilinear comparisons: nine texture instructions instead of PCFSoft's sixteen.
// Keep the kernel fixed in shadow space: no animated noise or frame history.
export const stableShadowGLSL=/* glsl */`
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
uniform highp sampler2DShadow stableShadowDepth[ NUM_DIR_LIGHT_SHADOWS ];
uniform bool stableShadowFilterEnabled;
float getStableShadow(sampler2D packedMap, sampler2DShadow depthMap, vec2 mapSize, float intensity, float bias, float radius, vec4 coord){
  if(!stableShadowFilterEnabled)return getShadow(packedMap,mapSize,intensity,bias,radius,coord);
  coord.xyz/=coord.w;
  coord.z+=bias;
  if(any(lessThan(coord.xy,vec2(0.0)))||any(greaterThan(coord.xy,vec2(1.0)))||coord.z>1.0)return 1.0;
  vec2 p=coord.xy*mapSize+0.5;
  vec2 f=fract(p),base=(floor(p)-0.5)/mapSize;
  vec3 wx=vec3(4.0-3.0*f.x,7.0,1.0+3.0*f.x);
  vec3 wy=vec3(4.0-3.0*f.y,7.0,1.0+3.0*f.y);
  vec3 u=base.x+(vec3((3.0-2.0*f.x)/wx.x-2.0,(3.0+f.x)/7.0,f.x/wx.z+2.0))/mapSize.x;
  vec3 v=base.y+(vec3((3.0-2.0*f.y)/wy.x-2.0,(3.0+f.y)/7.0,f.y/wy.z+2.0))/mapSize.y;
  float visibility=
    wx.x*wy.x*texture(depthMap,vec3(u.x,v.x,coord.z))+
    wx.y*wy.x*texture(depthMap,vec3(u.y,v.x,coord.z))+
    wx.z*wy.x*texture(depthMap,vec3(u.z,v.x,coord.z))+
    wx.x*wy.y*texture(depthMap,vec3(u.x,v.y,coord.z))+
    wx.y*wy.y*texture(depthMap,vec3(u.y,v.y,coord.z))+
    wx.z*wy.y*texture(depthMap,vec3(u.z,v.y,coord.z))+
    wx.x*wy.z*texture(depthMap,vec3(u.x,v.z,coord.z))+
    wx.y*wy.z*texture(depthMap,vec3(u.y,v.z,coord.z))+
    wx.z*wy.z*texture(depthMap,vec3(u.z,v.z,coord.z));
  return mix(1.0,visibility/144.0,intensity);
}
#endif
`;

export function setupStableShadowFilter(material:Material,depths:ReturnType<typeof prepareShadowDepth>,enabled:{value:boolean}){
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    shader.uniforms.stableShadowDepth={value:depths};
    shader.uniforms.stableShadowFilterEnabled=enabled;
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <shadowmap_pars_fragment>','#include <shadowmap_pars_fragment>\n'+stableShadowGLSL)
      .replace('#include <lights_fragment_begin>',ShaderChunk.lights_fragment_begin.replaceAll(
        'getShadow( directionalShadowMap[ i ],','getStableShadow( directionalShadowMap[ i ], stableShadowDepth[ i ],'));
  };
}
