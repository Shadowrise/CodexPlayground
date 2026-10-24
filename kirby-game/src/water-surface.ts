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

const TILE_METRES=8,SLOPE_RANGE=.3;
let sharedTexture:T.DataTexture|undefined;

/** One small periodic tile for the entire scene: slopes (RG), tone (B),
 * roughness (A). Generated once, including mipmaps; never uploaded per frame. */
function waterTexture(){
 if(sharedTexture)return sharedTexture;
 const size=256,height=new Float32Array(size*size),data=new Uint8Array(size*size*4);
 const warp=rippleNoise(4,4,191),wide=rippleNoise(6,10,811),small=rippleNoise(16,26,137),fine=rippleNoise(32,48,923);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,a=u+.09*warp(u,v),b=v+.12*warp(u+.37,v+.19);
  height[y*size+x]=.56*wide(a,b)+.3*small(a+.17,b-.21)+.14*fine(a-.43,b+.31);
 }
 const sample=(x:number,y:number)=>height[((y+size)%size)*size+(x+size)%size];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const h=sample(x,y),i=(y*size+x)*4;
  const dx=(sample(x+1,y)-sample(x-1,y))*size/(TILE_METRES*2)*.06;
  const dy=(sample(x,y+1)-sample(x,y-1))*size/(TILE_METRES*2)*.06;
  data[i]=Math.round(127.5*(1+T.MathUtils.clamp(-dx/SLOPE_RANGE,-1,1)));
  data[i+1]=Math.round(127.5*(1+T.MathUtils.clamp(-dy/SLOPE_RANGE,-1,1)));
  data[i+2]=Math.round(255*T.MathUtils.clamp(.5+h*.55,0,1));
  data[i+3]=Math.round(255*(.5+.35*warp(x/size+.23,y/size-.17)));
 }
 const texture=new T.DataTexture(data,size,size);texture.name='Shared water: packed natural ripples';
 texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(1/TILE_METRES,1/TILE_METRES);
 texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=2;texture.needsUpdate=true;
 sharedTexture=texture;return texture;
}

/** PlaneGeometry and CircleGeometry have normalised UVs; ShapeGeometry already
 * uses metres. Keep ripple size consistent between lakes, bowls and channels. */
export function waterPlanarUVs<G extends T.BufferGeometry>(geometry:G):G{
 const positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
 for(let i=0;i<uv.count;i++)uv.setXY(i,positions.getX(i),positions.getY(i));
 uv.needsUpdate=true;return geometry;
}

export function createWaterSurface({flow=false,opacity=1}:{flow?:boolean;opacity?:number}={}){
 const texture=waterTexture(),phase={value:0};
 const material=new T.MeshStandardMaterial({map:texture,normalMap:texture,normalScale:new T.Vector2(SLOPE_RANGE,SLOPE_RANGE),roughness:.52,metalness:0,
  transparent:opacity<1,opacity,depthWrite:opacity===1,side:flow?T.DoubleSide:T.FrontSide});
 material.name=flow?'Natural flowing water':'Natural rippled water';material.forceSinglePass=true;
 // Phase belongs to the material, not the shared texture. Mill pressure must
 // never pause or speed up the river/fountain, nor move the other way on stop.
 material.userData.waterPhase=phase;
 material.onBeforeCompile=shader=>{
  shader.uniforms.waterPhase=phase;
  shader.uniforms.waterDeep={value:new T.Color(flow?'#265862':'#173f49')};shader.uniforms.waterCrest={value:new T.Color(flow?'#477e87':'#2d6570')};
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float waterPhase;\nuniform vec3 waterDeep;\nuniform vec3 waterCrest;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   // Two drifting reads of ONE tile break up a frozen sliding pattern. Colour,
   // roughness and normals reuse these reads, even though normalMap enables TBN.
   vec2 waterDrift=vec2(${flow?'.004,.16':'.012,.008'})*waterPhase;
   vec4 waterDetail=texture2D(map,vMapUv+waterDrift)*.65
    +texture2D(map,vMapUv*1.37+vec2(.31,-.23)+waterDrift*vec2(${flow?'-.4,.73':'-.6,.45'}))*.35;
   diffuseColor.rgb*=mix(waterDeep,waterCrest,waterDetail.b);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
   float roughnessFactor=roughness*(.85+.3*waterDetail.a);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
   // Respect the mesh tangent frame, including the curved sheet over the wheel.
   vec2 waterSlope=(waterDetail.rg*2.-1.)*normalScale;
   normal=normalize(tbn*normalize(vec3(waterSlope,1.)));
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',`
   #include <lights_physical_fragment>
   // Water's normal-incidence reflectance (IOR 1.333), rather than glass's .04.
   material.specularColor=vec3(.0204);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`
   #include <lights_fragment_end>
   #ifdef USE_LIGHT_PROBES
    // Broad sky reflection from the existing day/night probe. No scene capture,
    // reflection render target or extra lights; the ripple normal breaks it up.
    float waterFresnel=.0204+.9796*pow(1.-saturate(dot(normal,geometryViewDir)),5.);
    // The probe stores irradiance; convert to radiance so grazing reflections
    // retain the water colour instead of washing the whole surface white.
    vec3 waterSky=max(vec3(0.),lightProbe[0]*.886227+lightProbe[1]*1.023328)*RECIPROCAL_PI;
    reflectedLight.indirectSpecular+=waterSky*waterFresnel*(1.-roughnessFactor*.55);
   #endif
  `);
 };
 material.customProgramCacheKey=()=> 'packed-water-ripples-v4-'+(flow?'flow':'surface');
 return {texture,material,phase};
}
