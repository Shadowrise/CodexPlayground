import {Color,LightProbe,ShaderChunk,type Material,type Scene} from 'three';
import {CELESTIAL_MAX_HEIGHT,type Daylight} from './day-cycle';
import type {StableCSM} from './stable-shadows';

const sun=new Color('#fff0d9'),moon=new Color('#bdd1f1'),lowSun=new Color('#ffb783');
const daySky=new Color('#bfd9f0'),nightSky=new Color('#8ea9d4'),duskSky=new Color('#ffc494');
const dayGround=new Color('#61754c'),nightGround=new Color('#37465f');

/** One celestial source, represented by the existing two shadow cascades.
 * The probe only approximates its weak diffuse reflection off sky and ground;
 * it emits no light and needs no environment maps or render passes. */
export class CelestialLighting{
 readonly reflected=new LightProbe();
 source:'sun'|'moon'='sun';
 private sky=new Color();private ground=new Color();
 constructor(readonly shadows:StableCSM,scene:Scene){
  this.reflected.name='Reflected celestial sky and ground';scene.add(this.reflected);
  shadows.lights.forEach((light,i)=>light.name=`Celestial shadow cascade ${i+1}`);
 }
 setupMaterial(material:Material){
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=function(shader,renderer){
   compile.call(this,shader,renderer);
   // This probe only uses the constant and vertical coefficients. Avoid the
   // full nine-coefficient SH evaluation on every grass/leaf fragment.
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_pars_begin>',ShaderChunk.lights_pars_begin.replace(
    'vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );',
    'vec3 irradiance = lightProbe[0] * 0.886227 + lightProbe[1] * (1.023328 * dot(normal, viewMatrix[1].xyz));'));
  };
 }
 update(time:Daylight){
  this.source=time.elevation>=0?'sun':'moon';
  const height=Math.abs(time.sunDirection[1])/CELESTIAL_MAX_HEIGHT;
  const intensity=(this.source==='sun'?4.6:2.2)*(.72+.28*height)*time.shadowStrength;
  for(const light of this.shadows.lights){
   light.color.copy(this.source==='sun'?sun:moon);
   if(this.source==='sun')light.color.lerp(lowSun,time.twilight);
   light.intensity=intensity;
  }
  this.shadows.lightDirection.fromArray(time.shadowDirection);
  this.sky.copy(daySky).lerp(nightSky,time.night).lerp(duskSky,time.twilight*.65).multiplyScalar(.65+time.day*.35);
  this.ground.copy(dayGround).lerp(nightGround,time.night).multiplyScalar(.24+time.day*.1);
  // Degree-one SH: irradiance varies smoothly from sky to ground by surface
  // normal. No per-frame captures, textures or extra shadow maps are needed.
  const [constant,vertical]=this.reflected.sh.coefficients;
  constant.set(this.sky.r+this.ground.r,this.sky.g+this.ground.g,this.sky.b+this.ground.b).multiplyScalar(.5/.886227);
  vertical.set(this.sky.r-this.ground.r,this.sky.g-this.ground.g,this.sky.b-this.ground.b).multiplyScalar(.5/1.023328);
 }
}
