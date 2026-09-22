import { BufferGeometry, CatmullRomCurve3, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, LatheGeometry, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TubeGeometry, Vector2, Vector3 } from 'three';

export function makeStrawberry() {
  const group = new Group();
  const profile = new CatmullRomCurve3([
    new Vector3(0, 0, 0), new Vector3(.085, .04, 0), new Vector3(.18, .15, 0),
    new Vector3(.275, .30, 0), new Vector3(.335, .46, 0), new Vector3(.32, .59, 0),
    new Vector3(.245, .68, 0), new Vector3(.11, .70, 0), new Vector3(0, .675, 0),
  ]).getPoints(96);
  const geometry = new LatheGeometry(profile.map(p => new Vector2(Math.max(0, p.x), p.y)), 80);
  const radiusAt = (y: number) => {
    for (let i = 1; i < profile.length; i++) {
      if (profile[i].y >= y && profile[i - 1].y <= y) {
        const a = profile[i - 1], b = profile[i];
        return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y);
      }
    }
    return .1;
  };
  const seedPoints: { y: number; a: number; r: number }[] = [];
  for (let row = 0; row < 8; row++) {
    const y = .085 + row * .073, r = radiusAt(y);
    const count = Math.round(2 * Math.PI * r / .13);
    for (let i = 0; i < count; i++) seedPoints.push({ y, r, a: (i + (row % 2) * .5) / count * Math.PI * 2 });
  }
  const pos = geometry.getAttribute('position'), colors: number[] = [];
  const base = new Color('#d92535'), light = new Color('#ed3a3f');
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const angle = Math.atan2(x, z), radius = Math.hypot(x, z);
    let dent = 0;
    for (const seed of seedPoints) {
      const da = Math.atan2(Math.sin(angle - seed.a), Math.cos(angle - seed.a)) * seed.r;
      dent += .009 * Math.exp(-((da / .023) ** 2 + ((y - seed.y) / .032) ** 2));
    }
    if (radius > .001) { x *= (radius - dent) / radius; z *= (radius - dent) / radius; }
    pos.setXYZ(i, x, y, z * .9);
    const c = base.clone().lerp(light, .35 + .25 * Math.sin(y * 11 + angle * 2)).multiplyScalar(1 - dent * 12);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  group.add(new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: .2 })));
  const seeds = new InstancedMesh(new SphereGeometry(1, 8, 6), new MeshStandardMaterial({ color: '#efc66a', roughness: .6 }), seedPoints.length);
  const dummy = new Object3D();
  seedPoints.forEach((seed, i) => {
    dummy.position.set(Math.sin(seed.a) * (seed.r - .004), seed.y, Math.cos(seed.a) * (seed.r - .004) * .9);
    const slope = (radiusAt(seed.y + .002) - radiusAt(seed.y - .002)) / .004;
    dummy.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(Math.sin(seed.a), -slope, Math.cos(seed.a) / .9).normalize());
    dummy.scale.set(.009, .018, .006); dummy.updateMatrix(); seeds.setMatrixAt(i, dummy.matrix);
  });
  group.add(seeds);
  const green = new MeshStandardMaterial({ color: '#3e822b', roughness: .7, side: DoubleSide });
  for (let i = 0; i < 7; i++) {
    const p: number[] = [], indices: number[] = [];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8, width = .065 * Math.sin(Math.PI * t);
      const r = .015 + .30 * t, y = .71 + .065 * Math.sin(Math.PI * t) - .09 * t * t;
      p.push(-width, y, r, 0, y + .018 * Math.sin(Math.PI * t), r, width, y, r);
      if (j < 8) { const a = j * 3; indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    }
    const leaf = new BufferGeometry(); leaf.setAttribute('position', new Float32BufferAttribute(p, 3)); leaf.setIndex(indices); leaf.computeVertexNormals();
    const mesh = new Mesh(leaf, green); mesh.rotation.y = i * Math.PI * 2 / 7; group.add(mesh);
  }
  const stem = new CatmullRomCurve3([new Vector3(0, .68, 0), new Vector3(.018, .78, 0), new Vector3(.065, .83, .012)]);
  group.add(new Mesh(new TubeGeometry(stem, 10, .022, 6, false), green));
  return group;
}
