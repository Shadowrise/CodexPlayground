import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,Matrix4,Mesh,Texture,Vector3} from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {CharacterController,type Input} from '../src/controller';
import {NightFireflies} from '../src/night-fireflies';
import {actorState,applyActor} from '../src/network-actors';
import {clonePigeon} from '../src/pigeon-appearance';

async function load(name:string){const bytes=await readFile(new URL(`../public/models/${name}-animated.glb`,import.meta.url)),loader=new GLTFLoader();loader.register(()=>({name:'TextureStub',loadTexture:()=>Promise.resolve(new Texture())}));return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
const assets=Promise.all(['firefly','kirby','pigeon','snowball','kurlyk','ryzhik','ugolyok','metapidgie'].map(load));
const idle:Input={forward:false,left:false,right:false};
const flying:Input={forward:true,left:false,right:false,steer:.4};
function player(asset:GLTF,size=1){const c=new CharacterController(asset.scene.getObjectByName('Continuous_pigeon_body')?clonePigeon(asset.scene):clone(asset.scene),asset.animations);c.resizeTo(size,true);return c;}
function board(world:NightFireflies,c:CharacterController){const bug=world.bugs[0];bug.home.set(135,0,140);bug.phase=25;world.bugs.forEach((_,i)=>{if(i)world.networkBlocked.add(i);});world.update(0,false,bug.home);c.actor.position.copy(bug.home);c.yaw=1.1;c.actor.rotation.set(0,c.yaw,0);assert(world.board(c));return bug;}
function tick(world:NightFireflies,c:CharacterController,dt:number,input=idle){world.moveRider(dt,input);world.syncRider(dt);world.update(dt,false,c.actor.position);}
function body(c:CharacterController){return (c.isPigeon?c.actor.getObjectByName('Continuous_pigeon_body'):c.actor.getObjectByName('Body_•_high_resolution_smooth_sphere')) as Mesh;}
function contact(world:NightFireflies,c:CharacterController){
 c.actor.updateMatrixWorld(true);const bug=world.bugs[0],seat=bug.backSeat!.getWorldPosition(new Vector3()),bounds=new Box3().setFromObject(body(c),true),gap=(bounds.min.y-seat.y)/c.actor.scale.x;
 assert(gap>=.02&&gap<.03,`belly must rest above the animated shell, gap ${gap}`);
 const pole=new Vector3(),mesh=body(c),p=new Vector3();let low=Infinity;
 for(let i=0;i<mesh.geometry.getAttribute('position').count;i++){mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);if(p.y<low){low=p.y;pole.copy(p);}}
 bug.carrier.worldToLocal(pole);const shell=bug.carrier.worldToLocal(bug.shellSeat!.getWorldPosition(new Vector3()));
 assert(pole.z<shell.z-.10*bug.firefly.object.scale.x,'belly must remain behind the firefly head through yaw and body sway');
}
function clearHead(world:NightFireflies,c:CharacterController,asset:GLTF){
 const bug=world.bugs[0],head=bug.firefly.object.getObjectByName('Head')!,source=asset.scene.getObjectByName('Face') as Mesh;
 head.updateWorldMatrix(true,false);source.updateMatrix();const inverse=new Matrix4().multiplyMatrices(head.matrixWorld,source.matrix).invert(),p=new Vector3(),mesh=body(c);
 if(!source.geometry.boundingBox)source.geometry.computeBoundingBox();const bounds=source.geometry.boundingBox!,center=bounds.getCenter(new Vector3()),radii=bounds.getSize(new Vector3()).multiplyScalar(.5);
 const transform=new Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
 for(let i=0;i<mesh.geometry.getAttribute('position').count;i++){mesh.getVertexPosition(i,p).applyMatrix4(transform).sub(center).divide(radii);assert(p.lengthSq()>=.999,'seated body intersects the firefly head');}
}

test('Kirby and every player pigeon rest on the moving back through takeoff, sway, turning, growth and landing',async()=>{
 const [firefly,...riders]=await assets;
 for(const asset of riders)for(const size of [.3,1,7]){
  const c=player(asset,size),world=new NightFireflies(firefly),bug=board(world,c);
  let lowest=Infinity,highest=-Infinity;
  for(let frame=0;frame<240;frame++){
   const dt=frame%2?1/30:1/60;tick(world,c,dt,frame>=30&&frame<160?flying:idle);
   // A rendered frame also refreshes SkinnedMesh.bindMatrixInverse. Exercise
   // the same path so support cannot accidentally depend on stale skinning.
   c.actor.updateMatrixWorld(true);if(frame%12===0){try{contact(world,c);clearHead(world,c,firefly);}catch(error){throw Error(`${asset.scene.name} ${size} frame ${frame}: ${(error as Error).message}`);}}
   if(frame>=60&&frame<150){const y=bug.backSeat!.getWorldPosition(new Vector3()).y-bug.carrier.position.y;lowest=Math.min(lowest,y);highest=Math.max(highest,y);}
  }
  assert(highest-lowest>.03*size,'the checked flight really includes shell bobbing');
  c.actor.position.set(135,c.actor.position.y,140);for(let frame=0;frame<180;frame++)tick(world,c,1/60);contact(world,c);assert(bug.land);
  c.resizeTo(size*1.25);for(let frame=0;frame<45;frame++){tick(world,c,1/60,flying);if(frame%12===0)contact(world,c);}
  world.disembark();assert.equal(c.state,'Idle');assert.equal(c.actor.position.y,0);assert.equal(c.savedSize,size*1.25);
 }
});

test('remote riders stay on the animated back without overriding interpolated actor positions',async()=>{
 const [firefly,...riders]=await assets;
 for(const asset of [riders[0],riders[1],riders.at(-1)!])for(const size of [.3,1,7]){
  const c=player(asset,size),remote=player(asset),world=new NightFireflies(firefly),other=new NightFireflies(firefly);board(world,c);other.networkBlocked.add(0);
  for(let frame=0;frame<180;frame++){
   const dt=frame%2?1/30:1/60;tick(world,c,dt,frame>=15&&frame<110?flying:idle);
   const state=actorState(c,'Seat QA',0);state.ride={key:'bug:0',data:world.networkState()[0]};applyActor(remote,state,dt,frame===0);const position=remote.actor.position.clone();
   other.syncRemoteRider(0,remote,state,dt);other.update(dt,false,remote.actor.position);assert(remote.actor.position.equals(position),'seat correction must leave network interpolation intact');
   if(frame%12===0){try{contact(other,remote);clearHead(other,remote,firefly);}catch(error){throw Error(`${asset.scene.name} ${size} frame ${frame}: ${(error as Error).message}`);}}
  }
 }
});
