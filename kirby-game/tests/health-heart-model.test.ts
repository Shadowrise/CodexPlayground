import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Group, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHealthHeartModel, getHealthHeartStats } from '../src/health-heart-model';
import { HealthHeart } from '../src/health-heart';

test('heart is a closed outward-wound solid with finite smooth normals', () => {
  const model = createHealthHeartModel(), mesh = model.children[0] as Mesh;
  const geometry = mesh.geometry, p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  const index = geometry.index!;
  const edges = new Map<string, number>();
  let volume = 0;
  for (let i = 0; i < p.count; i++) {
    const point = new Vector3().fromBufferAttribute(p, i), normal = new Vector3().fromBufferAttribute(n, i);
    assert.ok(point.toArray().every(Number.isFinite));
    assert.ok(Math.abs(normal.length() - 1) < 1e-5);
  }
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const [a, b, c] = ids.map(id => new Vector3().fromBufferAttribute(p, id));
    assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-14, 'no collapsed triangles');
    volume += a.dot(b.clone().cross(c)) / 6;
    for (let k = 0; k < 3; k++) {
      const from = ids[k], to = ids[(k + 1) % 3];
      const key = `${Math.min(from, to)}:${Math.max(from, to)}`;
      edges.set(key, (edges.get(key) ?? 0) + (from < to ? 1 : -1));
    }
  }
  assert.ok(volume > .12, 'positive volume with outward normals');
  assert.ok([...edges.values()].every(balance => balance === 0), 'all edges join in opposing directions');
  const stats = getHealthHeartStats();
  assert.equal(stats.drawCalls, 1); assert.ok(stats.triangles <= 6000);
  assert.ok(stats.size[2] > .5, 'rounded front and back, suitable for carrying and turning');
  assert.ok(Math.abs(stats.bounds.max[0] + stats.bounds.min[0]) < 1e-6);
});

test('instances share buffers but keep independent attachment transforms', () => {
  const a = createHealthHeartModel(), b = createHealthHeartModel();
  assert.notEqual(a, b); assert.notEqual(a.children[0], b.children[0]);
  assert.equal((a.children[0] as Mesh).geometry, (b.children[0] as Mesh).geometry);
  a.position.set(7, 3, 2); a.rotation.y = .8;
  assert.deepEqual(b.position.toArray(), [0, 0, 0]);
  assert.equal(b.rotation.y, 0);
});

test('the central front and back surfaces remain rounded without a sharp seam', () => {
  const geometry = (createHealthHeartModel().children[0] as Mesh).geometry;
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
  let checked = 0;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    if (Math.abs(x) < .025 && y < -.08 && y > -.46 && Math.abs(z) > .15) {
      assert.ok(Math.abs(normals.getX(i)) < .16, 'surface must not turn sharply sideways at its centre');
      checked++;
    }
  }
  assert.ok(checked >= 40, 'check both faces along the former seam');
});

test('carried presentation preserves an NPC hand attachment; dropped motion resets deterministically', () => {
  const hand = new Group(), heart = new HealthHeart(.3);
  hand.position.set(3, 1, -2); hand.rotation.set(.1, .7, -.2); hand.scale.setScalar(.7);
  hand.add(heart.group); heart.group.position.set(.1, .2, .3);
  heart.floating = false;
  for (let frame = 0; frame < 180; frame++) heart.update(frame / 60);
  assert.deepEqual(heart.group.position.toArray(), [.1, .2, .3]);
  assert.equal(heart.visual.position.y, 0); assert.equal(heart.model.rotation.y, 0);
  assert.ok(new Box3().setFromObject(heart.model).min.toArray().every(Number.isFinite));
  heart.floating = heart.spinEnabled = true; heart.update(4);
  const position = heart.visual.position.clone(), quaternion = heart.model.quaternion.clone();
  heart.update(200); heart.update(4);
  assert.ok(heart.visual.position.equals(position)); assert.ok(heart.model.quaternion.equals(quaternion));
  heart.mistEnabled = heart.glintsEnabled = false; heart.update(5);
  assert.equal(heart.aura.visible, false); assert.equal(heart.glints.visible, false);
  const sibling = new HealthHeart(); heart.dispose(); heart.dispose(); sibling.update(7);
  assert.equal(heart.group.parent, null); assert.equal(heart.group.visible, false);
  assert.equal(sibling.group.visible, true); sibling.dispose();
});

test('exported GLB reloads with matching geometry, burgundy material and emission', async () => {
  const bytes = await readFile(new URL('../public/models/health-heart.glb', import.meta.url));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  let triangles = 0, meshes = 0;
  gltf.scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    meshes++; triangles += object.geometry.index!.count / 3;
    const material = object.material;
    assert.ok(!Array.isArray(material) && 'emissiveIntensity' in material);
    assert.ok(material.emissiveIntensity > 0);
    assert.equal(object.geometry.getAttribute('color').count, object.geometry.getAttribute('position').count);
  });
  assert.equal(meshes, 1); assert.equal(triangles, getHealthHeartStats().triangles);
  const bounds = new Box3().setFromObject(gltf.scene).getSize(new Vector3()).toArray();
  bounds.forEach((value, i) => assert.ok(Math.abs(value - getHealthHeartStats().size[i]) < 1e-6));
});
