import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AmbientLight,HemisphereLight,LightProbe,MeshStandardMaterial,PerspectiveCamera,Scene,ShaderChunk,Vector3,type WebGLRenderer,type WebGLProgramParametersWithUniforms} from 'three';
import {CelestialLighting} from '../src/celestial-lighting';
import {CELESTIAL_ORBIT_NORMAL,daylight} from '../src/day-cycle';
import {StableCSM} from '../src/stable-shadows';
import {createSky} from '../src/sky';

test('one celestial source lights both shadow cascades from the visible sun or moon',()=>{
 const scene=new Scene(),camera=new PerspectiveCamera(48,1.6,.75,1200);
 camera.position.set(80,8,-20);camera.lookAt(0,0,0);
 const shadows=new StableCSM({camera,parent:scene,cascades:2,shadowMapSize:1024}),lighting=new CelestialLighting(shadows,scene),sky=createSky(scene);
 try{
  for(const phase of [.02,.125,.25,.4,.48,.52,.625,.75,.9,.98]){
   const time=daylight(phase);lighting.update(time);shadows.update();sky(0,camera,time);scene.updateMatrixWorld(true);
   const body=scene.getObjectByName(time.elevation>=0?'Sun disc':'Moon')!;
   assert(body.visible);
   const source=body.position.clone().sub(camera.position).normalize();
   for(const light of shadows.lights){
    assert(light.target.position.clone().sub(light.position).normalize().dot(source)<-.999999,'light must point from the visible celestial body');
    assert.equal(light.intensity,shadows.lights[0].intensity);assert(light.color.equals(shadows.lights[0].color));
   }
   assert.equal(lighting.source,time.elevation>=0?'sun':'moon');
   assert(source.y>0);assert(source.y<.6,'the celestial path must not put the body directly overhead');
   assert(Math.abs(source.dot(new Vector3().fromArray(CELESTIAL_ORBIT_NORMAL)))<1e-9,'shadow orientation stays perpendicular to the whole orbit');
  }
  assert(!scene.children.some(o=>o instanceof HemisphereLight||o instanceof AmbientLight),'remove the strong omnidirectional fill');
  assert.equal(shadows.lights.length,2,'reuse the existing shadow maps');
 }finally{shadows.dispose();shadows.remove();}
});

test('weak reflected light keeps shaded surfaces readable with a smooth horizon handoff',()=>{
 const scene=new Scene(),camera=new PerspectiveCamera(),shadows=new StableCSM({camera,parent:scene,cascades:2,shadowMapSize:1024}),lighting=new CelestialLighting(shadows,scene);
 const irradiance=(n:Vector3)=>lighting.reflected.sh.getIrradianceAt(n,new Vector3());
 try{
  for(const phase of [.25,.75]){
   lighting.update(daylight(phase));const direct=shadows.lights[0].intensity;
   for(const normal of [new Vector3(0,1,0),new Vector3(1,0,0),new Vector3(0,-1,0)]){
    const reflected=irradiance(normal);
    assert(reflected.toArray().every(v=>v>0&&v<direct*.25),'reflection must stay positive and subordinate to the celestial source');
   }
  }
  for(const phase of [0,.5,1]){
   lighting.update(daylight(phase));assert.equal(shadows.lights[0].intensity,0);
   lighting.update(daylight(phase-1e-6));const before=irradiance(new Vector3(0,1,0)),a=shadows.lights[0].intensity;
   lighting.update(daylight(phase+1e-6));const after=irradiance(new Vector3(0,1,0));
   assert(before.distanceTo(after)<.0001);assert(Math.abs(a-shadows.lights[0].intensity)<.0001);
  }
 }finally{shadows.dispose();shadows.remove();}
});

test('twilight reflection brightens the horizon handoff without changing established day or night',()=>{
 const scene=new Scene(),shadows=new StableCSM({camera:new PerspectiveCamera(),parent:scene,cascades:2}),lighting=new CelestialLighting(shadows,scene);
 const normal=new Vector3(0,1,0),read=()=>lighting.reflected.sh.getIrradianceAt(normal,new Vector3());
 try{
  for(let step=0;step<=200;step++){
   const time=daylight(step/200);
   lighting.update({...time,shadowStrength:1});const ordinary=read();
   lighting.update(time);const actual=read();
   if(Math.abs(time.elevation)>=.16)assert(actual.equals(ordinary),'day and moonlight reflection must be unchanged outside the handoff');
   else{
    assert(actual.toArray().every((value,i)=>value>=ordinary.getComponent(i)),'twilight must never dim shaded surfaces');
    if(Math.abs(time.elevation)<=.02)assert(actual.length()>ordinary.length()*2,'retain enough diffuse light when direct illumination vanishes');
   }
   if(time.shadowStrength===0)assert.equal(shadows.lights[0].intensity,0,'do not revive a shadow at the sun/moon switch');
  }
  assert.equal(scene.children.filter(o=>o instanceof LightProbe).length,1,'reuse the existing probe');
  assert.equal(shadows.lights.length,2,'no additional shadow passes');
 }finally{shadows.dispose();shadows.remove();}
});

test('cheap reflection evaluates only its two active coefficients and preserves surface and shadow shaders',()=>{
 const scene=new Scene(),shadows=new StableCSM({camera:new PerspectiveCamera(),parent:scene,cascades:2}),lighting=new CelestialLighting(shadows,scene),material=new MeshStandardMaterial();
 let surfaceCompiled=false;
 try{
  shadows.setupMaterial(material);const shadowShader=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{shadowShader.call(material,shader,renderer);surfaceCompiled=true;};lighting.setupMaterial(material);
  const shader={uniforms:{},vertexShader:'',fragmentShader:'#include <lights_pars_begin>\n#include <shadowmap_pars_fragment>\n#include <lights_fragment_begin>'} as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader,{} as WebGLRenderer);
  assert(surfaceCompiled);assert(shader.uniforms.stableShadowDepth);
  assert(shader.fragmentShader.includes('lightProbe[1] * (1.023328 * dot(normal, viewMatrix[1].xyz))'));
  assert(!shader.fragmentShader.includes('shGetIrradianceAt( worldNormal, lightProbe )'));
  assert(ShaderChunk.lights_pars_begin.includes('shGetIrradianceAt( worldNormal, lightProbe )'),'do not globally change Three shaders');
  const camera=shadows.camera;
  for(const eye of [new Vector3(3,8,12),new Vector3(-9,2,-5)]){
   camera.position.copy(eye);camera.lookAt(0,0,0);camera.updateMatrixWorld();
   const skyAxis=new Vector3().setFromMatrixColumn(camera.matrixWorldInverse,1);
   for(const normal of [new Vector3(0,1,0),new Vector3(1,2,-3).normalize(),new Vector3(-1,-2,4).normalize()]){
    assert(Math.abs(normal.clone().transformDirection(camera.matrixWorldInverse).dot(skyAxis)-normal.y)<1e-9,'cheap vertical irradiance must not change when orbiting the camera');
   }
  }
 }finally{shadows.dispose();shadows.remove();material.dispose();}
});
