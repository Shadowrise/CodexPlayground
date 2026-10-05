import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {Box3,BufferAttribute,InstancedMesh,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BedQuilt} from '../src/bed-quilt';
import {KirbyHome} from '../src/kirby-home';
import {CharacterController} from '../src/controller';

const positions=(quilt:BedQuilt)=>Array.from(quilt.geometry.getAttribute('position').array);
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
 for(let i=0;i<120;i++)remoteHome.update(1/60,c);
 const remote=remoteHome.group.getObjectByName('Soft blue bed quilt') as BedQuilt;
 assert.deepEqual(positions(remote),positions(quilt));assert(!remoteHome.active);
 home.wake();home.update(1);assert.deepEqual(positions(quilt),flat);assert.equal(c.animationRoot.parent!.scale.x,1);
 for(let i=0;i<120;i++)remoteHome.update(1/60);
 assert.deepEqual(positions(remote),flat);
});
