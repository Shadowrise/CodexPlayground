import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,Matrix4,Mesh,Quaternion,Scene,ShaderMaterial,Vector3,WebGLRenderTarget} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createPlayerModel} from '../src/player-model';
import {CharacterController} from '../src/controller';
import {KIRBY_VARIANTS,remainingVariants} from '../src/variants';
import {actorState,RemotePlayers} from '../src/network-actors';
import {validActor} from '../src/network-protocol';
import {MetaKnightReflections} from '../src/meta-knight-reflections';
import {createNpcs} from '../src/npcs';
import {captureGame,parseSave,restoreGame} from '../src/save-game';
import {FruitWorld} from '../src/fruits';
import {Benches,BENCH_SEATS} from '../src/benches';
import {RiverBoats} from '../src/river-boats';
import {Balloons} from '../src/balloons';
import {KirbyHome} from '../src/kirby-home';
import {BreadWorld} from '../src/bread';
import {BedQuilt,BED_MATTRESS_Y,BED_META_KNIGHT_REST} from '../src/bed-quilt';
import {MillQuestDecor} from '../src/mill-quest-decor';
import {newMillQuest} from '../src/mill-quest';
import {Coaster,STATION} from '../src/coaster';

async function load(file:string){const b=await readFile(new URL('../public/models/'+file,import.meta.url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const assets=Promise.all([load('kirby-animated.glb'),load('meta-knight-animated.glb')]);
const variant=KIRBY_VARIANTS.find(v=>v[0]==='Meta Knight')!;
async function player(){const [kirby,knight]=await assets;const rig=createPlayerModel(kirby,variant,undefined,false,knight);return new CharacterController(rig.model,rig.clips);}
function samePose(a:CharacterController,b:CharacterController){for(const name of ['Left_shoulder','Right_shoulder','Left_foot_pivot','Right_foot_pivot']){const x=a.actor.getObjectByName(name)!,y=b.actor.getObjectByName(name)!;assert(x.quaternion.clone().normalize().angleTo(y.quaternion.clone().normalize())<1e-6,name);assert(x.position.distanceTo(y.position)<1e-6,name);}}

test('Meta Knight selection uses the approved native model with independent actor materials and stable indices',async()=>{
 const [kirby,knight]=await assets;
 assert.equal(KIRBY_VARIANTS.indexOf(variant),18);assert.equal(KIRBY_VARIANTS[17][0],'Пиджи');assert.equal(remainingVariants(variant).length,14);
 assert.throws(()=>createPlayerModel(kirby,variant),/Meta Knight/);
 const first=createPlayerModel(kirby,variant,undefined,false,knight),second=createPlayerModel(kirby,variant,undefined,false,knight);
 assert.equal(first.character,'meta-knight');assert.equal(first.clips,knight.animations);
 first.model.traverse(node=>{if(!(node instanceof Mesh))return;const source=knight.scene.getObjectByName(node.name) as Mesh,other=second.model.getObjectByName(node.name) as Mesh;assert.equal(node.geometry,source.geometry);assert.notEqual(node.material,source.material);assert.notEqual(node.material,other.material);});
 const c=new CharacterController(first.model,first.clips);assert(c.isMetaKnight);assert(c.hasNativeAnimations);assert(!c.isPigeon);assert(c.actor.getObjectByName('Galaxia'));assert(c.actor.getObjectByName('Left_hand_attachment'));
});

test('native actions and five emotions render remotely through the existing actor contract',async()=>{
 const [kirby,knight]=await assets,c=await player(),remote=new RemotePlayers(new Scene(),kirby,undefined,knight);
 for(const state of ['Run','WalkBackward','RotateLeft','Jump','Fly','Swim','Push','Sitting','Swing','Cart','Boat','Balloon','FireflyRide','Sleep','Wake','Climb','Lookout','LeafDive','Trampoline','Hello','Joy','Fear','Anger','Sad']){
  c.setActivity(state);c.mixer.update(.38);const snapshot=actorState(c,'Рыцарь',18);assert(validActor(snapshot),state);
  remote.update(new Map([['knight',snapshot]]),.05);const other=remote.players.get('knight')!;
  assert(other.isMetaKnight,state);assert.equal(other.state,state);assert.equal(other.actions.get(state)!.getClip().name,state);assert(!other.cloud.visible);assert.equal(snapshot.pose.length,5);
 }
 remote.clear();assert.equal(remote.players.size,0);
});

test('night-created player clones retain the same daylight metal reflection intensity after the next sunrise',async()=>{
 const [kirby,knight]=await assets,lighting=new MetaKnightReflections(knight.scene,new WebGLRenderTarget(16,16));
 lighting.update({day:0});const rig=createPlayerModel(kirby,variant,undefined,false,knight);lighting.add(rig.model);
 const metals:Mesh[]=[];rig.model.traverse(o=>{if(o instanceof Mesh&&!Array.isArray(o.material)&&'metalness' in o.material&&Number(o.material.metalness)>=.5)metals.push(o);});assert(metals.length);
 lighting.update({day:1});for(const mesh of metals){const material=mesh.material as import('three').MeshStandardMaterial;assert.equal(material.envMapIntensity,material.userData.metaKnightReflectionIntensity);assert(material.envMap);}
 lighting.dispose();
});

test('Meta Knight saves restore the native selection, progress and fourteen existing ambient NPCs',async()=>{
 const [kirby]=await assets,c=await player(),npcs=createNpcs(kirby.scene,kirby.animations,variant),fruits=new FruitWorld();
 c.actor.position.set(12,0,18);c.yaw=.7;c.resizeTo(.8,true);c.fruitsEaten=2;c.achievements.add('boat');
 const save=parseSave(JSON.stringify(captureGame(c,variant,npcs,fruits))),restored=await player();
 restoreGame(save,restored,npcs,fruits);assert.equal(save.player.variant,'Meta Knight');assert(restored.isMetaKnight);assert.equal(restored.savedSize,.8);assert.equal(restored.yaw,.7);assert.equal(restored.fruitsEaten,2);assert(restored.achievements.has('boat'));assert.equal(npcs.length,14);assert(npcs.every(n=>n.variant[0]!=='Meta Knight'));
});

test('benches, boats and balloons preserve authored Meta Knight poses and sword grip',async()=>{
 const c=await player(),reference=await player(),benches=new Benches();c.actor.position.copy(BENCH_SEATS[0].position).setY(0);benches.interact(c);assert(benches.active);benches.update(.65);reference.setActivity('Sitting');reference.mixer.update(.65);samePose(c,reference);benches.cancel();
 const boats=new RiverBoats();boats.update(0,0);c.actor.position.copy(boats.boats[0].position);assert(boats.board(c));boats.update(.65,.65);reference.setActivity('Boat');reference.mixer.update(.65);samePose(c,reference);boats.cancel();
 const balloons=new Balloons();c.actor.position.copy(balloons.balloons[0].group.position);assert(balloons.board(c));balloons.update(.65,[],c);reference.setActivity('Balloon');reference.mixer.update(.65);samePose(c,reference);balloons.cancel();
});

test('native sleep contacts the mattress, keeps the visor outside the fitted quilt and matches remote beds at every size',async()=>{
 const quiltHeight=(quilt:BedQuilt,x:number,z:number)=>{
  const p=quilt.geometry.getAttribute('position');
  if(x<p.getX(0)||x>=p.getX(24)||z<p.getZ(0)||z>=p.getZ(24*25))return;
  let col=0,row=0;while(col<23&&x>=p.getX(col+1))col++;while(row<23&&z>=p.getZ((row+1)*25))row++;
  const u=(x-p.getX(col))/(p.getX(col+1)-p.getX(col)),v=(z-p.getZ(row*25))/(p.getZ((row+1)*25)-p.getZ(row*25));
  const a=p.getY(row*25+col),b=p.getY((row+1)*25+col),d=p.getY(row*25+col+1),e=p.getY((row+1)*25+col+1);
  return u+v<=1?(1-u-v)*a+v*b+u*d:(1-u)*b+(1-v)*d+(u+v-1)*e;
 };
 for(const size of [.3,1,7]){
  const c=await player(),home=new KirbyHome(),remoteHome=new KirbyHome();c.resizeTo(size,true);c.actor.position.copy(home.entrance);
  const quilt=home.group.getObjectByName('Soft blue bed quilt') as BedQuilt,remoteQuilt=remoteHome.group.getObjectByName('Soft blue bed quilt') as BedQuilt;
  const flat=Array.from(quilt.geometry.getAttribute('position').array);
  assert(home.start(c));for(let frame=0;frame<120;frame++)home.update(1/60);
  assert.equal(c.state,'Sleep');assert(c.actor.quaternion.angleTo(new Quaternion())<1e-6);
  assert.equal(c.actor.position.y,BED_MATTRESS_Y+(BED_META_KNIGHT_REST.y-BED_MATTRESS_Y)*Math.min(1,size));
  c.actor.updateMatrixWorld(true);let body:Mesh|undefined;
  c.animationRoot.traverse(node=>{if(node instanceof Mesh&&node.name.startsWith('Body_motion_surface'))body=node;});assert(body);
  assert(Math.abs(new Box3().setFromObject(body,true).min.y-BED_MATTRESS_Y)<.015,'the actual torso rests on the mattress');
  let covered=0,closestBody=Infinity;
  c.animationRoot.traverse(node=>{
   if(!(node instanceof Mesh))return;const vertices=node.geometry.getAttribute('position'),point=new Vector3();
   for(let i=0;i<vertices.count;i++){
    node.getVertexPosition(i,point).applyMatrix4(node.matrixWorld).sub(home.group.position);
    if(node.parent?.name==='Eyes_glow'){assert(point.z<quilt.geometry.getAttribute('position').getZ(0),'the visor stays exposed');continue;}
    const height=quiltHeight(quilt,point.x,point.z);if(height===undefined)continue;covered++;
    assert(height>point.y,`${size}: ${node.name} at ${point.toArray()} pokes through the quilt by ${point.y-height}`);
    if(node===body)closestBody=Math.min(closestBody,height-point.y);
   }
  });
  assert(covered>1000,'coverage is checked against the actual native meshes');assert(closestBody<.12,'the quilt rests close to the torso');
  for(let frame=0;frame<120;frame++)remoteHome.update(1/60,c);
  assert.deepEqual(Array.from(remoteQuilt.geometry.getAttribute('position').array),Array.from(quilt.geometry.getAttribute('position').array),'remote occupancy uses the same native bed origin and profile');
  home.wake();home.update(.3);remoteHome.update(.3,c);assert.deepEqual(Array.from(remoteQuilt.geometry.getAttribute('position').array),Array.from(quilt.geometry.getAttribute('position').array));
  home.update(.7);assert(!home.active);assert.equal(c.state,'Idle');assert.equal(c.animationRoot.parent!.scale.x,1);assert.equal(c.savedSize,size);assert.deepEqual(Array.from(quilt.geometry.getAttribute('position').array),flat);
 }
});

test('bread follows the free left gauntlet without overriding the sword shoulder',async()=>{
 const c=await player(),bread=new BreadWorld();c.setActivity('Idle');c.mixer.update(.3);const shoulder=c.actor.getObjectByName('Right_shoulder')!,rotation=shoulder.quaternion.clone();bread.state.owner='solo';bread.update(1000,new Map([['solo',c.actor]]));assert(shoulder.quaternion.clone().normalize().angleTo(rotation.normalize())<1e-6);const hand=c.actor.getObjectByName('Left_hand_attachment')!.getWorldPosition(new Vector3());assert(bread.loaf.position.distanceTo(hand)<1);assert(bread.loaf.position.x<0);
});

test('mill sack handles attach to the free gauntlet while the sword shoulder keeps its native pose',async()=>{
 const c=await player(),props=new MillQuestDecor(new ShaderMaterial());c.setActivity('Run');c.mixer.update(.3);
 const shoulder=c.actor.getObjectByName('Right_shoulder')!,rotation=shoulder.quaternion.clone();
 props.update({...newMillQuest(),stage:'bags',owner:'solo',carried:0},1000,c.actor);
 assert(shoulder.quaternion.clone().normalize().angleTo(rotation.normalize())<1e-6);
 const hand=c.actor.getObjectByName('Left_hand_attachment')!.getWorldPosition(new Vector3()),bag=props.bags[0];
 assert(Math.abs(bag.position.x-hand.x)<1e-6);assert(Math.abs(bag.position.z-hand.z)<1e-6);assert(Math.abs(bag.position.y+1.19*bag.scale.y-hand.y)<1e-6);
});

test('playable ride fit keeps boots behind the cart bar and helmet below the boat canopy at every saved size',async()=>{
 for(const size of [.3,1,7]){
  const c=await player(),coaster=new Coaster();new Scene().add(coaster.group,c.actor);c.resizeTo(size,true);c.actor.position.copy(STATION);const cart=coaster.group.getObjectByName('Rounded coaster cart 1')!;assert(coaster.board(c));coaster.update(.65);
  cart.updateWorldMatrix(true,true);c.actor.updateWorldMatrix(true,true);const cartInverse=cart.matrixWorld.clone().invert();
  let toeZ=-Infinity;for(const side of ['Left','Right'])c.actor.getObjectByName(side+'_foot_pivot')!.traverse(node=>{if(!(node instanceof Mesh))return;node.geometry.computeBoundingBox();const box=node.geometry.boundingBox!.clone().applyMatrix4(new Matrix4().multiplyMatrices(cartInverse,node.matrixWorld));toeZ=Math.max(toeZ,box.max.z);});
  assert(toeZ<.6,`size${size}: boots${toeZ}`);assert.equal(c.savedSize,size);coaster.disembark();
  const boats=new RiverBoats();boats.update(0,0);c.actor.position.copy(boats.boats[0].position);assert(boats.board(c));boats.update(.65,.65);
  const boat=boats.boats[0];boat.updateWorldMatrix(true,true);c.actor.updateWorldMatrix(true,true);const inverse=boat.matrixWorld.clone().invert();
  const head=c.actor.getObjectByName('Mask_shell')!;const bounds=new Box3();head.traverse(node=>{if(!(node instanceof Mesh))return;node.geometry.computeBoundingBox();bounds.union(node.geometry.boundingBox!.clone().applyMatrix4(new Matrix4().multiplyMatrices(inverse,node.matrixWorld)));});
  assert(bounds.max.y<2.46,`size${size}: helmet${bounds.max.y}`);assert.equal(c.savedSize,size);boats.cancel();assert.equal(c.animationRoot.parent!.scale.x,1);
 }
});
