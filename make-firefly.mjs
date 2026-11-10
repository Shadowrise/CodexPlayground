import * as T from './kirby-game/node_modules/three/build/three.module.js';
import { GLTFExporter } from './kirby-game/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from './kirby-game/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { writeFileSync } from 'node:fs';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};

const root = new T.Group();
root.name = 'Firefly';
root.userData = { glowMaterial: 'Firefly_Glow', glowLight: 'Firefly_Light', animations: ['Sit', 'Fly', 'LookAround', 'Groom', 'WingStretch'], forward: '+Z' };
const motion = group(root, 'Motion', [0, 0, 0]);
function material(name, color, roughness = .45, extra = {}) {
  const m = new T.MeshStandardMaterial({ color, roughness, ...extra }); m.name = name; return m;
}
const shell = material('Satin teal chitin', '#306766', .43, { vertexColors: true });
const headMat = material('Olive face with warm shading', '#879e63', .61, { vertexColors: true });
const rim = material('Honey chitin edges', '#bba16a', .42);
const black = material('Glossy deep eyes', '#101b22', .12);
const iris = material('Blue iris', '#439ea9', .24, { vertexColors: true });
const white = material('Eye highlights', '#f5fcf1', .15);
const legMat = material('Dusky plum legs', '#725b7d', .57, { vertexColors: true });
const antennaMat = material('Mulberry antenna stems', '#685375', .6, { vertexColors: true });
const tipMat = material('Warm copper antenna tips', '#e4ad70', .48, { vertexColors: true });
const padMat = material('Soft mauve foot pads', '#aa87a1', .64, { vertexColors: true });
const detailMat = material('Quiet olive chitin details', '#68745a', .58, { vertexColors: true });
const mouthMat = material('Warm smile', '#354735', .65);
const blush = material('Soft peach cheeks', '#c6a17d', .8, { vertexColors: true });
const glow = material('Firefly_Glow', '#deff89', .38);
glow.emissive.set('#baff55'); glow.emissiveIntensity = 2.2;
const wingMat = material('Translucent wings', '#c4dfd3', .34, {
  transparent: true, opacity: .29, side: T.DoubleSide, depthWrite: false, vertexColors: true,
});
const veinMat = material('Fine wing veins', '#9dbbad', .48, { transparent: true, opacity: .55, depthWrite: false });

function group(parent, name, position) {
  const g = new T.Group(); g.name = name; g.position.set(...position); parent.add(g); return g;
}
function mesh(parent, name, geometry, mat) {
  const m = new T.Mesh(geometry, mat); m.name = name; parent.add(m); return m;
}
function paint(geometry, tint = () => 1) {
  const p = geometry.attributes.position, colors = [];
  for (let i = 0; i < p.count; i++) {
    const value = tint(p.getX(i), p.getY(i), p.getZ(i));
    colors.push(...(Array.isArray(value) ? value : [value, value, value]));
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); return geometry;
}
function ell(parent, name, position, scale, mat, detail = [24, 16], tint) {
  const geo = new T.SphereGeometry(1, ...detail); if (mat.vertexColors) paint(geo, tint);
  const m = mesh(parent, name, geo, mat); m.position.set(...position); m.scale.set(...scale); return m;
}
// Iris, pupil and highlights follow the eye surface instead of protruding discs.
const eyeSize = [.119, .158, .073];
function eyePatch(parent, name, center, scale, offset, mat, tint) {
  const geo = new T.RingGeometry(0, 1, 40, scale[0] + scale[1] > .1 ? 8 : 4), p = geo.attributes.position;
  if (mat.vertexColors) paint(geo, tint);
  for (let i = 0; i < p.count; i++) {
    const x = center[0] + p.getX(i) * scale[0], y = center[1] + p.getY(i) * scale[1];
    p.setXYZ(i, x, y, .014 + eyeSize[2] * Math.sqrt(Math.max(0, 1 - (x / eyeSize[0]) ** 2 - (y / eyeSize[1]) ** 2)) + offset);
  }
  geo.computeVertexNormals(); return mesh(parent, name, geo, mat);
}
// Vary each curve's section, avoiding constant-width tubes and ball tips.
function tapered(parent, name, points, radii, mat, segments = 18, sides = 8) {
  const path = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
  const geo = new T.TubeGeometry(path, segments, 1, sides, false), p = geo.attributes.position;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, center = path.getPointAt(t), step = t * (radii.length - 1);
    const k = Math.min(radii.length - 2, Math.floor(step)), radius = T.MathUtils.lerp(radii[k], radii[k + 1], step - k);
    for (let j = 0; j <= sides; j++) {
      const index = i * (sides + 1) + j;
      p.setXYZ(index, center.x + (p.getX(index) - center.x) * radius,
        center.y + (p.getY(index) - center.y) * radius, center.z + (p.getZ(index) - center.z) * radius);
    }
  }
  geo.computeVertexNormals();
  if (mat.vertexColors) paint(geo, (x, y) => .84 + .16 * Math.max(0, Math.min(1, y + .5)));
  return mesh(parent, name, geo, mat);
}
// Bake detail into rigid parts to keep the existing distant instancing cheap.
function combine(parent, mat, name) {
  const parts = parent.children.filter(o => o.isMesh && o.material === mat); if (!parts.length) return;
  const geometries = parts.map(o => { o.updateMatrix(); return o.geometry.clone().applyMatrix4(o.matrix); });
  const merged = mesh(parent, name, mergeGeometries(geometries), mat);
  for (const part of parts) { parent.remove(part); part.geometry.dispose(); }
  geometries.forEach(g => g.dispose()); return merged;
}

ell(motion, 'Thorax', [0, .8, .03], [.32, .32, .43], shell, [32, 20],
  (x, y, z) => .77 + .2 * Math.max(0, y) + .025 * Math.sin(z * 15));
ell(motion, 'Glow_Abdomen', [0, .74, -.6], [.4, .35, .65], glow, [32, 24]);
const lamp = new T.PointLight('#baff55', .8, 3.5, 2);
lamp.name = 'Firefly_Light'; lamp.position.set(0, .69, -.92); motion.add(lamp);
// Flush ventral plates follow the actual abdomen surface.
for (let i = 0; i < 4; i++) {
  const z = -.36 - i * .18, section = Math.sqrt(1 - ((z + .6) / .65) ** 2);
  tapered(motion, `Abdomen_segment_${i}`, Array.from({ length: 13 }, (_, j) => {
    const a = Math.PI * (1.05 + j / 12 * .9);
    return [.403 * section * Math.cos(a), .74 + .353 * section * Math.sin(a), z];
  }), [.005, .009, .005], detailMat, 24, 6);
}
combine(motion, detailMat, 'Abdomen_segment_plates');
const head = group(motion, 'Head', [0, 1.08, .47]);
const face = ell(head, 'Face', [0, 0, 0], [.39, .35, .34], headMat, [40, 28],
  (x, y, z) => {
    const grain = .012 * Math.sin(x * 61 + z * 17) * Math.sin(y * 53 - z * 31);
    const shade = .82 + .16 * Math.max(0, y) + grain;
    return [shade, shade, shade * (.95 + .05 * Math.max(0, y))];
  });
// A narrower chin and broad forehead retain the friendly large-head silhouette.
const fp = face.geometry.attributes.position;
for (let i = 0; i < fp.count; i++) fp.setX(i, fp.getX(i) * (1 - .12 * Math.max(0, -fp.getY(i))));
face.geometry.computeVertexNormals();
const antennas = [], antennaRigs = [], legs = [], wings = [], covers = [], eyes = [], feet = [];

for (const side of [-1, 1]) {
  const label = side < 0 ? 'Left' : 'Right';
  const eye = group(head, `${label}_Eye`, [side * .167, .064, .273]); eyes.push(eye);
  const features=group(eye,`${label}_Eye_features`,[0,0,0]);features.scale.setScalar(.8);
  ell(features, `${label}_Socket`, [0, 0, -.006], [.137, .181, .073], headMat, [24, 16], (x, y) => .68 + .22 * Math.max(0, y));
  ell(features, `${label}_Eye_black`, [0, 0, .014], [.119, .158, .073], black, [32, 24]);
  eyePatch(features, `${label}_Iris`, [side * .008, -.032], [.069, .084], .0014, iris,
    (x, y) => {
      const shade = .74 + .25 * Math.max(0, -y) + .08 * Math.sin(Math.atan2(y, x) * 22);
      return [shade * .8, shade, Math.min(1, shade * 1.06)];
    });
  eyePatch(features, `${label}_Pupil`, [side * .008, -.025], [.032, .055], .0028, black);
  eyePatch(features, `${label}_Catchlight`, [-.032, .061], [.031, .038], .0032, white);
  eyePatch(features, `${label}_Small_glint`, [.035, -.074], [.012, .015], .0032, white);
  combine(features, black, `${label}_Eye_black`); combine(features, white, `${label}_Catchlights`);
  tapered(features, `${label}_Upper_eyelid`, [[-.121, .032, .02], [-.09, .134, .029], [0, .169, .026], [.092, .125, .027], [.12, .036, .02]],
    [.009, .014, .009], headMat, 24);
  combine(features, headMat, `${label}_Eyelids`);
  tapered(head, `${label}_Brow`, [[side * .07, .244, .202], [side * .16, .263, .211], [side * .25, .228, .178]], [.003, .011, .002], detailMat);
  // Thin blush patches sit flush against the face, without round cheek beads.
  const cheek = ell(head, `${label}_Cheek`, [side * .267, -.096, .215], [.056, .029, .006], blush, [24, 16],
    (x, y) => .72 + .27 * Math.max(0, 1 - x * x - y * y));
  cheek.rotation.y = side * .46;
  tapered(head, `${label}_Smile_dimple`, [[side * .104, -.137, .289], [side * .115, -.126, .281]], [.007, .002], mouthMat, 6);

  const antenna = group(head, `${label}_Antenna`, [side * .19, .235, .015]); antennas.push(antenna);
  ell(antenna, `${label}_Antenna_socket`, [0, .006, 0], [.036, .029, .031], headMat, [16, 12]);
  const antennaPoints = [[0, 0, 0], [side * .068, .18, .012], [side * .16, .37, .055], [side * .245, .43, .108], [side * .295, .41, .158]];
  const path = new T.CatmullRomCurve3(antennaPoints.map(p => new T.Vector3(...p)));
  // Short rigid links distribute the bend smoothly while keeping the meadow's
  // instancing path compatible with the complete animated model.
  const sections = [];
  for(let i=0;i<8;i++){
    const origin=path.getPointAt(i/8),previous=sections[i-1];
    const node=i===0?antenna:group(previous.node,`${label}_Antenna_${i===1?'bend':i===2?'flex':'bend_'+i}`,origin.clone().sub(previous.origin).toArray());
    sections.push({node,start:i/8,end:(i+1)/8,origin});
  }
  const bend=sections[1].node,flex=sections[7].node,flexOrigin=sections[7].origin;
  for (const {node,start,end,origin} of sections) {
    const points = Array.from({length:13}, (_,i) => path.getPointAt(start+(end-start)*i/12).sub(origin).toArray());
    tapered(node, `${label}_Antenna_stem_${start}`, points, [.019-.013*start,.019-.013*end], antennaMat, 16);
  }
  // Retain the slender sensory-club silhouette, with a distinct warm tip colour.
  const tip = ell(flex, `${label}_Antenna_tip`, new T.Vector3(side * .286, .416, .149).sub(flexOrigin).toArray(), [.02, .016, .048], tipMat, [20, 14], () => 1.08);
  tip.rotation.y = side * .55; tip.rotation.z = -side * .22;
  for (let i = 1; i <= 8; i++) {
    const t = .15 + i * .082, center = path.getPointAt(t), tangent = path.getTangentAt(t);
    const section = sections.find(section=>t<=section.end) ?? sections.at(-1);
    const ring = new T.Mesh(new T.TorusGeometry(.017 - t * .01, .0018, 4, 10), antennaMat);
    paint(ring.geometry, () => .73); ring.position.copy(center).sub(section.origin); ring.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), tangent);
    ring.name = `${label}_Antenna_segment_${i}`; section.node.add(ring);
  }
  for (const [index,section] of sections.entries()) combine(section.node, antennaMat, `${label}_Antenna_stem_${index}`);
  antennaRigs.push({antenna,bend,flex,path,sections,side});

  const cover = group(motion, `${label}_Wing_cover`, [side * .13, 1.015, .03]); covers.push(cover);
  const elytron = ell(cover, `${label}_Elytron`, [side * .14, 0, -.4], [.24, .12, .56], shell, [40, 24],
    (x, y, z) => {
      const ribs = Math.cos((x * side + .1) * 28 + z * .35) ** 10;
      const pores = Math.sin(x * 113 + z * 61) * Math.sin(z * 107 - y * 29);
      return .8 + .17 * Math.max(0, y) + .065 * ribs + .014 * pores;
    });
  const ep = elytron.geometry.attributes.position;
  for (let i = 0; i < ep.count; i++) ep.setX(i, ep.getX(i) * (1 - .15 * Math.max(0, -ep.getZ(i))));
  elytron.geometry.computeVertexNormals();
  tapered(cover, `${label}_Elytron_seam`, [[side * .012, .06, .03], [side * .012, .118, -.27], [side * .036, .095, -.64], [side * .095, .025, -.91]],
    [.003, .006, .005, .002], rim, 32, 6);
  for (const offset of [-.045, .045, .12]) {
    const points = [];
    for (let j = 0; j <= 18; j++) {
      const z = -.4 + .46 - j / 18 * .92, nz = (z + .4) / .56;
      const dx = offset * Math.sqrt(Math.max(0, 1 - nz * nz));
      const y = .12 * Math.sqrt(Math.max(0, 1 - nz * nz - (dx / .24) ** 2));
      points.push([side * (.14 + dx * (1 - .15 * Math.max(0, -nz))), y + .002, z]);
    }
    tapered(cover, `${label}_Elytron_ridge_${offset}`, points, [.001, .0035, .001], shell, 28, 6);
  }
  combine(cover, shell, `${label}_Elytron`);

  const wing = group(motion, `${label}_Wing`, [side * .21, 1.03, .025]); wings.push(wing);
  // Cambered membrane and veins share one surface, with no floating lines.
  const wingPoint = (t, across) => {
    const width = .012 + .255 * Math.sin(Math.PI * t) ** .72;
    return [side * 1.42 * t, .012 + .028 * Math.sin(Math.PI * t) * (1 - across * across), -.19 * t + across * width];
  };
  const wp = [], wc = [], uv = [], indices = [], rows = 36, cols = 10;
  for (let j = 0; j <= rows; j++) for (let k = 0; k <= cols; k++) {
    const t = j / rows, across = k / cols * 2 - 1;
    wp.push(...wingPoint(t, across)); uv.push(t, k / cols);
    const shade = .84 + .14 * Math.abs(across); wc.push(shade, shade, shade);
    if (j < rows && k < cols) { const a = j * (cols + 1) + k, b = a + cols + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  const membrane = new T.BufferGeometry(); membrane.setAttribute('position', new T.Float32BufferAttribute(wp, 3));
  membrane.setAttribute('color', new T.Float32BufferAttribute(wc, 3)); membrane.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  membrane.setIndex(indices); membrane.computeVertexNormals(); mesh(wing, `${label}_Membrane`, membrane, wingMat);
  const vein = (name, samples, radius = .004) => tapered(wing, name, samples.map(([t, a]) => {
    const p = wingPoint(t, a); p[1] += .002; return p;
  }), [radius, radius * .72, .001], veinMat, 18, 5);
  vein(`${label}_Leading_vein`, Array.from({ length: 19 }, (_, j) => [j / 18, .97]), .007);
  vein(`${label}_Trailing_vein`, Array.from({ length: 19 }, (_, j) => [j / 18, -.98]), .004);
  vein(`${label}_Central_vein`, [[0, 0], [.28, .12], [.65, .02], [1, 0]], .006);
  for (let j = 0; j < 6; j++) {
    const t = .2 + j * .115;
    for (const edge of [-1, 1]) vein(`${label}_Vein_${j}_${edge}`, [[t - .1, .05], [t, edge * .38], [t + .1, edge * .96]], .0035);
  }
  combine(wing, veinMat, `${label}_Wing_veins`);

  for (let i = 0; i < 3; i++) {
    const leg = group(motion, `${label}_Leg_${i}`, [side * .24, .69, .23 - i * .28]);
    const footZ = [.18,-.06,-.36][i], restFoot = new T.Vector3(side*.4,-.658,footZ);
    const knee = [side * .36, -.14, footZ * .32];
    const lower = group(leg, `${label}_Knee_joint_${i}`, knee);
    const local = p => new T.Vector3(...p).sub(lower.position).toArray();
    const ankle = [side * .386, -.59, footZ-.035];
    ell(leg, `${label}_Coxa_${i}`, [side * .026, -.025, 0], [.053, .045, .054], legMat, [16, 12], () => .75);
    tapered(leg, `${label}_Femur_${i}`, [[0, 0, 0], [side * .15, -.048, footZ*.12], knee], [.028, .035, .022], legMat, 14);
    ell(lower, `${label}_Knee_${i}`, [0,0,0], [.027, .029, .027], legMat, [16, 12], () => .76);
    tapered(lower, `${label}_Tibia_${i}`, [knee, [side * .372, -.36, footZ-.015], ankle].map(local), [.023, .018, .011], legMat, 16);
    tapered(lower, `${label}_Tarsus_${i}`, [ankle, [side * .405, -.635, footZ-.01], restFoot.toArray()].map(local), [.013, .01, .006], legMat, 12);
    for (let toe = -1; toe <= 1; toe += 2) tapered(lower, `${label}_Claw_${i}_${toe}`,
      [[side*.4+toe*.014,-.662,footZ+.016],[side*.403+toe*.019,-.669,footZ+.038],[side*.401+toe*.016,-.673,footZ+.052]].map(local),
      [.006, .004, .0015], legMat, 8, 6);
    combine(leg, legMat, `${label}_Leg_shape_${i}`);
    combine(lower, legMat, `${label}_Lower_leg_shape_${i}`);
    const foot = ell(lower, `${label}_Foot_${i}`, local(restFoot.toArray()), [.031,.016,.033], padMat, [20,12], ()=>.93);
    legs.push({leg,lower,foot,restFoot,side,i});feet.push({foot,side,i});
  }
}
tapered(head, 'Gentle_smile', [[-.105, -.14, .291], [-.055, -.166, .302], [0, -.174, .302], [.055, -.166, .302], [.105, -.14, .291]],
  [.003, .008, .003], mouthMat, 28, 8);
combine(head, mouthMat, 'Gentle_smile'); combine(head, blush, 'Soft_cheeks'); combine(head, detailMat, 'Expressive_brows');

const clips = [];
function quaternionTrack(node, times, angles) {
  const values = [];
  for (const a of angles) { const q = new T.Quaternion().setFromEuler(new T.Euler(...a)); values.push(q.x, q.y, q.z, q.w); }
  return new T.QuaternionKeyframeTrack(`${node.name}.quaternion`, times, values);
}
const smooth = (t, a, b) => T.MathUtils.smoothstep(t, a, b);
const windowAt = (t, a, b, edge = .35) => smooth(t, a, a + edge) * (1 - smooth(t, b - edge, b));
// Solve the authored rigid upper/lower links, so the visible pad follows the
// actual bent antenna rather than a fixed hand-waving direction.
function reachLeg(rig, target, amount) {
  const upper = rig.lower.position.clone(), lower = rig.foot.position.clone();
  const a = upper.length(), b = lower.length(), distance = target.length();
  const d = T.MathUtils.clamp(distance, Math.abs(a-b)+.0001, a+b-.0001);
  const restDirection=rig.restFoot.clone().normalize();
  const restPole=rig.lower.position.clone().addScaledVector(restDirection,-rig.lower.position.dot(restDirection)).normalize();
  const forward = target.clone().normalize(), pole = restPole.lerp(new T.Vector3(rig.side*1.5,.05,.55).normalize(),Math.min(1,amount*2));
  pole.addScaledVector(forward, -pole.dot(forward)).normalize().applyAxisAngle(forward,-.95*rig.side*amount);
  const along = (a*a-b*b+d*d)/(2*d), height = Math.sqrt(Math.max(0,a*a-along*along));
  const elbow = forward.clone().multiplyScalar(along).addScaledVector(pole,height);
  const hip = new T.Quaternion().setFromUnitVectors(upper.normalize(),elbow.clone().normalize());
  const shin = target.clone().sub(elbow).applyQuaternion(hip.clone().invert()).normalize();
  return {hip,knee:new T.Quaternion().setFromUnitVectors(lower.normalize(),shin),reachable:distance<a+b};
}
const bindPose = new Map();root.traverse(node=>bindPose.set(node,{p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()}));
const modes = [{ name: 'Sit', duration: 12 }, { name: 'Fly', duration: 2 },
  { name: 'LookAround', duration: 8 }, { name: 'Groom', duration: 8 }, { name: 'WingStretch', duration: 8 }];
for (const { name, duration } of modes) {
  const flying = name === 'Fly', tracks = [], samples = duration * (flying || name==='Groom' ? 60 : 30);
  const times = Array.from({ length: samples + 1 }, (_, i) => duration * i / samples);
  const phase = t => t * Math.PI * 2 / duration;
  const leftGroom = t => name === 'Groom' ? windowAt(t, .7, 3.5, .65) : 0;
  const rightGroom = t => name === 'Groom' ? windowAt(t, 4, 6.8, .65) : 0;
  const opening = t => {
    if (flying) return 1;
    if (name === 'WingStretch') return .85 * windowAt(t, 1, 6.6, 1.1);
    if (name === 'Sit') return Math.max(windowAt(t, 3, 4.1, .28), windowAt(t, 9.1, 10, .25));
    return 0;
  };
  const looking = t => name === 'LookAround' ? .38 * windowAt(t, .6, 3.2, .8) - .33 * windowAt(t, 3.7, 6.6, .8)
    : name === 'Sit' ? .16 * windowAt(t, 5.2, 7.6, .8) - .13 * windowAt(t, 10.4, 11.8, .4) : 0;
  tracks.push(new T.VectorKeyframeTrack('Motion.position', times, times.flatMap(t => [0,
    flying ? .35 + .038 * Math.sin(phase(t) * 2) : .005 * (1 - Math.cos(phase(t) * 2)), 0])));
  tracks.push(quaternionTrack(motion, times, times.map(t => flying
    ? [.018 * Math.sin(phase(t)), 0, .022 * Math.sin(phase(t) * 2)] : [0, 0, 0])));
  const headAngles = t => [
    .025 * Math.sin(phase(t)) + .12 * (leftGroom(t) + rightGroom(t)),
    .065 * Math.sin(phase(t)) + looking(t) - .1 * (leftGroom(t) - rightGroom(t)),
    .018 * Math.sin(phase(t) * 2) - looking(t) * .18,
  ];
  tracks.push(quaternionTrack(head, times, times.map(headAngles)));
  const antennaAngles = (rig,t) => {
    const i=rig.side>0?1:0,w=phase(t),g=i?rightGroom(t):leftGroom(t),side=rig.side;
    // The cleaning stroke folds beside the eye rim, clearing the lens and lids.
    return [
      [(1-g)*(flying?.11:.045)*Math.sin(w*(flying?3:2)+i*.8)+.8*g,
        (1-g)*.035*Math.sin(w*2+i)+side*.06*g,
        side*((1-g)*(flying?.12:.065)*Math.sin(w*2+i*.7)-.28*g)],
      ...rig.sections.slice(1).map((_,j)=>[3.4/7*g+(1-g)*(flying?.018:.004)*Math.sin(w*2+i-j*.24),0,side*.8/7*g]),
    ];
  };
  for(const rig of antennaRigs)for(const [index,{node}] of rig.sections.entries())
    tracks.push(quaternionTrack(node,times,times.map(t=>antennaAngles(rig,t)[index])));
  wings.forEach((wing, i) => {
    const side = i ? 1 : -1;
    tracks.push(quaternionTrack(wing, times, times.map(t => {
      const e = opening(t), flutter = name === 'WingStretch' ? .07 * Math.sin(phase(t) * 5) : .24 * Math.sin(t * Math.PI * 16);
      return flying ? [0, side * .05, side * (.1 + .7 * Math.sin(t * Math.PI * 12))]
        : [0, side * (1.27 * (1 - e) + .15 * e), side * (.06 + e * (.3 + flutter))];
    })));
    tracks.push(new T.VectorKeyframeTrack(wing.name + '.scale', times, times.flatMap(t => {
      const s = .04 + .96 * opening(t); return [s, s, s];
    })));
  });
  covers.forEach((cover, i) => tracks.push(quaternionTrack(cover, times, times.map(t => {
    const side = i ? 1 : -1, e = opening(t); return [0, side * .42 * e, side * .65 * e];
  }))));
  for(const rig of legs){
    const hips=[],knees=[],{leg,lower,side,i}=rig;
    for(const t of times){
      const w=phase(t),g=i===0?(side<0?leftGroom(t):rightGroom(t)):0;
      const hip=new T.Quaternion().setFromEuler(new T.Euler(
        flying?-.2+.1*Math.sin(w*2+i*.95+side*.5):0,
        flying?.045*Math.sin(w*2+i*1.3):0,
        flying?side*(.34+.085*Math.sin(w*2+i*1.25+side)):0));
      const knee=new T.Quaternion().setFromEuler(new T.Euler(flying?.10*Math.sin(w*2+i-1):0,0,flying?side*.06*Math.sin(w*2+i-1):0));
      if(g>0){
        const antenna=antennaRigs.find(antenna=>antenna.side===side);
        head.quaternion.setFromEuler(new T.Euler(...headAngles(t)));
        const angles=antennaAngles(antenna,t);
        for(const [j,{node}] of antenna.sections.entries())node.quaternion.setFromEuler(new T.Euler(...angles[j]));
        root.updateWorldMatrix(true,true);
        const start=side<0?1.35:4.65,u=T.MathUtils.clamp((t-start)/1.5,0,1);
        const curveT=.70+.26*(.5-.5*Math.cos(u*Math.PI*2));
        const section=antenna.sections.find(section=>curveT<=section.end)??antenna.sections.at(-1);
        const contact=section.node.localToWorld(antenna.path.getPointAt(curveT).sub(section.origin));
        const onHead=head.worldToLocal(contact);
        const normal=new T.Vector3(onHead.x/.39**2,onHead.y/.35**2,onHead.z/.34**2).normalize();
        onHead.addScaledVector(normal,.035);
        const contactTarget=motion.worldToLocal(head.localToWorld(onHead)).sub(leg.position);
        // Lift and lower around the cheek; the elbow and forearm stay outside
        // the head, while the pad follows the actual articulated antenna.
        const target=rig.restFoot.clone().lerp(contactTarget,g).add(new T.Vector3(side*.16,0,.25).multiplyScalar(Math.sin(Math.PI*g)));
        const solved=reachLeg(rig,target,g);
        if(g>.999&&!solved.reachable)throw Error(`Unreachable grooming target ${side}:${t.toFixed(3)} distance=${target.length()}`);
        hip.copy(solved.hip);knee.copy(solved.knee);
      }
      hips.push(...hip.toArray());knees.push(...knee.toArray());
    }
    tracks.push(new T.QuaternionKeyframeTrack(leg.name+'.quaternion',times,hips));
    tracks.push(new T.QuaternionKeyframeTrack(lower.name+'.quaternion',times,knees));
  }
  feet.forEach(({ foot, side, i }) => tracks.push(quaternionTrack(foot, times, times.map(t => [
    flying ? .13 * Math.sin(phase(t) * 2 + i) : 0, 0, flying ? side * .09 * Math.sin(phase(t) * 2 + i) : 0,
  ]))));
  const blinkTimes = flying ? [0, .7, .76, .82, .88, 2]
    : name === 'Sit' ? [0, 1.6, 1.68, 1.76, 1.84, 4.35, 4.43, 4.51, 4.59, 8.85, 8.93, 9.01, 9.09, 12]
      : [0, 1.6, 1.68, 1.76, 1.84, 5.35, 5.43, 5.51, 5.59, 8];
  eyes.forEach((eye,index) => {
    const blinkValues=blinkTimes.map((_,i)=>(flying?i===2:[2,6,10].includes(i))?.06:1);
    if(name==='Groom')tracks.push(new T.VectorKeyframeTrack(eye.name+'.scale',times,times.flatMap(t=>{
      const k=Math.max(0,blinkTimes.findIndex((v,i)=>i<blinkTimes.length-1&&t>=v&&t<=blinkTimes[i+1]));
      const blink=T.MathUtils.lerp(blinkValues[k],blinkValues[k+1],(t-blinkTimes[k])/(blinkTimes[k+1]-blinkTimes[k]));
      const g=index===0?leftGroom(t):rightGroom(t);return [1,blink*(1-g)+.9*g,1];
    })));
    else tracks.push(new T.VectorKeyframeTrack(eye.name+'.scale',blinkTimes,blinkValues.flatMap(value=>[1,value,1])));
  });
  clips.push(new T.AnimationClip(name, duration, tracks));
}
for(const [node,pose] of bindPose){node.position.copy(pose.p);node.quaternion.copy(pose.q);node.scale.copy(pose.s);}
// Transforms baked by the rigid-part merge can accumulate tiny normal errors.
root.traverse(o => {
  if (!o.isMesh) return;
  const normals = o.geometry.attributes.normal;
  for (let i = 0; i < normals.count; i++) {
    const n = new T.Vector3().fromBufferAttribute(normals, i);
    if (n.lengthSq() < 1e-10) n.set(0, 0, 1); else n.normalize();
    normals.setXYZ(i, n.x, n.y, n.z);
  }
});
const glb = await new GLTFExporter().parseAsync(root, { binary: true, animations: clips, onlyVisible: false });
writeFileSync(new URL('./firefly-animated.glb', import.meta.url), Buffer.from(glb));
writeFileSync(new URL('./kirby-game/public/models/firefly-animated.glb', import.meta.url), Buffer.from(glb));
let triangles = 0, meshes = 0;
root.traverse(o => { if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
console.log(JSON.stringify({ bytes: glb.byteLength, triangles, meshes, animations: clips.map(c => c.name), glowMaterial: glow.name }));
