import {
  BufferGeometry, CatmullRomCurve3, Color, DataTexture, DoubleSide,
  Float32BufferAttribute, LinearFilter, LinearMipmapLinearFilter,
  Mesh, MeshLambertMaterial, RepeatWrapping, SRGBColorSpace, TubeGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Skin = 'peach' | 'orange' | 'pear' | 'watermelon' | 'cherry' | 'grape';
const skins = new Map<Skin, DataTexture>();
const detailsMaterial = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });
export const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Seamless, non-directional skin grain, generated once rather than every frame. */
function noise(u: number, v: number, columns: number, rows: number, seed: number) {
  const x = u * columns, y = v * rows, ix = Math.floor(x), iy = Math.floor(y);
  const tx = smooth(0, 1, x - ix), ty = smooth(0, 1, y - iy);
  const value = (cx: number, cy: number) => {
    cx = (cx % columns + columns) % columns;
    cy = (cy % rows + rows) % rows;
    let h = Math.imul(cx + seed, 374761393) ^ Math.imul(cy + seed * 17, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295 * 2 - 1;
  };
  const a = value(ix, iy), b = value(ix + 1, iy), c = value(ix, iy + 1), d = value(ix + 1, iy + 1);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

/** One small mipmapped colour map per fruit species; no normal/specular maps. */
export function fruitSkin(kind: Skin) {
  const cached = skins.get(kind);
  if (cached) return cached;
  const width = 512, height = 256, pixels = new Uint8Array(width * height * 4);
  const seed = { peach: 43, orange: 79, pear: 127, watermelon: 193, cherry: 251, grape: 317 }[kind];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / (height - 1), phi = u * Math.PI * 2;
    const cloud = noise(u, v, 12, 7, seed), mottle = noise(u, v, 47, 29, seed + 1);
    const grain = noise(u, v, 181, 109, seed + 2);
    let r: number, g: number, b: number;
    if (kind === 'peach') {
      const blush = smooth(-.3, .85, Math.cos(phi)) * Math.sin(Math.PI * v) ** .65 * (.8 + cloud * .2);
      const cleft = Math.exp(-((Math.sin(phi) / .085) ** 2)) * Math.sin(Math.PI * v) * 7;
      const fuzz = grain * 3 + mottle * 2;
      r = 247 - blush * 19 + cloud * 4 + fuzz - cleft;
      g = 183 - blush * 92 + cloud * 8 + fuzz - cleft;
      b = 100 - blush * 13 + cloud * 6 + fuzz - cleft * .5;
    } else if (kind === 'orange') {
      const green = smooth(.83, 1, v) * (1 + cloud) * 9;
      r = 239 + cloud * 7 + mottle * 2 - green + grain;
      g = 129 + cloud * 10 + mottle * 3 + green * .2 + grain;
      b = 24 + cloud * 4 + mottle * 2 + grain;
    } else if (kind === 'pear') {
      const blush = smooth(.1, .9, Math.cos(phi + .6)) * Math.sin(Math.PI * v) * .35;
      const russet = smooth(.7, .99, v) * smooth(-.3, .6, mottle) * 27;
      r = 185 + cloud * 13 + mottle * 4 + blush * 22 - russet * .5 + grain;
      g = 194 + cloud * 11 + mottle * 3 - blush * 51 - russet + grain;
      b = 73 + cloud * 7 + mottle * 2 - blush * 13 - russet * .15 + grain;
    } else if (kind === 'cherry') {
      const blush = smooth(-.7, .85, Math.cos(phi + .5)) * Math.sin(Math.PI * v);
      const stemBed = smooth(.88, .99, v) * 17;
      const suture = Math.exp(-((Math.sin(phi) / .08) ** 2)) * smooth(.45, .9, v) * 5;
      r = 171 + blush * 29 + cloud * 11 + mottle * 3 + grain * 1.1 - stemBed - suture;
      g = 29 + blush * 10 + cloud * 4 + mottle * 2 + grain * .7 - stemBed * .45;
      b = 49 - blush * 15 + cloud * 4 + mottle * 2 + grain * .8 - stemBed * .3;
    } else if (kind === 'grape') {
      const bloom = smooth(-.6, .75, cloud + mottle * .10);
      const stalk = smooth(.95, 1, v) * 10;
      const blossom = (1 - smooth(0, .025, v)) * 16;
      r = 113 + bloom * 15 + cloud * 4 + mottle * 1.5 + grain - stalk - blossom;
      g = 57 + bloom * 19 + cloud * 2 + mottle + grain * .7 - stalk * .5 - blossom * .4;
      b = 148 + bloom * 13 + cloud * 4 + mottle * 1.5 + grain - stalk - blossom;
    } else {
      const phase = phi * 10 + .21 * Math.sin(v * Math.PI * 9)
        + .09 * Math.sin(v * Math.PI * 27) + noise(u, v, 18, 23, seed + 3) * .85;
      const stripe = smooth(-.24 + cloud * .12, .24 + cloud * .12, Math.cos(phase));
      const angle = Math.atan2(Math.sin(phi - Math.PI), Math.cos(phi - Math.PI));
      const field = Math.exp(-((angle / .7) ** 2 + ((v - .47) / .19) ** 2)) * .83;
      const flecks = smooth(.0, .7, mottle) * smooth(.1, .7, grain);
      const veins = smooth(.32, .8, noise(u, v, 97, 17, seed + 4)) * 6;
      const speck = mottle * 8 + grain * 3 + flecks * 16 + veins;
      r = (99 - stripe * 63 + cloud * 9) * (1 - field) + 196 * field + speck;
      g = (136 - stripe * 61 + cloud * 11) * (1 - field) + 177 * field + speck;
      b = (64 - stripe * 24 + cloud * 6) * (1 - field) + 93 * field + speck * .65;
    }
    const i = (y * width + x) * 4;
    pixels[i] = Math.max(0, Math.min(255, Math.round(r)));
    pixels[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    pixels[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    pixels[i + 3] = 255;
  }
  if (kind === 'orange' || kind === 'pear') {
    // Rounded orange pores and pear lenticels stay in the shared colour map.
    // No separate speck meshes or reflective/bump-map shading is needed.
    let seed = kind === 'orange' ? 4217 : 6329;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let pore = 0; pore < (kind === 'orange' ? 15000 : 8500); pore++) {
      const cx = random() * width, cy = random() * height, radius = .65 + random() * (kind === 'orange' ? .7 : .55);
      for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
        if (y < 0 || y >= height) continue;
        for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
          const d = Math.hypot(x + .5 - cx, y + .5 - cy) / radius;
          if (d > 1) continue;
          const i = (y * width + (x + width) % width) * 4;
          for (let c = 0; c < 3; c++) {
            const shade = kind === 'orange'
              ? -7 * Math.exp(-d * d * 7) + 2 * Math.exp(-((d - .73) ** 2) * 50)
              : -[19, 30, 12][c] * (1 - smooth(.25, 1, d));
            pixels[i + c] = Math.max(0, Math.min(255, Math.round(pixels[i + c] + shade)));
          }
        }
      }
    }
  }
  const texture = new DataTexture(pixels, width, height);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  skins.set(kind, texture);
  return texture;
}

/** Continuous organic silhouette, with a welded normal across the UV seam. */
export function fruitSurface(sample: (u: number, v: number) => Vector3, columns = 40, rows = 28) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
    const u = i / columns, v = j / rows, p = sample(u, v);
    positions.push(p.x, p.y, p.z); uv.push(u, v);
    if (j < rows && i < columns) {
      const a = j * (columns + 1) + i, b = a + columns + 1;
      if (j > 0) indices.push(a, a + 1, b);
      if (j < rows - 1) indices.push(a + 1, b + 1, b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal'), normal = new Vector3();
  for (let j = 0; j <= rows; j++) {
    const a = j * (columns + 1), b = a + columns;
    if (j === 0 || j === rows) {
      normal.set(0, 0, 0);
      for (let i = a; i <= b; i++) normal.add(new Vector3().fromBufferAttribute(normals, i));
      normal.normalize();
      for (let i = a; i <= b; i++) normals.setXYZ(i, normal.x, normal.y, normal.z);
    } else {
      normal.fromBufferAttribute(normals, a).add(new Vector3().fromBufferAttribute(normals, b)).normalize();
      normals.setXYZ(a, normal.x, normal.y, normal.z); normals.setXYZ(b, normal.x, normal.y, normal.z);
    }
  }
  return geometry;
}

export function fruitColour(geometry: BufferGeometry, hex: string) {
  const colour = new Color(hex), values: number[] = [];
  for (let i = 0; i < geometry.attributes.position.count; i++) values.push(colour.r, colour.g, colour.b);
  geometry.deleteAttribute('uv');
  geometry.setAttribute('color', new Float32BufferAttribute(values, 3));
  return geometry;
}

export function fruitStem(points: Vector3[], radius: number, colour: string, segments = 12, sides = 7) {
  return fruitColour(new TubeGeometry(new CatmullRomCurve3(points), segments, radius, sides, false), colour);
}

/** A folded, curved leaf with a raised midrib and tapered edges. */
export function fruitLeaf(points: Vector3[], width: number, colour = '#40713a') {
  const curve = new CatmullRomCurve3(points), positions: number[] = [], colours: number[] = [], indices: number[] = [];
  const base = new Color(colour), vein = new Color('#849850'), edge = base.clone().multiplyScalar(.82);
  for (let j = 0; j <= 14; j++) {
    const t = j / 14, p = curve.getPoint(t), tangent = curve.getTangent(t);
    const side = new Vector3(tangent.z, 0, -tangent.x).normalize();
    const spread = width * Math.sin(Math.PI * t) ** .8;
    for (let k = -1; k <= 1; k++) {
      const q = p.clone().addScaledVector(side, k * spread);
      q.y += (k === 0 ? .014 : -.008) * Math.sin(Math.PI * t);
      positions.push(q.x, q.y, q.z);
      const c = k === 0 ? base.clone().lerp(vein, .5) : edge;
      colours.push(c.r, c.g, c.b);
    }
    if (j < 14) { const a = j * 3; indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function fruitCalyx(centre: Vector3, radius: number, colour: string, petals = 5) {
  const positions = [centre.x, centre.y + .007, centre.z], indices: number[] = [];
  for (let i = 0; i <= petals * 4; i++) {
    const angle = i / (petals * 4) * Math.PI * 2;
    const r = radius * (.72 + .28 * Math.cos(angle * petals));
    positions.push(centre.x + Math.sin(angle) * r, centre.y - .012 * (r / radius), centre.z + Math.cos(angle) * r);
    if (i < petals * 4) indices.push(0, i + 1, i + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return fruitColour(geometry, colour);
}

/** Leaves, stems and scars use one draw call, regardless of their individual colours. */
export function fruitDetails(name: string, parts: BufferGeometry[]) {
  const geometry = mergeGeometries(parts)!;
  for (const part of parts) part.dispose();
  const mesh = new Mesh(geometry, detailsMaterial); mesh.name = name;
  return mesh;
}
