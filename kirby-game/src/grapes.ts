import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshLambertMaterial, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fruitDetails, fruitSkin, fruitStem, fruitSurface } from './fruit-model';

/** A curved, serrated palmate blade with five lobes and baked radial veins. */
function grapeLeaf() {
  const positions: number[] = [], colours: number[] = [], indices: number[] = [];
  const green = new Color('#477d38'), edge = new Color('#2e6134'), vein = new Color('#8d9d57');
  const spokes = 60, rings = 6;
  for (let j = 0; j <= rings; j++) for (let i = 0; i <= spokes; i++) {
    const a = i / spokes * Math.PI * 2, t = j / rings;
    const delta = Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI));
    const notch = 1 - .44 * Math.exp(-((delta / .31) ** 2));
    const lobes = (.86 + .21 * Math.cos(a * 5)) * (.972 + .028 * Math.cos(a * 30));
    const r = t * lobes * notch;
    const x = .215 + Math.cos(a) * .217 * r, z = .067 + Math.sin(a) * .186 * r;
    const y = .948 - .079 * Math.cos(a) * r - .018 * r * r - .103 * Math.sin(a) * r;
    positions.push(x, y, z);
    const mainVein = Math.max(0, Math.cos(a * 5)) ** 20 * (1 - t * .5);
    const c = green.clone().lerp(edge, t * .48).lerp(vein, mainVein * .42 + (1 - t) * .12);
    colours.push(c.r, c.g, c.b);
    if (j < rings && i < spokes) {
      const k = j * (spokes + 1) + i, next = k + spokes + 1;
      if (j > 0) indices.push(k, next, k + 1);
      indices.push(k + 1, next, next + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** An asymmetric hanging bunch; every berry has an attached pedicel. */
export function makeGrapes() {
  const group = new Group(); group.name = 'Detailed frosted purple grape bunch';
  const berry = fruitSurface((u, v) => {
    const a = u * Math.PI * 2, t = v * Math.PI, ring = Math.sin(t);
    const r = .12 * ring * (1 + .012 * Math.cos(a * 3) * ring);
    const dimple = .010 * Math.exp(-(((1 - v) / .10) ** 2));
    return new Vector3(Math.sin(a) * r, .133 - .132 * Math.cos(t) - dimple, Math.cos(a) * r * .95);
  }, 20, 14);
  // Loosely staggered three-dimensional tiers taper to a natural tip.
  const berries = [
    [-.15, .685, .069], [.091, .674, .133], [.216, .654, -.039], [-.13, .705, -.15], [.095, .71, -.135],
    [-.23, .486, .058], [-.064, .487, .208], [.145, .49, .16], [.245, .468, -.034],
    [.098, .501, -.219], [-.155, .477, -.142], [.005, .499, -.018],
    [-.155, .293, .071], [.033, .28, .164], [.16, .304, .017], [.053, .292, -.144], [-.12, .277, -.108],
    [.002, .12, .031], [-.069, .152, -.092],
  ];
  const geometries: BufferGeometry[] = [], branches: BufferGeometry[] = [];
  berries.forEach(([x, y, z], i) => {
    const scale = .94 + .085 * (.5 + .5 * Math.sin(i * 2.37));
    const geometry = berry.clone(); geometry.translate(0, -.133, 0);
    geometry.scale(scale, scale * (1 + .035 * Math.sin(i * 1.7)), scale);
    geometry.rotateY(i * 2.399); geometry.rotateZ(Math.sin(i * 3.7) * .06); geometry.translate(x, y, z);
    const colour = new Color().setHSL(.78 + .016 * Math.sin(i * 1.8), .13, .92 + .025 * Math.sin(i * 2.9));
    const colours: number[] = [];
    for (let j = 0; j < geometry.attributes.position.count; j++) colours.push(colour.r, colour.g, colour.b);
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3)); geometries.push(geometry);
    // The slender stalk ends inside the berry's top dimple, never in mid-air.
    const tip = new Vector3(x, y + .120 * scale, z);
    const joint = new Vector3(.013 + .02 * (y / .7), Math.min(.823, y + .148), -.014);
    branches.push(fruitStem([joint, new Vector3(x * .51, joint.y - .006, z * .52), tip], .006, '#8a8d45', 6, 5));
  });
  const geometry = mergeGeometries(geometries)!; berry.dispose(); geometries.forEach(g => g.dispose());
  const body = new Mesh(geometry, new MeshLambertMaterial({ map: fruitSkin('grape'), vertexColors: true }));
  body.name = 'Grape irregular oval berries with wax bloom'; group.add(body);
  group.add(fruitDetails('Grape branching stalks and serrated leaf', [
    ...branches,
    fruitStem([new Vector3(.018, .18, -.011), new Vector3(.031, .48, -.02), new Vector3(.031, .75, -.015), new Vector3(.052, .905, 0), new Vector3(.009, .994, .009)], .019, '#77843f'),
    fruitStem([new Vector3(.009, .99, .009), new Vector3(.006, 1.017, .003)], .016, '#7b6944', 5, 6),
    fruitStem([new Vector3(.045, .883, 0), new Vector3(.075, .948, .013), new Vector3(.138, .976, .055), new Vector3(.215, .948, .067)], .008, '#718340', 8, 5),
    fruitStem([new Vector3(.034, .909, -.005), new Vector3(-.032, .946, -.025), new Vector3(-.086, .973, -.011), new Vector3(-.083, 1.009, .023), new Vector3(-.043, 1.012, .036), new Vector3(-.03, .988, .021)], .006, '#8c9450', 10, 5),
    grapeLeaf(),
  ]));
  return group;
}
