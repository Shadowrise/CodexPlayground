import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {NightFireflies} from '../src/night-fireflies';
import {fireflyActivity} from '../src/firefly-activity';
import {FIREFLY_MODES} from '../src/firefly';
import {FIREFLY_MODEL_FILE} from '../src/firefly-asset';
import {GAME_MODEL_FILES} from '../src/game-assets';

async function model(){
 const bytes=await readFile(new URL('../public/models/'+FIREFLY_MODEL_FILE.split('?')[0],import.meta.url));
 return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}

test('game loads the approved preview rig and every idle gesture fits between landing and takeoff',async()=>{
 const gltf=await model();assert.equal(GAME_MODEL_FILES[1],FIREFLY_MODEL_FILE);assert(FIREFLY_MODEL_FILE.includes('?v='));
 assert(gltf.scene.getObjectByName('Left_Knee_joint_0'));assert(gltf.scene.getObjectByName('Left_Eye_features'));
 for(let bug=0;bug<40;bug++){
  const seen=new Set<string>();
  for(let lap=0;lap<4;lap++){
   const start=lap*32;
   assert.equal(fireflyActivity(start+22.999,0,bug).mode,'Fly');
   const gesture=fireflyActivity(start+23,0,bug);seen.add(gesture.mode);assert.equal(gesture.animationTime,0);
   assert.equal(fireflyActivity(start+30.999,0,bug).mode,gesture.mode);
   assert(gltf.animations.find(c=>c.name===gesture.mode)!.duration>=7.99);
   assert.equal(fireflyActivity(start+31,0,bug).mode,'Sit');assert.equal(fireflyActivity(start+32,0,bug).mode,'Fly');
  }
  assert.deepEqual([...seen].sort(),['Groom','LookAround','Sit','WingStretch']);
 }
 assert.deepEqual(fireflyActivity(0,-6,3),fireflyActivity(32,-38,3),'negative landing phases stay deterministic');
});

test('real meadow plays all five clips, preserves the flight path and restores culled/reconnected gestures without restarting',async()=>{
 const gltf=await model(),world=new NightFireflies(gltf),bug=world.bugs[0],seen=new Set<string>();
 let loops=0;bug.firefly.mixer.addEventListener('loop',()=>loops++);
 const camera=bug.home.clone().add(new Vector3(0,3,5));
 for(let frame=0;frame<32*4*10;frame++){
  world.update(.1,true,camera);seen.add(bug.firefly.currentMode!);
  if(!bug.land){assert(bug.carrier.position.y>=0&&bug.carrier.position.y<=3.4);assert.equal(bug.firefly.currentMode,'Fly');}
 }
 assert.deepEqual([...seen].sort(),[...FIREFLY_MODES].sort());
 assert(loops<100,'a shared clock must not emit extra clip loops on every flight frame');
 // A late join and repeated 20Hz snapshots must not reset the grooming action.
 const rows=world.networkState();rows.forEach(r=>{r[0]=90;r[3]=0;r[8]=1;r[4]=r[1];r[5]=0;r[6]=r[2];});
 world.networkApply(rows);world.update(.05,true,camera);assert.equal(bug.firefly.currentMode,'Groom');
 const clip=gltf.animations.find(c=>c.name==='Groom')!,action=bug.firefly.mixer.existingAction(clip)!;
 assert(Math.abs(action.time-3.05)<1e-8);
 for(let i=0;i<15;i++){
  world.networkApply(world.networkState());world.update(.05,true,camera);
  assert.equal(bug.firefly.currentMode,'Groom');assert(Math.abs(action.time-(3.1+i*.05))<1e-8);
 }
 assert.equal(action.getEffectiveWeight(),1,'snapshot updates preserve the completed fade');
 world.update(.6,true,new Vector3(10000,0,10000));assert(!bug.firefly.object.visible);
 world.update(.05,true,camera);assert(Math.abs(action.time-4.45)<1e-8,'returning to view catches up to the shared clip clock');
 const guest=new NightFireflies(gltf);guest.networkApply(world.networkState());guest.update(.01,true,camera);world.update(.01,true,camera);
 const guestAction=guest.bugs[0].firefly.mixer.existingAction(clip)!;assert.equal(guest.bugs[0].firefly.currentMode,'Groom');assert(Math.abs(guestAction.time-action.time)<1e-8);
 // A remote passenger suppresses grooming even while grounded.
 world.networkBlocked.add(0);world.update(.1,true,camera);assert.equal(bug.firefly.currentMode,'Sit');
 world.networkBlocked.delete(0);world.update(.1,true,camera);assert.equal(bug.firefly.currentMode,'Groom');
});
