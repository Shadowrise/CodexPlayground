import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Vector3, MeshStandardMaterial, Raycaster } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterController, type Input } from '../src/controller';
import { MountainLedges } from '../src/mountain-ledges';
import { MOUNTAIN_STEPS as STEPS, MOUNTAIN_SUMMIT as SUMMIT, MOUNTAIN_MAIN_STEP_COUNT as MAIN_COUNT, MOUNTAIN_LEDGE_YAW as YAW, mountainWorld, mountainFace } from '../src/mountain-ledges-layout';
import { createCoasterCurve } from '../src/coaster';
import { insideMeadow } from '../src/world-bounds';
import { createMountainTexture } from '../src/mountain-texture';
import { createMountains } from '../src/mountains';
import { mountainSurfaceHeight } from '../src/mountain-surface';
const idle: Input = { forward: false, left: false, right: false };
async function player() {
  const bytes = await readFile(new URL('../public/models/kirby-animated.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return new CharacterController(gltf.scene, gltf.animations);
}
const position = (p: typeof SUMMIT) => { const xy = mountainWorld(p.tangent, p.radial); return new Vector3(xy.x, p.y, xy.z); };
function tick(world: MountainLedges, c: CharacterController, dt: number, input = idle) {
  c.positionConstraint=world.constrainTravel;
  const previous = c.actor.position.clone(); world.update(dt, [c]); c.update(dt, input); world.apply(c, previous, dt);
}

test('100% Kirby can fly between distant slope ledges using two real jump presses and ordinary forward speed', async () => {
  const c = await player(), world = new MountainLedges(); c.actor.position.copy(world.entry);
  for (const [i, p] of [...STEPS.slice(0, MAIN_COUNT), SUMMIT].entries()) {
    const target = position(p), from = c.actor.position.clone();
    c.yaw = Math.atan2(target.x - from.x, target.z - from.z); c.actor.rotation.y = c.yaw;
    // Correct the heading with normal steering when the uneven slope deflects it.
    const towards=()=>{
      const dx=target.x-c.actor.position.x,dz=target.z-c.actor.position.z;
      const delta=Math.atan2(Math.sin(Math.atan2(dx,dz)-c.yaw),Math.cos(Math.atan2(dx,dz)-c.yaw));
      return {...idle,forward:Math.hypot(dx,dz)>.055,steer:Math.max(-1,Math.min(1,delta*10))};
    };
    if(i>0)for(let frame=0;frame<13;frame++)tick(world,c,1/60,towards());
    for (let frame = 0; frame < 240; frame++) {
      tick(world, c, 1 / 60, { ...towards(), jump: frame === 0||frame===18 });
    }
    assert(Math.abs(c.actor.position.y - p.y) < .03, `double jump lands on ledge ${i + 1}: ${c.actor.position.y} versus ${p.y}`);
    assert(!c.flight.active); assert.equal(c.actor.scale.x, 1); assert.equal(c.fruitBoost.multiplier, 1);
  }
  for (let i = 0; i < 300; i++) tick(world, c, 1 / 60);
  assert.equal(c.actor.position.y, SUMMIT.y, 'the summit never retracts');
  assert(!insideMeadow(c.actor.position,1),'the course reaches the existing slope beyond the meadow border');
});

test('three seconds of standing retract the rock under Kirby and gravity drops him to the meadow', async () => {
  const c = await player(), world = new MountainLedges(); c.actor.position.copy(position(STEPS[1])); world.apply(c, c.actor.position.clone(), 0);
  world.update(2.99, [c]); assert.equal(world.steps[1].phase, 'ready');
  world.update(.01, [c]); assert.equal(world.steps[1].phase, 'retracting'); assert.equal(world.steps[1].slide, 0);
  const oldZ = world.steps[1].mesh.position.z;
  for (let frame = 0; frame < 40; frame++) tick(world, c, 1 / 60);
  assert(world.steps[1].mesh.position.z > oldZ); assert(c.actor.position.y < STEPS[1].y - .1);
  for (let frame = 0; frame < 180; frame++) tick(world, c, 1 / 60);
  assert.equal(c.actor.position.y, 0); assert.equal(c.surfaceY, 0);
  assert.equal(world.steps[1].phase, 'hidden'); assert(!world.steps[1].mesh.visible);
  world.update(2.1); assert.equal(world.steps[1].phase, 'ready'); assert(world.steps[1].mesh.visible); assert.equal(world.steps[1].slide, 0);
});

test('jumping resets continuous standing and an already retracting step does not pull Kirby into the mountain', async () => {
  const c = await player(), world = new MountainLedges(); c.actor.position.copy(position(STEPS[0])); world.apply(c, c.actor.position.clone(), 0);
  world.update(2.95, [c]); const previous = c.actor.position.clone(); c.update(1 / 60, { ...idle, jump: true }); world.update(1 / 60, [c]); world.apply(c, previous, 1 / 60);
  assert.equal(world.steps[0].standing, 0); assert.equal(world.steps[0].phase, 'ready'); assert(c.flight.active);
  c.setActivity('Idle'); c.actor.position.copy(position(STEPS[0])); tick(world, c, 1 / 60);
  world.update(3, [c]); const x = c.actor.position.x, z = c.actor.position.z;
  tick(world, c, 1 / 60, { ...idle, jump: true });
  for (let frame = 0; frame < 25; frame++) tick(world, c, 1 / 60);
  assert(c.actor.position.y > STEPS[0].y); assert(c.flight.active);
  assert.equal(c.actor.position.x, x); assert.equal(c.actor.position.z, z);
});

test('undersides cannot catch an ascending jump and walking off uses gravity', async () => {
  const c = await player(), world = new MountainLedges(); c.actor.position.copy(position(SUMMIT)); c.actor.position.y = SUMMIT.y - .6;
  const previous = c.actor.position.clone(); c.flight.press(); c.actor.position.y = SUMMIT.y + .1; world.apply(c, previous, 1 / 60);
  assert.equal(c.actor.position.y, SUMMIT.y + .1); assert(c.flight.active);
  c.setActivity('Idle'); c.actor.position.copy(position(SUMMIT)); world.apply(c, c.actor.position.clone(), 0);
  const away = mountainWorld(SUMMIT.tangent - 18, SUMMIT.radial - 15); c.actor.position.x = away.x; c.actor.position.z = away.z;
  for (let i = 0; i < 120; i++) tick(world, c, 1 / 60);
  assert.equal(c.actor.position.y, 0); assert.equal(c.surfaceY, 0);
});

test('rounded steps support their visible arc and lose support as it retracts into the slope',async()=>{
  const c=await player(),world=new MountainLedges(),p=STEPS[0],ray=new Raycaster();
  const back=p.radial+p.depth/2,front=back-p.depth;
  const place=(tangent:number,radial:number)=>{const xy=mountainWorld(tangent,radial);c.actor.position.set(xy.x,p.y,xy.z);};
  const supported=()=>world.surfaces(c).some(s=>s.index===0);
  c.actor.scale.setScalar(.1);c.yaw=YAW;
  world.group.updateMatrixWorld(true);
  place(p.tangent,p.radial);
  assert(supported());ray.set(c.actor.position.clone().add(new Vector3(0,1,0)),new Vector3(0,-1,0));
  assert(Math.abs(ray.intersectObject(world.steps[0].mesh)[0].point.y-p.y)<.001);
  place(p.tangent+p.width/2-.12,front+.12);
  assert(!supported(),'empty corners around the arc cannot hold Kirby');
  ray.set(c.actor.position.clone().add(new Vector3(0,1,0)),new Vector3(0,-1,0));
  assert.equal(ray.intersectObject(world.steps[0].mesh).length,0);
  c.actor.scale.setScalar(1);place(p.tangent,p.radial);world.update(3.2,[c]);
  assert.equal(world.steps[0].phase,'retracting');c.actor.scale.setScalar(.1);
  place(p.tangent,front+.08);assert(!supported(),'the departed front edge no longer supports feet');
  place(p.tangent,front+world.steps[0].slide+.25);assert(supported(),'the remaining exposed arc still supports feet');
  place(p.tangent,back+.15);assert(!supported(),'the part buried inside the slope is not a landing surface');
});

test('the visible rock next to the uneven mountain supports feet while standing and turning before retraction',async()=>{
  const c=await player(),world=new MountainLedges(),ray=new Raycaster();let checked=0;
  world.group.updateMatrixWorld(true);
  for(const [i,p] of STEPS.entries())for(const size of [.3,1,2])for(const fraction of [-.75,-.5,-.25,0,.25,.5,.75]){
    const tangent=p.tangent+fraction*p.width/2;
    // Near the real summit some exposed slab edges have no cliff behind them;
    // this regression samples wall contacts, not those unsupported cross-sections.
    let face:number;try{face=mountainFace(p.y,tangent);}catch{continue;}
    const radial=face-.35*size,xy=mountainWorld(tangent,radial);
    const start=new Vector3(xy.x,p.y,xy.z);
    ray.set(start.clone().add(new Vector3(0,1,0)),new Vector3(0,-1,0));
    if(!ray.intersectObject(world.steps[i].mesh).some(hit=>Math.abs(hit.point.y-p.y)<.001))continue;
    for(const turn of [0,Math.PI/2,Math.PI,-Math.PI/2]){
      c.setActivity('Idle');c.actor.scale.setScalar(size);c.actor.position.copy(start);c.surfaceY=p.y;c.yaw=YAW+turn;c.actor.rotation.y=c.yaw;
      world.resetPlayer();world.restorePosition(c);world.networkApply(STEPS.map(()=>[0,0,0]));
      for(let frame=0;frame<12;frame++)tick(world,c,1/60);
      assert.equal(world.steps[i].phase,'ready');
      assert.equal(c.actor.position.y,p.y,`step ${i+1}, size ${size}, wall offset ${fraction}, turn ${turn}`);
      assert.equal(c.surfaceY,p.y);checked++;
    }
  }
  assert(checked>300,'cover the visible wall contact across the whole course and character sizes');
});

test('steps attach to the unchanged slope and the enlarged semicircular summit connects to the left rock', async () => {
  const map = createMountainTexture(), world = new MountainLedges(new MeshStandardMaterial({ map, vertexColors: true }));
  assert.equal((world.summit.material as MeshStandardMaterial).map, map);
  assert(STEPS.every(p => p.width < SUMMIT.width && p.depth < SUMMIT.depth));
  assert(STEPS.every(p=>p.shape==='semicircle'&&Math.abs(p.width/2-p.depth)<1e-8));
  assert(!world.group.getObjectByName('Mountain corner rock buttress'));
  assert.equal(world.group.children.length,STEPS.length+2);
  assert(Math.abs(Math.PI*(SUMMIT.width/2)**2/2-36.96*3)<1e-8);assert.equal(SUMMIT.shape,'semicircle');
  const left=mountainWorld(SUMMIT.tangent-SUMMIT.width/2,SUMMIT.radial+SUMMIT.depth/2);
  assert(mountainSurfaceHeight(left.x,left.z)>=SUMMIT.y-.001,'the left end meets the existing rock without an air gap');
  const curve = createCoasterCurve(), top = position(SUMMIT); let nearest = new Vector3(), distance = Infinity;
  for (let i = 0; i < 6000; i++) { const p = curve.getPointAt(i / 6000), d = p.distanceTo(top); if (d < distance) { distance = d; nearest = p; } }
  assert(distance < 80, `visible rail distance: ${distance}`);
  assert(STEPS.slice(1,MAIN_COUNT).every((p, i) => Math.hypot(p.tangent-STEPS[i].tangent,p.radial-STEPS[i].radial)>=8.4));
  assert.equal(SUMMIT.y,30.72);assert(STEPS.slice(0,MAIN_COUNT).every((p,i)=>Math.abs(p.y-(i+1)*2.56)<1e-8));
  const mountains=createMountains();mountains.updateMatrixWorld(true);const ray=new Raycaster();
  for(const p of STEPS.filter(p=>p.embedDepth===undefined)){const back=mountainWorld(p.tangent,p.radial+p.depth/2);ray.set(new Vector3(back.x,150,back.z),new Vector3(0,-1,0));const contact=ray.intersectObject(mountains)[0];assert(contact);assert(Math.abs(contact.point.y-p.y)<.001);assert(Math.abs(mountainSurfaceHeight(back.x,back.z)-p.y)<.001);}
  const c=await player(),back=SUMMIT.radial+SUMMIT.depth/2;
  const corner=mountainWorld(SUMMIT.tangent+SUMMIT.width/2-.1,back-SUMMIT.depth+.1);c.actor.position.set(corner.x,SUMMIT.y,corner.z);c.actor.scale.setScalar(.1);
  assert(!world.surfaces(c).some(s=>s.index===STEPS.length),'empty corners of the half-circle are not invisible rectangular ground');
  c.actor.scale.setScalar(1);
  for(const [i,p] of STEPS.slice(0,MAIN_COUNT).entries()){
    c.actor.position.copy(position(p));
    assert(!world.surfaces(c).some(s=>s.index===STEPS.length),`ledge ${i+1} stays outside the summit overhang, so the approach goes around its edge`);
  }
});

test('a single jump no longer reaches the first ledge, and leaving the slope restores meadow limits',async()=>{
  const c=await player(),world=new MountainLedges(),target=position(STEPS[0]);c.actor.position.copy(world.entry);c.yaw=Math.atan2(target.x-c.actor.position.x,target.z-c.actor.position.z);
  let high=0;for(let i=0;i<190;i++){tick(world,c,1/60,{...idle,jump:i===0,forward:i<40});high=Math.max(high,c.actor.position.y);}
  assert(high<STEPS[0].y);assert.equal(c.actor.position.y,0);
  c.actor.position.set(1000,0,1000);world.constrainTravel(c.actor.position,1);assert(insideMeadow(c.actor.position,1));
});

test('host-triggered traps synchronize and observers animate them without starting their own timers', async () => {
  const c = await player(), host = new MountainLedges(), observer = new MountainLedges(); c.actor.position.copy(position(STEPS[3]));
  host.update(3.2, [c]); observer.networkApply(host.networkState()); assert.deepEqual(observer.networkState(), host.networkState());
  host.update(.2); observer.update(.2, [], false); assert.equal(observer.steps[3].slide, host.steps[3].slide);
  observer.update(4, [c], false); assert.equal(observer.steps[0].phase, 'ready'); assert.equal(observer.steps[0].standing, 0);
});
