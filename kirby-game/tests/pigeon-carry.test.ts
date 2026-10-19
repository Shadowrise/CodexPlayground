import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {CharacterController} from '../src/controller';
import {MillQuestDecor} from '../src/mill-quest-decor';
import {MillBakery} from '../src/mill-bakery';
import {newMillQuest} from '../src/mill-quest';
import {BreadWorld} from '../src/bread';
import {clearPigeonCarryPoses} from '../src/pigeon-carry';

const asset=(async()=>{
 const bytes=await readFile(new URL('../public/models/pigeon-animated.glb',import.meta.url)),loader=new GLTFLoader();
 loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new T.Texture())}));
 return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
})();

function distanceToFeathers(wing:T.Object3D,point:T.Vector3){
 let closest=Infinity;
 const triangle=new T.Triangle(),nearest=new T.Vector3();
 wing.traverse(mesh=>{
  if(!(mesh instanceof T.Mesh))return;
  const p=mesh.geometry.attributes.position,indices=mesh.geometry.index!;
  for(let i=0;i<indices.count;i+=3){
   triangle.a.fromBufferAttribute(p,indices.getX(i)).applyMatrix4(mesh.matrixWorld);
   triangle.b.fromBufferAttribute(p,indices.getX(i+1)).applyMatrix4(mesh.matrixWorld);
   triangle.c.fromBufferAttribute(p,indices.getX(i+2)).applyMatrix4(mesh.matrixWorld);
   triangle.closestPointToPoint(point,nearest);closest=Math.min(closest,nearest.distanceTo(point));
  }
 });
 return closest;
}

test('Pidgie carries mill sacks by their collars with the same wing pose as bread while moving and turning',async()=>{
 const gltf=await asset,c=new CharacterController(clone(gltf.scene),gltf.animations),reference=new CharacterController(clone(gltf.scene),gltf.animations);
 const decor=new MillQuestDecor(new T.ShaderMaterial()),bakery=new MillBakery(),bread=new BreadWorld();
 decor.group.position.set(4,0,-7);bakery.group.position.set(-8,0,5);
 const wing=c.actor.getObjectByName('Right_wing')!,left=c.actor.getObjectByName('Left_wing')!;
 const point=new T.Vector3();bread.state.owner='solo';
 for(const size of [1,2])for(const name of ['Idle','Walk','Run'])for(const time of [.12,.38,.79]){
  for(const bird of [c,reference]){
   bird.resizeTo(size,true);bird.actor.position.set(17,0,-9);bird.actor.rotation.y=bird.yaw=1.1;
   bird.actions.forEach(action=>action.stop());bird.actions.get(name)!.reset().play();bird.mixer.setTime(time);
  }
  clearPigeonCarryPoses();
  const nativeLeft=left.quaternion.clone();
  decor.update({...newMillQuest(),stage:'bags',owner:'solo',carried:1},1000,c.actor);
  bread.update(1000,new Map([['solo',reference.actor]]));
  assert(wing.quaternion.angleTo(reference.actor.getObjectByName('Right_wing')!.quaternion)<1e-6,'grain uses the existing bread-carry pose');
  assert(left.quaternion.equals(nativeLeft),'the other wing keeps its native movement');
  decor.group.updateMatrixWorld(true);
  decor.bags[1].localToWorld(point.set(0,1.19,0));
  assert(distanceToFeathers(wing,point)<.005*size,'the grain sack collar must touch the carrying feathers');
  assert(new T.Box3().setFromObject(decor.bags[1],true).min.y>.08*size,'the carried sack must clear the ground');
  c.mixer.setTime(time);
  bakery.update(.016,{...newMillQuest(),stage:'knead',kneadStep:1,owner:'solo'},1000,c.actor);
  bakery.group.updateMatrixWorld(true);
  const flour=bakery.group.getObjectByName('Freshly milled flour sack')!;flour.localToWorld(point.set(0,.77,0));
  assert(distanceToFeathers(wing,point)<.005*size,'the flour sack collar must also touch the carrying feathers');
  assert(wing.quaternion.angleTo(reference.actor.getObjectByName('Right_wing')!.quaternion)<1e-6);
  assert.equal(c.savedSize,size);
 }
 c.actions.forEach(action=>action.stop());c.actions.get('Idle')!.reset().play();c.mixer.setTime(.4);
 clearPigeonCarryPoses();const released=wing.quaternion.clone();
 decor.update({...newMillQuest(),stage:'bags',owner:'solo',carried:1},1000,c.actor);
 c.mixer.update(.1);clearPigeonCarryPoses();
 decor.update(newMillQuest(),2000,c.actor);bakery.update(.016,newMillQuest(),2000,c.actor);
 assert(wing.quaternion.equals(released),'putting the sack down releases the wing');
});
