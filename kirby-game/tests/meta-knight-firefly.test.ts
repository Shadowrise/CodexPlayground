import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,Matrix4,Mesh,Texture,Vector3} from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {CharacterController,type Input} from '../src/controller';
import {NightFireflies} from '../src/night-fireflies';
import {actorState,applyActor} from '../src/network-actors';

async function load(name:string){const b=await readFile(new URL(`../public/models/${name}-animated.glb`,import.meta.url)),loader=new GLTFLoader();if(name==='pigeon')loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const assets=Promise.all([load('meta-knight'),load('firefly'),load('kirby'),load('pigeon')]);
const idle:Input={forward:false,left:false,right:false};
function player(asset:GLTF){return new CharacterController(clone(asset.scene),asset.animations);}

/** Inspect source shell vertices using the displayed mount's animated parent.
 * Rigid batching retains exactly these triangles, although it merges their name. */
function shellTop(world:NightFireflies,asset:GLTF){
 const source=asset.scene.getObjectByName('Thorax') as Mesh;assert(source);source.updateMatrix();
 const motion=world.bugs[0].firefly.object.getObjectByName('Motion')!;motion.updateWorldMatrix(true,false);
 const matrix=new Matrix4().multiplyMatrices(motion.matrixWorld,source.matrix),p=new Vector3(),vertices=source.geometry.getAttribute('position');let top=-Infinity;
 for(let i=0;i<vertices.count;i++){source.getVertexPosition(i,p).applyMatrix4(matrix);top=Math.max(top,p.y);}
 return top;
}
function supportGap(world:NightFireflies,c:CharacterController,asset:GLTF){
 const body=c.actor.getObjectByName('Body_motion')!.children.find((node):node is Mesh=>node instanceof Mesh&&node.name.startsWith('Body_motion_surface'))!;
 c.actor.updateWorldMatrix(true,true);return new Box3().setFromObject(body,true).min.y-shellTop(world,asset);
}
function board(world:NightFireflies,c:CharacterController){
 const bug=world.bugs[0];bug.phase=25;world.bugs.forEach((_,i)=>{if(i)world.networkBlocked.add(i);});world.update(0,false,bug.home);c.actor.position.copy(bug.carrier.position).setY(0);assert(world.board(c));return bug;
}
function tick(world:NightFireflies,c:CharacterController,dt:number,input=idle){world.moveRider(dt,input);world.syncRider(dt);world.update(dt,false,c.actor.position);}
function seated(world:NightFireflies,c:CharacterController,asset:GLTF){
 const gap=supportGap(world,c,asset),size=c.actor.scale.x;
 assert(gap>=-.00001*size,`the torso sinks ${-gap} into the animated shell`);
 assert(gap<.005*size,`the torso floats ${gap} above the actual shell`);
}

test('native seated torso rests on the actual firefly shell at all sizes through boarding, flight and landing',async()=>{
 const [knight,firefly]=await assets;
 for(const size of [.3,1,7]){
  const c=player(knight),world=new NightFireflies(firefly);c.resizeTo(size,true);const bug=board(world,c),origin=bug.home.clone();
  // Include the blend from the original standing pose and initial mount scale.
  for(let frame=0;frame<80;frame++){tick(world,c,1/60);seated(world,c,firefly);}
  assert(bug.land);assert.equal(c.savedSize,size);assert.equal(c.actor.scale.x,size);
  const groundTop=shellTop(world,firefly);
  for(let frame=0;frame<50;frame++){tick(world,c,1/30,{...idle,forward:true,steer:.15});seated(world,c,firefly);}
  assert(!bug.land);assert(bug.carrier.position.y>size*2);assert(shellTop(world,firefly)>groundTop+size);
  c.actor.position.x=origin.x;c.actor.position.z=origin.z;
  for(let frame=0;frame<120;frame++){tick(world,c,1/30);seated(world,c,firefly);}
  assert(bug.land);assert.equal(bug.carrier.position.y,0);assert.equal(c.savedSize,size);
  world.disembark();assert.equal(c.actor.scale.x,size);assert.equal(c.state,'Idle');assert.equal(c.actor.position.y,0);
 }
});

test('remote interpolation keeps the same native support without changing the presented player position',async()=>{
 const [knight,firefly]=await assets;
 for(const size of [.3,1,7]){
  const source=player(knight),remote=player(knight),world=new NightFireflies(firefly),other=new NightFireflies(firefly);source.resizeTo(size,true);board(world,source);other.networkBlocked.add(0);
  for(let frame=0;frame<130;frame++){
   const dt=frame%2?1/30:1/60;tick(world,source,dt,frame<30||frame>=90?idle:{...idle,forward:true});
   const state=actorState(source,'Meta Knight',18);state.ride={key:'bug:0',data:world.networkState()[0]};
   applyActor(remote,state,dt,frame===0);const position=remote.actor.position.clone();
   other.syncRemoteRider(0,remote,state,dt);other.update(dt,false,remote.actor.position);
   assert(remote.actor.position.equals(position),'mount support cannot override player interpolation');seated(other,remote,firefly);
  }
 }
});

test('mounted growth preserves native support while Kirby and Pidgie keep their existing seat interpolation',async()=>{
 const [knight,firefly,kirby,pigeon]=await assets,c=player(knight),world=new NightFireflies(firefly);board(world,c);c.resizeTo(2.5);
 for(let frame=0;frame<45;frame++){tick(world,c,1/60);seated(world,c,firefly);}assert.equal(c.savedSize,2.5);assert.equal(c.actor.scale.x,2.5);
 for(const legacy of [kirby,pigeon]){
  const rider=player(legacy),mounts=new NightFireflies(firefly),bug=board(mounts,rider),dt=.05;
  const previous=rider.actor.position.y;mounts.moveRider(dt,idle);mounts.syncRider(dt);
  const expected=previous+(bug.carrier.position.y+bug.firefly.object.scale.x*.95-previous)*(1-Math.exp(-12*dt));
  assert(Math.abs(rider.actor.position.y-expected)<1e-9);const before=rider.actor.position.y;mounts.update(dt,false,rider.actor.position);assert.equal(rider.actor.position.y,before);
 }
});
