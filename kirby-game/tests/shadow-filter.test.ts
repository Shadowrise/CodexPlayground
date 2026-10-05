import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LinearFilter,LessEqualCompare,MeshStandardMaterial,PerspectiveCamera,Scene,ShaderChunk} from 'three';
import {StableCSM} from '../src/stable-shadows';
import {prepareShadowDepth} from '../src/shadow-filter';

test('hardware shadow depths reuse the same targets and preserve their resolution',()=>{
 const csm=new StableCSM({camera:new PerspectiveCamera(),parent:new Scene(),cascades:2,shadowMapSize:1024});
 const depths=prepareShadowDepth(csm),maps=csm.lights.map(l=>l.shadow.map);
 assert.deepEqual(prepareShadowDepth(csm),depths);
 csm.lights.forEach((light,i)=>{
  assert.equal(light.shadow.map,maps[i]);assert.equal(light.shadow.map!.width,1024);
  assert.equal(depths[i].compareFunction,LessEqualCompare);
  assert.equal(depths[i].minFilter,LinearFilter);assert.equal(depths[i].magFilter,LinearFilter);
 });
 const material=new MeshStandardMaterial();csm.setupMaterial(material);
 const shader={uniforms:{},vertexShader:'',fragmentShader:'#include <shadowmap_pars_fragment>\n#include <lights_fragment_begin>'};
 material.onBeforeCompile(shader as never,{} as never);
 assert(shader.fragmentShader.includes('stableShadowDepth[ i ]'));
 assert(!shader.fragmentShader.includes('getShadow( directionalShadowMap[ i ],'));
 assert(shader.fragmentShader.includes('getShadow( spotShadowMap[ i ],'));
 assert.equal(ShaderChunk.lights_fragment_begin.includes('stableShadowDepth'),false,'Do not globally replace Three shader chunks');
 csm.dispose();csm.remove();maps.forEach(m=>m!.dispose());material.dispose();
});

test('paired hardware samples exactly reproduce a continuous 5-tap tent',()=>{
 const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
 // Each adjacent pair is reconstructed by one bilinear texture comparison.
 // Check random shadow patterns as the sample crosses a texel boundary.
 for(let k=0;k<=100;k++){
  const s=k/100,w=[4-3*s,7,1+3*s],t=[(3-2*s)/w[0],(3+s)/7,s/w[2]];
  for(let bit=0;bit<64;bit++){
   const samples=Array.from({length:6},(_,i)=>(bit>>i)&1);
   const paired=w.reduce((sum,weight,i)=>sum+weight*lerp(samples[i*2],samples[i*2+1],t[i]),0)/12;
   const weights=[1-s,3-2*s,4-s,3+s,1+2*s,s];
   const explicit=samples.reduce((sum,value,i)=>sum+value*weights[i],0)/12;
   assert(Math.abs(paired-explicit)<1e-12);assert(paired>=-1e-12&&paired<=1+1e-12);
  }
 }
});
