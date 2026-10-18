import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {KNIGHT} from '../src/meta-knight-battle';
import {MetaKnightSwordSwing,knightSwordAngle} from '../src/meta-knight-sword-swing';

async function fixture(){
 const bytes=await readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url));
 const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const c=new CharacterController(asset.scene,asset.animations);c.actor.scale.setScalar(KNIGHT.modelScale);
 const swing=new MetaKnightSwordSwing(c.actor),blade=c.actor.getObjectByName('Galaxia')!;
 return {c,swing,blade,pose:(stage:'slash-warn'|'slash'|'open',step:number,f:number)=>{
  swing.clear();c.setActivity('Idle');c.updateActivity(0);swing.apply({stage,step,since:1000,until:stage==='slash'?1250:2600},f);c.actor.updateMatrixWorld(true);
 }};
}

test('the actual sword tip sweeps the entire warned radius and cone in both directions and at any boss heading',async()=>{
 const {c,swing,blade,pose}=await fixture();
 for(const yaw of [0,.7,Math.PI,-2])for(const step of [1,3]){
  c.actor.position.set(2007,2,-8);c.actor.rotation.y=yaw;
  const grip=c.actor.getObjectByName('Right_grip_fingers')!;
  c.actor.updateMatrixWorld(true);const held=blade.matrixWorld.clone().invert().multiply(grip.matrixWorld);
  for(let i=0;i<=40;i++){
   const f=i/40;pose('slash',step,f);
   const delta=swing.tip.clone().sub(c.actor.position),angle=yaw+knightSwordAngle({stage:'slash',step},f);
   assert(Math.abs(Math.hypot(delta.x,delta.z)-KNIGHT.slashRadius)<.025,'blade reaches the actual outer warning edge');
   assert(Math.abs(Math.atan2(Math.sin(Math.atan2(delta.x,delta.z)-angle),Math.cos(Math.atan2(delta.x,delta.z)-angle)))<.003,'blade and trail follow the same sector angle');
   const bounds=new Box3().setFromObject(blade);assert(bounds.min.y>c.actor.position.y+.15,'entire blade stays above the arena surface');
   const relative=blade.matrixWorld.clone().invert().multiply(grip.matrixWorld);
   relative.elements.forEach((value,index)=>assert(Math.abs(value-held.elements[index])<1e-5,'sword and fingers stay attached'));
  }
 }
});

test('wind-up visibly raises the sword, then meets the start of each stroke without snapping',async()=>{
 const {swing,pose}=await fixture();
 pose('slash-warn',0,0);const rest=swing.tip.clone();pose('slash-warn',0,.5);const raised=swing.tip.clone();
 assert(raised.y>rest.y+.7,'readable sword lift during the yellow warning');assert(raised.distanceTo(rest)>2);
 for(const step of [0,2]){
  pose('slash-warn',step,1);const ready=swing.tip.clone();pose('slash',step+1,0);
  assert(swing.tip.distanceTo(ready)<1e-5,'warning finishes in the exact strike pose');
 }
 pose('slash',1,1);const end=swing.tip.clone();pose('slash-warn',2,0);
 assert(swing.tip.distanceTo(end)<1e-5,'backhand preparation continues from the forehand follow-through');
});

test('stroke pose depends on encounter time and clears cleanly before other animations',async()=>{
 const {c,swing,pose}=await fixture();
 pose('slash',1,.46);const tip=swing.tip.clone();
 for(let i=0;i<10;i++)pose('slash',1,.46);assert(swing.tip.distanceTo(tip)<1e-6,'paused/repeated rendering never advances the blade');
 swing.clear();c.setActivity('Idle');c.updateActivity(0);
 const body=c.actor.getObjectByName('Body_motion')!,p=body.position.clone(),q=body.quaternion.clone();
 pose('open',4,0);assert(body.quaternion.angleTo(q)>.5,'the stroke recovers smoothly instead of snapping into the next clip');
 pose('open',4,.5);assert(body.position.distanceTo(p)<1e-6);assert(body.quaternion.angleTo(q)<1e-6);
 pose('slash',1,1);swing.reset();pose('open',4,0);assert(body.quaternion.angleTo(q)<1e-6,'a new encounter never inherits an old follow-through');
 assert(c.actor.getObjectByName('Galaxia')!.getWorldPosition(new Vector3()).y>0);
});
