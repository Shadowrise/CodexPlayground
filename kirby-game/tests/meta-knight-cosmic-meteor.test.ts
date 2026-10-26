import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {startKnightBattle,setKnightPhase,advanceKnightBattle,knightAttack,KNIGHT,type KnightActor} from '../src/meta-knight-battle';
import {COSMIC,cosmicHeight,cosmicAirborne} from '../src/meta-knight-cosmic';
import {COSMIC_METEOR as M,meteorPath,meteorPoint,meteorContact,meteorGuidanceMs,updateMeteorTracking} from '../src/meta-knight-cosmic-meteor';
import {CharacterController} from '../src/controller';import {MetaKnightBattleMotion} from '../src/meta-knight-battle-motion';import {MetaKnightCosmicMeteorView} from '../src/meta-knight-cosmic-meteor-view';
import {MetaKnightCosmicView} from '../src/meta-knight-cosmic-view';
const a:KnightActor={id:'a',p:[0,180,35],yaw:Math.PI,available:true};
function fixture(actors=[a]){const ground=actors.map((a,i)=>({...a,p:[i*3,0,-2] as [number,number,number]})),s=startKnightBattle(ground,'a',1000)!;setKnightPhase(s,4,actors,5000,2);return s;}

test('meteor attraction uses blue eyes and sword lightning until release, without changing materials for the bolts',async()=>{
 const bytes=await readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url)),asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),scene=new T.Scene(),actor=asset.scene;
 scene.add(actor);const cosmic=new MetaKnightCosmicView(actor,scene),meteor=new MetaKnightCosmicMeteorView(actor.getObjectByName('Galaxia')!),s=fixture(),eyes=actor.getObjectByName('Eyes_glow')!;
 scene.add(cosmic.group,meteor.group);const version=meteor.lightning.hotMaterial.version;
 for(const at of [s.since+500,s.cosmicMeteor!.at-1]){
  if(at===s.cosmicMeteor!.at-1){s.stage='cosmic-meteor-cast';s.since=s.until;}
  cosmic.update(s,at);meteor.update(s,at);
  eyes.traverse(o=>{if(o instanceof T.Mesh){const material=o.material as T.MeshBasicMaterial;assert(material instanceof T.MeshBasicMaterial);assert(material.color.b>material.color.r*5);}});
  assert(meteor.lightning.hot.count>0);assert(meteor.lightning.hotMaterial.color.b>meteor.lightning.hotMaterial.color.r*5);assert.equal(meteor.lightning.hotMaterial.version,version);
 }
 cosmic.update(s,s.cosmicMeteor!.at);meteor.update(s,s.cosmicMeteor!.at);assert.equal(meteor.lightning.hot.count,0);
 eyes.traverse(o=>{if(o instanceof T.Mesh)assert(o.material instanceof T.MeshStandardMaterial);});cosmic.dispose();meteor.dispose();
});

test('lead follows measured flight velocity until release, rather than freezing during the windup',()=>{
 const actor={...a,p:[-8,180,35] as typeof a.p},s=fixture([actor]),began=s.since,release=s.cosmicMeteor!.at;
 for(let now=began;now<release;now+=20){actor.p=[-8+(now-began)/1000*5.44,180,35];advanceKnightBattle(s,[actor],now,'a');}
 const m=s.cosmicMeteor!;assert(m.aim[0]>actor.p[0]+3);assert(Math.abs(m.tracking!.v[0]-5.44)<.1);assert(!m.launched);
 actor.p=[-8+(release-began)/1000*5.44,180,35];advanceKnightBattle(s,[actor],release,'a');assert(m.launched);const aim=[...m.aim],yaw=m.yaw;
 actor.p[0]+=1;advanceKnightBattle(s,[actor],release+100,'a');assert.deepEqual(m.aim,aim);assert.equal(m.yaw,yaw);assert((m.guidance?.length??0)>0);
});

test('short guidance keeps the flown history and tangent continuous, then locks with a readable final approach',()=>{
 const s=fixture(),m=s.cosmicMeteor!;Object.assign(s,{stage:'cosmic-meteor-cast',since:m.at-M.releaseMs});updateMeteorTracking(s,[0,180,35],m.at);
 const old=meteorPath(m),at=m.at+100;updateMeteorTracking(s,[2,180,35],at);const path=meteorPath(m),guide=m.guidance![0];assert(guide);assert(path.end[0]>old.end[0]);
 for(const elapsed of [0,20,99,100])assert.deepEqual(path.point(elapsed/path.hitMs),old.point(elapsed/old.hitMs),'later guidance cannot bend an existing trail');
 const speed=(path:ReturnType<typeof meteorPath>,time:number)=>new T.Vector3(...path.point((time+.01)/path.hitMs)).sub(new T.Vector3(...path.point((time-.01)/path.hitMs))).multiplyScalar(50);
 assert(speed(path,100).distanceTo(speed(old,100))<.002);
 const window=meteorGuidanceMs(m);for(let t=120;t<=window+100;t+=20)updateMeteorTracking(s,[2+t*.006,180,35],m.at+t);
 const count=m.guidance!.length,snapshot=structuredClone(m),frozen=meteorPath(m);for(let t=window+120;t<path.hitMs;t+=20)updateMeteorTracking(s,[-30,180,-20],m.at+t);
 assert.equal(m.guidance!.length,count);assert.deepEqual(m,snapshot);assert(path.hitMs-window>=350);for(const step of m.guidance!)assert(step.at+step.blendMs<=window+.001);
 assert.deepEqual(meteorPath(m).point(.8),frozen.point(.8));assert.deepEqual(meteorPath(structuredClone(m)).point(.8),frozen.point(.8),'Worker snapshots reproduce the exact steered path');
});

test('steady sideways movement gets intercepted; changing direction after the guidance window still dodges',()=>{
 for(const evade of [false,true]){
  const actor={...a,p:[-8,180,35] as typeof a.p},s=fixture([actor]),began=s.since,release=s.cosmicMeteor!.at;let touched=false,old=began;
  for(let now=began;now<release+1600;now+=10){const m=s.cosmicMeteor;if(!m||s.stage==='cosmic-meteor-gap')break;
   const turn=release+(m.launched?meteorGuidanceMs(m):350)+40,seconds=(now-began)/1000;
   actor.p=[-8+5.44*seconds-(evade&&now>turn?2*5.44*(now-turn)/1000:0),180,35];
   advanceKnightBattle(s,[actor],now,'a');if(meteorContact(s,actor.p,now,old))touched=true;old=now;
  }assert.equal(touched,!evade,evade?'a late reversal should remain a fair escape':'permanent sideways flight should meet the predicted arc');
 }
});
test('hyphen shortcuts enter the chosen flight attack, while plain phase four keeps the full ascent',()=>{
 const s=fixture();assert.equal(s.stage,'cosmic-meteor-draw');assert.equal(s.hp,6);assert.equal(cosmicHeight(s,s.since),180);assert(cosmicAirborne(s));assert.equal(s.cosmicMeteor?.index,0);
 setKnightPhase(s,4,[a],6000,1);assert.equal(s.stage,'cosmic-spin-warn');assert.equal(s.cosmicPart,1);assert(!s.cosmicMeteor);assert(s.cosmicLaunch);
 setKnightPhase(s,4,[a],7000);assert.equal(s.stage,'transition');assert(!s.cosmicLaunch);assert.equal(cosmicHeight(s,7000),0);
});
test('three curved throws change targets, keep aiming through windup, cost no boss health and never open a fatigue window',()=>{
 const b={...a,id:'b',p:[30,180,0] as [number,number,number]},c={...a,id:'c',p:[-30,180,0] as [number,number,number]},actors=[a,b,c],s=fixture(actors),targets=[];
 for(let i=0;i<3;i++){
  assert.equal(s.stage,'cosmic-meteor-draw');assert.equal(s.until-s.since,1500);assert.equal(s.cosmicMeteor!.index,i);targets.push(s.target);
  const aimed=actors.find(a=>a.id===s.target)!,old=[...aimed.p] as typeof a.p;aimed.p=[old[0]+2,180,old[2]+1];advanceKnightBattle(s,actors,s.since+500,'a');assert.equal(s.cosmicMeteor!.aim[0],aimed.p[0]);
  const prior=[...s.cosmicMeteor!.aim];aimed.p=[old[0]+6,180,old[2]+4];advanceKnightBattle(s,actors,s.until-200,'a');assert.notDeepEqual(s.cosmicMeteor!.aim,prior);aimed.p=old;
  advanceKnightBattle(s,actors,s.until,'a');assert.equal(s.stage,'cosmic-meteor-cast');const path=meteorPath(s.cosmicMeteor!),middle=path.point(.5),straight=path.origin.map((v,j)=>(v+path.end[j])*.5);assert(Math.hypot(middle[0]-straight[0],middle[2]-straight[2])>5.9);assert(path.hitMs<1400);assert(Math.hypot(...path.point(1).map((v,j)=>v-s.cosmicMeteor!.aim[j]))<1e-8);
  assert(!meteorPoint(s,s.cosmicMeteor!.at+path.duration+1));advanceKnightBattle(s,actors,s.until,'a');assert.equal(s.stage,i<2?'cosmic-meteor-gap':'cosmic-meteor-settle');assert.equal(s.hp,6);advanceKnightBattle(s,actors,s.until,'a');
 }
 assert.equal(new Set(targets).size,3);assert.equal(s.stage,'cosmic-star-draw');assert.equal(s.hp,6);
});
test('a real timed attack reflects the first rock, cancels the other two and removes one health only on return impact',()=>{
 const s=fixture();advanceKnightBattle(s,[a],s.until);const m=s.cosmicMeteor!,path=meteorPath(m),arrival=m.at+path.hitMs;
 advanceKnightBattle(s,[a],arrival-170);assert(knightAttack(s,a,arrival-170));advanceKnightBattle(s,[a],arrival);
 assert.equal(s.stage,'cosmic-meteor-return');assert.equal(s.players.a.reflects,1);assert.equal(s.hp,6);assert.equal(m.index,0);assert(m.returned);assert.equal(m.returned.by,'a');
 const copy=structuredClone(s);assert.deepEqual(meteorPoint(s,s.since+300),meteorPoint(copy,s.since+300));advanceKnightBattle(s,[a],s.until);assert.equal(s.hp,5);assert.equal(s.stage,'cosmic-hit');assert.equal(s.players.a.hp,5);
 advanceKnightBattle(s,[a],s.until);advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'cosmic-star-draw');assert(!s.cosmicMeteor);
});
test('the arc sweeps against the real player height, grants contact grace and cannot double-hit or be reflected by holding attack',()=>{
 const s=fixture();advanceKnightBattle(s,[a],s.until);const m=s.cosmicMeteor!,path=meteorPath(m),at=m.at+path.hitMs;
 assert(meteorContact(s,a.p,at+60,at-60));assert(!meteorContact(s,[0,0,35],at+60,at-60));advanceKnightBattle(s,[a],at);assert.equal(s.players.a.hp,5);advanceKnightBattle(s,[a],at+M.graceMs+1);assert.equal(s.players.a.hp,4);advanceKnightBattle(s,[a],at+300);assert.equal(s.players.a.hp,4);
 const early=fixture();advanceKnightBattle(early,[a],early.until);assert(knightAttack(early,a,early.since));const hit=early.cosmicMeteor!.at+meteorPath(early.cosmicMeteor!).hitMs;advanceKnightBattle(early,[a],hit);advanceKnightBattle(early,[a],hit+100);assert.equal(early.players.a.reflects,0);assert.equal(early.hp,6);
});
test('real sword geometry clears the torso throughout the overhead summon, side windup, side throw and recovery',async()=>{
 const bytes=await readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url)),asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const c=new CharacterController(asset.scene,asset.animations),motion=new MetaKnightBattleMotion(c.actor),s=fixture(),blade=c.actor.getObjectByName('Galaxia')!,body=c.actor.getObjectByName('Body_motion')!,p=new T.Vector3(),view=new MetaKnightCosmicMeteorView(blade);c.actor.add(view.group);
 for(const stage of ['cosmic-meteor-draw','cosmic-meteor-cast','cosmic-meteor-gap','cosmic-meteor-return','cosmic-meteor-settle'] as const){
  Object.assign(s,{stage,since:5000,until:stage==='cosmic-meteor-draw'?6500:7500});
  for(let i=0;i<=90;i++){
   motion.clear();c.setActivity('Fly');c.updateActivity(1/60);motion.apply(s,i/90);c.actor.updateMatrixWorld(true);
   let closest=Infinity;blade.traverse(o=>{if(o instanceof T.Mesh){const position=o.geometry.getAttribute('position');for(let j=0;j<position.count;j+=3){p.fromBufferAttribute(position,j);o.localToWorld(p);body.worldToLocal(p);closest=Math.min(closest,(p.x/.91)**2+(p.y/.91)**2+(p.z/.79)**2);}}});assert(closest>1.035,`${stage} ${i}: sword enters the torso`);
   view.update(s,s.since+(s.until-s.since)*i/90);if(view.group.visible){const point=meteorPoint(s,s.since+(s.until-s.since)*i/90)!;assert(view.rock.position.distanceTo(new T.Vector3(...point))<1e-8);assert(view.lightning.hot.count<8192);}
  }
 }
 view.update(undefined,0);assert(!view.group.visible);view.dispose();motion.clear();c.disposeEffects();
});
test('meteor fire, wake and animation stay identical with real epoch timestamps',()=>{
 const view=new MetaKnightCosmicMeteorView(new T.Group()),s=fixture(),m=s.cosmicMeteor!;
 const snapshot=()=>{
  const meshes:{matrix:number[];instances?:number[];clock?:number}[]=[];view.group.updateMatrixWorld(true);view.group.traverse(o=>{if(o instanceof T.Mesh){
   const material=o.material as T.Material;meshes.push({matrix:o.matrixWorld.elements.slice(),instances:o instanceof T.InstancedMesh?Array.from(o.instanceMatrix.array.slice(0,o.count*16)):undefined,clock:material instanceof T.ShaderMaterial?material.uniforms.clock?.value:undefined});
  }});return {meshes,light:view.light.intensity};
 };
 try{for(const stage of ['cosmic-meteor-draw','cosmic-meteor-cast','cosmic-meteor-return'] as const){
  s.stage=stage;s.since=stage==='cosmic-meteor-draw'?5000:stage==='cosmic-meteor-cast'?6500:7500;s.until=s.since+1500;
  if(stage==='cosmic-meteor-return')m.returned={at:s.since,from:[3,182,25],by:'a'};
  const now=s.since+(stage==='cosmic-meteor-return'?240:900);view.update(s,now);const expected=snapshot();
  for(const offset of [Date.UTC(2026,9,26),Date.UTC(2027,9,26)]){
   const shifted=structuredClone(s);shifted.since+=offset;shifted.until+=offset;shifted.cosmicMeteor!.at+=offset;if(shifted.cosmicMeteor!.returned)shifted.cosmicMeteor!.returned.at+=offset;if(shifted.cosmicLaunch)shifted.cosmicLaunch.at+=offset;
   view.update(shifted,now+offset);const actual=snapshot();assert.equal(actual.light,expected.light);assert.deepEqual(actual.meshes.map(mesh=>mesh.clock),expected.meshes.map(mesh=>mesh.clock));assert.equal(actual.meshes.length,expected.meshes.length);
   // Subtracting fractional trail ages from epoch milliseconds rounds by up to .00025ms.
   for(let i=0;i<expected.meshes.length;i++)for(const key of ['matrix','instances'] as const){
    const before=expected.meshes[i][key],after=actual.meshes[i][key];if(!before||!after){assert.equal(after,before);continue;}
    assert.equal(after.length,before.length);assert(before.every((value,j)=>Math.abs(after[j]-value)<.001),`${stage}: ${key} of mesh ${i} changed with the timestamp origin`);
   }
  }
 }}finally{view.dispose();}
});

test('recorded meteor cues are stereo PCM with silent edges and headroom',async()=>{
 for(const kind of ['draw','throw','reflect','impact']){const b=await readFile(new URL(`../public/audio/meta-knight-cosmic/cosmic-meteor-${kind}.wav`,import.meta.url));assert.equal(b.readUInt16LE(22),2);assert.equal(b.readUInt32LE(24),44100);let peak=0,energy=0;for(let i=44;i<b.length;i+=2){const v=b.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(v));energy+=v*v;}assert(peak>.4&&peak<=.701);assert(energy>10);assert.equal(b.readInt16LE(44),0);assert.equal(b.readInt16LE(b.length-2),0);}
});
