import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3,Mesh,Box3,Raycaster} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KNIGHT,startKnightBattle,setKnightPhase,advanceKnightBattle,knightAttack,knightPartyHearts,type KnightActor} from '../src/meta-knight-battle';
import {spawnKnightLifeFirefly,knightLifeFireflyPoint,lifeFireflyDuration} from '../src/meta-knight-life-firefly';
import {MetaKnightLifeFireflyView} from '../src/meta-knight-life-firefly-view';
import {COSMIC} from '../src/meta-knight-cosmic';
import {SHIELD} from '../src/meta-knight-shield';
import {knightSound} from '../src/meta-knight-sounds';

function fixture(count=1){const actors:KnightActor[]=Array.from({length:count},(_,i)=>({id:String(i),p:[i,0,-2],yaw:Math.PI,available:true}));const s=startKnightBattle(actors,'0',1000)!;return {s,actors};}
function hitFixture(count=1,hp=5){
 const {s,actors}=fixture(count);Object.assign(s,{stage:'rest',since:4000,until:40000,checked:4000,from:[0,0,0],to:[0,0,0]});spawnKnightLifeFirefly(s,4000);
 if(s.teamHp!==undefined)s.teamHp=hp;for(const p of Object.values(s.players))p.hp=hp;
 const point=knightLifeFireflyPoint(s,4160)!;for(const actor of actors){actor.p=[point[0],0,point[2]-2];actor.yaw=0;}
 return {s,actors};
}

test('one visitor appears in the second attack part of each phase and never repeats in that encounter',()=>{
 const {s,actors}=fixture();actors[0].p=[30,0,0];let now=s.until;
 advanceKnightBattle(s,actors,now,'0');assert(!Object.hasOwn(s,'lifeFirefly'),'no visitor during the first sword sequence');
 for(const phase of [1,2,3,4] as const){
  if(phase!==1){setKnightPhase(s,phase,actors,now,phase===4?1:undefined);}
  let guard=0;
  while(s.lifeFirefly?.phase!==phase&&guard++<80){now=s.until;advanceKnightBattle(s,actors,now,'0');}
  assert.equal(s.lifeFirefly?.phase,phase);assert.equal(s.stage,phase===1?'jump-warn':phase===2?'dive-warn':phase===3?'shield':'cosmic-meteor-draw');
  const at=s.lifeFirefly!.at;spawnKnightLifeFirefly(s,now+1);assert.equal(s.lifeFirefly!.at,at);
  const restored=JSON.parse(JSON.stringify(s));spawnKnightLifeFirefly(restored,now+80000);assert.equal(restored.lifeFirefly.at,at,'persistence cannot reroll or respawn');
 }
 assert.equal(s.lifeFireflyPhases,15);
 const fresh=startKnightBattle([{...actors[0],p:[0,0,-2]}],'0',now+1000)!;assert.equal(fresh.lifeFireflyPhases,undefined);
});

test('all angles cross to the opposite rim, clear the dome, preserve altitude in space and expire at the invisible boundary',()=>{
 for(const phase of [1,2,3,4] as const)for(let seed=0;seed<32;seed++){
  const {s}=fixture();s.id+=seed*7919;s.phase=phase;s.stage=phase===3?'shield':'rest';s.from=s.to=[0,phase===4?COSMIC.height:0,0];spawnKnightLifeFirefly(s,4000);
  const first=knightLifeFireflyPoint(s,4000)!;assert(Math.abs(Math.hypot(first[0],first[2])-46)<1e-8);
  for(let i=0;i<201;i++){const p=knightLifeFireflyPoint(s,4000+lifeFireflyDuration*i/201)!;const radius=Math.hypot(p[0],p[2]);assert(radius>=SHIELD.radius+2&&radius<=46.00001);assert(Math.abs(p[1]-(phase===4?181.35:1.35))<1e-8);}
  const end=knightLifeFireflyPoint(s,4000+lifeFireflyDuration-.001)!;assert(Math.hypot(end[0]+first[0],end[2]+first[2])<.0001);
  assert.equal(knightLifeFireflyPoint(s,4000+lifeFireflyDuration),undefined);
 }
});

test('the higher carrier is still hittable without jumping anywhere along an unobstructed crossing in all four phases',()=>{
 for(const phase of [1,2,3,4] as const)for(let sample=1;sample<10;sample++){
  const {s,actors:[actor]}=fixture();Object.assign(s,{phase,hp:phase===3?3:12,stage:'rest',since:4000,until:40000,checked:4000,from:[0,phase===4?180:0,0],to:[0,phase===4?180:0,0]});spawnKnightLifeFirefly(s,4000);
  const impact=4000+lifeFireflyDuration*sample/10,point=knightLifeFireflyPoint(s,impact)!;actor.p=[point[0],phase===4?180:0,point[2]-2];actor.yaw=0;
  assert(knightAttack(s,actor,impact-160));advanceKnightBattle(s,[actor],impact);assert(s.lifeFirefly!.hit,`phase ${phase}, sample ${sample} must allow a grounded strike`);
 }
});

test('a moving boss on the path is flown over with body and wing clearance',()=>{
 const {s}=fixture();s.stage='rest';spawnKnightLifeFirefly(s,4000);const at=9000,point=knightLifeFireflyPoint(s,at)!;
 s.from=s.to=[point[0],0,point[2]];const diverted=knightLifeFireflyPoint(s,at)!;assert(diverted[1]>=12);assert.equal(diverted[0],point[0]);assert.equal(diverted[2],point[2]);
});

test('a normal attack drops exactly one heart, heals one spent life or stores a bonus above five in solo and multiplayer',()=>{
 for(const count of [1,2,4])for(const hp of [2,4,5,8]){
  const {s,actors}=hitFixture(count,hp);
  for(const actor of actors)assert(knightAttack(s,actor,4001));advanceKnightBattle(s,actors,4160);
  assert.equal(knightPartyHearts(s),hp+1);assert(Object.values(s.players).every(p=>p.hp===hp+1));assert(s.lifeFirefly!.hit);assert.equal(s.hp,12);
  const snapshot=JSON.parse(JSON.stringify(s));advanceKnightBattle(snapshot,actors,4200);advanceKnightBattle(snapshot,actors,4800);
  assert.equal(knightPartyHearts(snapshot),hp+1,'repeated packets, attackers and wakeups never duplicate the reward');
  assert.equal(knightLifeFireflyPoint(snapshot,4200),undefined);
 }
});

test('a visitor still accepts normal attacks when a reflected meteor quickly advances to another cosmic attack',()=>{
 const {s,actors:[actor]}=fixture();s.phase=4;Object.assign(s,{stage:'cosmic-hit',since:4000,until:40000,checked:4000,from:[0,180,0],to:[0,180,0]});spawnKnightLifeFirefly(s,4000);
 const point=knightLifeFireflyPoint(s,4160)!;actor.p=[point[0],180,point[2]-2];actor.yaw=0;
 assert(knightAttack(s,actor,4001));advanceKnightBattle(s,[actor],4160);assert.equal(knightPartyHearts(s),6);
});

test('spectators, withdrawn players, stale attacks, wrong facing, distant and high attacks earn no life',()=>{
 for(const mode of ['spectator','withdrawn','stale','facing','distance','height'] as const){
  const {s,actors:[actor]}=hitFixture();
  if(mode==='spectator')actor.id='outside';if(mode==='withdrawn')s.players[actor.id].withdrawn=true;
  if(mode==='facing')actor.yaw=Math.PI;if(mode==='distance')actor.p[0]+=12;if(mode==='height')actor.p[1]=10;
  knightAttack(s,actor,mode==='stale'?3000:4001);advanceKnightBattle(s,[actor],4160);
  assert.equal(knightPartyHearts(s),5,mode);assert.equal(s.lifeFirefly!.hit,undefined,mode);
 }
});

test('bonus lives are consumed by ordinary damage and a new attempt resets to five',()=>{
 const {s,actors:[actor]}=hitFixture(2);knightAttack(s,actor,4001);advanceKnightBattle(s,[actor],4160);assert.equal(s.teamHp,6);
 Object.assign(s,{stage:'slash',since:5000,until:10000,from:[0,0,0],to:[0,0,0],yaw:0});actor.p=[0,0,8];advanceKnightBattle(s,[actor],5100);assert.equal(s.teamHp,5);
 actor.p=[0,0,-2];assert.equal(knightPartyHearts(startKnightBattle([actor],'0',9000)),5);
});

test('the real firefly holds the new shared heart, animates its drop, deduplicates sound and leaves cached assets intact',async()=>{
 const bytes=await readFile(new URL('../public/models/firefly-animated.glb',import.meta.url)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const cues:string[]=[],view=new MetaKnightLifeFireflyView(gltf,k=>cues.push(k));const {s,actors:[actor]}=hitFixture();
 view.update(s,4000,.1);assert(view.group.visible);assert(view.heart.model.getObjectByName('Health_heart_body'));assert.equal(view.heart.group.parent?.name,'Motion');
 const wing=view.firefly.object.getObjectByName('Right_Wing')!;assert(wing.scale.x>.99,'wings are spread on the very first frame');const rotation=wing.quaternion.clone();view.update(s,4020,0);assert(wing.quaternion.angleTo(rotation)>.1,'the flight clock keeps flapping even when rendering with dt=0');
 const motion=view.firefly.object.getObjectByName('Motion')!;
 assert(Math.abs(view.heart.model.getWorldScale(new Vector3()).x-1.26)<1e-8,'carried and dropped hearts are 1.5 times their previous size');
 for(let frame=0;frame<80;frame++){
  view.update(s,4000+frame*230,0);view.group.updateWorldMatrix(true,true);assert(new Box3().setFromObject(view.heart.model,true).min.y>.65,'the entire larger heart stays above the floor throughout flight');
  for(const side of [-1,1])for(let i=0;i<3;i++){
   const foot=view.firefly.object.getObjectByName(`${side<0?'Left':'Right'}_Foot_${i}`)!.getWorldPosition(new Vector3()),local=view.heart.model.worldToLocal(foot.clone());
   const origin=view.heart.model.localToWorld(new Vector3(side*2,local.y,local.z)),direction=new Vector3(-side,0,0).transformDirection(view.heart.model.matrixWorld);
   const contact=new Raycaster(origin,direction).intersectObject(view.heart.model,true)[0];assert(contact&&contact.point.distanceTo(foot)<.005,`foot ${side}:${i} must grip the actual heart surface`);
  }
 }
 assert(view.buzzLevel(view.carrier.getWorldPosition(new Vector3()))>.9);
 knightAttack(s,actor,4001);advanceKnightBattle(s,[actor],4160);view.update(s,4160,.16);assert.equal(view.heart.group.parent,view.group);assert.equal(view.buzzLevel(new Vector3()),0,'wing hum stops on impact');
 assert(Math.abs(view.heart.model.getWorldScale(new Vector3()).x-1.26)<1e-8,'the released heart keeps its larger size');
 for(let age=0;age<1100;age+=20){view.update(s,4160+age,0);view.group.updateWorldMatrix(true,true);assert(new Box3().setFromObject(view.heart.model,true).min.y>.15,'the drop never clips the arena floor');}
 view.update(s,4300,.14);view.update(s,4400,.1);assert.deepEqual(cues,['life-firefly-hit']);view.update(s,5400,.1);assert.equal(view.group.visible,false);
 let disposed=false;gltf.scene.traverse(o=>{if(o instanceof Mesh)o.geometry.addEventListener('dispose',()=>disposed=true);});view.dispose();assert.equal(disposed,false);assert(motion);
 const sound=knightSound('life-firefly-hit');assert(sound.left.some(v=>Math.abs(v)>.05));assert(sound.left.every(Number.isFinite));
});
