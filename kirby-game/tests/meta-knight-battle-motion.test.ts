import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {MetaKnightBattleMotion} from '../src/meta-knight-battle-motion';
import {MetaKnightSwordSwing} from '../src/meta-knight-sword-swing';
import {MetaKnightDashSparks,DASH_SPARK_COUNT} from '../src/meta-knight-dash-sparks';
import {MetaKnightBladeGlow} from '../src/meta-knight-blade-glow';
import {MetaKnightDazedStars} from '../src/meta-knight-dazed-stars';
import {KNIGHT,startKnightBattle,knightShotOrigin,type KnightBattle} from '../src/meta-knight-battle';
import {starPosition,STAR_LANDING_STEP,STAR_FALL_STEP,STAR_SHIELD_STEP} from '../src/meta-knight-star-assault';

async function fixture(){
 const bytes=await readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url));
 const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const c=new CharacterController(asset.scene,asset.animations);c.actor.scale.setScalar(KNIGHT.modelScale);
 const motion=new MetaKnightBattleMotion(c.actor),swing=new MetaKnightSwordSwing(c.actor),s=startKnightBattle([{id:'a',p:[0,0,-2],yaw:0,available:true}],'a',1000)!;
 const pose=(stage:KnightBattle['stage'],f:number)=>{motion.clear();swing.clear();c.setActivity(['won','open','stunned','crystal-break'].includes(stage)?'Sitting':stage==='get-up'?'Idle':s.pattern==='star'||stage.startsWith('shot')||stage.startsWith('dash')?'Fly':'Idle');c.updateActivity(0);Object.assign(s,{stage,since:1000,until:stage==='shot'?2800:2600});swing.apply(s,f);motion.apply(s,f);c.actor.updateMatrixWorld(true);};
 return {c,motion,s,pose,node:(name:string)=>c.actor.getObjectByName(name)!};
}
test('jump visibly crouches, tucks the feet in flight and drives the held sword into the target at landing',async()=>{
 const {pose,node}=await fixture(),body=node('Body_motion'),foot=node('Left_foot_pivot'),blade=node('Galaxia');
 pose('jump-warn',0);const standing=body.position.y;pose('jump-warn',1);assert(body.position.y<standing-.2);
 pose('jump',.25);assert(foot.position.y>.5);const raised=blade.localToWorld(new T.Vector3(-.315,2.05,0));
 pose('slam',.2);const tip=blade.localToWorld(new T.Vector3(-.315,2.05,0)),hilt=blade.getWorldPosition(new T.Vector3());
 assert(raised.y>tip.y+3,'the raised sword visibly plunges down');assert(tip.y<0&&hilt.y>0,'the blade penetrates the floor');
 const impact=hilt.clone().lerp(tip,-hilt.y/(tip.y-hilt.y));assert(Math.hypot(impact.x,impact.z)<.05,'the blade enters the centre of the marked circle');
});
test('both hands keep contact with the hilt while the sword reverses from raised to plunged',async()=>{
 const {pose,node}=await fixture(),blade=node('Galaxia'),hand=node('Left_gauntlet');
 for(const [stage,f] of [['jump-warn',.6],['jump',.15],['jump',.55],['jump',.9],['slam',.2]] as const){
  pose(stage,f);const target=blade.localToWorld(new T.Vector3(0,-.23,.025));
  assert(hand.getWorldPosition(new T.Vector3()).distanceTo(target)<.001,`${stage} ${f}: the support hand holds the hilt`);
 }
});

test('dazed boss settles onto his body with attached feet, and its pose clears before another action',async()=>{
 const {pose,node,motion}=await fixture(),body=node('Body_motion');
 pose('open',.6);assert(body.position.y<.95);
 const bodyBox=new T.Box3().setFromObject(body.children.find(o=>o instanceof T.Mesh)!);
 for(const name of ['Left_foot_pivot','Right_foot_pivot']){
  const foot=node(name);assert(foot.position.z<.4);assert(Math.abs(foot.position.x)<.5);
  assert(new T.Box3().setFromObject(foot).intersectsBox(bodyBox),'the boots meet the body');
 }
 const blade=new T.Box3().setFromObject(node('Galaxia'));assert(blade.min.y>.1,'resting sword clears the floor');
 motion.clear();assert(body.position.y>.93,'the native sitting pose is restored before the next clip');
});

test('ordinary and crystal hits sit with attached boots, then the recovery pose smoothly stands up',async()=>{
 const {pose,node,c,s,motion}=await fixture(),body=node('Body_motion');
 for(const stage of ['stunned','crystal-break'] as const){s.pattern=stage==='crystal-break'?'star':'sword';pose(stage,.5);assert(body.position.y<.95);const box=new T.Box3().setFromObject(body.children.find(o=>o instanceof T.Mesh)!);for(const name of ['Left_foot_pivot','Right_foot_pivot'])assert(new T.Box3().setFromObject(node(name)).intersectsBox(box));}
 motion.clear();c.setActivity('Idle');c.updateActivity(.4);pose('get-up',0);const seated=body.position.y,boots=node('Left_foot_pivot').position.clone();pose('get-up',1);assert(body.position.y>seated+.04);assert(node('Left_foot_pivot').position.distanceTo(boots)>.05);motion.clear();
});

test('leap is fully seated on its first open frame, without delaying vulnerability for the sword recovery',async()=>{
 const {pose,node,s,c}=await fixture();s.pattern='leap';s.step=2;
 const body=node('Body_motion'),foot=node('Left_foot_pivot'),blade=node('Galaxia'),hand=node('Left_gauntlet');
 c.actor.position.y=5*Math.sin(Math.PI*.999);pose('jump',.999);const before=body.getWorldPosition(new T.Vector3()),boot=foot.getWorldPosition(new T.Vector3());
 c.actor.position.y=0;pose('open',0);assert(body.getWorldPosition(new T.Vector3()).distanceTo(before)<.06,'the final flight frames prepare the seated body');assert(foot.getWorldPosition(new T.Vector3()).distanceTo(boot)<.06);
 const tip=blade.localToWorld(new T.Vector3(-.315,2.05,0));assert(tip.y<0&&tip.y>-.4);assert(Math.hypot(tip.x,tip.z)<KNIGHT.impactRadius,'the two-handed stab stays inside the marked circle and ahead of the body');assert(hand.getWorldPosition(new T.Vector3()).distanceTo(blade.localToWorld(new T.Vector3(0,-.23,.025)))<.001);
 for(const elapsed of [0,1,60,180,240,400]){pose('open',elapsed/1600);assert(body.position.y<.95,`seated after ${elapsed}ms`);assert.equal(node('MetaKnight_motion').position.z,0);assert(foot.position.z<.4);}
});
test('crescent release has a large actual sword swing before the projectile appears',async()=>{
 const {pose,node}=await fixture(),blade=node('Galaxia');
 pose('shot',0);const ready=blade.localToWorld(new T.Vector3(-.315,2.05,0));
 pose('shot',KNIGHT.shotReleaseMs/1800);const hit=blade.localToWorld(new T.Vector3(-.315,2.05,0));
 assert(ready.distanceTo(hit)>8);assert(Math.abs(hit.y-ready.y)<.001,'the cut stays horizontal');assert(Math.abs(hit.y-KNIGHT.projectileHeight)<.001);assert(Math.abs(hit.x)<.03,'the blade crosses the target heading at release');assert(node('Left_foot_pivot').position.y<.4);
});

test('the full sword stays in front of the torso throughout crouch, jump, reversal and impact',async()=>{
 const {pose,node,c,s}=await fixture(),blade=node('Galaxia'),body=node('Body_motion'),point=new T.Vector3();s.pattern='leap';
 for(const stage of ['jump-warn','jump','slam','open'] as const)for(let frame=0;frame<=40;frame++){
  c.actor.position.y=stage==='jump'?5*Math.sin(Math.PI*frame/40):0;pose(stage,stage==='open'?frame/160:frame/40);let closest=Infinity,minY=Infinity;
  blade.traverse(o=>{if(o instanceof T.Mesh){const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i+=3){point.fromBufferAttribute(p,i);o.localToWorld(point);minY=Math.min(minY,point.y);body.worldToLocal(point);closest=Math.min(closest,(point.x/.91)**2+(point.y/.91)**2+(point.z/.79)**2);}}});
  assert(closest>1.03,`${stage} ${frame}/40: sword penetrates torso (${closest})`);
  assert(minY>(stage==='slam'||stage==='open'?-.45:.02),`${stage} ${frame}/40: only the impact tip may enter the floor (${minY})`);
 }
});

test('flying thrust points the held sword forward and emits a bounded reusable spark stream from the blade',async()=>{
 const {pose,node}=await fixture(),blade=node('Galaxia');pose('dash',.5);
 const tip=blade.localToWorld(new T.Vector3(-.315,2.05,0)),hilt=blade.getWorldPosition(new T.Vector3()),direction=tip.sub(hilt).normalize();
 assert(direction.z>.995);assert(Math.abs(direction.y)<.06);
 const sparks=new MetaKnightDashSparks(blade);assert.equal(sparks.group.parent,blade);sparks.update(200,true);assert(sparks.group.visible);
 const stream=sparks.group.children[0] as T.InstancedMesh;assert.equal(stream.count,DASH_SPARK_COUNT);const matrix=new T.Matrix4();stream.getMatrixAt(0,matrix);assert(matrix.elements.every(Number.isFinite));
 sparks.update(200,false);assert(!sparks.group.visible);sparks.dispose();assert(!sparks.group.parent);
});
test('dizziness uses three bevelled golden five-point stars floating above the seated head',()=>{
 const stars=new MetaKnightDazedStars();stars.update([0,0,0],700,true);
 for(let i=0;i<3;i++){
  const star=stars.group.getObjectByName('Meta Knight dazed star '+i) as T.Mesh<T.ExtrudeGeometry,T.MeshStandardMaterial>;
  assert(star);assert.equal(star.material.color.getHex(),0xffd34e);assert(star.geometry.parameters.options.bevelEnabled);assert.equal((star.geometry.parameters.shapes as T.Shape).getPoints().length,11);
  assert(star.getWorldPosition(new T.Vector3()).y>7);
 }
 stars.update([0,0,0],700,false);assert(!stars.group.visible);stars.dispose();
});

test('blade glows gold on its shadowed faces without changing shared character materials',async()=>{
 const {node}=await fixture(),blade=node('Galaxia'),mesh=blade.children.find(o=>o instanceof T.Mesh&&(o.material as T.Material).name.includes('gold')) as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 const original=mesh.material,emission=original.emissive.clone(),glow=new MetaKnightBladeGlow(blade);glow.update(500,true);
 assert.notEqual(mesh.material,original);assert(mesh.material.emissiveIntensity>1);assert.equal(mesh.material.emissive.getHex(),0xffb52b);assert(original.emissive.equals(emission));
 assert(blade.getObjectByName('Galaxia warm blade aura'));glow.dispose();assert.equal(mesh.material,original);assert(!blade.getObjectByName('Galaxia warm blade aura'));
});

test('crystal conducting uses a real sword cut and ricochets point the blade along the low flight',async()=>{
 const {pose,node,s}=await fixture();s.phase=3;s.pattern='star';s.step=2;
 const tip=()=>node('Galaxia').localToWorld(new T.Vector3(-.315,2.05,0));
 pose('cross',0);const before=tip();pose('cross',.8);assert(tip().distanceTo(before)>8,'the conductor visibly cuts across the beam');
 s.step=6;pose('ricochet',.5);const direction=tip().sub(node('Galaxia').getWorldPosition(new T.Vector3())).normalize();
 assert(direction.z>.9&&direction.y<-.2,'the blade extends forward and slightly down at ground height');
 assert(Math.abs(node('MetaKnight_motion').rotation.z)<.001,'a straight flight does not bank off its warning');
 s.starRoute=[0,4,1,5];s.starAims=[[30,0,12],[10,0,20],[-10,0,20]];pose('ricochet',.5);assert(Math.abs(node('MetaKnight_motion').rotation.z)>.01,'the boss banks into a curved flight while keeping its forward sword thrust');
});

test('starfall holds the hilt in both hands, joins ascent to descent and clears torso and arena until impact',async()=>{
 const {pose,node,c,s}=await fixture();s.phase=3;s.pattern='star';s.step=STAR_LANDING_STEP;
 const blade=node('Galaxia'),hand=node('Left_gauntlet'),body=node('Body_motion'),point=new T.Vector3();
 c.actor.position.y=9;pose('star-warn',1);const raised=blade.localToWorld(new T.Vector3(-.315,2.05,0));
 s.step=STAR_FALL_STEP;pose('star-fall',0);assert(blade.localToWorld(new T.Vector3(-.315,2.05,0)).distanceTo(raised)<.001,'no sword snap at the top');
 for(let frame=0;frame<=40;frame++){
  const f=frame/40;Object.assign(s,{stage:'star-fall',since:1000,until:2600});c.actor.position.y=starPosition(s,1000+1600*f)![1];pose('star-fall',f);
  assert(hand.getWorldPosition(new T.Vector3()).distanceTo(blade.localToWorld(new T.Vector3(0,-.23,.025)))<.001,'support hand remains on the hilt');
  let minY=Infinity,closest=Infinity;blade.traverse(o=>{if(o instanceof T.Mesh){const positions=o.geometry.getAttribute('position');for(let i=0;i<positions.count;i+=3){point.fromBufferAttribute(positions,i);o.localToWorld(point);minY=Math.min(minY,point.y);body.worldToLocal(point);closest=Math.min(closest,(point.x/.91)**2+(point.y/.91)**2+(point.z/.79)**2);}}});
  assert(minY>.02,`starfall ${frame}/40: blade clears the arena (${minY})`);assert(closest>1.03,`starfall ${frame}/40: blade clears the body (${closest})`);
 }
});

test('final recovery keeps the sword planted while the wings droop and the boss bows',async()=>{
 const {pose,node,c,s}=await fixture();s.phase=3;s.pattern='star';s.step=STAR_SHIELD_STEP;c.actor.position.y=0;
 pose('shield',0);const before=new T.Box3().setFromObject(node('Left_wing_pivot')).max.y;
 pose('shield',.8);const after=new T.Box3().setFromObject(node('Left_wing_pivot')).max.y;
 assert(after<before-1.5,`the exhausted wings lower visibly (${before} -> ${after})`);assert(node('Body_motion').rotation.x>.2);
 const tip=node('Galaxia').localToWorld(new T.Vector3(-.315,2.05,0));assert(tip.y<0&&tip.y>-.45,'only the planted tip enters the arena');assert(Math.hypot(tip.x,tip.z)<.05,'the sword stays in the centre of impact');
});

test('all three crescent swings keep both boot centres outside the torso, below the body and above the floor',async()=>{
 const {pose,node,c,s}=await fixture();c.actor.position.y=KNIGHT.hoverHeight;const body=node('Body_motion');
 for(const step of [1,3,5])for(const stage of ['shot-warn','shot'] as const)for(let frame=0;frame<=30;frame++){
  s.step=step;pose(stage,frame/30);const centre=body.getWorldPosition(new T.Vector3());
  for(const name of ['Left_foot_pivot','Right_foot_pivot']){const foot=node(name),p=body.worldToLocal(foot.getWorldPosition(new T.Vector3())),box=new T.Box3().setFromObject(foot);
   assert((p.x/.91)**2+(p.y/.91)**2+(p.z/.79)**2>1,`${stage} ${step} ${frame}: boot centre is not buried`);
   assert(box.max.y<centre.y-.7,`${stage} ${step} ${frame}: boots below body (${box.max.y}, ${centre.y})`);assert(box.min.y>.4,'the boss remains visibly in a low hover');
  }
 }
});

test('crescent is mown from the opposite side with both hands and is born at the real blade tip',async()=>{
 const {pose,node,c,s}=await fixture();c.actor.position.y=KNIGHT.hoverHeight;s.from=[0,KNIGHT.hoverHeight,0];s.height=KNIGHT.hoverHeight;
 const blade=node('Galaxia'),hand=node('Left_gauntlet'),tip=()=>blade.localToWorld(new T.Vector3(-.315,2.05,0));
 pose('shot-warn',1);const ready=tip();assert(ready.x<-6,'windup brings the sword across to the left');
 for(const f of [0,.1,KNIGHT.shotReleaseMs/1800,.2,.35]){pose('shot',f);assert(hand.getWorldPosition(new T.Vector3()).distanceTo(blade.localToWorld(new T.Vector3(0,-.23,.025)))<.001,'both hands grip the same hilt through the cut');}
 for(const yaw of [0,.7,Math.PI]){s.yaw=yaw;c.actor.rotation.y=yaw;pose('shot',KNIGHT.shotReleaseMs/1800);const origin=new T.Vector3().fromArray(knightShotOrigin(s));assert(tip().distanceTo(origin)<.001,'the projectile starts at the actual tip on the release frame');}
});
