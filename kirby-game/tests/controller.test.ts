import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Quaternion, Vector3 } from 'three';
import { CharacterController, type Input } from '../src/controller';

const idle: Input = { forward: false, left: false, right: false };

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
    assert(Math.abs(c.yaw-100*Math.PI/180)<1e-6);
    if(mode==='sprint')assert.equal(c.actions.get('Run')!.getEffectiveTimeScale(),2);
    c.update(1/60,{...idle,left:true});assert.equal(c.state,'RotateLeft');
  }
});

test('swallow starts smooth growth and immediately unlocks movement and jumping', async()=>{
  const c=await create();
  advance(c,.95,{...idle,eat:true});assert.equal(c.state,'Eat');
  c.grow();assert.equal(c.actor.scale.x,1);
  c.update(1/60,{...idle,forward:true});
  assert.equal(c.state,'Run');assert(c.actor.position.z>0);
  assert(c.actor.scale.x>1 && c.actor.scale.x<1.01);
  let previous=c.actor.scale.x;
  for(let i=0;i<30;i++){
    c.update(1/60,{...idle,forward:true});
    assert(c.actor.scale.x>=previous && c.actor.scale.x<=1.1);previous=c.actor.scale.x;
  }
  assert.equal(c.actor.scale.x,1.1);
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
  assert.equal(c.actions.size, 11);
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
  c.grow();
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
test('tap turns left 10 degrees, heading survives Idle and subsequent Run', async () => {
  const c = await create();
  c.update(1 / 60, { ...idle, left: true });
  advance(c, 1.4);
  assert.equal(c.state, 'Idle');
  assert(Math.abs(c.yaw - Math.PI / 18) < 1e-6);
  assert(Math.abs(c.animationRoot.rotation.y) < 1e-6);
  advance(c, 1, { ...idle, forward: true });
  assert(Math.abs(c.actor.position.x - Math.sin(Math.PI / 18) * c.speed) < 1e-6);
  assert(Math.abs(c.actor.position.z - Math.cos(Math.PI / 18) * c.speed) < 1e-6);
});
test('visible root turns only 10 degrees across every frame in both directions', async () => {
  for (const direction of [-1, 1]) {
    const c = await create();
    assert.notEqual(c.animationRoot, c.actor.children[0]);
    let previous = 0;
    for (let i = 0; i < 84; i++) {
      c.update(1 / 60, { ...idle, left: i === 0 && direction === 1, right: i === 0 && direction === -1 });
      const forward = new Vector3(0, 0, 1).applyQuaternion(c.animationRoot.getWorldQuaternion(new Quaternion()));
      const angle = Math.atan2(forward.x, forward.z);
      assert(Math.abs(angle - c.yaw) < 1e-6, 'Model yaw must not add another animated rotation');
      assert(Math.abs(angle) <= Math.PI / 18 + 1e-6);
      assert(direction * (angle - previous) >= -1e-6, 'No end-of-turn snap back');
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
    maxHeight = Math.max(maxHeight, c.animationRoot.getWorldPosition(new Vector3()).y);
  }
  assert(maxHeight > 1.3);
  assert.equal(c.state, 'Idle');
  assert(Math.abs(c.animationRoot.position.y) < 1e-6);
  c.update(1 / 60, idle);
  c.update(1 / 60, { ...idle, jump: true });
  assert.equal(c.state, 'Jump');
});
test('held right repeats turns without position drift; opposite keys cancel', async () => {
  const c = await create();
  advance(c, 2.4, { ...idle, right: true });
  assert(Math.abs(c.yaw + 24 * Math.PI / 18) < 1e-6);
  assert(c.actor.position.length() < 1e-6);
  const yaw = c.yaw;
  advance(c, .5, { ...idle, left: true, right: true });
  assert.equal(c.yaw, yaw);
  assert.equal(c.state, 'Idle');
});
test('release finishes only the current 10-degree step and stops repeating', async () => {
  const c = await create();
  advance(c, .45, { ...idle, left: true });
  advance(c, 1);
  assert(Math.abs(c.yaw - 5 * Math.PI / 18) < 1e-6);
  const yaw = c.yaw;
  advance(c, 1);
  assert.equal(c.yaw, yaw);
});
test('each fruit increases actual forward and backward speed by ten percent', async () => {
  const c = await create();
  c.grow(); c.grow();
  advance(c, .5);
  assert.equal(c.fruitsEaten, 2);
  assert(Math.abs(c.actor.scale.x - 1.2) < 1e-9);
  advance(c, 1, { ...idle, forward: true });
  assert(Math.abs(c.actor.position.z - 3.4 * 1.2) < 1e-6);
  const z = c.actor.position.z;
  advance(c, 1, { ...idle, backward: true });
  assert(Math.abs(c.actor.position.z - (z - 1.65 * 1.2)) < 1e-6);
});
test('fast heading steps preserve continuous half-speed footwork while held', async () => {
  const c = await create();
  advance(c, .25, { ...idle, left: true });
  const action = c.actions.get('RotateLeft')!;
  assert(Math.abs(c.yaw - 25 * Math.PI / 180) < 1e-6);
  const duration = action.getClip().duration;
  assert(Math.abs(action.getEffectiveTimeScale() - duration / .4) < 1e-6);
  assert(Math.abs(action.time - .25 * duration / .4) < 1e-6, 'Foot phase must not reset at 10-degree boundaries');
  advance(c, .5);
  assert(Math.abs(c.yaw - 30 * Math.PI / 180) < 1e-6);
  assert.equal(c.state, 'Idle');
});
