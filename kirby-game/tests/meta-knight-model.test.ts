import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AnimationMixer, Box3, DoubleSide, LoopOnce, Mesh, Object3D, PropertyBinding, Quaternion, Raycaster, Triangle, Vector3, type AnimationClip, type BufferGeometry} from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {META_KNIGHT_CLIPS,META_KNIGHT_CLIP_BY_NAME,type MetaKnightClipName} from '../src/meta-knight-clips';

async function exportedModel() {
  const bytes = await readFile(new URL('../public/models/meta-knight-animated.glb', import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

function rig(model: Object3D, name: string) {
  const node = model.getObjectByName(name);
  assert(node, `The exported model must preserve ${name}`);
  return node;
}

function poseSampler(gltf: GLTF) {
  const mixer = new AnimationMixer(gltf.scene);
  return (name: string, fraction: number) => {
    mixer.stopAllAction();
    const clip = clipByName(gltf.animations, name);
    const action = mixer.clipAction(clip);
    action.reset().setLoop(LoopOnce, 1).play();
    action.clampWhenFinished = true;
    mixer.setTime(clip.duration * fraction);
    gltf.scene.updateMatrixWorld(true);
  };
}

function clipByName(clips: AnimationClip[], name: string) {
  const clip = clips.find(candidate => candidate.name === name);
  assert(clip, `The exported model must contain ${name}`);
  return clip;
}

function worldPosition(model: Object3D, name: string) {
  return rig(model, name).getWorldPosition(new Vector3());
}

function actualBottom(model: Object3D) {
  let bottom = Infinity;
  const vertex = new Vector3();
  model.traverse(object => {
    if (!(object instanceof Mesh) || !object.visible) return;
    const positions = object.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      object.getVertexPosition(i, vertex).applyMatrix4(object.matrixWorld);
      assert(Number.isFinite(vertex.x) && Number.isFinite(vertex.y) && Number.isFinite(vertex.z), `${object.name} has an invalid animated vertex`);
      bottom = Math.min(bottom, vertex.y);
    }
  });
  assert(Number.isFinite(bottom), 'The model needs visible geometry');
  return bottom;
}

type TriangleTree = {box: Box3; faces?: Triangle[]; children?: [TriangleTree, TriangleTree]};
type Collider = {root: Object3D; tree: TriangleTree};

function triangleTree(faces: Triangle[]): TriangleTree {
  const box = new Box3();
  for (const face of faces) box.expandByPoint(face.a).expandByPoint(face.b).expandByPoint(face.c);
  if (faces.length <= 8) return {box, faces};
  const size = box.getSize(new Vector3());
  const axis = size.x > size.y && size.x > size.z ? 'x' : size.y > size.z ? 'y' : 'z';
  faces.sort((a, b) => a.a[axis] + a.b[axis] + a.c[axis] - b.a[axis] - b.b[axis] - b.c[axis]);
  const middle = Math.floor(faces.length / 2);
  return {box, children: [triangleTree(faces.slice(0, middle)), triangleTree(faces.slice(middle))]};
}

/** Preserve the exported triangles and their placement within a rigid part. */
function collider(root: Object3D, include: (mesh: Mesh) => boolean = () => true): Collider {
  const inverse = root.matrixWorld.clone().invert(), faces: Triangle[] = [];
  root.traverse(object => {
    if (!(object instanceof Mesh) || !include(object)) return;
    const geometry = object.geometry as BufferGeometry, positions = geometry.getAttribute('position');
    const transform = inverse.clone().multiply(object.matrixWorld), index = geometry.index;
    const count = index?.count ?? positions.count;
    for (let i = 0; i < count; i += 3) {
      const vertices = [0, 1, 2].map(offset => new Vector3().fromBufferAttribute(positions, index ? index.getX(i + offset) : i + offset).applyMatrix4(transform));
      const face = new Triangle(vertices[0], vertices[1], vertices[2]);
      if (face.getArea() > 1e-12) faces.push(face);
    }
  });
  assert(faces.length > 0, `${root.name} must test actual collision geometry`);
  return {root, tree: triangleTree(faces)};
}

/** Triangle SAT, including in-plane axes for coplanar triangles. */
function trianglesIntersect(a: Triangle, b: Triangle) {
  const edgesA = [a.b.clone().sub(a.a), a.c.clone().sub(a.b), a.a.clone().sub(a.c)];
  const edgesB = [b.b.clone().sub(b.a), b.c.clone().sub(b.b), b.a.clone().sub(b.c)];
  const normalA = edgesA[0].clone().cross(edgesA[1]), normalB = edgesB[0].clone().cross(edgesB[1]);
  const axes = [normalA, normalB];
  for (const edgeA of edgesA) for (const edgeB of edgesB) axes.push(edgeA.clone().cross(edgeB));
  for (const edge of edgesA) axes.push(normalA.clone().cross(edge));
  for (const edge of edgesB) axes.push(normalB.clone().cross(edge));
  for (const axis of axes) {
    if (axis.lengthSq() < 1e-20) continue;
    axis.normalize();
    const pa = [a.a.dot(axis), a.b.dot(axis), a.c.dot(axis)];
    const pb = [b.a.dot(axis), b.b.dot(axis), b.c.dot(axis)];
    if (Math.max(...pa) < Math.min(...pb) - 1e-7 || Math.max(...pb) < Math.min(...pa) - 1e-7) return false;
  }
  return true;
}

function intersection(first: Collider, second: Collider) {
  function world(source: Collider) {
    const boxes = new Map<TriangleTree, Box3>(), triangles = new Map<Triangle, {face: Triangle; box: Box3}>();
    return {
      box(node: TriangleTree) {
        let box = boxes.get(node);
        if (!box) {box = node.box.clone().applyMatrix4(source.root.matrixWorld); boxes.set(node, box);}
        return box;
      },
      triangle(local: Triangle) {
        let result = triangles.get(local);
        if (!result) {
          const face = new Triangle(local.a.clone().applyMatrix4(source.root.matrixWorld), local.b.clone().applyMatrix4(source.root.matrixWorld), local.c.clone().applyMatrix4(source.root.matrixWorld));
          result = {face, box: new Box3().setFromPoints([face.a, face.b, face.c])}; triangles.set(local, result);
        }
        return result;
      },
    };
  }
  const a = world(first), b = world(second);
  function visit(left: TriangleTree, right: TriangleTree): Vector3 | undefined {
    if (!a.box(left).intersectsBox(b.box(right))) return;
    if (left.children) return visit(left.children[0], right) ?? visit(left.children[1], right);
    if (right.children) return visit(left, right.children[0]) ?? visit(left, right.children[1]);
    for (const localA of left.faces!) for (const localB of right.faces!) {
      const triangleA = a.triangle(localA), triangleB = b.triangle(localB);
      if (triangleA.box.intersectsBox(triangleB.box) && trianglesIntersect(triangleA.face, triangleB.face)) return triangleA.face.getMidpoint(new Vector3());
    }
  }
  return visit(first.tree, second.tree);
}

/** Recover solid palm/thumb volumes from the material-batched GLB geometry. */
function fistVolumes(root: Object3D) {
  const inverse = root.matrixWorld.clone().invert(), points: Vector3[] = [], parents: number[] = [];
  const vertices = new Map<string, number>();
  function vertex(point: Vector3) {
    const key = point.toArray().map(value => value.toFixed(6)).join(',');
    let id = vertices.get(key);
    if (id === undefined) {id = points.length; points.push(point); parents.push(id); vertices.set(key, id);}
    return id;
  }
  function find(id: number): number {
    if (parents[id] !== id) parents[id] = find(parents[id]);
    return parents[id];
  }
  root.traverse(object => {
    if (!(object instanceof Mesh) || Array.isArray(object.material) || object.material.name !== 'Gauntlet · satin pearl') return;
    const geometry = object.geometry as BufferGeometry, positions = geometry.getAttribute('position');
    const transform = inverse.clone().multiply(object.matrixWorld), index = geometry.index;
    for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
      const ids = [0, 1, 2].map(offset => vertex(new Vector3().fromBufferAttribute(positions, index ? index.getX(i + offset) : i + offset).applyMatrix4(transform)));
      for (const id of ids.slice(1)) parents[find(id)] = find(ids[0]);
    }
  });
  const volumes = new Map<number, {bounds: Box3; vertices: number}>();
  points.forEach((point, index) => {
    const key = find(index), volume = volumes.get(key) ?? {bounds: new Box3(), vertices: 0};
    volume.bounds.expandByPoint(point); volume.vertices++; volumes.set(key, volume);
  });
  return [...volumes.values()].sort((a, b) => b.vertices - a.vertices).map(volume => ({center: volume.bounds.getCenter(new Vector3()), vertices: volume.vertices}));
}

test('Meta Knight GLB retains valid geometry, animation bindings and seamless loops', async () => {
  const gltf = await exportedModel();
  assert.deepEqual(gltf.animations.map(clip => clip.name).sort(), META_KNIGHT_CLIPS.map(clip=>clip.name).sort());
  for (const name of ['MetaKnight_root', 'Body_motion', 'Left_shoulder', 'Right_shoulder', 'Left_foot_pivot', 'Right_foot_pivot', 'Left_wing_pivot', 'Right_wing_pivot', 'Eyes_glow']) rig(gltf.scene, name);

  let meshes = 0;
  gltf.scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    meshes++;
    const geometry = object.geometry as BufferGeometry, positions = geometry.getAttribute('position');
    assert(positions?.count > 0, `${object.name} must have vertices`);
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      assert.equal(attribute.count, positions.count, `${object.name}: mismatched ${name} attribute`);
      for (const value of attribute.array) assert(Number.isFinite(value), `${object.name}: invalid ${name} value`);
    }
    const count = geometry.index?.count ?? positions.count;
    assert.equal(count % 3, 0, `${object.name} must contain complete triangles`);
    if (geometry.index) for (const index of geometry.index.array) assert(index >= 0 && index < positions.count, `${object.name}: invalid triangle index`);
  });
  assert(meshes > 0);

  for (const clip of gltf.animations) {
    assert(clip.duration > 0 && clip.validate(), `${clip.name} must be a valid clip`);
    assert(clip.tracks.length > 0);
    for (const track of clip.tracks) {
      const binding = PropertyBinding.parseTrackName(track.name);
      assert(PropertyBinding.findNode(gltf.scene, binding.nodeName), `${clip.name}: missing target for ${track.name}`);
      for (const value of [...track.times, ...track.values]) assert(Number.isFinite(value), `${clip.name}: invalid animation sample`);
      const stride = track.getValueSize();
      if(META_KNIGHT_CLIP_BY_NAME[clip.name as MetaKnightClipName].loop)assert.deepEqual(Array.from(track.values.slice(0, stride)), Array.from(track.values.slice(-stride)), `${clip.name}: ${track.name} must close its loop exactly`);
      if (binding.propertyName === 'quaternion') {
        for (let offset = 0; offset < track.values.length; offset += 4) {
          const quaternion = new Quaternion().fromArray(track.values, offset);
          assert(Math.abs(quaternion.length() - 1) < 1e-5, `${clip.name}: non-unit quaternion`);
        }
      }
    }
  }
});

test('Meta Knight walks with alternating steps and keeps every pose above the floor', async () => {
  const gltf = await exportedModel(), sample = poseSampler(gltf);
  const steps: {left: Vector3; right: Vector3}[] = [];
  for (let frame = 0; frame <= 32; frame++) {
    sample('Walk', frame / 32);
    steps.push({left: worldPosition(gltf.scene, 'Left_foot_pivot'), right: worldPosition(gltf.scene, 'Right_foot_pivot')});
  }
  const separation = steps.map(step => step.left.z - step.right.z);
  assert(Math.max(...separation) > .12 && Math.min(...separation) < -.12, 'Each foot must take a forward turn during the gait');
  for (const side of ['left', 'right'] as const) {
    const heights = steps.map(step => step[side].y);
    assert(Math.max(...heights) - Math.min(...heights) > .035, `${side} foot must lift during a step`);
  }
  for (const clip of ['Idle', 'Walk', 'Sitting']) {
    for (let frame = 0; frame <= 16; frame++) {
      sample(clip, frame / 16);
      assert(actualBottom(gltf.scene) >= -.025, `${clip} penetrates the floor at phase ${frame}/16`);
      gltf.scene.traverse(object => {
        assert([...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()].every(Number.isFinite), `${clip}: invalid transform on ${object.name}`);
        assert(object.scale.x > 0 && object.scale.y > 0 && object.scale.z > 0, `${clip}: collapsed transform on ${object.name}`);
      });
    }
  }
});

test('Meta Knight sits with a lowered torso and feet extended in front', async () => {
  const gltf = await exportedModel(), sample = poseSampler(gltf);
  sample('Idle', 0);
  const standingBody = worldPosition(gltf.scene, 'Body_motion');
  const standingFeet = ['Left', 'Right'].map(side => worldPosition(gltf.scene, `${side}_foot_pivot`));
  sample('Sitting', 0);
  const sittingBody = worldPosition(gltf.scene, 'Body_motion');
  assert(sittingBody.y < standingBody.y - .12, 'Sitting must lower the torso visibly');
  for (const [index, side] of ['Left', 'Right'].entries()) {
    const foot = worldPosition(gltf.scene, `${side}_foot_pivot`);
    assert(foot.z > standingFeet[index].z + .1, `${side} foot must extend forward while sitting`);
  }
});

test('Meta Knight curved wings and visor keep continuous normals across triangle seams', async () => {
  const gltf = await exportedModel();
  const smoothMaterials = new Set(['Wings · violet silk', 'Visor · recessed shadow']);
  let surfaces = 0;
  gltf.scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const mesh = object as Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.some(material => smoothMaterials.has(material.name))) return;
    surfaces++;
    const positions = mesh.geometry.getAttribute('position'), normals = mesh.geometry.getAttribute('normal');
    assert(normals, `${mesh.name} needs authored surface normals`);
    const shared = new Map<string, Vector3>();
    let sharedSamples = 0;
    for (let i = 0; i < positions.count; i++) {
      const point = new Vector3().fromBufferAttribute(positions, i);
      const normal = new Vector3().fromBufferAttribute(normals, i);
      assert(Math.abs(normal.length() - 1) < 1e-5, `${mesh.name} has a non-unit surface normal`);
      const key = point.toArray().map(value => value.toFixed(6)).join(',');
      const previous = shared.get(key);
      if (previous) {
        sharedSamples++;
        assert(normal.dot(previous) > .9999, `${mesh.name} has a visible lighting seam at ${key}`);
      } else shared.set(key, normal);
    }
    assert(sharedSamples > 100, `${mesh.name} must check actual neighbouring triangles`);
    // Mirroring a wing reverses its winding. Keep its authored normals on that
    // same side, while allowing the double-sided material to light either face.
    for (let i = 0; i < positions.count; i += 3) {
      const a = new Vector3().fromBufferAttribute(positions, i);
      const b = new Vector3().fromBufferAttribute(positions, i + 1);
      const c = new Vector3().fromBufferAttribute(positions, i + 2);
      const winding = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      assert(winding * normals.getZ(i) > 0, `${mesh.name} normals disagree with mirrored triangle winding`);
    }
  });
  assert.equal(surfaces, 3, 'Both wing membranes and the recessed visor need smooth lighting');
});

test('Meta Knight keeps the sword locked in the fingers as the wrist changes pose', async () => {
  const gltf = await exportedModel(), sample = poseSampler(gltf);
  const wrist = rig(gltf.scene, 'Right_gauntlet');
  const grip = rig(gltf.scene, 'Right_grip');
  const fingers = rig(gltf.scene, 'Right_grip_fingers');
  const sword = rig(gltf.scene, 'Galaxia');
  assert.equal(grip.getObjectByName(fingers.name), fingers, 'The wrist grip must carry the folded fingers');
  assert.equal(grip.getObjectByName(sword.name), sword, 'The same wrist grip must carry the sword');
  for (const part of [fingers, sword]) {
    let geometry = false;
    part.traverse(object => {if (object instanceof Mesh && object.geometry.getAttribute('position').count > 0) geometry = true;});
    assert(geometry, `${part.name} must retain its visible geometry in the GLB`);
  }

  const gripInWrist = () => wrist.getWorldQuaternion(new Quaternion()).invert().multiply(grip.getWorldQuaternion(new Quaternion()));
  sample('Idle', 0);
  const standingGrip = gripInWrist();
  const heldPosition = sword.matrixWorld.clone().invert().multiply(fingers.matrixWorld);
  for (const {name:clip} of META_KNIGHT_CLIPS) {
    for (let frame = 0; frame <= 12; frame++) {
      sample(clip, frame / 12);
      const relative = sword.matrixWorld.clone().invert().multiply(fingers.matrixWorld);
      relative.elements.forEach((value, index) => {
        assert(Math.abs(value - heldPosition.elements[index]) < 1e-5, `${clip}: the sword slides through the fingers at phase ${frame}/12`);
      });
    }
  }
  sample('Sitting', 0);
  assert(gripInWrist().angleTo(standingGrip) > .12, 'Sitting must reposition the complete wrist grip together with the sword');
});

test('Meta Knight sword clears the shoulder armour, mask and body throughout every clip', async () => {
  const gltf = await exportedModel(), sample = poseSampler(gltf);
  sample('Idle', 0);
  const sword = collider(rig(gltf.scene, 'Galaxia'));
  const body = rig(gltf.scene, 'Body_motion');
  const obstacles = [collider(body, mesh => mesh.parent === body), collider(rig(gltf.scene, 'Mask_shell'))];
  for (const side of ['Left', 'Right']) {
    const shoulder = rig(gltf.scene, `${side}_shoulder`);
    const armour = shoulder.children.find(child => /(?:^|_)shoulder_armour(?:_\d+)?$/i.test(child.name));
    assert(armour, `${side} shoulder needs its own collision geometry, excluding the glove and sword`);
    obstacles.push(collider(armour));
  }
  for (const {name:clip} of META_KNIGHT_CLIPS) {
    for (let frame = 0; frame <= 48; frame++) {
      sample(clip, frame / 48);
      for (const obstacle of obstacles) {
        const contact = intersection(sword, obstacle);
        assert(!contact, `${clip} phase ${frame}/48: sword intersects ${obstacle.root.name} near ${contact?.toArray().map(value => value.toFixed(3)).join(', ')}`);
      }
    }
  }
});

test('Meta Knight thin curved mask follows the face and has four raised ribs with a higher visor', async () => {
  const gltf = await exportedModel(), sample = poseSampler(gltf);
  sample('Idle', 0);
  const mask = rig(gltf.scene, 'Mask_shell');
  const inverse = mask.matrixWorld.clone().invert();
  const isSilver = (object: Object3D): object is Mesh => object instanceof Mesh && !Array.isArray(object.material) && object.material.name === 'Mask · brushed moon silver';
  const base = mask.children.filter(isSilver);
  assert(base.length > 0, 'The forehead needs a continuous silver shell beneath its ribs');
  const localBounds = new Box3();
  for (const mesh of base) {
    const positions = mesh.geometry.getAttribute('position');
    const transform = inverse.clone().multiply(mesh.matrixWorld);
    for (let i = 0; i < positions.count; i++) localBounds.expandByPoint(new Vector3().fromBufferAttribute(positions, i).applyMatrix4(transform));
  }
  const size = localBounds.getSize(new Vector3());

  function rayAt(x: number, y: number) {
    return new Raycaster(new Vector3(x, y, 2).applyMatrix4(mask.matrixWorld), new Vector3(0, 0, -1).transformDirection(mask.matrixWorld), 0, 5);
  }

  const body = rig(gltf.scene, 'Body_motion');
  const skin = body.children.filter((object): object is Mesh => object instanceof Mesh);
  assert(skin.length > 0, 'The mask must be checked against the actual body surface');
  const shellSides = base.flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(material => ({material, side: material.side}));
  // Read both sides of the actual exported shell, regardless of render culling.
  for (const {material} of shellSides) material.side = DoubleSide;
  try {
    for (const y of [.43, .52, .60]) for (const x of [-.28, -.185, -.11, 0, .11, .185, .28]) {
      const ray = rayAt(x, y), hit = ray.intersectObject(mask, true)[0];
      assert(hit, `The forehead has a hole at ${x}, ${y}`);
      assert(isSilver(hit.object), `The forehead must expose silver rather than a dark hole at ${x}, ${y}`);
      const shell = ray.intersectObjects(base, false).map(hit => hit.point.clone().applyMatrix4(inverse).z);
      const surfaces = shell.filter((z, index) => index === 0 || Math.abs(z - shell[index - 1]) > 1e-5);
      assert(surfaces.length >= 2, `The mask needs a thin front and back at ${x}, ${y}`);
      const thickness = surfaces[0] - surfaces[surfaces.length - 1];
      assert(thickness > .018 && thickness < .045, `The mask has excessive metal thickness ${thickness.toFixed(4)} at ${x}, ${y}`);
      const bodyHit = ray.intersectObjects(skin, false)[0];
      assert(bodyHit, `The mask must lie over the face at ${x}, ${y}`);
      const gap = surfaces[0] - bodyHit.point.clone().applyMatrix4(inverse).z;
      assert(gap > .020 && gap < .065, `The curved mask must hug the face, with no detached dome: gap ${gap.toFixed(4)} at ${x}, ${y}`);
    }
  } finally {
    for (const {material, side} of shellSides) material.side = side;
  }

  const ribs = mask.children.filter(child => /^Mask_ridge_[LR]_[01]$/.test(child.name));
  assert.equal(ribs.length, 4, 'The forehead needs exactly four raised ribs');
  for (const rib of ribs) {
    let protrusion = -Infinity;
    const points: Vector3[] = [];
    rib.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.getAttribute('position'), transform = inverse.clone().multiply(object.matrixWorld);
      for (let i = 0; i < positions.count; i++) points.push(new Vector3().fromBufferAttribute(positions, i).applyMatrix4(transform));
    });
    assert(points.length > 0, `${rib.name} must contain visible geometry`);
    const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    assert(rib.name.includes('_L_') ? meanX < 0 : meanX > 0, `${rib.name} must sit on its own side of the forehead`);
    for (const point of points) {
      const hit = rayAt(point.x, point.y).intersectObjects(base, false)[0];
      if (hit) protrusion = Math.max(protrusion, point.z - hit.point.clone().applyMatrix4(inverse).z);
    }
    assert(protrusion > .015, `${rib.name} must rise above the silver shell rather than lie flat`);
  }

  const visorMeshes: Mesh[] = [];
  mask.traverse(object => {
    if (object instanceof Mesh && !Array.isArray(object.material) && object.material.name === 'Visor · recessed shadow') visorMeshes.push(object);
  });
  assert(visorMeshes.length > 0);
  const visorBounds = new Box3();
  for (const mesh of visorMeshes) {
    const positions = mesh.geometry.getAttribute('position'), transform = inverse.clone().multiply(mesh.matrixWorld);
    for (let i = 0; i < positions.count; i++) visorBounds.expandByPoint(new Vector3().fromBufferAttribute(positions, i).applyMatrix4(transform));
  }
  const openingHeight = (localBounds.max.y - visorBounds.getCenter(new Vector3()).y) / size.y;
  assert(openingHeight > .48 && openingHeight < .58, 'The higher visor must sit near the middle of the curved mask');
});

test('Meta Knight thumbs close inward toward the body in both fists', async () => {
  const gltf = await exportedModel(), sample = poseSampler(gltf);
  sample('Idle', 0);
  const body = rig(gltf.scene, 'Body_motion');
  const fists = ['Left_fist', 'Right_grip_fingers'].map(name => {
    const root = rig(gltf.scene, name), volumes = fistVolumes(root);
    assert(volumes.length >= 2, `${name} needs a visible palm and closed thumb volume`);
    const [palm, thumb] = volumes;
    assert(palm.vertices > thumb.vertices * 1.5, `${name} must distinguish the main palm from its short thumb`);
    return {root, palm: palm.center, thumb: thumb.center};
  });
  for (const clip of ['Idle', 'Walk', 'Sitting']) for (let frame = 0; frame <= 12; frame++) {
    sample(clip, frame / 12);
    const torso = body.getWorldPosition(new Vector3());
    for (const fist of fists) {
      const palm = fist.palm.clone().applyMatrix4(fist.root.matrixWorld);
      const thumb = fist.thumb.clone().applyMatrix4(fist.root.matrixWorld);
      const inward = torso.clone().sub(palm).normalize();
      assert(thumb.sub(palm).dot(inward) > .025, `${clip} phase ${frame}/12: ${fist.root.name} thumb points away from the body`);
    }
  }
});
