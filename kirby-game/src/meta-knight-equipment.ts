import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

type GearMaterial = THREE.MeshStandardMaterial;
type GearBatch = Map<GearMaterial, THREE.BufferGeometry[]>;

function metal(name: string, color: string, metalness: number, roughness: number) {
  const material = new THREE.MeshStandardMaterial({color, metalness, roughness});
  material.name = name;
  return material;
}

function append(batch: GearBatch, geometry: THREE.BufferGeometry, material: GearMaterial,
  position: number[] = [0, 0, 0], scale: number[] = [1, 1, 1], rotation: number[] = [0, 0, 0]) {
  let copy = geometry.clone();
  if (copy.index) copy = copy.toNonIndexed();
  copy.deleteAttribute('uv');
  copy.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  ));
  const existing = batch.get(material) ?? [];
  existing.push(copy);
  batch.set(material, existing);
}

function finish(group: THREE.Group, batch: GearBatch) {
  for (const [material, geometries] of batch) {
    const geometry = mergeGeometries(geometries, false);
    if (!geometry) throw new Error(`Unable to merge ${group.name} equipment`);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${group.name}_${material.name.replace(/[^\p{L}\p{N}]+/gu, '_')}`;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    geometries.forEach(source => source.dispose());
  }
  return group;
}

/** Matching solid gauntlets. The gripping hand encloses the vertical hilt axis. */
export function createKnightFist(holding: boolean): THREE.Group {
  const fist = new THREE.Group();
  fist.name = holding ? 'Right_grip_fingers' : 'Left_fist';
  fist.userData.holding = holding;
  const batch: GearBatch = new Map();
  const pearl = metal('Gauntlet · satin pearl', '#e3e8ef', .40, .36);
  const seam = metal('Gauntlet · shallow seams', '#9eacbe', .35, .46);
  const edge = metal('Gauntlet · wrist edging', '#c3cede', .48, .34);
  const handed = holding ? -1 : 1;

  // One closed rounded volume supplies the entire fist silhouette. Small surface
  // deformations suggest grouped knuckles without separate loops or open ends.
  const shell = new THREE.SphereGeometry(1, 32, 22);
  const p = shell.getAttribute('position');
  const signedPower = (value: number, exponent: number) => Math.sign(value) * Math.abs(value) ** exponent;
  for (let i = 0; i < p.count; i++) {
    const original = new THREE.Vector3().fromBufferAttribute(p, i);
    const x = .196 * signedPower(original.x, .82);
    const localY = .194 * signedPower(original.y, .86);
    let z = .175 * signedPower(original.z, .82) - .014;
    if (original.z > 0) {
      const front = Math.min(1, original.z * 2);
      const knuckles = [-.135, -.045, .045, .135].reduce((sum, center) =>
        sum + .009 * Math.exp(-(((x - center) / .039) ** 2)), 0);
      const grooves = [-.09, 0, .09].reduce((sum, center) =>
        sum + .0055 * Math.exp(-(((x - center) / .010) ** 2)), 0);
      z += front * (knuckles * Math.exp(-(((localY - .067) / .075) ** 2))
        - grooves * Math.exp(-((localY / .11) ** 4)));
    }
    p.setXYZ(i, x, localY - .13, z);
  }
  shell.computeVertexNormals();
  append(batch, shell, pearl);
  shell.dispose();

  const sphere = new THREE.SphereGeometry(1, 16, 12);
  // The thumb is short, closed, and tucked into the palm instead of wrapping in
  // a coil. Its base disappears into the common fist volume.
  append(batch, sphere, pearl, [handed * .142, -.155, .105], [.073, .107, .067], [0, handed * -.12, handed * -.65]);
  append(batch, sphere, edge, [0, .025, -.025], [.162, .045, .145]);
  sphere.dispose();

  // Three fine, shallow inset lines follow the convex front surface. They are
  // closed ribbons rather than tubes, holes, or separated sausage-like digits.
  for (const center of [-.09, 0, .09]) {
    const vertices: number[] = [], indices: number[] = [];
    for (let row = 0; row <= 12; row++) {
      const t = row / 12, y = -.035 - t * .205;
      const x = center + .009 * Math.sin(t * Math.PI);
      const localY = y + .13;
      const z = .175 * Math.max(0, 1 - (Math.abs(x) / .196) ** (2 / .82)
        - (Math.abs(localY) / .194) ** (2 / .86)) ** (.82 / 2) - .014;
      const width = .0005 + .001 * Math.sin(t * Math.PI);
      vertices.push(handed * (x - width), y, z + .002, handed * (x + width), y, z + .002);
      if (row < 12) {
        const at = row * 2;
        if (handed > 0) indices.push(at, at + 2, at + 1, at + 1, at + 2, at + 3);
        else indices.push(at, at + 1, at + 2, at + 1, at + 3, at + 2);
      }
    }
    const groove = new THREE.BufferGeometry();
    groove.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    groove.setIndex(indices);groove.computeVertexNormals();
    append(batch, groove, seam);groove.dispose();
  }
  return finish(fist, batch);
}

/** Galaxia faces +Z: slender flame hooks, a long asymmetric point, and a ruby guard. */
export function createGalaxia(): THREE.Group {
  const sword = new THREE.Group();
  sword.name = 'Galaxia';
  const batch: GearBatch = new Map();
  const gold = metal('Galaxia · brilliant gold face', '#e9bd42', .95, .09);
  const brightGold = metal('Galaxia · polished gold edge', '#ffe59a', .98, .07);
  gold.envMapIntensity = 1.5;
  brightGold.envMapIntensity = 1.5;
  const guard = metal('Galaxia · burgundy guard', '#4e2634', .66, .30);
  const guardEdge = metal('Galaxia · burgundy bevel', '#80505a', .70, .28);
  const grip = metal('Galaxia · midnight purple grip', '#251c3b', .18, .60);
  const gripBand = metal('Galaxia · grip bands', '#41304f', .32, .45);
  const gem = metal('Galaxia · oval ruby', '#b41036', .35, .19);
  gem.emissive.set('#4a0010');gem.emissiveIntensity = .15;
  const reflection = metal('Galaxia · ruby glint', '#ffe2df', .15, .21);

  const shape = (points: number[][]) => {
    const outline = new THREE.Shape();outline.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(point => outline.lineTo(point[0], point[1]));outline.closePath();
    return outline;
  };
  function bevel(outline: THREE.Shape, face: GearMaterial, rim: GearMaterial, depth: number, size: number, keepCaps = true) {
    const geometry = new THREE.ExtrudeGeometry(outline, {
      depth, steps: 1, bevelEnabled: true, bevelSegments: 2,
      bevelSize: size, bevelThickness: size * .75, curveSegments: 16,
    });
    // Keep true bevel faces in their own polished metal material.
    for (const group of geometry.groups) {
      if (group.materialIndex === 0 && !keepCaps) continue;
      const section = new THREE.BufferGeometry();
      for (const name of ['position', 'normal'] as const) {
        const attribute = geometry.getAttribute(name);
        section.setAttribute(name, new THREE.Float32BufferAttribute(
          Array.from(attribute.array).slice(group.start * 3, (group.start + group.count) * 3), 3));
      }
      append(batch, section, group.materialIndex === 0 ? face : rim, [0, 0, -depth / 2]);
      section.dispose();
    }
    geometry.dispose();
  }

  const bladeOutline = [[-.061, .18], [-.092, .48], [-.146, .92], [-.225, 1.42],
    [-.315, 2.05], [.285, 1.72], [.225, 1.38], [.146, .89], [.092, .48], [.061, .18]];
  const bladeDepth = .055, bladeBevel = .014;
  bevel(shape(bladeOutline), gold, brightGold, bladeDepth, bladeBevel, false);

  // Broad faces are gently ground convex, so the metal reflects a moving sweep
  // of the room instead of reflecting one flat patch of floor. Every profile
  // corner gets a shared row; the surface meets the physical bevel exactly.
  const minY = .18, maxY = 2.05, columns = 14;
  const rows = [...new Set([
    ...Array.from({length: 33}, (_, i) => minY + (maxY - minY) * i / 32),
    ...bladeOutline.map(point => point[1]),
  ])].filter(y => y < maxY - 1e-8).sort((a, b) => a - b);
  function widthAt(y: number) {
    const crossings: number[] = [];
    bladeOutline.forEach((start, i) => {
      const end = bladeOutline[(i + 1) % bladeOutline.length];
      if (Math.abs(end[1] - start[1]) < 1e-9 || y < Math.min(start[1], end[1]) || y > Math.max(start[1], end[1])) return;
      crossings.push(start[0] + (end[0] - start[0]) * (y - start[1]) / (end[1] - start[1]));
    });
    return [Math.min(...crossings), Math.max(...crossings)];
  }
  const edgeZ = bladeDepth / 2 + bladeBevel * .75;
  for (const side of [1, -1]) {
    const positions: number[] = [], indices: number[] = [];
    rows.forEach(y => {
      const [left, right] = widthAt(y), t = (y - minY) / (maxY - minY);
      for (let col = 0; col <= columns; col++) {
        const u = col / columns;
        const ground = .105 * Math.sin(Math.PI * u) * Math.sin(Math.PI * t) ** .25;
        positions.push(left + (right - left) * u, y, side * (edgeZ + ground));
      }
    });
    for (let row = 0; row < rows.length - 1; row++) for (let col = 0; col < columns; col++) {
      const a = row * (columns + 1) + col, b = a + 1, c = a + columns + 1, d = c + 1;
      if (side > 0) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
    // A single shared apex avoids collapsed triangles at the asymmetric point.
    const apex = positions.length / 3;
    positions.push(-.315, maxY, side * edgeZ);
    const lastRow = (rows.length - 1) * (columns + 1);
    for (let col = 0; col < columns; col++) {
      if (side > 0) indices.push(lastRow + col, lastRow + col + 1, apex);
      else indices.push(lastRow + col, apex, lastRow + col + 1);
    }
    const groundFace = new THREE.BufferGeometry();
    groundFace.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    groundFace.setIndex(indices);groundFace.computeVertexNormals();
    append(batch, groundFace, gold);groundFace.dispose();
  }

  for (const side of [-1, 1]) for (const shift of [0, -.58]) {
    const hook = new THREE.Shape();
    hook.moveTo(side * .14, 1.00 + shift);
    hook.bezierCurveTo(side * .29, 1.035 + shift, side * .37, 1.19 + shift, side * .325, 1.55 + shift);
    hook.bezierCurveTo(side * .305, 1.33 + shift, side * .29, 1.18 + shift, side * .14, 1.15 + shift);
    hook.closePath();
    bevel(hook, gold, brightGold, .045, .009);
  }

  // Angular burgundy quillons echo the reference's compact, dark guard.
  for (const side of [-1, 1]) {
    const quillon = shape([[0, .18], [side * .15, .185], [side * .315, .335],
      [side * .284, .18], [side * .355, .025], [side * .19, .065], [0, .025]]);
    bevel(quillon, guard, guardEdge, .074, .012);
  }
  const handle = new THREE.CylinderGeometry(.056, .056, .35, 16);
  append(batch, handle, grip, [0, -.13, 0]);handle.dispose();
  for (const y of [-.282, -.19, -.097, .018]) {
    const band = new THREE.CylinderGeometry(.058, .058, .016, 16);
    append(batch, band, gripBand, [0, y, 0]);band.dispose();
  }
  const sphere = new THREE.SphereGeometry(1, 18, 12);
  append(batch, sphere, brightGold, [0, -.365, 0], [.073, .065, .073]);
  // Layered closed oval volumes form the gold bezel and polished red gem.
  append(batch, sphere, brightGold, [0, .116, .063], [.126, .153, .032]);
  append(batch, sphere, guard, [0, .116, .085], [.108, .134, .023]);
  append(batch, sphere, gem, [0, .116, .105], [.091, .116, .029]);
  append(batch, sphere, reflection, [-.023, .164, .131], [.012, .026, .004]);
  // The back of the guard has a matching restrained gold setting.
  append(batch, sphere, brightGold, [0, .116, -.061], [.120, .146, .022]);
  append(batch, sphere, guard, [0, .116, -.078], [.101, .127, .013]);
  sphere.dispose();
  return finish(sword, batch);
}
