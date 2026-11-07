import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Mesh,Object3D,Raycaster,SkinnedMesh,Texture,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createPigeon} from '../src/pigeon-model';

function validateBeak(root:Object3D){
 root.updateMatrixWorld(true);
 const beak=root.getObjectByName('Beak')!,jaw=root.getObjectByName('Lower_beak')!,upper=root.getObjectByName('Beak_sculpt_paint') as Mesh,lower=root.getObjectByName('Lower_beak_sculpt_paint') as Mesh;
 assert(upper&&lower&&jaw);assert.equal(lower.parent,jaw);assert.equal(root.getObjectByName('Pigeon_tongue')!.parent,jaw);
 upper.geometry.computeBoundingBox();assert(Math.abs(upper.geometry.boundingBox!.max.z-((1426-1270)/155-.49))<1e-6,'preserve the animated peck contact point');
 const cups:Mesh[]=[];beak.traverse(n=>{if(n instanceof Mesh&&n.userData.beakFeature==='recessed-nostril')cups.push(n);});assert.equal(cups.length,2);
 const centers=cups.map(cup=>new Vector3().fromBufferAttribute(cup.geometry.attributes.position,0));
 assert(Math.abs(centers[0].x+centers[1].x)<1e-6&&Math.abs(centers[0].y-centers[1].y)<1e-6&&Math.abs(centers[0].z-centers[1].z)<1e-6,'paired nostrils are symmetric');
 for(const cup of cups){
  const p=cup.geometry.attributes.position,n=cup.geometry.attributes.normal,center=new Vector3().fromBufferAttribute(p,0),outward=new Vector3();
  for(let i=0;i<49;i++)outward.add(new Vector3().fromBufferAttribute(n,i));outward.normalize();
  const lip=root.getObjectByName(cup.name.replace(/nostril$/,'nostril_lip')) as Mesh,lp=lip.geometry.attributes.position,rimCenter=new Vector3();
  for(let i=0;i<lp.count;i++)rimCenter.add(new Vector3().fromBufferAttribute(lp,i));rimCenter.divideScalar(lp.count);
  assert(rimCenter.sub(center).dot(outward)>.006,'the aperture has measurable depth behind its rim');
  const ray=new Raycaster(cup.localToWorld(center.clone().addScaledVector(outward,.07)),outward.clone().transformDirection(cup.matrixWorld).negate(),.0001,.14);
  const hit=ray.intersectObject(beak,true)[0];assert.equal(hit?.object,cup,'nostril recess remains exposed instead of being hidden by the bill surface');
 }
 const throat=root.getObjectByName('Pigeon_oral_throat') as SkinnedMesh;
 assert(throat?.isSkinnedMesh,'a flexible oral diaphragm closes the feathered skull behind the gape');
 assert.equal(root.getObjectByName('Pigeon_oral_palate')!.parent,beak);assert.equal(root.getObjectByName('Pigeon_oral_floor')!.parent,jaw);
 for(const angle of [0,.15,.30,.40]){
  jaw.rotation.x=angle;root.updateMatrixWorld(true);root.traverse(node=>{if(node instanceof SkinnedMesh)node.computeBoundingSphere();});
  // Aim through the opening at several parts of the back of the mouth,
  // from ahead and from either side. Feathered head geometry must never be
  // the visible surface behind the beak, including a fully opened jaw.
  for(const column of [8,12,16]){
   const target=throat.getVertexPosition(6*25+column,new Vector3());throat.localToWorld(target);
   for(const direction of [new Vector3(0,0,1),new Vector3(-1,0,0),new Vector3(1,0,0)]){
    direction.transformDirection(beak.matrixWorld);const ray=new Raycaster(target.clone().addScaledVector(direction,.65),direction.clone().negate(),0,1.3),hit=ray.intersectObject(root,true)[0];
    assert(hit,`the oral cavity is enclosed at jaw angle ${angle}`);assert(!/^Continuous[ _]pigeon[ _]body$/.test(hit.object.name),`feathers are visible inside the gape at jaw angle ${angle}`);
   }
  }
 }
}
test('authored bill has two visible recessed nostrils and retains the articulated mandible',()=>validateBeak(createPigeon().root));
for(const id of ['pigeon','snowball','ugolyok','ryzhik','kurlyk'])test(`${id} embeds the detailed bill and exposed nasal cavities`,async()=>{
 const bytes=await readFile(new URL(`../public/models/${id}-animated.glb`,import.meta.url)),loader=new GLTFLoader();
 loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));
 const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');validateBeak(gltf.scene);
});
