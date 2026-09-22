import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mesh, MeshStandardMaterial, PointLight, Box3 } from 'three';
import { Firefly } from '../src/firefly';
test('firefly GLB contains working idle blink, flight and independently configurable glow',async()=>{
 const bytes=await readFile(new URL('../public/models/firefly-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 assert.deepEqual(gltf.animations.map(c=>c.name).sort(),['Fly','Sit']);
 const f=new Firefly(gltf);f.update(.3);const eye=f.object.getObjectByName('Left_Eye')!;assert(eye.scale.y>.9);
 f.mixer.setTime(1.68);assert(eye.scale.y<.1);f.mixer.setTime(2);assert(eye.scale.y>.9);
 f.setMode('Fly');f.update(.3);const wing=f.object.getObjectByName('Left_Wing')!,pose=wing.quaternion.clone();f.update(.04);assert(wing.quaternion.angleTo(pose)>.1);assert(wing.scale.x>.99);
 const glow=(f.object.getObjectByName('Glow_Abdomen') as Mesh).material as MeshStandardMaterial;
 const shell=(f.object.getObjectByName('Thorax') as Mesh).material as MeshStandardMaterial,original=shell.color.clone();
 f.setGlowColor('#ff3388');assert.equal(glow.emissive.getHexString(),'ff3388');assert(shell.color.equals(original));
 assert.equal((f.object.getObjectByName('Firefly_Light') as PointLight).color.getHexString(),'ff3388');
 f.setMode('Sit');f.update(.3);assert(wing.scale.x<.05);assert(!new Box3().setFromObject(f.object).isEmpty());
});
