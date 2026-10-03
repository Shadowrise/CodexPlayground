import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {Vector3} from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SkyTrail} from '../src/sky-trail';import {SKY_PLATFORMS as P,SKY_TRAIL_SITE as S,SKY_CHECKPOINTS,SKY_COLORS,rainbowHeight,SKY_RAINBOW_START as RS,SKY_RAINBOW_END as RE,platformThickness,skySurfaces} from '../src/sky-trail-layout';import {CharacterController} from '../src/controller';import {scoreOf} from '../src/score';import {sceneryClearance} from '../src/landmarks';
import {HedgeMaze} from '../src/maze';
import {actorState,restoreNetworkPlayer} from '../src/network-actors';
async function player(){const bytes=await readFile(new URL('../public/models/kirby-animated.glb',import.meta.url));const m=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return new CharacterController(m.scene,m.animations);}
const pos=(i:number)=>new Vector3(S.x+P[i].x,P[i].y,S.z+P[i].z);

test('online return restores growth, rewards and checkpoint without falling through its platform',async()=>{
 const c=await player();c.actor.position.copy(pos(SKY_CHECKPOINTS[1]));c.surfaceY=c.actor.position.y;c.skyCheckpoint=2;c.achievements.add('mill');c.grow();
 const state=actorState(c,'Вернулся',3);state.state='Idle';state.pose=[];
 const restored=await player(),trail=new SkyTrail();restoreNetworkPlayer(restored,state);trail.restorePosition(restored);
 assert.equal(restored.actor.scale.x,1.1);assert.equal(restored.fruitsEaten,1);assert.equal(scoreOf(restored),4);assert.equal(restored.skyCheckpoint,2);
 for(let i=0;i<60;i++){const previous=restored.actor.position.clone();restored.update(1/60,{forward:false,left:false,right:false});trail.apply(restored,previous,1/60);}
 assert(restored.actor.position.distanceTo(c.actor.position)<.001);assert.equal(restored.state,'Idle');
});
test('rainbow has seven bands and route steps are reachable by a normal single jump',()=>{assert.equal(SKY_COLORS.length,7);for(let i=1;i<P.length;i++){assert(P[i].y-P[i-1].y<=1.45);if(i!==RE)assert(Math.hypot(P[i].x-P[i-1].x,P[i].z-P[i-1].z)<6);}assert.equal(rainbowHeight(P[RS].x),P[RS].y);assert(Math.abs(rainbowHeight(P[RE].x)!-P[RE].y)<1e-8);assert(!sceneryClearance(S.x,S.z));});
test('jump through all platforms, walk the rainbow, collect once and return via leaves',async()=>{
 const c=await player(),trail=new SkyTrail();c.actor.position.copy(trail.entry);assert(!trail.start(c));
 for(let step=0;step<P.length;step++){
  const start=c.actor.position.clone(),end=pos(step);
  if(step===RE){for(let i=1;i<=150;i++){const previous=c.actor.position.clone();c.actor.position.lerpVectors(start,end,i/150);c.actor.position.y=previous.y;trail.apply(c,previous,1/60);}assert(Math.abs(c.actor.position.y-end.y)<.01);continue;}
  for(let i=0;i<210;i++){const previous=c.actor.position.clone();c.update(1/60,{forward:false,left:false,right:false,jump:i===0});const u=Math.min(1,(i+1)/45);c.actor.position.x=start.x+(end.x-start.x)*u;c.actor.position.z=start.z+(end.z-start.z)*u;trail.apply(c,previous,1/60);}
  assert(Math.abs(c.actor.position.y-end.y)<.02,`land on step ${step}: ${c.actor.position.y} vs ${end.y}`);
 }
 assert.equal(c.skyCheckpoint,4);assert(c.achievements.has('skyStar'));assert.equal(scoreOf(c),3);trail.apply(c,c.actor.position.clone(),.016);assert.equal(scoreOf(c),3);
 assert(trail.start(c));for(let i=0;i<300;i++)trail.update(1/60,c);assert(!trail.active);assert(c.actor.position.distanceTo(trail.landing)<.01);
});
test('falling off keeps checkpoints and lower trampoline returns to the last reached one',async()=>{const c=await player(),trail=new SkyTrail();c.skyCheckpoint=2;c.actor.position.copy(trail.lower.position).add(trail.group.position);assert(trail.start(c));for(let i=0;i<240;i++)trail.update(1/60,c);assert(c.actor.position.distanceTo(pos(SKY_CHECKPOINTS[1]))<.01);
 c.actor.position.x=S.x+20;c.actor.position.z=S.z+5;for(let i=0;i<180;i++){const previous=c.actor.position.clone();c.update(1/60,{forward:false,left:false,right:false});trail.apply(c,previous,1/60);}assert.equal(c.actor.position.y,0);assert.equal(c.skyCheckpoint,2);
 c.actor.position.copy(trail.lower.position).add(trail.group.position);assert(trail.start(c));for(let i=0;i<240;i++)trail.update(1/60,c);assert(c.actor.position.distanceTo(pos(SKY_CHECKPOINTS[1]))<.01);
});

test('44 platforms reach double height and every pair has a visible gap',()=>{
 assert.equal(P.length,44);assert(Math.abs(P.at(-1)!.y-45.6)<1e-8);
 for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){
  const a=P[i],b=P[j],half=(a.size+b.size)/2;
  const separated=Math.abs(a.x-b.x)>=half+.1||Math.abs(a.z-b.z)>=half+.1||a.y+.1<=b.y-platformThickness(j)||b.y+.1<=a.y-platformThickness(i);
  assert(separated,`platforms ${i} and ${j} intersect or touch`);
 }
});

test('recovery trampoline unlocks at first checkpoint and launches only after landing on fabric',async()=>{
 const c=await player(),sounds:string[]=[],trail=new SkyTrail(k=>sounds.push(k));const pad=trail.lower.position.clone().add(trail.group.position);
 c.actor.position.copy(pad).add(new Vector3(2,0,0));assert.equal(trail.prompt(c),'');assert(!trail.start(c));
 c.skyCheckpoint=1;assert(trail.start(c));trail.update(.3,c);assert(c.actor.position.y<2);assert.equal(sounds.length,0);
 trail.update(.25,c);assert(Math.hypot(c.actor.position.x-pad.x,c.actor.position.z-pad.z)<.001);assert(Math.abs(c.actor.position.y-.56)<.001);
 trail.update(.09,c);assert(c.actor.position.y<.56);assert.equal(sounds.length,0);
 trail.update(.1,c);assert.deepEqual(sounds,['bounce']);for(let i=0;i<200;i++)trail.update(1/60,c);
 assert(c.actor.position.distanceTo(pos(SKY_CHECKPOINTS[0]))<.01);assert(!trail.active);
 assert(trail.lower.position.x<P[0].x);const sign=trail.group.getObjectByName('Sky Trail entrance sign')!;assert.equal(sign.position.x,P[0].x);assert(sign.position.z<P[0].z);
 assert.equal(trail.lower.position.z,P[0].z);assert(P[0].x-trail.lower.position.x-P[0].size/2-1.71>1);
 assert.equal(sign.rotation.y,Math.PI);assert.equal(trail.landing.x,S.x);assert.equal(trail.landing.z,S.z);
});

test('decorations are hollow geometric ornaments outside the platforms, with the first raised high',()=>{
 const trail=new SkyTrail(),ornaments=trail.group.children.filter(o=>o.name==='Sky Trail decorative ornament');assert.equal(ornaments.length,56);
 assert(ornaments[0].position.y>=10);
 for(const o of ornaments){assert(Math.hypot(o.position.x,o.position.z)>=20.99);assert.equal((o as any).geometry.type,'TorusGeometry');for(const p of P)assert(Math.hypot(o.position.x-p.x,o.position.z-p.z)>p.size/Math.sqrt(2)+1);}
});


test('summit star grants the maze power and glow for 30 seconds without unlocking the maze reward',async()=>{
 const c=await player(),trail=new SkyTrail(),maze=new HedgeMaze(),speed=c.speed;
 c.actor.position.copy(pos(P.length-1));c.surfaceY=c.actor.position.y;trail.restorePosition(c);
 trail.apply(c,c.actor.position.clone(),0);
 assert(c.achievements.has('skyStar'));assert(!c.achievements.has('star'));assert(!c.starBlessed);assert.equal(c.starCooldown,0);
 assert.equal(c.starRemaining,30);assert.equal(c.speed,speed*2);
 maze.update(0,c,false);
 const aura=c.actor.getObjectByName('Golden star blessing');assert(aura?.visible);
 const restored=await player();restoreNetworkPlayer(restored,actorState(c,'Summit',0));
 assert.equal(restored.starRemaining,30);assert.equal(restored.speed,speed*2);assert(!restored.starBlessed);
 maze.update(10,c,false);trail.apply(c,c.actor.position.clone(),0);
 assert.equal(c.starRemaining,20);assert.equal(scoreOf(c),3);
 maze.update(20,c,false);assert.equal(c.starRemaining,0);assert.equal(c.speed,speed);assert(!aura.visible);
});


test('support follows a 700% Kirby footprint on platform edges and rainbow, including turns',()=>{
 const i=P.length-1,p=P[i],edge=p.x+p.size/2;
 const on=(x:number,z:number,size:number,yaw=0)=>skySurfaces(x,z,size,yaw).some(s=>s.index===i);
 assert(on(edge+4,p.z,7));assert(!on(edge+4,p.z,1));
 assert(on(edge+6,p.z,7));assert(!on(edge+6,p.z,7,Math.PI/2));
 assert(!on(edge+7,p.z,7));
 // A diagonal corner outside the rounded footprint must not create phantom ground.
 assert(!on(edge+6,p.z+p.size/2+5,7));
 assert(skySurfaces(0,P[RS].z+4,7).some(s=>s.index===-1));
 assert(!skySurfaces(0,P[RS].z+4,1).some(s=>s.index===-1));
});

test('large Kirby lands with feet overlapping an edge and falls when shrinking removes contact',async()=>{
 const c=await player(),trail=new SkyTrail(),top=P.at(-1)!;
 c.actor.scale.setScalar(7);c.actor.position.copy(pos(P.length-1));c.actor.position.x+=top.size/2+4;
 c.flight.press();const previous=c.actor.position.clone();previous.y+=.5;c.actor.position.y-=.1;
 trail.apply(c,previous,1/60);assert.equal(c.actor.position.y,top.y);assert(!c.flight.active);
 for(let i=0;i<60;i++)trail.apply(c,c.actor.position.clone(),1/60);
 assert.equal(c.actor.position.y,top.y);
 c.actor.scale.setScalar(1);
 for(let i=0;i<10;i++)trail.apply(c,c.actor.position.clone(),1/60);
 assert(c.actor.position.y<top.y-.1);
});

test('expanded footprint still cannot land from below or while rising through a platform',async()=>{
 const c=await player(),trail=new SkyTrail(),top=P.at(-1)!;
 c.actor.scale.setScalar(7);c.actor.position.copy(pos(P.length-1));c.actor.position.x+=top.size/2+4;c.flight.press();
 const previous=c.actor.position.clone();previous.y=top.y-1;c.actor.position.y=top.y+.1;
 trail.apply(c,previous,1/60);assert.equal(c.actor.position.y,top.y+.1);assert(c.flight.active);
});
