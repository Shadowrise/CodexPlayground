import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {AnimationMixer,Box3,BufferAttribute,InstancedMesh,Mesh,SkinnedMesh,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BedQuilt,BED_REST,BED_MATTRESS_Y,BED_PIGEON_COVER_FOLD,BED_PIGEON_REST} from '../src/bed-quilt';
import {KirbyHome} from '../src/kirby-home';
import {CharacterController} from '../src/controller';

const positions=(quilt:BedQuilt)=>Array.from(quilt.geometry.getAttribute('position').array);
function quiltHeight(quilt:BedQuilt,x:number,z:number){
 const p=quilt.geometry.getAttribute('position');
 if(x<p.getX(0)||x>=p.getX(24)||z<p.getZ(0)||z>=p.getZ(24*25))return;
 let i=0,j=0;
 while(i<23&&x>=p.getX(i+1))i++;
 while(j<23&&z>=p.getZ((j+1)*25))j++;
 const u=(x-p.getX(i))/(p.getX(i+1)-p.getX(i)),v=(z-p.getZ(j*25))/(p.getZ((j+1)*25)-p.getZ(j*25));
 const a=p.getY(j*25+i),b=p.getY((j+1)*25+i),d=p.getY(j*25+i+1),c=p.getY((j+1)*25+i+1);
 return u+v<=1?(1-u-v)*a+v*b+u*d:(1-u)*b+(1-v)*d+(u+v-1)*c;
}

test('pigeon quilt profile covers its side-sleeping torso, wings, feet and tail while exposing the face',async()=>{
 const {createPigeon}=await import('../src/pigeon-model');
 const {root,clips}=createPigeon(),quilt=new BedQuilt(),mixer=new AnimationMixer(root);
 mixer.clipAction(clips.find(c=>c.name==='Sleep')!).play();
 root.position.set(0,BED_PIGEON_REST.y,BED_PIGEON_REST.z);root.rotation.set(BED_PIGEON_REST.pitch,BED_PIGEON_REST.yaw,0);
 quilt.setPose(1,BED_PIGEON_COVER_FOLD,'pigeon');
 const top=quilt.geometry.getAttribute('position').getZ(0);
 assert(Math.abs(top+.75)<1e-6);
 for(const time of [0,.7,1.4,2.1,2.8,3.5]){
  mixer.setTime(time);root.updateMatrixWorld(true);
  let covered=0,closestTorso=Infinity;
  root.traverse(node=>{
   if(!(node instanceof Mesh))return;
   if(node instanceof SkinnedMesh)node.skeleton.update();
   const point=new Vector3(),vertices=node.geometry.getAttribute('position');
   for(let i=0;i<vertices.count;i++){
    node.getVertexPosition(i,point);point.applyMatrix4(node.matrixWorld);
    if(/eye|pupil|beak|tuft/i.test(node.name)){assert(point.z<top,`${node.name}: face stays uncovered`);continue;}
    const y=quiltHeight(quilt,point.x,point.z);if(y===undefined)continue;
    covered++;
    assert(y>point.y,`${node.name} at ${time}s pokes through quilt by ${point.y-y}`);
    if(node.name==='Continuous pigeon body')closestTorso=Math.min(closestTorso,y-point.y);
   }
  });
  assert(covered>4000,'coverage uses the actual posed/skinned sculpt');
  assert(closestTorso<.12,'quilt rests close to the torso instead of forming a tent');
 }
 const p=quilt.geometry.getAttribute('position');
 const centerline=Array.from({length:25},(_,row)=>p.getY(row*25+12));
 let crests=0;
 for(let i=1;i<24;i++)if(centerline[i]>1.6&&centerline[i]>centerline[i-1]&&centerline[i]>=centerline[i+1])crests++;
 assert.equal(crests,1,'one torso mound, without Kirby’s separate boot peaks');
});

test('profile changes invalidate the quilt cache and flattening restores the same mattress cover',()=>{
 const quilt=new BedQuilt(),flat=positions(quilt);
 quilt.setPose(1,BED_PIGEON_COVER_FOLD,'kirby');const kirby=positions(quilt);
 const attribute=quilt.geometry.getAttribute('position') as BufferAttribute,version=attribute.version;
 quilt.setPose(1,BED_PIGEON_COVER_FOLD,'pigeon');assert.notDeepEqual(positions(quilt),kirby);assert(attribute.version>version);
 const settled=attribute.version;quilt.setPose(1,BED_PIGEON_COVER_FOLD,'pigeon');assert.equal(attribute.version,settled);
 quilt.setPose(1,BED_PIGEON_COVER_FOLD,'pigeon',.3);assert(attribute.version>settled,'Resizing a sleeper updates the same pose');
 const resized=attribute.version;quilt.setPose(1,BED_PIGEON_COVER_FOLD,'pigeon',.3);assert.equal(attribute.version,resized);
 quilt.setPose(0,0,'pigeon',.3);assert.deepEqual(positions(quilt),flat);
 quilt.setPose(0,0,'pigeon');assert.deepEqual(positions(quilt),flat);
 quilt.setPose(0,0);assert.deepEqual(positions(quilt),flat);
});
test('quilt clears the entire mattress top and pillow fits inside the bed',()=>{
 const home=new KirbyHome(),quilt=home.group.getObjectByName('Soft blue bed quilt') as BedQuilt;
 const p=quilt.geometry.getAttribute('position');
 for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))<=1.75){assert(p.getY(i)>1.1);assert(p.getZ(i)<1.6);}
 const pillow=home.group.children.find(o=>o instanceof InstancedMesh&&!Array.isArray(o.material)&&'color' in o.material&&o.material.color.getHexString()==='fff5df')!;
 assert(pillow);const size=new Box3().setFromObject(pillow).getSize(new Vector3());assert(size.x<3.5);assert(size.x>2);
 assert(p.count<700);assert(!quilt.castShadow);
 assert(p instanceof BufferAttribute);const version=p.version;quilt.setPose(0,0);assert.equal(p.version,version,'Idle blanket does not update geometry every frame');
});

test('blanket fits shrunk and enlarged Kirby, follows remote rest and resets on wake or cancelled approach',async()=>{
 const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));
 for(const size of [.3,.6,1,7]){
 const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const c=new CharacterController(model.scene,model.animations),home=new KirbyHome(),remoteHome=new KirbyHome();
 c.actor.scale.setScalar(size);c.actor.position.copy(home.entrance);
 const quilt=home.group.getObjectByName('Soft blue bed quilt') as BedQuilt,flat=positions(quilt);
 assert(home.start(c));home.update(.3);home.wake();home.update(1);assert.deepEqual(positions(quilt),flat);
 assert(home.start(c));for(let i=0;i<120;i++)home.update(1/60);
 assert(!positions(quilt).every((v,i)=>v===flat[i]));assert.equal(c.actor.scale.x,size);
 assert.equal(c.animationRoot.parent!.scale.x,Math.min(1,1/size));assert.equal(home.group.scale.x,1);
 assert.equal(c.actor.position.y,BED_MATTRESS_Y+(BED_REST.y-BED_MATTRESS_Y)*Math.min(1,size),'Small Kirby rests on the mattress');
 const p=quilt.geometry.getAttribute('position'),peak=Math.max(...Array.from({length:p.count},(_,i)=>p.getY(i)));
 assert(peak<1.16+1.8*Math.min(1,size),'The blanket mound shrinks with the body');
 assert.equal(c.achievements.size,1);
 c.actor.updateMatrixWorld(true);let closestBody=Infinity;
 c.actor.traverse(o=>{
  if(!(o instanceof Mesh)||!/high_resolution|_foot$|smiling_mouth/.test(o.name))return;
  const vertices=o.geometry.getAttribute('position'),point=new Vector3();
  for(let i=0;i<vertices.count;i++){
   point.fromBufferAttribute(vertices,i).applyMatrix4(o.matrixWorld).sub(home.group.position);
   if(o.name.includes('mouth')){assert(point.z<quilt.geometry.getAttribute('position').getZ(0),'Mouth stays beyond the blanket edge');continue;}
   const height=quiltHeight(quilt,point.x,point.z);if(height===undefined)continue;
   assert(height-point.y>0,`${o.name} pokes through quilt by ${point.y-height}`);
   if(o.name.includes('high_resolution'))closestBody=Math.min(closestBody,height-point.y);
  }
 });
 assert(closestBody<.12,'Cloth should rest close to Kirby rather than form a tent');
 for(let i=0;i<120;i++)remoteHome.update(1/60,c);
 const remote=remoteHome.group.getObjectByName('Soft blue bed quilt') as BedQuilt;
 assert.deepEqual(positions(remote),positions(quilt));assert(!remoteHome.active);
 const restingPosition=c.actor.position.clone(),restingRotation=c.actor.quaternion.clone();
 home.wake();home.update(.3);remoteHome.update(.3,c);
 assert.deepEqual(positions(remote),positions(quilt));
 assert(c.actor.position.equals(restingPosition));assert(c.actor.quaternion.equals(restingRotation));
 assert(quilt.geometry.getAttribute('position').getZ(0)>BED_REST.z+(.85-BED_REST.z)*Math.min(1,size),'Blanket must clear the feet before Kirby moves');
 home.update(.7);assert.deepEqual(positions(quilt),flat);assert.equal(c.animationRoot.parent!.scale.x,1);
 for(let i=0;i<120;i++)remoteHome.update(1/60);
 assert.deepEqual(positions(remote),flat);
 assert.equal(c.savedSize,size);
 assert(home.start(c));home.update(2);home.cancel();assert.deepEqual(positions(quilt),flat);assert.equal(c.savedSize,size);
 }
});
