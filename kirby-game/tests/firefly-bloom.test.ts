import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Color,ColorManagement,Mesh,MeshStandardMaterial,PointLight,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Firefly} from '../src/firefly';
import {setFireflyBloomColor} from '../src/firefly-bloom';

async function fixture(){
 const bytes=await readFile(new URL('../public/models/firefly-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const firefly=new Firefly(gltf),glow=(firefly.object.getObjectByName('Glow_Abdomen') as Mesh).material as MeshStandardMaterial;
 return {firefly,glow};
}
test('preview red and blue emit above the real bloom threshold without changing their hue or the shell',async()=>{
 const {firefly,glow}=await fixture(),weights=new Vector3();ColorManagement.getLuminanceCoefficients(weights);
 const shell=(firefly.object.getObjectByName('Thorax') as Mesh).material as MeshStandardMaterial,original=shell.color.clone();
 for(const hex of ['#ff0000','#0000ff','#ff00ff','#00ffff','#00ff00','#ffff00','#ffffff','#baff55']){
  setFireflyBloomColor(firefly,hex);const color=new Color(hex);
  const brightness=(glow.emissive.r*weights.x+glow.emissive.g*weights.y+glow.emissive.b*weights.z)*glow.emissiveIntensity;
  assert(brightness>1.1,hex+' must pass the preview bloom threshold');
  assert(glow.emissive.equals(color));assert(glow.color.equals(color));assert(shell.color.equals(original));
  assert((firefly.object.getObjectByName('Firefly_Light') as PointLight).color.equals(color));
 }
 setFireflyBloomColor(firefly,'#baff55');assert.equal(glow.emissiveIntensity,1.4,'the approved default green stays unchanged');
 setFireflyBloomColor(firefly,'#ffff00');assert.equal(glow.emissiveIntensity,1.4,'yellow keeps its existing glow');
});
test('brightness compensation is bounded and repeatable, while dark colours dim and black stays off',async()=>{
 const {firefly,glow}=await fixture();
 setFireflyBloomColor(firefly,'#0000ff');const intensity=glow.emissiveIntensity;
 const energy=()=>Math.max(glow.emissive.r,glow.emissive.g,glow.emissive.b)*glow.emissiveIntensity;
 const bright=energy();
 for(let i=0;i<10;i++)setFireflyBloomColor(firefly,'#0000ff');assert.equal(glow.emissiveIntensity,intensity);
 setFireflyBloomColor(firefly,'#000001');assert(Math.abs(glow.emissiveIntensity-intensity)<1e-10);
 assert(energy()<bright/1000);
 setFireflyBloomColor(firefly,'#000000');assert.equal(energy(),0);assert(Number.isFinite(glow.emissiveIntensity));
 setFireflyBloomColor(firefly,'#baff55');assert.equal(glow.emissiveIntensity,1.4);
});
