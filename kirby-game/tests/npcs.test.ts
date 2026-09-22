import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createNpcs, NPC_COLORS } from '../src/npcs';
import { cloneVariant, KIRBY_VARIANTS } from '../src/variants';
import { insideMeadow } from '../src/world-bounds';

test('NPC greets once, faces the player, waves and resumes idle after jumping', async () => {
  const bytes = await readFile(new URL('../public/models/kirby-animated.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const npc = createNpcs(gltf.scene, gltf.animations)[0];
  const initial = npc.actor.position.clone();
  const player = initial.clone().add(new Vector3(4, 0, 0));
  const arm = npc.model.getObjectByName('Right_shoulder') ?? npc.model.getObjectByName('Right shoulder');
  assert(arm, 'greeting arm exists in the real model');
  assert(npc.greet(player));
  assert.equal(npc.state, 'Jump');
  let hellos = 0, waved = false;
  for (let frame = 0; frame < 84; frame++) {
    npc.update(1 / 30, []);
    if (npc.hello) hellos++;
    if (Math.abs(arm.rotation.z) > .7) waved = true;
    if (frame < 79) assert.equal(npc.requestEat(), false);
    assert.equal(npc.greet(player), false);
  }
  assert.equal(hellos, 1);
  assert(waved);
  assert(npc.actor.position.distanceTo(initial) < 1e-6);
  assert(Math.abs(Math.sin(npc.yaw) - 1) < 1e-4);
  assert.equal(npc.state, 'Idle');
  npc.takeHit(); npc.takeHit(); npc.takeHit();
  for (let frame = 0; frame < 360; frame++) npc.update(1 / 30, []);
  assert.equal(npc.isDown, false);
  assert.equal(npc.greet(player), false, 'revival does not repeat the first greeting');
});

test('every selection creates the other fourteen variants with green NPC feet', async () => {
  const bytes = await readFile(new URL('../public/models/kirby-animated.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  for (const selected of KIRBY_VARIANTS) {
    const npcs = createNpcs(gltf.scene, gltf.animations, selected);
    const player = cloneVariant(gltf.scene, selected, false);
    assert.equal(npcs.length, 14);
    const names = new Set(npcs.map(n => n.variant[0]));
    assert(!names.has(selected[0]));
    assert.equal(new Set([selected[0], ...names]).size, 15);
    for (const npc of npcs) npc.model.traverse(o => {
      if (o instanceof Mesh && (o.material as MeshStandardMaterial).name.startsWith('Feet')) {
        assert.equal((o.material as MeshStandardMaterial).color.getHexString(), '12452a');
      }
    });
    player.traverse(o => {
      if (o instanceof Mesh && (o.material as MeshStandardMaterial).name.startsWith('Kirby') && selected[0] !== 'Классический') {
        assert.equal((o.material as MeshStandardMaterial).color.getHexString(), selected[1].slice(1));
      }
    });
  }
});

test('fourteen independent colorful NPCs use every clip and stay in the meadow', async () => {
  const bytes = await readFile(new URL('../public/models/kirby-animated.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const npcs = createNpcs(gltf.scene, gltf.animations);
  assert.equal(npcs.length, 14);
  assert.equal(new Set(NPC_COLORS.map(c => c[1])).size, 14);
  const body = (model: typeof gltf.scene) => {
    let found: Mesh | undefined;
    model.traverse(o => { if (o instanceof Mesh && o.name.startsWith('Body')) found = o; });
    return found!;
  };
  const original = body(gltf.scene), first = body(npcs[0].model as typeof gltf.scene), second = body(npcs[1].model as typeof gltf.scene);
  assert.notEqual(first.material, second.material);
  assert.notEqual(first.material, original.material);
  assert.equal(first.geometry, original.geometry);
  assert.notEqual((first.material as MeshStandardMaterial).color.getHex(), (second.material as MeshStandardMaterial).color.getHex());
  const visited = npcs.map(() => new Set<string>());
  const initial = npcs.map(n => n.actor.position.clone());
  for (let frame = 0; frame < 240 * 30; frame++) {
    const positions = npcs.map(n => n.actor.position);
    npcs.forEach((npc, i) => {
      npc.update(1 / 30, positions);
      visited[i].add(npc.state);
      assert(insideMeadow(npc.actor.position, npc.actor.scale.x));
      assert(Number.isFinite(npc.yaw));
    });
  }
  npcs.forEach((npc, i) => {
    assert(npc.actor.position.distanceTo(initial[i]) > .1);
    for (const clip of gltf.animations) if (clip.name !== 'Death') assert(visited[i].has(clip.name), `${i}: missing ${clip.name}`);
    assert(!visited[i].has('Death'), 'Death is now reserved for three combat hits');
  });
});
