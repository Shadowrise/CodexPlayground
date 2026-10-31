import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Scene,Mesh,MeshStandardMaterial} from 'three';
import {CharacterController} from '../src/controller';
import {createPlayerModel} from '../src/player-model';
import {KIRBY_VARIANTS} from '../src/variants';
import {startKnightBattle,type KnightActor} from '../src/meta-knight-battle';
import {MetaKnightCelebrationView} from '../src/meta-knight-celebration-view';
import {knightCelebration} from '../src/meta-knight-celebration';
import {MetaKnightHelperView} from '../src/meta-knight-helper-view';
import {startHelperAbility,helperOrbs} from '../src/meta-knight-helper';
import {advanceKnightBattle} from '../src/meta-knight-battle';
import {MetaKnightDuetView} from '../src/meta-knight-duet-view';
import {knightDuetOpening} from '../src/meta-knight-duet';

function colours(c:CharacterController){const values:unknown[]=[];c.actor.traverse(o=>{if(o instanceof Mesh&&o.material instanceof MeshStandardMaterial)values.push([o.material.color.getHex(),o.material.emissive.getHex(),o.material.name.includes('gold')?undefined:o.material.emissiveIntensity]);});return values;}

async function models(){const b=await readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url)),gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');return ()=>{const rig=createPlayerModel(gltf,KIRBY_VARIANTS.find(v=>v[0]==='Meta Knight')!,undefined,false,gltf);return new CharacterController(rig.model,rig.clips);};}
function battle(){const actors:KnightActor[]=[{id:'hero',p:[0,0,-2],yaw:0,available:true},{id:'helper',p:[10,0,0],yaw:0,available:true,metaKnight:true,side:'boss'}];return {actors,s:startKnightBattle(actors,'hero',100000)!};}

test('real rig celebration is reversible, uses smiling eyes, stows both swords, hugs then skips',async()=>{
 const make=await models(),boss=make(),helper=make(),scene=new Scene();scene.add(boss.actor,helper.actor);boss.actor.scale.setScalar(3.3);
 const {s}=battle();s.stage='lost';s.celebration={at:100000,boss:[-5,0,-6],helpers:{helper:[10,0,0]}};
 const views=[new MetaKnightCelebrationView(boss),new MetaKnightCelebrationView(helper)];
 for(const now of [100000,101100,102200,103400,104000,107500,109000,114500]){
  views[0].clear();views[1].clear();views[0].update(s,'boss',now,1/60);views[1].update(s,'helper',now,1/60);scene.updateMatrixWorld(true);
  for(const c of [boss,helper]){assert.equal(c.actor.getObjectByName('Meta Knight friendship hearts'),undefined);assert.equal(c.actor.getObjectByName('Galaxia')!.visible,false);c.actor.traverse(o=>{assert(o.position.toArray().every(Number.isFinite));assert(o.quaternion.toArray().every(Number.isFinite));});}
  if(now===103400){assert(helper.actor.position.y>.6);assert(boss.actor.getObjectByName('Meta Knight smiling crescent eyes')!.visible);assert(!helper.actor.getObjectByName('Eyes_glow')!.visible);
   const right=boss.actor.getObjectByName('Right_gauntlet')!.getWorldPosition(new Vector3()),little=helper.actor.getObjectByName('Body_motion')!.getWorldPosition(new Vector3());assert(right.distanceTo(little)<2.6,'the big knight brings his actual hand around the small knight');
  }
 }
 views.forEach(v=>v.dispose());for(const c of [boss,helper]){assert(c.actor.getObjectByName('Galaxia')!.visible);assert(c.actor.getObjectByName('Eyes_glow')!.visible);assert.equal(c.actor.getObjectByName('Meta Knight friendship hearts'),undefined);c.disposeEffects();}
});
test('victory paths remain continuous through greeting, hug, circle and repeated hug boundaries',()=>{
 const {s}=battle();s.stage='lost';s.celebration={at:100000,boss:[-5,0,-6],helpers:{helper:[10,0,0]}};
 for(const id of ['boss','helper']){let before=knightCelebration(s,id,100000)!;for(let t=16;t<45000;t+=16){const next=knightCelebration(s,id,100000+t)!;assert(Math.hypot(...next.p.map((p,i)=>p-before.p[i]))<.35,`no teleport at ${id}:${t}`);before=next;}}
});
test('helper keeps its colours during target windows, uses yellow dash and six boss orbs, and has no target for projectiles',async()=>{
 const make=await models(),c=make(),scene=new Scene();scene.add(c.actor);const {s,actors}=battle();s.stage='rest';s.until=1e9;
 const baseline=colours(c),view=new MetaKnightHelperView(c,()=>{}),h=s.players.helper.helper!;startHelperAbility(s,actors[1],2,100000);const dash=h.cast!;
 view.update(s,'helper',100100,0);let yellow=false;c.actor.traverse(o=>{if(o instanceof Mesh&&o.material instanceof MeshStandardMaterial&&o.material.emissive.getHex()===0xffc233)yellow=true;});assert(yellow);
 view.update(s,'helper',dash.end+50,0);assert(view.target.group.visible);assert(view.target.group.getObjectByName('Floating downward target arrow'));assert(view.target.group.getObjectByName('Available target window countdown'));assert.deepEqual(colours(c),baseline,'the dash yellow clears without repainting the knight green');
 startHelperAbility(s,actors[1],3,dash.recoverUntil);const spin=h.cast!;view.update(s,'helper',spin.release+500,0);const cores=view.group.getObjectByName('Cosmic electric orb cores') as import('three').InstancedMesh;assert.equal(cores.count,6);assert.equal(helperOrbs(spin,spin.release+500).length,6);
 startHelperAbility(s,actors[1],1,spin.recoverUntil);const shot=h.cast!;view.update(s,'helper',shot.end+50,0);assert.equal(view.target.group.visible,false);
 view.dispose();c.disposeEffects();
});
test('the real duet rig raises both actual blades vertically and joins their tips with pooled gold lightning',async()=>{
 const make=await models(),boss=make(),helper=make(),scene=new Scene();scene.add(boss.actor,helper.actor);boss.actor.scale.setScalar(3.3);const {s,actors}=battle();s.stage='open';s.until=100200;s.from=s.to=[-8,0,-9];startHelperAbility(s,actors[1],4,100000);advanceKnightBattle(s,actors,s.until);advanceKnightBattle(s,actors,s.until);
 const baseline=[colours(boss),colours(helper)],view=new MetaKnightDuetView(scene,()=>{}),helperView=new MetaKnightHelperView(helper,()=>{});view.update(s,s.until-1,boss,helper);scene.updateMatrixWorld(true);
 for(const c of [boss,helper]){const blade=c.actor.getObjectByName('Galaxia')!,base=blade.localToWorld(new Vector3()),tip=blade.localToWorld(new Vector3(-.315,2.05,0));assert(tip.sub(base).normalize().y>.999,'the real sword points into the sky');assert(c.actor.position.toArray().every(Number.isFinite));}
 assert(view.bolts.hot.count>200);assert(view.light.intensity>0);assert.equal(view.group.getObjectByName('United thunderstorm danger disk 0')!.visible,false,'the cinematic charge has no damage disks');
 advanceKnightBattle(s,actors,s.until);view.update(s,s.since+50,boss,helper);assert.equal(view.group.getObjectByName('United thunderstorm danger disk 0')!.visible,true);
 let guard=0;while(s.duet?.stage!=='recover'&&guard++<15)advanceKnightBattle(s,actors,s.until,'hero');assert(guard<15);const now=s.since+20;view.clear();helperView.update(s,'helper',now,0);view.update(s,now,boss,helper);
 assert(knightDuetOpening(s));assert(helperView.target.group.visible);assert.deepEqual([colours(boss),colours(helper)],baseline,'both knights keep their original colours after the gold electricity clears');
 s.openHit=true;s.duet!.bossHit=now;view.clear();helperView.update(s,'helper',now+100,0);view.update(s,now+100,boss,helper);assert(!knightDuetOpening(s));assert(helperView.target.group.visible,'hitting the big knight keeps the little knight target available');
 helperView.dispose();view.dispose();assert.equal(scene.getObjectByName('Meta Knight united thunderstorm'),undefined);assert.equal(scene.getObjectByName('Big Meta Knight green recovery zone'),undefined);boss.disposeEffects();helper.disposeEffects();
});

test('both real rigs take strides by distance and move their feet on circle hops',async()=>{
 const make=await models(),boss=make(),helper=make();boss.actor.scale.setScalar(3.3);const {s}=battle();s.stage='lost';s.celebration={at:100000,boss:[-5,0,-6],helpers:{helper:[10,0,0]}};
 const pairs=[[boss,'boss'],[helper,'helper']] as const,views=pairs.map(([c])=>new MetaKnightCelebrationView(c)),cycles:number[]=[];
 pairs.forEach(([c,id],i)=>{
  const view=views[i],run=c.actions.get('Run')!;c.setActivity('Run');const rate=run.getEffectiveTimeScale();
  view.update(s,id,100100,1/60);const start=run.time;view.update(s,id,100150,1/60);cycles.push((run.time-start)/run.getClip().duration);assert(cycles[i]>0,'each running animation advances');
  view.clear();assert.equal(run.getEffectiveTimeScale(),rate,'normal movement rate is restored');
  view.update(s,id,108150,1/60);const foot=c.actor.getObjectByName('Left_foot_pivot')!,p=foot.position.clone(),q=foot.quaternion.clone();view.update(s,id,108400,1/60);assert(foot.position.distanceTo(p)>.02,`${id} foot moved ${foot.position.distanceTo(p)}`);assert(foot.quaternion.angleTo(q)>.05,`${id} foot rotated ${foot.quaternion.angleTo(q)}`);
 });
 assert(Math.abs(cycles[1]/cycles[0]-3.3)<.001,'the large knight takes proportionately fewer strides');views.forEach(v=>v.dispose());pairs.forEach(([c])=>c.disposeEffects());
});
