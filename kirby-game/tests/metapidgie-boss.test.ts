import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AnimationClip,AnimationMixer,PropertyBinding,Texture,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {parseChatCommand,commandSuggestions} from '../src/chat-commands';
import {startKnightBattle,advanceKnightBattle,knightAttack,knightPosition,setKnightPhase,type KnightActor} from '../src/meta-knight-battle';
import {knightHealthPhases} from '../src/meta-knight-health';
import {advanceKnightSideChoices} from '../src/meta-knight-side-choice';
import {requestKnightDuet} from '../src/meta-knight-duet';
import {createMetapidgieCombatFx} from '../src/metapidgie-combat-fx';
import {pidgeyCameraPoints} from '../src/metapidgie-camera';
import {fitKnightArenaCamera} from '../src/meta-knight-camera-fit';
import {PerspectiveCamera} from 'three';
const actor:KnightActor={id:'a',p:[0,0,-2],yaw:Math.PI,available:true};
const make=()=>startKnightBattle([structuredClone(actor)],'a',1000,'metapidgie')!;

test('portal 2 is solo-only and selects Pidgie without changing the original commands',()=>{
 assert.deepEqual(parseChatCommand('/portal 2',true,[]),{command:{kind:'portal',open:true,boss:'metapidgie'}});
 assert(parseChatCommand('/portal 2',false,[])?.error);
 assert.equal(commandSuggestions('/portal 2',true,[])[0].value,'/portal 2');
});
test('both melee hits and returned crescents advance into phase two and finish after eight hits',()=>{
 for(const reflected of [false,true]){
  const s=make();let now=2000;
  for(let hit=1;hit<=8;hit++){
   const a={...actor,p:[0,0,2] as KnightActor['p']};
   Object.assign(s,{stage:reflected?'return':'open',pattern:'sword',since:now,until:now+(reflected?450:2750),checked:now,from:[0,0,0],to:[0,0,0],openHit:false,returnFrom:[0,1.2,10]});
   if(reflected)advanceKnightBattle(s,[a],s.until);
   else {assert(knightAttack(s,a,now+20));advanceKnightBattle(s,[a],now+170);}
   assert.equal(s.hp,12-hit);assert.equal(s.stage,'stunned');
   advanceKnightBattle(s,[a],s.until);
   if(hit<8){assert.equal(s.stage,'get-up');advanceKnightBattle(s,[a],s.until);assert.equal(s.phase,hit<4?1:2);}
   else {assert.equal(s.stage,'won');assert.equal(s.phase,2);assert.deepEqual(knightHealthPhases(s).map(p=>p.remaining),[0,0]);}
   now+=5000;
  }
  const snapshot=structuredClone(s);advanceKnightBattle(s,[actor],now+60000);assert.equal(s.stage,snapshot.stage);assert.equal(s.hp,4);
 }
});
test('Pidgie supports two phases, rejects unfinished phases and preserves identity after side choice',()=>{
 const s=make();for(const phase of [3,4] as const)assert.equal(setKnightPhase(s,phase,[actor],2000),false);
 assert.equal(requestKnightDuet(s,actor,2000),false);assert(setKnightPhase(s,2,[actor],2000));assert.equal(s.phase,2);
 const heroes=[{...actor,metaKnight:true},{...actor,id:'b'}];
 const room={knightBattle:startKnightBattle(heroes,'a',1000,'metapidgie')!,knightSides:{a:'players' as const}};
 assert.equal(room.knightBattle.stage,'side-choice');advanceKnightSideChoices(room,heroes,2000);assert.equal(room.knightBattle.boss,'metapidgie');
 assert.deepEqual(knightHealthPhases(s).map(p=>[p.phase,p.maximum]),[[1,4],[2,4]]);
});
test('double-height authored leap and authoritative impact share one 1200ms clock',()=>{
 const s=make(),a={...actor,p:[25,0,0] as KnightActor['p']};s.players.a.invulnerable=1e12;
 let jump=false;
 for(let i=0;i<35;i++){advanceKnightBattle(s,[a],s.until);if(s.stage==='jump'){jump=true;assert.equal(s.until-s.since,1200);assert(knightPosition(s,s.since+540)[1]>14);assert.equal(knightPosition(s,s.until)[1],0);advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'open');assert.equal(knightPosition(s,s.since)[1],0);break;}}
 assert(jump);
});
test('all finished clips bind to the actual armored asset and keep finite natural rig transforms',async()=>{
 const bytes=await readFile(new URL('../public/models/metapidgie-animated.glb',import.meta.url)),loader=new GLTFLoader();
 loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));
 const model=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),data=JSON.parse(await readFile(new URL('../public/models/metapidgie-boss-phase1.json',import.meta.url),'utf8'));
 const clips=data.clips.map((clip:any)=>AnimationClip.parse(clip)) as AnimationClip[],mixer=new AnimationMixer(model.scene);
 assert.equal((model.asset as any).extras.workshopSha256,data.sourceSha256);assert.equal(clips.length,23);assert(!clips.some(c=>/cosmic|duet|dash|dive|star/.test(c.name)));
 for(const clip of clips)for(const track of clip.tracks){
  const binding=PropertyBinding.parseTrackName(track.name),node=PropertyBinding.findNode(model.scene,binding.nodeName);
  assert(node,`${clip.name}: missing ${binding.nodeName}`);
  if(binding.propertyName==='morphTargetInfluences')assert.equal(track.getValueSize(),(node as any).morphTargetInfluences.length,track.name);
 }
 for(const clip of clips){
  mixer.stopAllAction();const action=mixer.clipAction(clip).play();action.paused=true;
  for(let i=0;i<=20;i++){action.time=clip.duration*i/20;mixer.update(0);model.scene.updateMatrixWorld(true);model.scene.traverse(node=>{assert(node.matrixWorld.elements.every(Number.isFinite),`${clip.name}: ${node.name}`);if(node.type==='Bone')assert(Math.abs(node.quaternion.length()-1)<1e-4);});}
 }
 const tip=model.scene.getObjectByName('Metapidgie_beak_tip')!;assert(tip);assert(model.scene.getObjectByName('Head'));
 const fx=createMetapidgieCombatFx(model.scene,clips),camera=new (await import('three')).PerspectiveCamera();fx.update('Boss_slash',.125,.25,camera);assert(fx.glow>0);assert(fx.trails[0].root.visible);assert(tip.getWorldPosition(new Vector3()).toArray().every(Number.isFinite));
 fx.update('Boss_stunned',.01,1,camera,[.39,-1]);assert(fx.trails[0].root.visible,'a counterattack preserves the fading mist');assert(fx.glow>0);
 fx.update('Boss_stunned',.8,1,camera,[1.18,-1]);assert(!fx.trails[0].root.visible);assert.equal(fx.glow,0);
});
test('the higher leap fits below the HUD on desktop and portrait screens',()=>{
 const s=make();Object.assign(s,{stage:'jump-warn',pattern:'leap',to:[18,0,12]});
 for(const [w,h] of [[1280,900],[1920,1080],[390,844],[844,390]]){
  const points=pidgeyCameraPoints(s,[0,0,-9],[18,0,12]),fit=fitKnightArenaCamera(w,h,points,100,42,false),camera=new PerspectiveCamera(fit.fov,w/h,.1,1000),focus=new Vector3().fromArray(fit.focus);
  camera.position.copy(focus).add(new Vector3(0,.68,.82).multiplyScalar(fit.distance));camera.lookAt(focus);camera.updateMatrixWorld();
  for(const point of points){const q=new Vector3().fromArray(point).project(camera);assert(Math.abs(q.x)<1);assert(q.y<1-200/h+.01);assert(q.y>-1+84/h-.01);}
 }
});
