import {
  Box3, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh,
  MeshPhysicalMaterial, Vector3,
} from 'three';

let template: Group | undefined;

/** A closed, inflated heart, centred on the attachment pivot and facing +Z.
 * Instances share immutable geometry/material, like the existing fruit assets. */
export function createHealthHeartModel(): Group {
  template ??= buildHeart();
  return template.clone(true);
}

function buildHeart() {
  const segments = 96, rings = 32;
  const positions: number[] = [0, 0, .285], indices: number[] = [];
  const colors: number[] = [];
  const wine = new Color('#510a20'), ruby = new Color('#8e1231'), blush = new Color('#bf2c48');
  for (let ring = 1; ring < rings; ring++) {
    const latitude = ring / rings * Math.PI;
    const radius = Math.sin(latitude);
    for (let column = 0; column < segments; column++) {
      const angle = column / segments * Math.PI * 2;
      const x = .65 * Math.sin(angle) ** 3;
      const y = (13 * Math.cos(angle) - 5 * Math.cos(2 * angle)
        - 2 * Math.cos(3 * angle) - Math.cos(4 * angle) + 2.5) * .0405;
      // Round interior cross-sections into ellipses: carrying the outline's
      // pointed tip into every ring would crease the entire lower face.
      const outlineWeight = radius * radius;
      const roundedX = x * outlineWeight + .65 * Math.sin(angle) * (1 - outlineWeight);
      const roundedY = y * outlineWeight + .587 * Math.cos(angle) * (1 - outlineWeight);
      positions.push(roundedX * radius, roundedY * radius,
        .285 * Math.cos(latitude) * (1 + .12 * radius * Math.sin(angle) ** 2));
    }
  }
  const back = positions.length / 3;
  positions.push(0, 0, -.285);
  for (let column = 0; column < segments; column++) {
    const next = (column + 1) % segments;
    indices.push(0, 1 + next, 1 + column);
    for (let ring = 0; ring < rings - 2; ring++) {
      const a = 1 + ring * segments + column, n = 1 + ring * segments + next;
      indices.push(a, n, a + segments, n, n + segments, a + segments);
    }
    const last = 1 + (rings - 2) * segments;
    indices.push(last + column, last + next, back);
  }
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const height = Math.max(0, Math.min(1, (y + .59) / 1.18));
    const color = wine.clone().lerp(ruby, .35 + .55 * height);
    const shoulder = Math.exp(-(((x + .26) / .37) ** 2 + ((y - .3) / .32) ** 2));
    color.lerp(blush, shoulder * .25 * Math.abs(z) / .3);
    colors.push(color.r, color.g, color.b);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const material = new MeshPhysicalMaterial({
    name: 'Health heart · burgundy glaze', vertexColors: true,
    color: '#ffffff', metalness: .025, roughness: .39,
    clearcoat: .28, clearcoatRoughness: .32, specularIntensity: .45,
    emissive: '#9c1230', emissiveIntensity: .12 * 3,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'Health_heart_body'; mesh.castShadow = mesh.receiveShadow = false;
  const root = new Group(); root.name = 'Health_heart'; root.add(mesh);
  root.userData = {
    asset: 'health-heart', forward: '+Z', units: 'metres',
    sharedResources: true, role: 'NPC-carried health pickup',
    width: 1.3, presentation: 'Use HealthHeart for animated fruit-style mist.',
  };
  return root;
}

export function getHealthHeartStats() {
  const model = createHealthHeartModel(), mesh = model.children[0] as Mesh;
  const bounds = new Box3().setFromObject(model, true);
  return {
    triangles: mesh.geometry.index!.count / 3, drawCalls: 1,
    size: bounds.getSize(new Vector3()).toArray(),
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
  };
}
