import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {AnimationMixer,Box3,LoopOnce,Mesh,PropertyBinding,Quaternion,Vector3,type Object3D} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {META_KNIGHT_CLIPS,META_KNIGHT_CLIP_BY_NAME,type MetaKnightClipName} from '../src/meta-knight-clips';

async function model(){
  const bytes=await readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const mixer=new AnimationMixer(gltf.scene);
  function sample(name:MetaKnightClipName,phase:number){
    mixer.stopAllAction();
    const clip=gltf.animations.find(clip=>clip.name===name)!;
    const action=mixer.clipAction(clip);action.reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
    action.time=clip.duration*phase;mixer.update(0);gltf.scene.updateMatrixWorld(true);
  }
  const node=(name:string)=>{const result=gltf.scene.getObjectByName(name);assert(result,name);return result;};
  return {...gltf,mixer,sample,node};
}

test('all gameplay states export native clips while preserving the base geometry and original wing cycles',async()=>{
  const asset=await model();
  assert.equal(asset.animations.length,31);
  let meshes=0,triangles=0;
  const embroidery=asset.node('Cape_embroidered_yoke');
  assert.equal(embroidery.parent,asset.node('Cape'),'embroidery follows the cloak in every pose');
  asset.scene.traverse(object=>{if(object instanceof Mesh&&object.parent!==embroidery){meshes++;triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3;}});
  assert.equal(meshes,49);assert.equal(triangles,61734);
  const approved={Idle:'caddc055e097dc9eb3d6ce99817478e4df625871579df06d6ba9f7b4d208c844',Walk:'3757cefb53d4551a2f21e1ac1fa52eaf5b6fa955bb5ce91861edf56ae31c93f6',Sitting:'2b11e6547520aa301bec6c68937af87a4188630737cdd0dc7e4fe83ddc6edbd8'};
  for(const [name,digest] of Object.entries(approved)){
    const hash=createHash('sha256');
    for(const track of asset.animations.find(clip=>clip.name===name)!.tracks.filter(track=>track.name.includes('_wing_pivot.'))){
      hash.update(track.name);hash.update(new Uint8Array(track.times.buffer,track.times.byteOffset,track.times.byteLength));hash.update(new Uint8Array(track.values.buffer,track.values.byteOffset,track.values.byteLength));
    }
    assert.equal(hash.digest('hex'),digest,`${name}: original wing tracks must remain byte-for-byte identical`);
  }
  assert.equal(asset.node('Left_hand_attachment').parent,asset.node('Left_gauntlet'));
  assert(!asset.node('Right_gauntlet').getObjectByName('Left_hand_attachment'),'food belongs to the empty hand');
});

test('native gaits alternate feet, backward gait reverses the stride, and turns carry the required root binding',async()=>{
  const asset=await model(),left=asset.node('Left_foot_pivot'),right=asset.node('Right_foot_pivot');
  for(const name of ['Run','WalkBackward'] as const){
    asset.sample(name,.25);const first=left.position.z-right.position.z;
    asset.sample(name,.75);const second=left.position.z-right.position.z;
    assert(first*second<-.05,`${name}: both feet must take their turn`);
    assert.equal(Math.sign(first),name==='Run'?1:-1,'backward steps must reverse forward reach');
  }
  for(const name of ['RotateLeft','RotateRight'] as const){
    const clip=asset.animations.find(clip=>clip.name===name)!;
    const root=asset.node('MetaKnight_root');
    const track=clip.tracks.find(track=>{
      const binding=PropertyBinding.parseTrackName(track.name);
      return binding.propertyName==='quaternion'&&PropertyBinding.findNode(asset.scene,binding.nodeName)===root;
    });
    assert(track,'controller must be able to discover the animated root');
    asset.sample(name,1);
    const forward=new Vector3(0,0,1).applyQuaternion(root.quaternion);
    assert(Math.abs(Math.atan2(forward.x,forward.z)-(name==='RotateLeft'?1:-1)*Math.PI/2)<1e-6);
  }
});

test('flight beats the actual wings and all five emotions change the eyes while the mask stays solid',async()=>{
  const asset=await model(),wing=asset.node('Left_wing_pivot'),eyes=asset.node('Eyes_glow'),mask=asset.node('Mask_shell');
  asset.sample('Fly',.25);const first=wing.quaternion.clone();
  asset.sample('Fly',.75);assert(first.angleTo(wing.quaternion)>1,'flight needs visible wingbeats');
  const originalMask=mask.quaternion.clone();
  for(const {name,duration} of META_KNIGHT_CLIPS.filter(clip=>clip.group==='emotions')){
    asset.sample(name,.3);
    assert(eyes.scale.distanceTo(new Vector3(1,1,1))>.025,`${name}: expression must be readable through the visor`);
    assert(mask.quaternion.angleTo(originalMask)<1e-6,`${name}: silver mask must remain rigid`);
    asset.sample(name,1);
    assert(eyes.scale.distanceTo(new Vector3(1,1,1))<1e-6,`${name}: expression must recover at completion`);
    assert.equal(duration,name==='Hello'?2.7:2.4);
  }
});

test('hello raises the free left fist beside the face and waves its wrist with a cheerful expression',async()=>{
  const asset=await model(),wrist=asset.node('Left_gauntlet'),fist=asset.node('Left_fist');
  const body=asset.node('Body_motion'),eyes=asset.node('Eyes_glow'),sword=asset.node('Galaxia');
  const duration=META_KNIGHT_CLIP_BY_NAME.Hello.duration;
  const fistCenter=()=>fist.localToWorld(new Vector3(0,-.13,0));
  asset.sample('Hello',0);const rest=fistCenter(),held=sword.matrixWorld.clone().invert().multiply(asset.node('Right_grip_fingers').matrixWorld);
  const wrists:Quaternion[]=[],positions:Vector3[]=[];
  for(const time of [.434,.661,.889,1.116]){
    asset.sample('Hello',time/duration);
    const center=fistCenter();positions.push(center);wrists.push(wrist.quaternion.clone());
    assert(center.y>body.getWorldPosition(new Vector3()).y+.35&&center.y>rest.y+.85,'the greeting fist stays raised above the visor');
    assert(center.x<-.85&&center.z>.15,'the free hand stays visibly beside the face rather than crossing the mask');
    assert(eyes.scale.y<.75&&eyes.scale.x>1.05,'hello shares the happy, smiling-eye response');
    const grip=sword.matrixWorld.clone().invert().multiply(asset.node('Right_grip_fingers').matrixWorld);
    grip.elements.forEach((value,i)=>assert(Math.abs(value-held.elements[i])<1e-5,'the sword remains in the right fist'));
  }
  assert(wrists[0].angleTo(wrists[1])>.7,'the raised wrist makes a readable wave');
  assert(positions[0].distanceTo(positions[1])>.10,'the hand follows the wave instead of freezing above the face');
  asset.sample('Hello',1);assert(fistCenter().distanceTo(rest)<1e-5,'the hand returns to its standing position');
});

test('push lunges Galaxia forwards at the hit time with a front step and recovers the guarded stance',async()=>{
  const asset=await model(),sword=asset.node('Galaxia'),body=asset.node('Body_motion');
  const rightFoot=asset.node('Right_foot_pivot'),leftFoot=asset.node('Left_foot_pivot');
  const tip=()=>sword.localToWorld(new Vector3(-.315,2.05,0));
  asset.sample('Push',0);const restTip=tip(),restBody=body.position.clone(),restFront=rightFoot.position.z,restBack=leftFoot.position.z;
  asset.sample('Push',.23/META_KNIGHT_CLIP_BY_NAME.Push.duration);
  const axis=new Vector3(0,1,0).transformDirection(sword.matrixWorld),hilt=sword.getWorldPosition(new Vector3()),extended=tip();
  assert(axis.dot(new Vector3(0,0,1))>.995,'the blade length must point forwards along the game facing direction');
  assert(extended.z>hilt.z+1.95&&extended.z>restTip.z+2,'the sword visibly thrusts forward rather than making a lateral swing');
  assert(body.position.z>restBody.z+.15&&body.position.y<restBody.y-.04,'the torso shifts its weight into the lunge');
  assert(rightFoot.position.z>restFront+.28&&leftFoot.position.z<restBack-.10,'the sword-side foot steps forward while the rear foot braces');
  assert(extended.y>.7,'the point stays clear of the ground');
  asset.sample('Push',1);assert(tip().distanceTo(restTip)<1e-5,'the sword recovers its guarded position');
  assert(body.position.distanceTo(restBody)<1e-5,'the lunge adds no lasting visual root displacement');
});

test('sleep and tumble use the internal motion pivot and every ride has a native pose',async()=>{
  const asset=await model(),motion=asset.node('MetaKnight_motion'),root=asset.node('MetaKnight_root');
  for(const {name} of META_KNIGHT_CLIPS.filter(clip=>clip.group==='rides')){
    asset.sample(name,.35);
    asset.scene.traverse((object:Object3D)=>assert([...object.position.toArray(),...object.quaternion.toArray(),...object.scale.toArray()].every(Number.isFinite),`${name}: finite rig transforms`));
    assert(root.quaternion.angleTo(new Quaternion())<1e-6,`${name}: gameplay heading must stay on the outer actor`);
  }
  asset.sample('Sleep',.25);assert(motion.quaternion.angleTo(new Quaternion())>1.4,'sleep reclines the entire body and feet');
  asset.sample('Wake',1);assert(motion.quaternion.angleTo(new Quaternion())<1e-6,'waking restores standing');
  asset.sample('Roll',.25);assert(motion.quaternion.angleTo(new Quaternion())>1.4,'tumble is animated without controller root yaw');
  assert(META_KNIGHT_CLIP_BY_NAME.Eat.duration>.95,'Eat must reach the gameplay bite event');
});

test('sleep rests on the body rather than folded wings and reclining/tumbling poses clear the floor',async()=>{
  const asset=await model(),body=asset.node('Body_motion');
  const surface=body.children.find(object=>object instanceof Mesh)!;
  for(const name of ['Sleep','Wake','Roll','Death'] as const)for(let frame=0;frame<=48;frame++){
    asset.sample(name,frame/48);
    const all=new Box3().setFromObject(asset.scene,true);
    assert(all.min.y>=-.025,`${name}: animation interpolation penetrates the floor at ${frame}/48`);
    if(name==='Sleep'){
      const support=new Box3().setFromObject(surface,true).min.y;
      assert(Math.abs(support-.33)<1e-5,'bed fitting uses the native body support height');
      assert(all.min.y>=support-1e-5,'wings, cape and sword must lie above the body support plane');
    }
  }
});
