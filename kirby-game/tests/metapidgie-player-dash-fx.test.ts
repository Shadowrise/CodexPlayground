import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {clonePigeon} from '../src/pigeon-appearance';
import {MetapidgiePlayerDashFx} from '../src/metapidgie-player-dash-fx';
import {MetapidgieFlightTrail,PIDGEY_FLIGHT_TRAIL} from '../src/metapidgie-flight-trail';
import {actorState,applyActor} from '../src/network-actors';
import {validActor} from '../src/network-protocol';
import {disposeActor} from '../src/actor-lifecycle';
import {MetaKnightHelperView} from '../src/meta-knight-helper-view';
import {startKnightBattle} from '../src/meta-knight-battle';
import {startHelperAbility} from '../src/meta-knight-helper';

const assets=await Promise.all(['metapidgie','pigeon'].map(async name=>{
 const bytes=await readFile(new URL(`../public/models/${name}-animated.glb`,import.meta.url)),loader=new GLTFLoader();
 loader.register(()=>({name:'test-texture-metadata',loadTexture:()=>Promise.resolve(new T.Texture())}));
 return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}));
const input={forward:false,left:false,right:false},camera=new T.PerspectiveCamera();camera.position.set(0,15,30);
function create(index=0){const asset=assets[index],c=new CharacterController(clonePigeon(asset.scene),asset.animations),scene=new T.Scene();scene.add(c.actor);return {c,scene};}
const wake=(scene:T.Object3D)=>scene.getObjectByName('Meta Pidgey golden iridescent flight wake');

test('player dash reuses the exact phase-two mist and sparkle shaders at the bird scale',()=>{
 const boss=new MetapidgieFlightTrail(),player=new MetapidgieFlightTrail(),scene=new T.Scene();scene.add(boss.group,player.group);
 const s=startKnightBattle([{id:'a',available:true,p:[0,0,-2],yaw:0}],'a',1000,'metapidgie')!;s.phase=2;s.stage='dash';
 for(let i=0;i<20;i++){const tail=new T.Vector3(i*.6,4,0);boss.update(s,2000+i*20,tail,camera);player.updateDash(true,2000+i*20,tail,camera,1/3.3);}
 assert.deepEqual(player.samples,boss.samples);
 for(let i=0;i<3;i++){const a=boss.group.children[i] as T.Mesh,b=player.group.children[i] as T.Mesh;assert.equal((a.material as T.ShaderMaterial).vertexShader,(b.material as T.ShaderMaterial).vertexShader);assert.equal((a.material as T.ShaderMaterial).fragmentShader,(b.material as T.ShaderMaterial).fragmentShader);}
 const a=new T.Matrix4(),b=new T.Matrix4();(boss.group.children[1] as T.InstancedMesh).getMatrixAt(0,a);(player.group.children[1] as T.InstancedMesh).getMatrixAt(0,b);
 assert(Math.abs(new T.Vector3().setFromMatrixScale(a).x/3.3-new T.Vector3().setFromMatrixScale(b).x)<1e-6);
 boss.dispose();player.dispose();
});
test('normal and network dashes emit the wake only for Meta Pidgie and end with a fading tail',()=>{
 for(const network of [false,true]){
  const {c,scene}=create(),remote=network?create():undefined;c.update(0,{...input,dashPressed:true});
  const shown=remote?.c??c,world=remote?.scene??scene;
  for(let i=0;i<30;i++){c.update(.02,input);if(remote){const a=actorState(c,'Bird',23);assert(validActor(a));applyActor(remote.c,a,.02,true);}shown.updateMetapidgieDashFx(.02,camera);}
  const group=wake(world)!;assert(group?.visible);assert.equal(group.parent,world);assert.notEqual(group.parent,shown.actor);
  c.setActivity('Boat');if(remote)applyActor(remote.c,actorState(c,'Bird',23),.02,true);
  shown.updateMetapidgieDashFx(.02,camera);assert(group.visible,'the emitted vapour remains after the burst');shown.updateMetapidgieDashFx(1.3,camera);assert(!group.visible);
  disposeActor(c);if(remote)disposeActor(remote.c);assert.equal(group.parent,null);
 }
 const {c,scene}=create(1);c.update(0,{...input,dashPressed:true});c.updateMetapidgieDashFx(.1,camera);assert.equal(wake(scene),undefined);disposeActor(c);
});
test('the helper ability emits the same wake during its acceleration and cancels emission on interruption',()=>{
 const {c,scene}=create(),a={id:'bird',variant:23,available:true,p:[0,0,-2] as [number,number,number],yaw:0,side:'boss' as const},s=startKnightBattle([a],a.id,1000,'metapidgie')!;s.stage='rest';s.until=1e9;
 assert(startHelperAbility(s,a,2,2000));const cast=s.players.bird.helper!.cast!,view=new MetaKnightHelperView(c,()=>{});
 view.update(s,a.id,cast.release-1,.02,camera);c.updateMetapidgieDashFx(.02,camera);assert.equal(wake(scene),undefined);
 view.update(s,a.id,cast.release+100,.02,camera);assert.equal(c.state,'Fly');c.updateMetapidgieDashFx(.02,camera);assert(wake(scene)!.visible);
 view.update(undefined,a.id,cast.release+200,.02,camera);c.updateMetapidgieDashFx(1.3,camera);assert(!wake(scene)!.visible);view.dispose();disposeActor(c);
});
test('history stays fixed through turns and growth, pauses, fades, and resets across portals or teleports',()=>{
 const {c,scene}=create(),fx=new MetapidgiePlayerDashFx(c.actor);
 for(let i=0;i<20;i++){c.actor.position.z=i*.25;fx.update(true,.02,camera);}
 const sample=fx.trail.samples[5],paused=JSON.stringify(fx.trail.samples);fx.update(true,0,camera);assert.equal(JSON.stringify(fx.trail.samples),paused);
 c.actor.rotation.y=1.7;c.actor.scale.setScalar(2);fx.update(false,.02,camera);assert(fx.trail.samples.some(s=>s.at===sample.at&&s.p.every((n,i)=>n===sample.p[i])));
 fx.update(true,.02,camera);c.actor.position.set(2000,0,-2);fx.update(true,.02,camera);assert.equal(fx.trail.sampleCount,1,'no ribbon across a teleport');
 const arena=new T.Group();arena.position.set(2000,180,0);scene.add(arena);arena.attach(c.actor);fx.update(true,.02,camera);assert.equal(fx.trail.group.parent,arena);assert.equal(fx.trail.sampleCount,1);
 for(let i=0;i<200;i++){c.actor.position.z+=.2;fx.update(true,.02,camera);}assert(fx.trail.sampleCount<=PIDGEY_FLIGHT_TRAIL.capacity);
 const count=fx.trail.sampleCount;assert(count>20);fx.update(false,1.3,camera);assert.equal(fx.trail.sampleCount,0);fx.dispose();assert.equal(fx.trail.group.parent,null);disposeActor(c);
});
test('owned wake geometries and materials are disposed when the character is removed',()=>{
 const {c,scene}=create();c.update(0,{...input,dashPressed:true});c.updateMetapidgieDashFx(.02,camera);const group=wake(scene)!;
 const geometry=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();group.traverse(n=>{if(n instanceof T.Mesh||n instanceof T.Points){geometry.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);}});
 let disposedGeometry=0,disposedMaterials=0;geometry.forEach(g=>g.addEventListener('dispose',()=>disposedGeometry++));materials.forEach(m=>m.addEventListener('dispose',()=>disposedMaterials++));
 disposeActor(c);assert.equal(disposedGeometry,geometry.size);assert.equal(disposedMaterials,materials.size);assert.equal(group.parent,null);
});
