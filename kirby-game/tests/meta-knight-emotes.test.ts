import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AnimationMixer,Group,Quaternion} from 'three';
import {CharacterController,type Input} from '../src/controller';
import {createMetaKnight} from '../src/meta-knight-model';
import {META_KNIGHT_CLIP_BY_NAME} from '../src/meta-knight-clips';
import {EMOTES} from '../src/emotes';

const asset=createMetaKnight(),idle:Input={forward:false,left:false,right:false};
function create(){const wrapper=new Group();wrapper.add(asset.root.clone(true));return new CharacterController(wrapper,asset.clips);}
function advance(c:CharacterController,seconds:number,input=idle){for(let frame=0;frame<Math.round(seconds*60);frame++)c.update(1/60,input);}

test('all five emotions play native body and visor expressions and finish cleanly',()=>{
 for(const {id} of EMOTES){
  const c=create();assert(c.startEmote(id));assert.equal(c.state,id);assert(!c.startEmote(id));advance(c,.35);
  const eye=c.actor.getObjectByName('Eyes_glow')!,neutral=asset.root.getObjectByName('Eyes_glow')!;
  assert(eye.scale.distanceTo(neutral.scale)>.01||eye.quaternion.angleTo(neutral.quaternion)>.01,`${id} has a native visor expression`);
  const reference=asset.root.clone(true),mixer=new AnimationMixer(reference);mixer.clipAction(asset.clips.find(clip=>clip.name===id)!).play();mixer.update(c.actions.get(id)!.time);
  for(const name of ['Body_motion','Left_shoulder','Right_shoulder','Eyes_glow']){
   const actual=c.actor.getObjectByName(name)!,expected=reference.getObjectByName(name)!;
   assert(actual.position.distanceTo(expected.position)<1e-6,`${id} preserves native ${name} translation`);
   assert(actual.quaternion.clone().normalize().angleTo(expected.quaternion.clone().normalize())<1e-6,`${id} preserves native ${name} rotation`);
   assert(actual.scale.distanceTo(expected.scale)<1e-6,`${id} preserves native ${name} scale`);
  }
  advance(c,META_KNIGHT_CLIP_BY_NAME[id].duration+.3);assert.equal(c.state,'Idle');assert(c.actions.get('Idle')!.isRunning());
  assert(eye.scale.distanceTo(neutral.scale)<1e-6,`${id} restores the visor`);
  assert(c.animationRoot.quaternion.angleTo(new Quaternion())<1e-6);
 }
});

test('movement interrupts native emotions and resets the visor, while flight and swimming reject them',()=>{
 for(const {id} of EMOTES){
  const c=create();assert(c.startEmote(id));advance(c,.4);advance(c,.3,{...idle,forward:true});assert.equal(c.state,'Run');
  assert(c.actor.getObjectByName('Eyes_glow')!.scale.distanceTo(asset.root.getObjectByName('Eyes_glow')!.scale)<1e-6,`${id} does not leave an expression on movement`);
  c.update(1/60,{...idle,jump:true});assert(!c.startEmote(id));
  c.setActivity('Idle');c.swimming=true;assert(!c.startEmote(id));
 }
});
