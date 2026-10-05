import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {Box3,BufferAttribute,InstancedMesh,Mesh,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BedQuilt} from '../src/bed-quilt';
import {KirbyHome} from '../src/kirby-home';
import {CharacterController} from '../src/controller';

const positions=(quilt:BedQuilt)=>Array.from(quilt.geometry.getAttribute('position').array);
function quiltHeight(quilt:BedQuilt,x:number,z:number){
 const p=quilt.geometry.getAttribute('position'),top=p.getZ(0),col=(x+1.95)/3.9*24,row=(z-top)/(1.5-top)*24;
 if(col<0||col>=24||row<0||row>=24)return;
 const i=Math.floor(col),j=Math.floor(row),u=col-i,v=row-j;
 const a=p.getY(j*25+i),b=p.getY((j+1)*25+i),d=p.getY(j*25+i+1),c=p.getY((j+1)*25+i+1);
 return u+v<=1?(1-u-v)*a+v*b+u*d:(1-u)*b+(1-v)*d+(u+v-1)*c;
}
test('quilt clears the entire mattress top and pillow fits inside the bed',()=>{
 const home=new KirbyHome(),quilt=home.group.getObjectByName('Soft blue bed quilt') as BedQuilt;
 const p=quilt.geometry.getAttribute('position');
 for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))<=1.75){assert(p.getY(i)>1.1);assert(p.getZ(i)<1.6);}
 const pillow=home.group.children.find(o=>o instanceof InstancedMesh&&!Array.isArray(o.material)&&'color' in o.material&&o.material.color.getHexString()==='fff5df')!;
 assert(pillow);const size=new Box3().setFromObject(pillow).getSize(new Vector3());assert(size.x<3.5);assert(size.x>2);
 assert(p.count<700);assert(!quilt.castShadow);
 assert(p instanceof BufferAttribute);const version=p.version;quilt.setPose(0,0);assert.equal(p.version,version,'Idle blanket does not update geometry every frame');
});

test('blanket covers fitted Kirby, follows remote rest and resets on wake or cancelled approach',async()=>{
 const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));
 const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const c=new CharacterController(model.scene,model.animations),home=new KirbyHome(),remoteHome=new KirbyHome();
 c.actor.scale.setScalar(7);c.actor.position.copy(home.entrance);
 const quilt=home.group.getObjectByName('Soft blue bed quilt') as BedQuilt,flat=positions(quilt);
 assert(home.start(c));home.update(.3);home.wake();home.update(1);assert.deepEqual(positions(quilt),flat);
 assert(home.start(c));for(let i=0;i<120;i++)home.update(1/60);
 assert(!positions(quilt).every((v,i)=>v===flat[i]));assert.equal(c.actor.scale.x,7);
 assert.equal(c.animationRoot.parent!.scale.x,1/7);assert.equal(home.group.scale.x,1);
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
 assert(quilt.geometry.getAttribute('position').getZ(0)>.85,'Blanket must clear the feet before Kirby moves');
 home.update(.7);assert.deepEqual(positions(quilt),flat);assert.equal(c.animationRoot.parent!.scale.x,1);
 for(let i=0;i<120;i++)remoteHome.update(1/60);
 assert.deepEqual(positions(remote),flat);
});
