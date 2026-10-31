import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Coaster,STATION} from '../src/coaster';
import {KIRBY_VARIANTS} from '../src/variants';
import {updateVisibility} from '../src/visibility';
import {shadowParts} from '../src/prepared-shadows';

test('distant carts keep passengers, return at close range and preserve the baked cart shadow',async()=>{
 const coaster=new Coaster(),cart=coaster.group.getObjectByName('Rounded coaster cart 2')!;
 const shadow=shadowParts(cart),bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 coaster.addKirbyPassengers(gltf.scene,gltf.animations,KIRBY_VARIANTS[0]);coaster.update(0);
 const passenger=cart.children.find(o=>o.name.startsWith('Permanent Kirby'))!,far=cart.getObjectByName('Distant coaster cart and passengers') as T.Mesh;
 const world=cart.getWorldPosition(new T.Vector3()),camera=world.clone().add(new T.Vector3(0,0,120));
 const geometry=far.geometry;assert(geometry.attributes.position.count>0);assert([...geometry.attributes.position.array].every(Number.isFinite));
 let triangles=0;passenger.traverse(o=>{if(o instanceof T.Mesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
 assert(geometry.attributes.position.count/3<triangles,'far snapshot must be substantially lighter than a single detailed passenger');
 coaster.updateDetail(camera);assert(far.visible);assert(!passenger.visible);updateVisibility(passenger,camera);assert(!passenger.visible,'ordinary actor visibility must not re-enable the detailed passenger');
 coaster.updateDetail(world.clone().add(new T.Vector3(0,0,100)));assert(far.visible,'hysteresis retains the far model');
 coaster.updateDetail(world.clone().add(new T.Vector3(0,0,90)));assert(!far.visible);updateVisibility(passenger,world);assert(passenger.visible);
 assert.equal(far.geometry,geometry,'travel must not allocate new geometry');
 assert.equal(shadowParts(cart).length,shadow.length,'the visual proxy must not become a second baked silhouette');
 coaster.detailEnabled=false;coaster.updateDetail(camera);assert(!far.visible);assert(passenger.visible);
});

test('a boarded player always has a detailed cart even with a far camera',()=>{
 const coaster=new Coaster(),actor=new T.Group();new T.Scene().add(actor);actor.position.copy(STATION);
 const player={actor,state:'Idle',yaw:0,fruitsEaten:0,achievements:new Set(),mixer:new T.AnimationMixer(actor),setActivity(this:{state:string},state:string){this.state=state;},update(){}} as never;
 assert(coaster.board(player));coaster.update(0,new T.Vector3(2000,2000,2000));
 const cart=coaster.group.getObjectByName('Rounded coaster cart 1')!,far=cart.getObjectByName('Distant coaster cart and passengers')!;assert(!far.visible);assert(cart.children.some(o=>o!==far&&o.visible));
});
