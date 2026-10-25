import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {MetaKnightBattleMotion} from '../src/meta-knight-battle-motion';
import {KNIGHT,startKnightBattle,setKnightPhase,knightAttack,advanceKnightBattle,knightPosition,type KnightStage} from '../src/meta-knight-battle';
import {COSMIC,COSMIC_DESCENT as D,cosmicDescent,cosmicHeight,cosmicControlsLocked} from '../src/meta-knight-cosmic';
import {cosmicTravel} from '../src/meta-knight-cosmic-world';
import {cosmicCameraPose} from '../src/meta-knight-cosmic-camera';
import {MetaKnightCosmicFinale} from '../src/meta-knight-cosmic-finale';
import {FINALE_SOUNDS} from '../src/meta-knight-cosmic-finale-sounds';
import {knightSound} from '../src/meta-knight-sounds';

const actor={id:'a',p:[0,180,4] as [number,number,number],yaw:Math.PI,available:true};
function lastHit(){const s=startKnightBattle([{...actor,p:[0,0,-2]}],'a',1000)!;setKnightPhase(s,4,[actor],2000,1);Object.assign(s,{stage:'cosmic-open',since:10000,until:22000,hp:1});assert(knightAttack(s,actor,11000));advanceKnightBattle(s,[actor],11150);assert.equal(s.stage,'cosmic-descent');return s;}
test('last hit switches off combat, accelerates the common plane, lands before the victory, and preserves the fall clock in snapshots',()=>{
 const s=lastHit(),at=s.since;assert.equal(s.hp,0);assert(s.cosmicFall);assert(cosmicControlsLocked(s));assert.equal(s.until-at,D.durationMs);
 let previous:number=COSMIC.height,speed=0;for(let elapsed=0;elapsed<D.impactMs;elapsed+=20){const f=cosmicDescent(s,at+elapsed)!;assert(f.height<=previous&&f.speed>=speed);previous=f.height;speed=f.speed;assert.deepEqual(f,cosmicDescent(structuredClone(s),at+elapsed));assert.equal(knightPosition(s,at+elapsed)[1],f.height);}
 assert(Math.abs(cosmicHeight(s,at+D.impactMs/2)-135)<1e-8,'halfway through free fall, a quarter of the distance has been covered');
 assert.equal(cosmicHeight(s,at+D.impactMs),0);assert.equal(cosmicDescent(s,at+D.impactMs)!.settle,0);assert.deepEqual(cosmicTravel(s,at+D.impactMs,1),[0,0,0]);
 advanceKnightBattle(s,[actor],at+D.impactMs);assert.equal(s.stage,'cosmic-descent','floor contact must not award victory before the impact pose settles');
 const saved=structuredClone(s);advanceKnightBattle(s,[actor],at+D.durationMs);assert.equal(s.stage,'won');assert.deepEqual(s.cosmicFall,saved.cosmicFall);assert.equal(cosmicDescent(s,s.since)!.settle,1);assert.equal(knightPosition(s,s.since)[1],0);
});
test('camera keeps both characters readable during the fall and blends back to the native orbit after victory',()=>{
 const s=lastHit(),follow={azimuth:0,elevation:.25,distance:10};
 for(const radius of [4,20.5,41])for(const size of [[1600,1000],[900,1400]])for(const ms of [0,350,1400,2200,2380,2650]){
  const y=cosmicHeight(s,s.since+ms),pose=cosmicCameraPose(s,s.since+ms,[0,y,radius],size[0],size[1],follow),camera=new T.PerspectiveCamera(pose.fov,size[0]/size[1],.25,3000);camera.position.fromArray(pose.position);camera.lookAt(new T.Vector3().fromArray(pose.focus));camera.updateMatrixWorld();
  for(const p of [[0,y+3.7,0],[0,y+1,radius]]){const v=new T.Vector3().fromArray(p).project(camera);assert(Math.abs(v.x)<.98&&Math.abs(v.y)<.98&&v.z<1,`${radius}m ${size} ${ms}ms: both actors remain on screen`);}
 }
 advanceKnightBattle(s,[actor],s.until);const pose=cosmicCameraPose(s,s.since+1400,[0,0,4],1600,1000,follow);assert.deepEqual(pose.focus,[0,.9,4]);assert.equal(pose.fov,55);assert(Math.abs(new T.Vector3().fromArray(pose.position).distanceTo(new T.Vector3().fromArray(pose.focus))-10)<1e-8);
});
test('real rig blends from every possible last attack, clears the sword and cape, and keeps the seated pose through victory',async()=>{
 const bytes=await readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url));
 for(const [stage,part] of [['cosmic-open',1],['cosmic-meteor-cast',2],['cosmic-star-stun',3]] as [KnightStage,1|2|3][]){
  const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),c=new CharacterController(asset.scene,asset.animations),motion=new MetaKnightBattleMotion(c.actor),s=lastHit();setKnightPhase(s,4,[actor],2000,part);Object.assign(s,{stage,since:10000,until:11000,cosmicSpin:{at:-2000,yaw:0}});c.setActivity('Fly');c.updateActivity(0);motion.apply(s,1);c.actor.updateMatrixWorld(true);
  const blade=c.actor.getObjectByName('Galaxia')!,body=c.actor.getObjectByName('Body_motion')!,cape=c.actor.getObjectByName('Cape')!,tip=blade.localToWorld(new T.Vector3(-.315,2.05,0)),cloth:T.Mesh[]=[];cape.traverse(o=>{if(o instanceof T.Mesh)cloth.push(o);});
  const inverse=new T.Matrix4(),relative=new T.Matrix4(),triangle=new T.Triangle(),v=new T.Vector3(),boots=['Left','Right'].map(side=>{const node=c.actor.getObjectByName(side+'_foot_pivot')!,box=new T.Box3();inverse.copy(node.matrixWorld).invert();node.traverse(o=>{if(o instanceof T.Mesh){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox!.clone().applyMatrix4(relative.multiplyMatrices(inverse,o.matrixWorld)));}});return {node,box:box.expandByScalar(.025)};});
  motion.beginCosmicFall();Object.assign(s,{stage:'cosmic-descent',since:11000,until:14000,cosmicFall:{at:11000,yaw:0}});let lastTip=tip,closest=Infinity;
  for(let frame=0;frame<=180;frame++){
   motion.clear();c.updateActivity(1/60);motion.apply(s,frame/180);c.actor.updateMatrixWorld(true);const next=blade.localToWorld(new T.Vector3(-.315,2.05,0));assert(next.distanceTo(lastTip)<.30,`${stage} ${frame}: no discontinuous sword movement`);lastTip=next;
   blade.traverse(o=>{if(o instanceof T.Mesh){const p=o.geometry.getAttribute('position');for(let j=0;j<p.count;j+=3){body.worldToLocal(o.localToWorld(v.fromBufferAttribute(p,j)));closest=Math.min(closest,(v.x/.91)**2+(v.y/.91)**2+(v.z/.79)**2);}}});
   if(frame*D.durationMs/180>=D.impactMs)assert(next.y>.04,'the point stays clear of the arena floor');
   for(const {node,box} of boots){inverse.copy(node.matrixWorld).invert();for(const mesh of cloth){relative.multiplyMatrices(inverse,mesh.matrixWorld);const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index,count=index?.count??p.count;for(let i=0;i<count;i+=3){triangle.a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(relative);triangle.b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(relative);triangle.c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(relative);assert(!box.intersectsTriangle(triangle),`${stage} ${frame}: ${mesh.name} enters ${node.name}`);}}}
  }
  assert(closest>1.035,`${stage}: every blade stays outside the torso`);Object.assign(s,{stage:'won',since:14000,until:1e12+14000});motion.clear();c.setActivity('Sitting');c.updateActivity(0);motion.apply(s,0);assert(blade.localToWorld(new T.Vector3(-.315,2.05,0)).distanceTo(lastTip)<1e-6,'the winning state keeps the exact final landing pose');motion.clear();c.disposeEffects();
 }
});
test('landing emits one impact cue, stays finite and resets on a new fall or rollback',()=>{
 const s=lastHit(),view=new MetaKnightCosmicFinale(),at=s.since;assert(!view.update(s,at+1000));assert(view.group.visible);assert(view.update(s,at+D.impactMs));assert(!view.update(s,at+D.impactMs+16));assert(!view.update(s,at+100));assert(view.update(s,at+D.impactMs));view.update(undefined,at+4000);assert(!view.group.visible);view.dispose();
});
test('fall and landing audio are finite stereo signals with headroom and silent boundaries',()=>{
 for(const kind of FINALE_SOUNDS){const {left,right}=knightSound(kind,22050);let peak=0,energy=0,stereo=0;for(let i=0;i<left.length;i++){assert(Number.isFinite(left[i])&&Number.isFinite(right[i]));peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));energy+=left[i]**2;stereo+=(left[i]-right[i])**2;}assert(peak<.7&&peak>.02);assert(energy/left.length>.00001&&stereo>0);assert.equal(Math.abs(left[0]),0);assert(Math.abs(right.at(-1)!)<.003);}
});
