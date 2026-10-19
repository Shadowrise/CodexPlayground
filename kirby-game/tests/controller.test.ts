import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Quaternion, Vector3 } from 'three';
import { CharacterController, type Input } from '../src/controller';

const idle: Input = { forward: false, left: false, right: false };
test('an immediate resize replaces pending growth without changing earned fruits or points',async()=>{
 const c=await create();c.resizeTo(1.1);c.fruitsEaten=1;c.bonusPoints=3;c.eventPoints=5;
 c.resizeTo(.3,true);assert.equal(c.actor.scale.x,.3);assert.equal(c.savedSize,.3);assert.equal(c.speed,3.4);
 advance(c,1);assert.equal(c.actor.scale.x,.3,'the old admin growth cannot restore its size later');
 c.setActivity('Balloon');c.resizeTo(10,true);assert.equal(c.actor.scale.x,10);assert.equal(c.savedSize,10);
 assert.equal(c.fruitsEaten,1);assert.equal(c.bonusPoints,3);assert.equal(c.eventPoints,5);
 c.setActivity('Idle');advance(c,1);assert.equal(c.actor.scale.x,10);
});
test('air push keeps flight height and motion, then restores wing animation',async()=>{
 const c=await create();c.update(1/60,{...idle,jump:true});advance(c,.2,idle);c.update(1/60,{...idle,jump:true});advance(c,.25,idle);
 const height=c.actor.position.y;assert(c.flight.active);assert(height>2.7);
 c.update(1/60,{...idle,attack:true,forward:true});assert(c.attackHit);assert(c.flight.active);assert(c.actor.position.y>=height-.05);assert(c.actor.position.z>0);
 advance(c,.75,{...idle});assert(c.flight.active);assert(c.actor.position.y>2.7);assert(!c.attackHit);
});

test('pushing during ascent, descent and levitation never changes the gravity or hover timer',async()=>{
 for(const phase of ['ascent','descent','levitation']){
  const c=await create(),reference=await create();
  for(const player of [c,reference]){
   player.update(.01,{...idle,jump:true});advance(player,phase==='descent'?.4:.1);
   if(phase==='levitation'){player.update(.01,{...idle,jump:true});advance(player,.4);}
  }
  const arm=c.actor.getObjectByName('Right_shoulder')!,referenceArm=reference.actor.getObjectByName('Right_shoulder')!;
  let hits=0,armMotion=false;
  for(let frame=0;frame<90;frame++){
   c.update(1/60,{...idle,attack:true,forward:true});reference.update(1/60,{...idle,forward:true});
   hits+=Number(c.attackHit);armMotion ||= arm.quaternion.angleTo(referenceArm.quaternion)>.3;
   assert.deepEqual(c.flight.networkState(),reference.flight.networkState(),phase);
   assert(c.actor.position.distanceTo(reference.actor.position)<1e-8,phase);
  }
  assert.equal(hits,1,`${phase}: holding push emits only one hit`);assert(armMotion,`${phase}: both the animation and hit work in the air`);
 }
});

test('fresh push events are accepted even when the release fell between game frames',async()=>{
 const c=await create();c.update(.01,{...idle,jump:true});advance(c,.1);c.update(.01,{...idle,jump:true});advance(c,.4);
 c.update(.01,{...idle,attack:true,attackPressed:true});assert(c.attackHit);
 for(let i=0;i<12;i++){c.update(.01,{...idle,attack:true});assert(!c.attackHit,'a held key cannot create another push');}
 c.update(.01,{...idle,attack:true,attackPressed:true});assert(c.attackHit,'a new actual press is not confused with the previous hold');
 c.update(.01,{...idle,attack:true});assert(!c.attackHit);
});

test('a fresh second jump event enables flight without needing an idle frame between taps',async()=>{
 const c=await create();
 c.update(.05,{...idle,jump:true,jumpPressed:true});assert(!c.flight.levitating);
 c.update(.05,{...idle,jump:true,jumpPressed:true});assert(c.flight.levitating);assert.equal(c.state,'Fly');
});

test('analog steering runs continuously, stops immediately and scales with stick strength',async()=>{
  const c=await create();
  for(let i=0;i<60;i++)c.update(1/60,{...idle,forward:true,steer:.5});
  assert(Math.abs(c.yaw-Math.PI*.275)<1e-6);assert.equal(c.state,'Run');
  const yaw=c.yaw;
  c.update(1/60,{...idle,forward:true,steer:0});assert.equal(c.yaw,yaw);
  c.update(1/60,{...idle,steer:-1});assert.equal(c.state,'RotateRight');
  assert(Math.abs(c.yaw-(yaw-Math.PI*.55/60))<1e-6);
  for(let i=0;i<90;i++)c.update(1/60,{...idle,steer:-1});
  assert.equal(c.state,'RotateRight');assert(c.actions.get('RotateRight')!.isRunning());
});

test('running, sprinting and backing turn without losing movement or animation cadence',async()=>{
  for(const mode of ['run','sprint','backward']) {
    const c=await create();
    const input={...idle,left:true,forward:mode!=='backward',backward:mode==='backward',sprint:mode==='sprint'};
    const speed=mode==='backward'?c.backwardSpeed:c.speed*(mode==='sprint'?2:1);
    for(let i=0;i<60;i++) {
      const before=c.actor.position.clone();c.update(1/60,input);
      assert(Math.abs(c.actor.position.distanceTo(before)-speed/60)<1e-7);
      assert.equal(c.state,mode==='backward'?'WalkBackward':'Run');
    }
    assert(Math.abs(c.yaw-198*Math.PI/180)<1e-6);
    if(mode==='sprint')assert.equal(c.actions.get('Run')!.getEffectiveTimeScale(),2);
    c.update(1/60,{...idle,left:true});assert.equal(c.state,'RotateLeft');
  }
});

test('swallow boosts speed without growth and immediately unlocks movement and jumping', async()=>{
  const c=await create();
  advance(c,.95,{...idle,eat:true});assert.equal(c.state,'Eat');
  c.eatFruit();assert.equal(c.actor.scale.x,1);
  c.update(1/60,{...idle,forward:true});
  assert.equal(c.state,'Run');assert(c.actor.position.z>0);
  assert.equal(c.speed,3.4*1.2);
  for(let i=0;i<30;i++){
    c.update(1/60,{...idle,forward:true});
    assert.equal(c.actor.scale.x,1);
  }
  assert.equal(c.actor.scale.x,1);
  c.update(1/60,{...idle,jump:true});assert.equal(c.state,'Jump');
});
async function create() {
  const bytes = await readFile(new URL('../public/models/kirby-animated.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return new CharacterController(gltf.scene, gltf.animations);
}
function advance(c: CharacterController, seconds: number, input = idle) {
  for (let i = 0; i < Math.round(seconds * 60); i++) c.update(1 / 60, input);
}
test('actual GLB loads and forward movement uses Run', async () => {
  const c = await create();
  assert.equal(c.actions.size, 12);
  assert(c.actions.has('Swim'));
  advance(c, 1, { ...idle, forward: true });
  assert.equal(c.state, 'Run');
  assert(Math.abs(c.actor.position.z - c.speed) < 1e-6);
  assert.equal(c.actor.position.x, 0);
  advance(c, .2);
  assert.equal(c.state, 'Idle');
});

test('Shift doubles forward speed and Run cadence, releases immediately and scales with growth', async () => {
  const c = await create();
  c.resizeTo(1.5);c.eatFruit();
  advance(c, .5);
  advance(c, 1, { ...idle, forward: true, sprint: true });
  assert(Math.abs(c.actor.position.z - c.speed * 2) < 1e-6);
  assert.equal(c.state, 'Run');
  assert.equal(c.actions.get('Run')!.getEffectiveTimeScale(), 2);
  const z = c.actor.position.z;
  advance(c, 1, { ...idle, forward: true });
  assert(Math.abs(c.actor.position.z - z - c.speed) < 1e-6);
  assert.equal(c.actions.get('Run')!.getEffectiveTimeScale(), 1);
  const beforeBack = c.actor.position.z;
  advance(c, 1, { ...idle, backward: true, sprint: true });
  assert(Math.abs(c.actor.position.z - beforeBack + c.backwardSpeed) < 1e-6);
  const position = c.actor.position.clone();
  advance(c, .5, { ...idle, sprint: true });
  assert.equal(c.state, 'Idle');
  assert(c.actor.position.distanceTo(position) < 1e-6);
});
test('a short tap turns only while held and the small heading survives Idle and subsequent Run', async () => {
  const c = await create();
  c.update(1 / 60, { ...idle, left: true });
  advance(c, 1.4);
  assert.equal(c.state, 'Idle');
  const angle=Math.PI*.55*2/60;
  assert(angle<Math.PI/18);
  assert(Math.abs(c.yaw - angle) < 1e-6);
  assert(Math.abs(c.animationRoot.rotation.y) < 1e-6);
  advance(c, 1, { ...idle, forward: true });
  assert(Math.abs(c.actor.position.x - Math.sin(angle) * c.speed) < 1e-6);
  assert(Math.abs(c.actor.position.z - Math.cos(angle) * c.speed) < 1e-6);
});

test('continuous keyboard turning reaches 198 degrees per second at low and high frame rates',async()=>{
  for(const fps of [20,24,30,60,75,120,144])for(const direction of [-1,1]){
    const c=await create();
    for(let frame=0;frame<fps;frame++)c.update(1/fps,{...idle,left:direction===1,right:direction===-1});
    assert(Math.abs(c.yaw-direction*198*Math.PI/180)<1e-6,`${fps} fps, direction ${direction}`);
  }
});

test('keyboard turning is twice as fast during attacks and flight, with analog sensitivity preserved',async()=>{
  for(const mode of ['attack','flight'])for(const direction of [-1,1]){
    const keyboard=await create(),analog=await create();
    const start={...idle,attack:mode==='attack',jump:mode==='flight'};
    keyboard.update(1/60,start);analog.update(1/60,start);
    for(let frame=0;frame<12;frame++){
      keyboard.update(1/60,{...idle,left:direction===1,right:direction===-1});
      analog.update(1/60,{...idle,steer:direction});
    }
    assert.equal(keyboard.flight.active,mode==='flight');
    assert.equal(keyboard.state,mode==='flight'?'Jump':'Push');
    assert(Math.abs(analog.yaw-direction*Math.PI*.55*.2)<1e-6,`${mode}: analog sensitivity`);
    assert(Math.abs(keyboard.yaw-analog.yaw*2)<1e-6,`${mode}: keyboard speed`);
  }
});
test('a tap immediately stops rotating the visible root in both directions', async () => {
  for (const direction of [-1, 1]) {
    const c = await create();
    assert.notEqual(c.animationRoot, c.actor.children[0]);
    let previous = 0;
    for (let i = 0; i < 84; i++) {
      c.update(1 / 60, { ...idle, left: i === 0 && direction === 1, right: i === 0 && direction === -1 });
      const forward = new Vector3(0, 0, 1).applyQuaternion(c.animationRoot.getWorldQuaternion(new Quaternion()));
      const angle = Math.atan2(forward.x, forward.z);
      assert(Math.abs(angle - c.yaw) < 1e-6, 'Model yaw must not add another animated rotation');
      assert(Math.abs(angle-direction*Math.PI*.55*2/60)<1e-6);
      if(i>0)assert(Math.abs(angle-previous)<1e-6,'Release must stop yaw without completing a step');
      previous = angle;
    }
  }
});
test('backward clip moves opposite facing direction and W+S cancels', async () => {
  const c = await create();
  advance(c, 1, { ...idle, backward: true });
  assert.equal(c.state, 'WalkBackward');
  assert(Math.abs(c.actor.position.z + c.backwardSpeed) < 1e-6);
  assert.equal(c.yaw, 0);
  const previous = c.actor.position.clone();
  advance(c, .5, { ...idle, forward: true, backward: true });
  assert.equal(c.state, 'Idle');
  assert(c.actor.position.distanceTo(previous) < 1e-6);
});
test('jump rises, lands, cannot retrigger while Space is held and works again after release', async () => {
  const c = await create();
  let maxHeight = 0;
  for (let i = 0; i < 180; i++) {
    c.update(1 / 60, { ...idle, jump: true });
    assert(!c.flight.levitating);assert(!c.cloud.visible);
    assert(Math.abs(c.animationRoot.position.y)<1e-6,'the animation cannot add height to the ballistic arc');
    if(i>=48)assert.equal(c.state,'Idle','a single jump has already landed before 0.8s');
    maxHeight = Math.max(maxHeight, c.animationRoot.getWorldPosition(new Vector3()).y);
  }
  assert(maxHeight > 1.3);
  assert.equal(c.state, 'Idle');
  assert(Math.abs(c.animationRoot.position.y) < 1e-6);
  c.update(1 / 60, idle);
  c.update(1 / 60, { ...idle, jump: true });
  assert.equal(c.state, 'Jump');
});
test('held right turns continuously without position drift; opposite keys cancel immediately', async () => {
  const c = await create();
  advance(c, 2.4, { ...idle, right: true });
  assert(Math.abs(c.yaw + 198*2.4*Math.PI/180) < 1e-6);
  assert(c.actor.position.length() < 1e-6);
  const yaw = c.yaw;
  advance(c, .5, { ...idle, left: true, right: true });
  assert.equal(c.yaw, yaw);
  assert.equal(c.state, 'Idle');
});
test('release stops at the exact heading and reversing responds in the next frame', async () => {
  const c = await create();
  advance(c, .45, { ...idle, left: true });
  const yaw = c.yaw;
  assert(Math.abs(yaw-198*.45*Math.PI/180)<1e-6);
  c.update(1/60,idle);assert.equal(c.yaw,yaw);assert.equal(c.state,'Idle');
  advance(c, 1);
  assert.equal(c.yaw, yaw);
  c.update(1/60,{...idle,right:true});
  assert(Math.abs(c.yaw-yaw+Math.PI*.55*2/60)<1e-6);
  assert.equal(c.state,'RotateRight');
});

test('holding a turn never delays a jump or attack',async()=>{
  for(const action of ['jump','attack'] as const){
    const c=await create();c.update(1/120,{...idle,left:true});
    c.update(1/120,{...idle,left:true,[action]:true});
    assert.equal(c.state,action==='jump'?'Jump':'Push');
    assert.equal(c.flight.active,action==='jump');
  }
});
test('small Kirby moves at full base speed, with sprint and star power still multiplying it',async()=>{
  for(const [size,multiplier] of [[.3,1],[.5,1],[.99,1],[1,1],[1.5,1.5],[2,2]]){
    for(const star of [false,true]){
      const c=await create();c.actor.scale.setScalar(size);if(star)c.activateStarPower();
      const boost=multiplier*(star?2:1);
      for(const [input,distance] of [
        [{...idle,forward:true},3.4*boost],
        [{...idle,forward:true,sprint:true},6.8*boost],
        [{...idle,backward:true},-1.65*boost],
      ] as const){
        const z=c.actor.position.z;advance(c,1,input);
        assert(Math.abs(c.actor.position.z-z-distance)<1e-6,`size ${size}, star ${star}, distance ${distance}`);
      }
    }
  }
});

test('each fruit adds twenty percentage points to forward and backward speed without resizing', async () => {
  const c = await create();
  c.eatFruit(); c.eatFruit();
  advance(c, .5);
  assert.equal(c.fruitsEaten, 2);
  assert.equal(c.actor.scale.x,1);
  advance(c, 1, { ...idle, forward: true });
  assert(Math.abs(c.actor.position.z - 3.4 * 1.4) < 1e-6);
  const z = c.actor.position.z;
  advance(c, 1, { ...idle, backward: true });
  assert(Math.abs(c.actor.position.z - (z - 1.65 * 1.4)) < 1e-6);
});
test('continuous turning keeps footwork cycling without resetting it each frame', async () => {
  const c = await create();
  advance(c, .25, { ...idle, left: true });
  const action = c.actions.get('RotateLeft')!;
  const yaw=198*.25*Math.PI/180;
  assert(Math.abs(c.yaw - yaw) < 1e-6);
  const duration = action.getClip().duration;
  const cycle=.4/2;
  assert(Math.abs(action.getEffectiveTimeScale() - duration / cycle) < 1e-6);
  assert(Math.abs(action.time - (.25 * duration / cycle)%duration) < 1e-6, 'Foot phase must not reset during the turn');
  advance(c, .5);
  assert(Math.abs(c.yaw-yaw)<1e-6);
  assert.equal(c.state, 'Idle');
});
