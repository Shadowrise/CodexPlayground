import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {MetaKnightBattleMotion} from '../src/meta-knight-battle-motion';
import {startKnightBattle} from '../src/meta-knight-battle';
import {COSMIC,COSMIC_SEQUENCE} from '../src/meta-knight-cosmic';
import {COSMIC_SPIN as C} from '../src/meta-knight-cosmic-spin';
import {COSMIC_REFUGE as R} from '../src/meta-knight-cosmic-refuge';
import {COSMIC_METEOR as M} from '../src/meta-knight-cosmic-meteor';

test('the actual cloak and gold hem clear both trailing boots throughout ascent, combat, fatigue and landing',async()=>{
 const bytes=await readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url)),asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const c=new CharacterController(asset.scene,asset.animations),motion=new MetaKnightBattleMotion(c.actor),cape=c.actor.getObjectByName('Cape')!,body=c.actor.getObjectByName('Body_motion')!;
 const cloth:T.Mesh[]=[];cape.traverse(o=>{if(o instanceof T.Mesh)cloth.push(o);});assert(cloth.length>=5,'include the actual cloth, gold piping and shoulder yoke');
 const inverse=new T.Matrix4(),relative=new T.Matrix4(),triangle=new T.Triangle();
 const boots=['Left','Right'].map(side=>{
  const node=c.actor.getObjectByName(side+'_foot_pivot')!,box=new T.Box3();node.updateWorldMatrix(true,true);inverse.copy(node.matrixWorld).invert();
  node.traverse(o=>{if(o instanceof T.Mesh){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox!.clone().applyMatrix4(relative.multiplyMatrices(inverse,o.matrixWorld)));}});
  return {node,box:box.expandByScalar(.025)};
 });
 const s=startKnightBattle([{id:'a',p:[0,0,-2],yaw:0,available:true}],'a',1000)!;s.phase=4;s.cosmicLaunch={at:5000+COSMIC.chargeMs+COSMIC.strikeMs,players:{}};
 let since=5000+COSMIC.chargeMs+COSMIC.strikeMs+COSMIC.surgeMs+COSMIC.liftMs;
 const stages=[...COSMIC_SEQUENCE.slice(4),['cosmic-spin-warn',C.warnMs],['cosmic-spin',C.spinMs],['cosmic-open',C.openMs],['cosmic-hit',C.hitMs],['cosmic-recover',C.recoverMs],['cosmic-meteor-draw',M.drawMs],['cosmic-meteor-cast',2500],['cosmic-meteor-gap',M.gapMs],['cosmic-meteor-return',M.returnMs],['cosmic-meteor-settle',M.settleMs],['cosmic-star-draw',R.drawMs],['cosmic-star-open',R.openMs],['cosmic-planet-draw',R.pullMs],['cosmic-planet-sweep',R.sweepMs],['cosmic-star-strike',R.strikeMs],['cosmic-star-stun',R.stunMs],['cosmic-star-retreat',R.retreatMs],['cosmic-spin-warn',C.warnMs],['cosmic-spin',C.spinMs],['cosmic-open',C.openMs],['cosmic-descent',C.descentMs]] as const;
 for(const [stage,duration] of stages){
  Object.assign(s,{stage,since,until:since+duration});if(stage==='cosmic-spin')s.cosmicSpin={at:since,yaw:0};if(stage==='cosmic-star-draw')s.cosmicRefuge={at:since,angle:0,world:0,contacts:{}};
  const samples=stage==='cosmic-rise'||stage==='cosmic-descent'?120:60;
  for(let frame=0;frame<=samples;frame++){
   motion.clear();c.setActivity('Fly');c.updateActivity(duration/samples/1000);motion.apply(s,frame/samples);c.actor.updateMatrixWorld(true);
   if(stage!=='cosmic-rise'&&stage!=='cosmic-descent')assert(cape.localToWorld(new T.Vector3(0,.40,-.75)).distanceTo(body.localToWorld(new T.Vector3(0,.40,-.75)))<1e-6,'the streaming cape stays attached at the shoulders');
   for(const {node,box} of boots){
    inverse.copy(node.matrixWorld).invert();
    for(const mesh of cloth){
     relative.multiplyMatrices(inverse,mesh.matrixWorld);const positions=mesh.geometry.getAttribute('position'),index=mesh.geometry.index,count=index?.count??positions.count;
     for(let i=0;i<count;i+=3){
      triangle.a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(relative);triangle.b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(relative);triangle.c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(relative);
      assert(!box.intersectsTriangle(triangle),`${stage} ${frame}/${samples}: ${mesh.name} enters the clearance around ${node.name}`);
     }
    }
   }
  }
  since+=duration;
 }
 motion.clear();assert(cape.position.length()<1e-6,'clearing the battle pose restores the native cloak');c.disposeEffects();
});
