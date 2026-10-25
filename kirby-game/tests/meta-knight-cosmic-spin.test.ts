import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KNIGHT,startKnightBattle,setKnightPhase,advanceKnightBattle,knightAttack,knightDanger,knightPosition,type KnightActor} from '../src/meta-knight-battle';
import {COSMIC,cosmicHeight,cosmicAirborne,cosmicOpening,cosmicControlsLocked} from '../src/meta-knight-cosmic';
import {COSMIC_SPIN,cosmicOrbs,cosmicOrbBirth,cosmicOrbCount,cosmicOrbLife,cosmicSpinAngle,cosmicSpinSpeed} from '../src/meta-knight-cosmic-spin';
import {refugeStar} from '../src/meta-knight-cosmic-refuge';
import {CharacterController} from '../src/controller';
import {MetaKnightBattleMotion} from '../src/meta-knight-battle-motion';
import {MetaKnightCosmicOrbs} from '../src/meta-knight-cosmic-orbs';
import {knightSound} from '../src/meta-knight-sounds';
import {COSMIC_SPIN_SOUNDS} from '../src/meta-knight-cosmic-spin-sounds';
import {knightBody,constrainKnightBody} from '../src/meta-knight-body';

const actor:KnightActor={id:'a',p:[0,0,-2],yaw:0,available:true};
function flight(){const s=startKnightBattle([actor],'a',1000)!;setKnightPhase(s,4,[actor],5000);let now=s.until;while(s.stage!=='cosmic-flight'){advanceKnightBattle(s,[actor],now);now=s.until;}return s;}
function spinning(){const s=flight(),a={...actor,p:[0,180,41] as [number,number,number]};advanceKnightBattle(s,[a],s.until);advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'cosmic-spin');return s;}

test('twelve seconds accelerate monotonically from 0.2 to 0.85 turns/s and deterministic releases leave the sword in straight lines',()=>{
 const s=spinning();assert.equal(s.until-s.since,12000);assert.equal(cosmicOrbCount,148);
 for(let i=0;i<120;i++){assert(cosmicSpinSpeed(i/10)<cosmicSpinSpeed((i+1)/10));assert(cosmicSpinAngle(i/10)<cosmicSpinAngle((i+1)/10));}
 assert(Math.abs(cosmicSpinAngle(12)/(2*Math.PI)-6.3)<1e-9);
 for(let id=0;id<cosmicOrbCount;id++){
  const birth=cosmicOrbBirth(id);assert(Math.abs(cosmicSpinAngle(birth)-id*COSMIC_SPIN.stepAngle)<1e-9);
  const t=s.since+birth*1000,shot=cosmicOrbs(s,t+.001).find(shot=>shot.id===id)!;
  assert(shot);assert(Math.abs(Math.hypot(shot.p[0],shot.p[2])-COSMIC_SPIN.emitRadius)<.0001);
  const later=cosmicOrbs(s,t+500).find(shot=>shot.id===id)!;assert(Math.abs(later.distance-COSMIC_SPIN.emitRadius-6.75)<1e-9);
  assert(Math.abs(shot.p[0]*later.p[2]-shot.p[2]*later.p[0])<1e-8);assert.equal(shot.p[1],181.5);
 }
 const copy=structuredClone(s);for(const t of [100,3733,9999])assert.deepEqual(cosmicOrbs(s,s.since+t),cosmicOrbs(copy,s.since+t));
});
test('the dense spiral leaves real dodge gaps, reaches every stationary outer heading, and the blade closes the inner blind spot',()=>{
 const s=spinning(),combined=COSMIC_SPIN.orbRadius+KNIGHT.bodyRadius;
 for(const r of [30,41])assert(2*r*Math.sin(COSMIC_SPIN.stepAngle/2)>combined*2+1.2,'clear room for a whole character between adjacent rays');
 for(const r of [12,25,41])for(let degrees=0;degrees<360;degrees+=2){
  const angle=degrees*Math.PI/180,p:[number,number,number]=[Math.sin(angle)*r,180,Math.cos(angle)*r];
  const hit=Array.from({length:cosmicOrbCount},(_,id)=>{const arrival=s.since+(cosmicOrbBirth(id)+(r-COSMIC_SPIN.emitRadius)/COSMIC_SPIN.speed)*1000;return knightDanger({...s,stage:arrival>=s.until?'cosmic-open':'cosmic-spin'},actorWith(p),arrival,arrival-1);}).some(Boolean);
  assert(hit,`${r}m / ${degrees}°: standing still cannot be a permanent safe lane`);
 }
 for(const r of [2.6,4,8])for(let degrees=0;degrees<360;degrees+=30){const angle=degrees*Math.PI/180,p:[number,number,number]=[Math.sin(angle)*r,180,Math.cos(angle)*r];let hit=false;for(let i=0;i<COSMIC_SPIN.spinMs/50;i++){if(knightDanger(s,actorWith(p),s.since+i*50,s.since+(i-1)*50)){hit=true;break;}}assert(hit,`${r}m: a visible blade sweep prevents point-blank camping`);}
 const p=cosmicOrbs(s,s.since+800)[0].p;assert(!knightDanger(s,actorWith([p[0],0,p[2]]),s.since+800),'spectators on the arena are not in the attack plane');
});
function actorWith(p:[number,number,number]){return {...actor,p};}
test('swept contact cannot tunnel through a player, immunity holds and resting keeps only the already outgoing balls',()=>{
 const s=spinning(),id=28,birth=cosmicOrbBirth(id),time=s.since+(birth+(30-COSMIC_SPIN.emitRadius)/COSMIC_SPIN.speed)*1000,angle=s.cosmicSpin!.yaw+id*COSMIC_SPIN.stepAngle,a=actorWith([Math.sin(angle)*30,180,Math.cos(angle)*30]);
 assert(knightDanger(s,a,time+70,time-70));const before=s.players.a.hp;advanceKnightBattle(s,[a],time);assert.equal(s.players.a.hp,before-1);advanceKnightBattle(s,[a],time+100);assert.equal(s.players.a.hp,before-1);
 const spinEnd=s.until;advanceKnightBattle(s,[a],spinEnd);assert(cosmicOpening(s));assert.equal(s.until-s.since,12000);assert(cosmicOrbs(s,spinEnd+500).length>0);
 assert.equal(cosmicOrbs(s,spinEnd+cosmicOrbLife*1000+1).length,0);assert.equal(knightPosition(s,s.since+5000)[1],180);
});
test('rest allows a reachable single hit, miss recycles the spin without replaying ascent, and six hits finish on the real arena',()=>{
 const s=spinning(),a=actorWith([0,180,4]);a.yaw=Math.PI;
 assert(COSMIC_SPIN.openMs/1000>((41-KNIGHT.meleeReach)/(2.72*COSMIC.flightSpeedMultiplier))+cosmicOrbLife+1,'ordinary phase-four flight from the rim has time after the last balls clear');
 assert(knightAttack(s,a,s.since+200));advanceKnightBattle(s,[a],s.since+400,'a');assert.equal(s.hp,6,'spinning is protected');
 advanceKnightBattle(s,[a],s.until,'a');advanceKnightBattle(s,[a],s.until,'a');assert.equal(s.stage,'cosmic-recover');advanceKnightBattle(s,[a],s.until,'a');assert.equal(s.stage,'cosmic-meteor-draw');
 let melee=0,counters=0;
 while(s.hp>0){
  let guard=0;while(s.stage!=='cosmic-open'&&s.hp>0&&guard++<48){if(s.stage==='cosmic-planet-sweep'){const star=refugeStar(s,s.until);a.p=[star[0],180,star[2]];}const hp:number=s.hp;advanceKnightBattle(s,[a],s.until,'a');counters+=hp-s.hp;}assert(guard<48);
  if(s.hp<=0)break;
  a.p=[0,180,4];a.yaw=Math.PI;const hp:number=Number(s.hp),at=s.since+3500;assert(knightAttack(s,a,at));advanceKnightBattle(s,[a],at+150,'a');assert.equal(s.hp,hp-1);melee++;assert.equal(s.stage,Number(s.hp)===0?'cosmic-descent':'cosmic-hit');
  if(s.hp>0){assert.equal(cosmicHeight(s,s.since),180);assert(!cosmicControlsLocked(s));assert.equal(cosmicOrbs(s,s.since).length,0);advanceKnightBattle(s,[a],s.until,'a');advanceKnightBattle(s,[a],s.until,'a');assert.equal(s.stage,'cosmic-meteor-draw');}
 }
 assert.equal(melee,3);assert.equal(counters,3); assert.equal(s.players.a.hits,6);let previous=180;for(let i=0;i<=100;i++){const y=cosmicHeight(s,s.since+(s.until-s.since)*i/100);assert(y<=previous&&y>=0);previous=y;}
 assert(cosmicControlsLocked(s));advanceKnightBattle(s,[a],s.until);assert.equal(s.stage,'won');assert.equal(knightPosition(s,s.since)[1],0);assert(!cosmicAirborne(s));
});
test('pooled orb presentation matches the shared positions and always stays within its allocation',()=>{
 const s=spinning(),view=new MetaKnightCosmicOrbs();let maximum=0;
 for(let ms=0;ms<COSMIC_SPIN.spinMs+cosmicOrbLife*1000+100;ms+=50){const state={...s,stage:ms>=COSMIC_SPIN.spinMs?'cosmic-open' as const:s.stage};view.update(state,s.since+ms);const shots=cosmicOrbs(state,s.since+ms).filter(o=>o.distance<=COSMIC_SPIN.outerRadius);assert.equal(view.cores.count,shots.length);assert(view.electricity.hot.count<8192);maximum=Math.max(maximum,shots.length);const matrix=new T.Matrix4(),point=new T.Vector3();shots.forEach((shot,i)=>{view.cores.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert(point.distanceTo(new T.Vector3().fromArray(shot.p))<.00002);});}
 assert(maximum>30&&maximum<60);assert(maximum<COSMIC_SPIN.capacity);view.update(undefined,0);assert(!view.group.visible);assert.equal(view.cores.count,0);view.dispose();
});
test('both hands stay on a clear horizontal blade; every real rig pose and exact release point matches the rules',async()=>{
 const bytes=await readFile(new URL('../public/models/meta-knight-animated.glb',import.meta.url)),asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const c=new CharacterController(asset.scene,asset.animations),motion=new MetaKnightBattleMotion(c.actor),s=spinning();c.actor.scale.setScalar(KNIGHT.modelScale);c.actor.position.y=180;
 const blade=c.actor.getObjectByName('Galaxia')!,body=c.actor.getObjectByName('Body_motion')!,hand=c.actor.getObjectByName('Left_gauntlet')!,point=new T.Vector3();let lastTip:T.Vector3|undefined;
 const at=s.since,C=COSMIC_SPIN;
 for(const [stage,duration,since] of [['cosmic-spin-warn',C.warnMs,at-C.warnMs],['cosmic-spin',C.spinMs,at],['cosmic-open',C.openMs,at+C.spinMs],['cosmic-recover',C.recoverMs,at+C.spinMs+C.openMs],['cosmic-spin-warn',C.warnMs,at+C.spinMs+C.openMs+C.recoverMs]] as const){
  for(let i=0;i<=40;i++){
   Object.assign(s,{stage,since,until:since+duration});motion.clear();c.setActivity('Fly');c.updateActivity(0);c.actor.rotation.y=0;motion.apply(s,i/40);c.actor.updateMatrixWorld(true);
   let closest=Infinity;blade.traverse(o=>{if(o instanceof T.Mesh){const positions=o.geometry.getAttribute('position');for(let j=0;j<positions.count;j+=3){point.fromBufferAttribute(positions,j);o.localToWorld(point);body.worldToLocal(point);closest=Math.min(closest,(point.x/.91)**2+(point.y/.91)**2+(point.z/.79)**2);}}});
   assert(closest>1.035,`${stage} ${i}: blade must stay outside the torso`);const tip=blade.localToWorld(new T.Vector3(-.315,2.05,0));
   assert(Math.abs(body.getWorldPosition(point).y-knightBody(s,since+duration*i/40).y)<.065,'the solid torso must follow the visible exhausted pose');
   if(i===0&&lastTip)assert(tip.distanceTo(lastTip)<.14,`${stage}: the sword does not jump between poses`);if(i===40)lastTip=tip;
   if(stage==='cosmic-spin'){
    assert(hand.getWorldPosition(new T.Vector3()).distanceTo(blade.localToWorld(new T.Vector3(0,-.23,.025)))<.001);
    assert(Math.abs(tip.y-181.5)<.001);assert(Math.abs(Math.hypot(tip.x,tip.z)-COSMIC_SPIN.emitRadius)<.001);
   }
  }
 }
 motion.clear();c.disposeEffects();
});
test('approaching the exhausted boss cannot put the player inside its lowered torso',()=>{
 const s=spinning();advanceKnightBattle(s,[actorWith([0,180,41])],s.until);const p:[number,number,number]=[0,180,3],now=s.since+4000;
 assert(constrainKnightBody(s,p,now));assert(p[2]>3.2&&p[2]<KNIGHT.meleeReach,'collision stays outside the model while keeping a counterattack reachable');assert(!constrainKnightBody(s,[...p],now));
});
test('new electric cues are finite, stereo, bounded and silent at their boundaries',()=>{
 for(const kind of COSMIC_SPIN_SOUNDS){const {left,right}=knightSound(kind,22050);if(kind==='cosmic-spin')assert.equal(left.length,22050*12);let peak=0,energy=0,stereo=0;for(let i=0;i<left.length;i++){assert(Number.isFinite(left[i]));assert(Number.isFinite(right[i]));peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));energy+=left[i]**2;stereo+=(left[i]-right[i])**2;}assert(peak<.7&&peak>.015);assert(energy/left.length>.00001);if(kind!=='cosmic-tired')assert(stereo>0);assert.equal(Math.abs(left[0]),0);assert.equal(Math.abs(right.at(-1)!),0);}
});
