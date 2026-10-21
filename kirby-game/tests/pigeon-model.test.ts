import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AnimationMixer,Box3,LoopOnce,Mesh,Object3D,Quaternion,SkinnedMesh,Texture,Vector3,type AnimationClip} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createPigeon} from '../src/pigeon-model';
import {PIGEON_CLIPS} from '../src/pigeon-clips';
import {PIGEON_GAITS,pigeonStanceSpeed} from '../src/pigeon-locomotion';

function meshes(root:Object3D){
 const result:Mesh[]=[];root.traverse(node=>{if(node instanceof Mesh)result.push(node);});return result;
}
function bodySkin(root:Object3D){
 return meshes(root).find(mesh=>mesh.name.replaceAll('_',' ')==='Continuous pigeon body') as SkinnedMesh;
}
function validateGeometry(root:Object3D){
 const all=meshes(root);assert(all.length>0);
 for(const mesh of all){
  const g=mesh.geometry,p=g.getAttribute('position');assert(p&&p.count>0,mesh.name);
  for(const [name,attribute] of Object.entries(g.attributes)){
   assert.equal(attribute.count,p.count,`${mesh.name}: ${name} count`);
   for(const value of attribute.array)assert(Number.isFinite(value),`${mesh.name}: ${name} has a nonfinite value`);
  }
  assert(g.index&&g.index.count%3===0,`${mesh.name}: triangle indices`);
  for(const index of g.index.array)assert(index>=0&&index<p.count,`${mesh.name}: invalid index ${index}`);
  if(mesh instanceof SkinnedMesh){
   const indices=g.getAttribute('skinIndex'),weights=g.getAttribute('skinWeight');assert(indices&&weights);
   for(let i=0;i<p.count;i++){
    let sum=0;for(let j=0;j<4;j++){
     const weight=weights.array[i*4+j],index=indices.array[i*4+j];
     assert(weight>=0&&weight<=1,`${mesh.name}: invalid skin weight`);
     assert(Number.isInteger(index)&&index<mesh.skeleton.bones.length,`${mesh.name}: invalid bone index`);sum+=weight;
    }
    assert(Math.abs(sum-1)<1e-6,`${mesh.name}: skin weights must sum to one`);
   }
  }
 }
 assert(all.some(mesh=>mesh instanceof SkinnedMesh),'the connected body must retain its editable skeleton');
}
function exactBounds(mesh:Mesh){
 const box=new Box3(),v=new Vector3(),p=mesh.geometry.getAttribute('position');
 for(let i=0;i<p.count;i++){
  mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);
  assert(Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z),`${mesh.name}: animated vertex must be finite`);
  box.expandByPoint(v);
 }
 return box;
}

function validateFlightFeet(root:Object3D,clips:AnimationClip[]){
 const mixer=new AnimationMixer(root),fly=clips.find(clip=>clip.name==='Fly')!;
 const body=bodySkin(root);
 root.updateMatrixWorld(true);
 const standingAnkles=new Map(['Left','Right'].map(side=>[side,root.getObjectByName(`${side}_foot`)!.getWorldPosition(new Vector3())]));
 mixer.clipAction(fly).play();
 for(let frame=0;frame<=72;frame++){
  mixer.setTime(fly.duration*frame/72);root.updateMatrixWorld(true);body.skeleton.update();
  const inside=skinVolume(body),point=new Vector3();
  for(const side of ['Left','Right']){
   const foot=root.getObjectByName(`${side}_foot`)!;
   const ankle=foot.getWorldPosition(new Vector3());
   assert(ankle.y>.28&&ankle.y<.45,`${side}: flight raises the ankle while keeping the foot below the belly`);
   assert(ankle.z<standingAnkles.get(side)!.z-.08,`${side}: tucked ankle moves toward the tail instead of only rising vertically`);
   for(const mesh of meshes(root.getObjectByName(`${side}_knee`)!)){
    const positions=mesh.geometry.attributes.position;
    for(let vertex=0;vertex<positions.count;vertex++){
     point.fromBufferAttribute(positions,vertex).applyMatrix4(mesh.matrixWorld);
     assert(!inside(point,.001),`${side}: exposed shin/foot vertex ${vertex} penetrates the belly at phase ${frame}/72, world ${point.toArray()}`);
    }
   }
   assert(exactBounds(meshes(foot)[0]).min.y>.17,`${side}: flight toes stay raised instead of dangling toward the ground`);
   const toes=new Vector3(0,0,1).applyQuaternion(foot.getWorldQuaternion(new Quaternion()));
   assert(Math.abs(toes.y)<.2,`${side}: flight feet stay nearly horizontal below the plumage`);
  }
 }
 // Crossfades must not send a visible foot through the belly during takeoff
 // or landing, including a moving stride and the jump's crouched frames.
 const flyAction=mixer.clipAction(fly),feet=['Left','Right'].flatMap(side=>meshes(root.getObjectByName(`${side}_foot`)!));
 for(const name of ['Idle','Run','Jump'])for(const phase of [0,.12,.29,.47,.68])for(let step=0;step<=16;step++){
  mixer.stopAllAction();const weight=step/16;
  mixer.clipAction(clips.find(clip=>clip.name===name)!).reset().setEffectiveWeight(1-weight).play();
  flyAction.reset().setEffectiveWeight(weight).play();mixer.setTime(phase);root.updateMatrixWorld(true);body.skeleton.update();
  const inside=skinVolume(body),point=new Vector3();
  for(const mesh of feet)for(let vertex=0;vertex<mesh.geometry.attributes.position.count;vertex++){
   point.fromBufferAttribute(mesh.geometry.attributes.position,vertex).applyMatrix4(mesh.matrixWorld);
   assert(!inside(point,.001),`${name}↔Fly: ${mesh.name} vertex ${vertex} penetrates the belly at blend ${weight}, phase ${phase}, world ${point.toArray()}`);
  }
 }
 mixer.stopAllAction();mixer.clipAction(clips.find(clip=>clip.name==='Idle')!).play();mixer.setTime(0);root.updateMatrixWorld(true);
 for(const side of ['Left','Right']){
  const foot=root.getObjectByName(`${side}_foot`)!;
  assert(foot.getWorldPosition(new Vector3()).y<.2,`${side}: landing restores the ankle to the ground`);
  assert(Math.abs(foot.getWorldPosition(new Vector3()).z-standingAnkles.get(side)!.z)<1e-6,`${side}: landing restores the foot's standing position along the body`);
  assert(Math.abs(exactBounds(meshes(foot)[0]).min.y)<.025,`${side}: landing restores planted toes`);
 }
 mixer.stopAllAction();
}

function validateGroundPeck(root:Object3D,clips:AnimationClip[]){
 const clip=clips.find(clip=>clip.name==='Peck')!,mixer=new AnimationMixer(root);
 const beak=meshes(root.getObjectByName('Beak')!).find(mesh=>mesh.name==='Beak_sculpt_paint')!;
 const positions=beak.geometry.attributes.position,tip=new Vector3();
 let front=0;for(let vertex=1;vertex<positions.count;vertex++)if(positions.getZ(vertex)>positions.getZ(front))front=vertex;
 const all=meshes(root),feet=['Left','Right'].map(side=>root.getObjectByName(`${side}_foot`)!);
 const body=bodySkin(root),tuck=body.morphTargetDictionary?.Belly_tuck;
 const ringMap=new Map<number,number[]>(),basePositions=body.geometry.attributes.position;
 for(let vertex=0;vertex<basePositions.count;vertex++){
  const y=basePositions.getY(vertex);
  if(y>1.05&&y<2.40&&Math.abs(basePositions.getX(vertex))<1e-7){const ring=ringMap.get(y)??[];ring.push(vertex);ringMap.set(y,ring);}
 }
 const rings=[...ringMap].sort(([a],[b])=>a-b).map(([,vertices])=>vertices.sort((a,b)=>basePositions.getZ(a)-basePositions.getZ(b)));
 const neckProfiles=[rings.map(ring=>ring[0]),rings.map(ring=>ring.at(-1)!)];
 assert.notEqual(tuck,undefined,'Peck: the body retains its named belly shape');
 for(const [name,targets] of Object.entries(body.geometry.morphAttributes))for(const target of targets!){
  assert.equal(target.count,body.geometry.attributes.position.count,`Peck: ${name} morph has one delta per vertex`);
  for(const value of target.array)assert(Number.isFinite(value),`Peck: finite ${name} morph delta`);
 }
 root.updateMatrixWorld(true);const planted=feet.map(foot=>foot.getWorldPosition(new Vector3()));
 const action=mixer.clipAction(clip).setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
 const heights:number[]=[];let previousTuck=0;
 for(let frame=0;frame<=320;frame++){
  mixer.setTime(clip.duration*frame/320);root.updateMatrixWorld(true);
  heights.push(tip.fromBufferAttribute(positions,front).applyMatrix4(beak.matrixWorld).y);
  const amount=body.morphTargetInfluences![tuck!];
  assert(Math.abs(amount-previousTuck)<.04,'Peck: the belly tucks and relaxes smoothly');previousTuck=amount;
  for(const mesh of all){
   if(mesh instanceof SkinnedMesh)mesh.skeleton.update();
   assert(exactBounds(mesh).min.y>=-.01,`Peck: ${mesh.name} must stay above the ground at phase ${frame}/320`);
  }
  feet.forEach((foot,i)=>assert(foot.getWorldPosition(new Vector3()).distanceTo(planted[i])<1e-6,'Peck: both feet stay planted'));
  for(const profile of neckProfiles){
   const points=profile.map(vertex=>body.getVertexPosition(vertex,new Vector3()).applyMatrix4(body.matrixWorld));
   for(let i=1;i<points.length-1;i++){
    const before=points[i].clone().sub(points[i-1]),after=points[i+1].clone().sub(points[i]);
    assert(before.angleTo(after)<Math.PI*2/9,`Peck: the neck profile must remain smooth without a folded collar at phase ${frame}/320`);
   }
  }
  if([96,160,224].includes(frame)){
   const neck=root.getObjectByName('Neck')!,head=root.getObjectByName('Head')!,torso=root.getObjectByName('Body')!;
   assert(Math.abs(torso.rotation.x-.80)<.004&&Math.abs(neck.rotation.x-1.55)<.004&&Math.abs(head.rotation.x+.65)<.004,'Peck: preserve the approved compact bend and head trajectory');
   assert(Math.abs(neck.position.z-.45)<1e-6,'Peck: smoothing must not extend the neck forward');
   assert(amount>.99,'Peck: the belly stays tucked through each ground contact');
   const tuckedFloor=exactBounds(body).min.y;
   body.morphTargetInfluences![tuck!]=0;const relaxedFloor=exactBounds(body).min.y;body.morphTargetInfluences![tuck!]=amount;
   assert(tuckedFloor>.20&&tuckedFloor>relaxedFloor+.15,'Peck: the belly clears the ground instead of blocking the beak');
   const inside=skinVolume(body),point=new Vector3();
   for(const side of ['Left','Right']){
    const hip=meshes(root.getObjectByName(`${side}_hip`)!).find(mesh=>mesh.parent?.name===`${side}_hip`)!;
    let connected=false;
    for(let vertex=0;vertex<hip.geometry.attributes.position.count;vertex++){
     hip.getVertexPosition(vertex,point).applyMatrix4(hip.matrixWorld);
     if(inside(point,.001)){connected=true;break;}
    }
    assert(connected,`Peck: ${side} hip stays attached when the belly retracts`);
   }
  }
 }
 const contacts=heights.filter((height,i)=>i>0&&i<heights.length-1&&height<.08&&height<heights[i-1]&&height<=heights[i+1]);
 assert.equal(contacts.length,3,'Peck: three separate beak contacts reach the ground');
 for(const fraction of [.4,.6])assert(heights[Math.round(320*fraction)]>.6,'Peck: the beak visibly recoils between contacts');
 assert(heights[0]>2&&Math.abs(heights.at(-1)!-heights[0])<1e-6,'Peck: the bird returns to its standing pose');
 assert.equal(body.morphTargetInfluences![tuck!],0,'Peck: the belly returns to its original shape');
 const delta=body.geometry.morphAttributes.position![0],base=body.geometry.attributes.position;
 for(let vertex=0;vertex<base.count;vertex++){
  const y=base.getY(vertex);
  if(y>=1.75)assert.equal(Math.hypot(delta.getX(vertex),delta.getY(vertex),delta.getZ(vertex)),0,'Peck: preserve the approved belly shape and neck proportions');
  for(const correction of body.geometry.morphAttributes.position!.slice(1)){
   const distance=Math.hypot(correction.getX(vertex),correction.getY(vertex),correction.getZ(vertex));
   assert(Math.abs(correction.getX(vertex))<1e-6,'Peck: crease smoothing preserves neck width');
   assert(distance<.26,'Peck: the crease correction stays local and modest');
   const ring=ringMap.get(y),zRange=ring?.map(index=>base.getZ(index));
   const back=zRange?base.getZ(vertex)<=Math.min(...zRange)+.375*(Math.max(...zRange)-Math.min(...zRange)):false;
   if(y<=1.15||y>=2.28||back)assert(distance<1e-6,'Peck: crease smoothing preserves the belly, upper neck, head and back');
  }
 }
 assert.equal(body.geometry.morphAttributes.position!.length,6,'Peck: local corrections follow the bend through the whole motion');
 assert(body.morphTargetInfluences!.every(weight=>weight===0),'Peck: all local corrections relax after the series');
 mixer.stopAllAction();
}

/** Horizontal rays through the actual deformed skin, accelerated in Y/Z. */
function skinVolume(mesh:SkinnedMesh){
 const step=.10,world=new Float64Array(mesh.geometry.attributes.position.count*3),v=new Vector3();
 const indices=mesh.geometry.index!.array,cells=new Map<string,number[]>();
 for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);v.toArray(world,i*3);}
 for(let triangle=0;triangle<indices.length;triangle+=3){
  const a=indices[triangle]*3,b=indices[triangle+1]*3,c=indices[triangle+2]*3;
  const ys=[world[a+1],world[b+1],world[c+1]],zs=[world[a+2],world[b+2],world[c+2]];
  for(let y=Math.floor(Math.min(...ys)/step);y<=Math.floor(Math.max(...ys)/step);y++)for(let z=Math.floor(Math.min(...zs)/step);z<=Math.floor(Math.max(...zs)/step);z++){
   const key=`${y},${z}`,list=cells.get(key)??[];list.push(triangle);cells.set(key,list);
  }
 }
 const gap=(point:Vector3)=>{
  let low=Infinity,high=-Infinity;
  for(const triangle of cells.get(`${Math.floor(point.y/step)},${Math.floor(point.z/step)}`)??[]){
   const a=indices[triangle]*3,b=indices[triangle+1]*3,c=indices[triangle+2]*3;
   const ay=world[a+1],az=world[a+2],by=world[b+1],bz=world[b+2],cy=world[c+1],cz=world[c+2];
   const determinant=(by-cy)*(az-cz)+(cz-bz)*(ay-cy);if(Math.abs(determinant)<1e-10)continue;
   const wa=((by-cy)*(point.z-cz)+(cz-bz)*(point.y-cy))/determinant;
   const wb=((cy-ay)*(point.z-cz)+(az-cz)*(point.y-cy))/determinant,wc=1-wa-wb;
   if(Math.min(wa,wb,wc)<-1e-6)continue;
   const x=wa*world[a]+wb*world[b]+wc*world[c];low=Math.min(low,x);high=Math.max(high,x);
  }
  return Math.max(low-point.x,point.x-high);
 };
 return Object.assign((point:Vector3,tolerance=.003)=>gap(point)<-tolerance,{gap});
}

function validateGroundLegAttachment(root:Object3D,clips:AnimationClip[]){
 const mixer=new AnimationMixer(root),body=bodySkin(root);
 const thighs=['Left','Right'].map(side=>meshes(root.getObjectByName(`${side}_hip`)!).find(mesh=>mesh.parent?.name===`${side}_hip`)!);
 const point=new Vector3();
 const check=(label:string)=>{
  root.updateMatrixWorld(true);
  for(const mesh of meshes(root))if(mesh instanceof SkinnedMesh)mesh.skeleton.update();
  const inside=skinVolume(body);
  for(const thigh of thighs){
   const positions=thigh.geometry.attributes.position;
   let collar=0,embedded=0;
   for(let vertex=0;vertex<positions.count;vertex++){
    if(positions.getY(vertex)<-.025)continue;
    collar++;thigh.getVertexPosition(vertex,point).applyMatrix4(thigh.matrixWorld);
    if(inside(point,.001))embedded++;
   }
   assert(collar>0&&embedded/collar>.5,`${label}: ${thigh.name} upper attachment detaches from the belly (${embedded}/${collar} collar vertices inside)`);
  }
 };
 for(const name of ['Walk','Run','WalkBackward','RotateLeft','RotateRight']){
  const clip=clips.find(clip=>clip.name===name)!;
  mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
  for(let frame=0;frame<=180;frame++){
   mixer.setTime(clip.duration*frame/180);check(`${name}, phase ${frame}/180`);
  }
 }
 for(const [from,to] of [['Idle','Walk'],['Idle','Run'],['Walk','Run'],['Walk','WalkBackward']]){
  for(const phase of [0,.17,.39,.61,.83])for(let blend=0;blend<=8;blend++){
   mixer.stopAllAction();
   for(const [name,weight] of [[from,1-blend/8],[to,blend/8]] as const){
    const clip=clips.find(clip=>clip.name===name)!;
    mixer.clipAction(clip).reset().setEffectiveWeight(weight).play();
   }
   mixer.setTime(phase);check(`${from}↔${to}, time ${phase}, blend ${blend}/8`);
  }
 }
 mixer.stopAllAction();
}

test('pigeon geometry has valid indices, finite attributes and normalized skin weights',()=>{
 validateGeometry(createPigeon().root);
});

test('pigeon has a horizontal torso with a small head and neck over its front third',()=>{
 const {root}=createPigeon();root.updateMatrixWorld(true);
 const sculpt=bodySkin(root);assert(sculpt);
 const neck=root.getObjectByName('Neck'),head=root.getObjectByName('Head');assert(neck&&head);
 const neckPosition=neck.getWorldPosition(new Vector3()),headPosition=head.getWorldPosition(new Vector3());
 const torsoBounds=new Box3(),headBounds=new Box3(),vertex=new Vector3(),positions=sculpt.geometry.getAttribute('position');
 // The neck base separates the torso; halfway up the neck isolates the skull.
 // Read the rest surface so this checks anatomy independently of Walk poses.
 const headBase=(neckPosition.y+headPosition.y)/2;
 for(let i=0;i<positions.count;i++){
  vertex.fromBufferAttribute(positions,i).applyMatrix4(sculpt.matrixWorld);
  if(vertex.y<neckPosition.y)torsoBounds.expandByPoint(vertex);
  if(vertex.y>headBase)headBounds.expandByPoint(vertex);
 }
 assert(!torsoBounds.isEmpty()&&!headBounds.isEmpty());
 const torsoSize=torsoBounds.getSize(new Vector3()),headSize=headBounds.getSize(new Vector3());
 assert(torsoSize.z>torsoSize.y*1.35,'the torso must run along the ground instead of forming an upright pear');
 const frontThird=torsoBounds.min.z+torsoSize.z*2/3;
 assert(neckPosition.z>frontThird&&headPosition.z>frontThird,'the neck and head must rise from the front of the torso');
 assert(headSize.x<torsoSize.x*.60&&headSize.y<torsoSize.y*.60&&headSize.z<torsoSize.z*.45,'the head must stay clearly smaller than the torso');
 const silhouette=exactBounds(sculpt);
 assert(Math.abs(silhouette.min.y-60/155)<1e-6,'approved traced belly stays unchanged');
 assert(Math.abs(silhouette.max.y-429/155)<1e-6,'approved traced forehead stays unchanged');
 assert(Math.abs(silhouette.getSize(new Vector3()).x-1.68)<.008,'approved torso width stays unchanged');
 for(const side of ['Left','Right']){
  const lid=root.getObjectByName(`${side}_eyelid`);assert(lid);assert.deepEqual(lid.scale.toArray(),[0,0,0],'open lids are fully invisible, with no flat shadow-casting strip');
 }
});

test('all player movements, ride poses and five emotions have complete finite animation channels',()=>{
 const {root,clips}=createPigeon();assert.equal(root.userData.character,'pigeon');
 assert.deepEqual(clips.map(c=>c.name),PIGEON_CLIPS.map(c=>c.name));
 const names=new Map<string,number>();root.traverse(node=>names.set(node.name,(names.get(node.name)??0)+1));
 const poseChannels=new Set(clips.find(c=>c.name==='Walk')!.tracks.map(track=>track.name));
 for(const definition of PIGEON_CLIPS){
  const clip=clips.find(c=>c.name===definition.name)!;assert.equal(clip.duration,definition.duration);
  assert.deepEqual(new Set(clip.tracks.filter(track=>track.name!=='GoofyPigeon.quaternion').map(track=>track.name)),poseChannels,`${clip.name}: every channel must restore a previous pose`);
  for(const track of clip.tracks){
   const target=track.name.slice(0,track.name.lastIndexOf('.'));assert.equal(names.get(target),1,`${clip.name}: unambiguous target ${target}`);
   assert(track.times.length>=2);assert.equal(track.times[0],0);assert(Math.abs(track.times.at(-1)!-clip.duration)<1e-6);
   for(let i=1;i<track.times.length;i++)assert(track.times[i]>track.times[i-1],`${clip.name}: keys must move forward`);
   for(const value of track.values)assert(Number.isFinite(value),`${clip.name}/${track.name}: finite value`);
   const stride=track.getValueSize();
   if(track.name.endsWith('.quaternion'))for(let i=0;i<track.values.length;i+=4){
    const length=Math.hypot(...Array.from(track.values.slice(i,i+4)));assert(Math.abs(length-1)<1e-6,`${clip.name}/${track.name}: normalized quaternion`);
   }
   if(definition.loop)for(let i=0;i<stride;i++)assert(Math.abs(track.values[i]-track.values[track.values.length-stride+i])<1e-6,`${clip.name}/${track.name}: loop seam`);
  }
 }
 assert(clips.find(c=>c.name==='RotateLeft')!.tracks.some(t=>t.name==='GoofyPigeon.quaternion'),'root yaw identifies the exported animation root');
 assert(clips.filter(c=>!c.name.startsWith('Rotate')).every(c=>c.tracks.every(t=>t.name!=='GoofyPigeon.quaternion')),'whole-bird poses use Motion, so removing game heading never removes the pose');
});

test('ground clips keep three unchanged foot strides inside one slower upper-body cycle',()=>{
 const {root,clips}=createPigeon(),mixer=new AnimationMixer(root);
 const body=root.getObjectByName('Body')!,head=root.getObjectByName('Head')!,left=root.getObjectByName('Left_foot')!;
 const peaks=(values:number[],maximum=true)=>values.filter((value,i)=>{
  const before=values[(i+values.length-1)%values.length],after=values[(i+1)%values.length];
  return maximum?value>=before&&value>after:value<=before&&value<after;
 }).length;
 for(const [name,strideDuration,speed] of [['Walk',1.05,1],['Run',.66,1.36],['WalkBackward',1.2,.8]] as const){
  const clip=clips.find(c=>c.name===name)!,gait=PIGEON_GAITS[name];
  assert.equal(gait.cyclesPerClip,3);
  assert(Math.abs(clip.duration-strideDuration*3)<1e-8,'head/body cycle is three times the original period');
  assert(Math.abs(pigeonStanceSpeed(name)-2*gait.reach/(gait.stance*strideDuration))<1e-8,'physical stepping speed does not change');
  mixer.stopAllAction();mixer.clipAction(clip).reset().play();
  const bodyX:number[]=[],headYaw:number[]=[],headZ:number[]=[],ankleZ:number[]=[],headWorld:Vector3[]=[];
  for(let frame=0;frame<360;frame++){
   mixer.setTime(clip.duration*frame/360);root.updateMatrixWorld(true);
   bodyX.push(body.position.x);headYaw.push(head.rotation.y);headZ.push(head.position.z);
   ankleZ.push(left.getWorldPosition(new Vector3()).z);headWorld.push(head.getWorldPosition(new Vector3()));
  }
  assert.equal(peaks(bodyX),1,`${name}: upper body sways once per full clip`);
  assert.equal(peaks(headYaw),1,`${name}: head turns once per full clip`);
  assert.equal(peaks(headZ),2,`${name}: original two head nods now take three stride periods`);
  assert.equal(peaks(ankleZ,false),3,`${name}: planted ankle still completes three strides`);
  assert.equal(peaks(ankleZ,true),3,`${name}: ankle recovery still completes three strides`);
  for(let frame=0;frame<120;frame++){
   assert(Math.abs(ankleZ[frame]-ankleZ[frame+120])<.002,`${name}: successive strides preserve ankle travel`);
   assert(Math.abs(ankleZ[frame]-ankleZ[frame+240])<.002,`${name}: third stride preserves ankle travel`);
  }
  assert(headWorld[24].distanceTo(headWorld[144])>.02,`${name}: the world-space head is not repeating at the old foot period`);
  assert(Math.abs(Math.max(...bodyX)-Math.min(...bodyX)-.044*speed)<.003,`${name}: original torso sway amplitude is preserved`);
  assert(Math.abs(Math.max(...headZ)-Math.min(...headZ)-.070*speed)<.003,`${name}: original head bob amplitude is preserved`);
  // Endpoint equality is already checked for every exported channel above.
  // Check sampled position and velocity as well, avoiding a slow-cycle snap.
  const epsilon=clip.duration/1000;
  const sample=(time:number)=>{mixer.setTime(time);root.updateMatrixWorld(true);return head.getWorldPosition(new Vector3());};
  const start=sample(0),after=sample(epsilon),before=sample(clip.duration-epsilon),end=sample(clip.duration);
  assert(start.distanceTo(end)<1e-6,`${name}: head world position closes its loop`);
  const into=start.clone().sub(before).divideScalar(epsilon),out=after.clone().sub(start).divideScalar(epsilon);
  // Linear/spherical keyframe interpolation changes the tangent slightly at
  // every key. The wrap must remain within the same small interpolation error.
  assert(into.distanceTo(out)<.06*Math.max(.2,into.length(),out.length()),`${name}: head velocity stays smooth across the loop`);
 }
 mixer.stopAllAction();
});

test('upper legs stay embedded in the moving belly through forward, backward and turning steps',()=>{
 const {root,clips}=createPigeon();validateGroundLegAttachment(root,clips);
});

test('every pose remains a finite connected sculpt through interpolated frames',()=>{
 const {root,clips}=createPigeon(),mixer=new AnimationMixer(root),all=meshes(root);
 const body=bodySkin(root);assert(body);
 for(const clip of clips){
  mixer.stopAllAction();mixer.clipAction(clip).reset().play();
  for(const fraction of [0,.071,.19,.333,.47,.63,.79,.917,1]){
   mixer.setTime(clip.duration*fraction);root.updateMatrixWorld(true);body.skeleton.update();
   const box=new Box3();
   for(const mesh of all)box.union(exactBounds(mesh));
   const size=box.getSize(new Vector3());
   assert(size.x<6&&size.y<6&&size.z<6,`${clip.name}: no detached or exploding vertices`);
   const torso=exactBounds(body).getSize(new Vector3());
   assert(Math.max(torso.x,torso.y,torso.z)<3.3,`${clip.name}: skin must remain compact`);
   for(const side of ['Left','Right']){
    const eye=root.getObjectByName(`${side}_eye`)!,wing=root.getObjectByName(`${side}_wing`)!;
    assert(eye.getWorldPosition(new Vector3()).distanceTo(root.getObjectByName('Head')!.getWorldPosition(new Vector3()))<.55,`${clip.name}: eye stays attached to head`);
    assert(wing.getWorldPosition(new Vector3()).distanceTo(root.getObjectByName('Body')!.getWorldPosition(new Vector3()))<2.1,`${clip.name}: wing stays attached to its shoulder`);
   }
  }
 }
 mixer.stopAllAction();
});

test('flight keeps both folded feet and shins outside the belly throughout the wingbeat and restores planted feet',()=>{
 const {root,clips}=createPigeon();validateFlightFeet(root,clips);
});

test('flight visibly opens the wings and sleep closes both eyes and folds the feet',()=>{
 const {root,clips}=createPigeon(),mixer=new AnimationMixer(root);
 const sample=(name:string,time:number)=>{mixer.stopAllAction();mixer.clipAction(clips.find(c=>c.name===name)!).reset().play();mixer.setTime(time);root.updateMatrixWorld(true);};
 sample('Fly',.12);
 for(const side of ['Left','Right']){
  const wing=root.getObjectByName(`${side}_wing`)!,box=exactBounds(meshes(wing)[0]);
  assert(side==='Left'?box.min.x< -1.6:box.max.x>1.6,'flight must spread the painted wing shells outward');
 }
 sample('Sleep',.6);
 assert(Math.abs(root.getObjectByName('Motion')!.quaternion.z)>.7,'the pigeon sleeps on its flank');
 const sleepingBox=new Box3();for(const mesh of meshes(root)){if(mesh instanceof SkinnedMesh)mesh.skeleton.update();sleepingBox.union(exactBounds(mesh));}
 assert(sleepingBox.min.y>=-.005&&sleepingBox.min.y<.05,'side-sleep belly rests on the mattress');
 assert(Math.abs(sleepingBox.getCenter(new Vector3()).x)<.3,'side-sleep remains centred over the bed');
 for(const side of ['Left','Right']){
  assert.equal(root.getObjectByName(`${side}_eyelid`)!.scale.y,1,'sleep closes eyes');
  assert(root.getObjectByName(`${side}_foot`)!.getWorldPosition(new Vector3()).y>.25,'sleep folds feet into the feathers');
 }
 sample('Idle',0);
 for(const side of ['Left','Right'])assert.equal(root.getObjectByName(`${side}_eyelid`)!.scale.y,0,'Idle restores open eyes');
});

test('model eyes are twenty percent larger than revision six, with matched pupils, highlights and lids',()=>{
 const {root}=createPigeon();root.updateMatrixWorld(true);
 for(const side of ['Left','Right']){
  const eye=root.getObjectByName(`${side}_eye`)!;assert.deepEqual(eye.scale.toArray(),[.6,.6,.6]);
  const ivory=meshes(eye).find(mesh=>mesh.name===`${side}_eye_sculpt_eyes`)!;
  const diameter=exactBounds(ivory).getSize(new Vector3());
  assert(Math.abs(diameter.y-.165*1.2)<1e-6,'ivory diameter .165 becomes .198');
  assert(Math.abs(diameter.z-.160*1.2)<1e-6,'ivory diameter .160 becomes .192');
  assert(Math.abs(eye.position.x-(side==='Left'?-.305:.305))<1e-6,'head attachment centre does not move');
 }
});

test('flight wings spread in a horizontal plane and keep outer feathers out of the actual skin',t=>{
 const {root,clips}=createPigeon(),mixer=new AnimationMixer(root),body=bodySkin(root);
 const action=mixer.clipAction(clips.find(clip=>clip.name==='Fly')!).play();
 const wings=['Left','Right'].map(side=>root.getObjectByName(`${side}_wing`)!),point=new Vector3();
 let maximumShoulderGap=-Infinity;
 mixer.setTime(0);root.updateMatrixWorld(true);
 for(const wing of wings){
  const normal=new Vector3(1,0,0).applyQuaternion(root.getObjectByName(`${wing.name}_vane`)!.getWorldQuaternion(new Quaternion()));
  assert(Math.abs(normal.y)>.99,'midstroke wing surface faces up/down, not sideways');
 }
 for(let frame=0;frame<=72;frame++){
  mixer.setTime(action.getClip().duration*frame/72);root.updateMatrixWorld(true);body.skeleton.update();
  const inside=skinVolume(body);
  for(const wing of wings){
   const mesh=meshes(wing)[0],positions=mesh.geometry.attributes.position;
   let nearestSeam=Infinity;
   for(let vertex=0;vertex<positions.count;vertex+=4){
    point.fromBufferAttribute(positions,vertex);
    const span=-point.z;
    point.applyMatrix4(mesh.matrixWorld);
    if(span<.20){nearestSeam=Math.min(nearestSeam,inside.gap(point));continue;} // only the shoulder seam may overlap skin
    assert(!inside(point),`${wing.name}: feather ${vertex} penetrates skin at phase ${frame}/72, span ${span.toFixed(3)}, world ${point.toArray().map(v=>v.toFixed(3))}`);
   }
   maximumShoulderGap=Math.max(maximumShoulderGap,nearestSeam);
   assert(nearestSeam<.003,`${wing.name}: shoulder seam must stay attached to actual skin at phase ${frame}/72; gap ${nearestSeam}`);
  }
 }
 t.diagnostic(`Largest steady-flight shoulder gap: ${(maximumShoulderGap*1000).toFixed(2)} mm (negative means connected skin overlap).`);
});

test('takeoff and landing blends keep visible wing feathers outside the animated torso',t=>{
 const {root,clips}=createPigeon(),mixer=new AnimationMixer(root),body=bodySkin(root);
 const fly=mixer.clipAction(clips.find(clip=>clip.name==='Fly')!),wings=['Left','Right'].map(side=>root.getObjectByName(`${side}_wing`)!);
 const point=new Vector3();
 let maximumShoulderGap=-Infinity;
 for(const otherName of ['Idle','Run','Jump','Push','Swim']){
  const other=mixer.clipAction(clips.find(clip=>clip.name===otherName)!);
  for(const phase of [0,.12,.29,.47,.68])for(let frame=0;frame<=16;frame++){
   mixer.stopAllAction();const weight=frame/16;
   other.reset().setEffectiveWeight(1-weight).play();fly.reset().setEffectiveWeight(weight).play();
   mixer.setTime(phase);root.updateMatrixWorld(true);body.skeleton.update();const inside=skinVolume(body);
   for(const wing of wings){
    const mesh=meshes(wing)[0],positions=mesh.geometry.attributes.position;
    let nearestSeam=Infinity;
    for(let vertex=0;vertex<positions.count;vertex+=4){
     point.fromBufferAttribute(positions,vertex);
     const span=-point.z;
     point.applyMatrix4(mesh.matrixWorld);
     if(span<.20){nearestSeam=Math.min(nearestSeam,inside.gap(point));continue;}
     // The original closed shell's hidden inner cap touches the plumage.
     // Visible outer feathers get the same 3 mm test as the flight cycle.
     const tolerance=Math.floor(vertex/129)<=10?.003:.035;
     assert(!inside(point,tolerance),`${otherName}↔Fly: ${wing.name} feather ${vertex} penetrates torso at blend ${weight}, phase ${phase}, world ${point.toArray().map(v=>v.toFixed(3))}`);
    }
    maximumShoulderGap=Math.max(maximumShoulderGap,nearestSeam);
    assert(nearestSeam<.02,`${otherName}↔Fly: ${wing.name} shoulder detaches at blend ${weight}, phase ${phase}; gap ${nearestSeam}`);
   }
  }
 }
 t.diagnostic(`Largest takeoff/landing shoulder gap: ${(maximumShoulderGap*1000).toFixed(2)} mm.`);
});

test('Walk loops cleanly, keeps feet above the floor and deforms the body without expansion',()=>{
 const {root,clips}=createPigeon(),clip=clips.find(c=>c.name==='Walk');assert(clip&&clip.duration>0);
 const names=new Map<string,number>();root.traverse(n=>names.set(n.name,(names.get(n.name)??0)+1));
 for(const track of clip.tracks){
  const name=track.name.slice(0,track.name.lastIndexOf('.'));assert.equal(names.get(name),1,`unambiguous animation target ${name}`);
  assert(track.times.length>1);assert.equal(track.times[0],0);assert(Math.abs(track.times.at(-1)!-clip.duration)<1e-6);
  const stride=track.getValueSize();
  for(let i=0;i<stride;i++)assert(Math.abs(track.values[i]-track.values[track.values.length-stride+i])<1e-6,`${track.name}: loop seam`);
  for(const value of track.values)assert(Number.isFinite(value),`${track.name}: finite animation value`);
 }
 const body=bodySkin(root);
 const feet=meshes(root).filter(n=>n.parent?.name==='Left_foot'||n.parent?.name==='Right_foot');assert.equal(feet.length,2);
 root.updateMatrixWorld(true);(body as SkinnedMesh).skeleton.update();
 const initial=exactBounds(body).getSize(new Vector3()),mixer=new AnimationMixer(root);mixer.clipAction(clip).play();
 let highestFoot=0,lowestFoot=Infinity;
 // Sample between keyframes as well as at the start/end, since interpolation can break contacts.
 for(let frame=0;frame<=126;frame++){
  mixer.setTime(frame/126*clip.duration);root.updateMatrixWorld(true);(body as SkinnedMesh).skeleton.update();
  const size=exactBounds(body).getSize(new Vector3());
  for(const axis of ['x','y','z'] as const)assert(size[axis]<initial[axis]*1.20,`body ${axis} must not swell under animation`);
  const floors=feet.map(foot=>exactBounds(foot).min.y);lowestFoot=Math.min(lowestFoot,...floors);highestFoot=Math.max(highestFoot,...floors);
  assert(Math.min(...floors)<.04,'at least one foot stays in contact with the floor');
  assert(Math.min(...floors)>=-.015,`foot penetrates floor at ${frame/126*clip.duration}: ${Math.min(...floors)}`);
 }
 assert(highestFoot>.075,'Walk must visibly lift the moving foot');assert(lowestFoot<.025,'feet should be placed on the floor');
 mixer.stopAllAction();
});

test('ground peck makes three visible beak contacts without sliding the feet or entering the ground',()=>{
 const {root,clips}=createPigeon();validateGroundPeck(root,clips);
});

test('exported pigeon GLB preserves the shared paint atlas, skeleton and all native clips',async()=>{
 const data=await readFile(new URL('../public/models/pigeon-animated.glb',import.meta.url));
 const jsonLength=data.readUInt32LE(12),metadata=JSON.parse(data.subarray(20,20+jsonLength).toString());
 assert.equal(metadata.images.length,1);assert.equal(metadata.images[0].mimeType,'image/png');
 const view=metadata.bufferViews[metadata.images[0].bufferView],png=data.subarray(28+jsonLength+view.byteOffset,28+jsonLength+view.byteOffset+view.byteLength);
 const atlas=await readFile(new URL('../design/pigeon/pigeon-feather-atlas.png',import.meta.url));
 assert.deepEqual(png,atlas,'GLB must embed the authored feather texture');
 assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(png.readUInt32BE(16),png.readUInt32BE(20));
 assert(metadata.materials.every((material:{pbrMetallicRoughness:{baseColorTexture?:{index:number}}})=>material.pbrMetallicRoughness.baseColorTexture?.index===0),'every material must share the unified paint atlas');
 // Node has no image bitmap/DOM; verify the embedded image above, then load
 // actual geometry/skin/clips with a texture placeholder. Browser QA also
 // decodes and renders the PNG through the real GLTFLoader.
 const loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));
 const gltf=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 validateGeometry(gltf.scene);assert.deepEqual(gltf.animations.map(c=>c.name),PIGEON_CLIPS.map(c=>c.name));
 validateGroundLegAttachment(gltf.scene,gltf.animations);
 validateFlightFeet(gltf.scene,gltf.animations);
 validateGroundPeck(gltf.scene,gltf.animations);
 assert.equal(gltf.scene.getObjectByName('GoofyPigeon')?.userData.character,'pigeon');
 const mixer=new AnimationMixer(gltf.scene);
 for(const clip of gltf.animations){
  mixer.stopAllAction();mixer.clipAction(clip).reset().play();mixer.setTime(clip.duration*.37);gltf.scene.updateMatrixWorld(true);
  for(const mesh of meshes(gltf.scene)){if(mesh instanceof SkinnedMesh)mesh.skeleton.update();exactBounds(mesh);}
 }
});
