import { createMountainTexture } from './mountain-texture';
import * as THREE from 'three';
import { MEADOW_HALF_SIZE as H, MOUNTAIN_WIDTH as W } from './world-bounds';

/** Continuous square heightfield: adjoining sides share their corner vertices. */
export function createMountains() {
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
  const along = 240, across = 40;
  const snow = new THREE.Color('#ffffff');
  // Same smooth boundaries as the meadow: spruce, birch, autumn and orchard.
  const greens=['#7e9a75','#a4ae7c','#b2a16a','#91ab70'].map(c=>new THREE.Color(c));
  const rocks=['#a2afb4','#c2c1ae','#bfa58b','#afafa0'].map(c=>new THREE.Color(c));
  const southColor=new THREE.Color(),green=new THREE.Color(),rock=new THREE.Color();
  function height(x: number, z: number) {
    const d = Math.max(Math.abs(x), Math.abs(z)) - H;
    const envelope = Math.sin(Math.PI * Math.max(0, Math.min(1, d / W))) ** .85;
    const broad = 51 + 18 * Math.sin(x * .037 + z * .029) + 15 * Math.cos(x * .061 - z * .043);
    const ridges = 14 * Math.abs(Math.sin(x * .14 + Math.sin(z * .09) * 2)) + 7 * Math.sin(z * .25 - x * .12);
    const crags = 3 * Math.sin(x * .71 + z * .53) + 1.5 * Math.cos(x * 1.21 - z * .91);
    return Math.max(0, (broad + ridges + crags) * envelope);
  }
  for (let side = 0; side < 4; side++) {
    const base = positions.length / 3;
    for (let j = 0; j <= across; j++) for (let i = 0; i <= along; i++) {
      const r = H + W * j / across, tangent = (i / along * 2 - 1) * r;
      const x = side === 0 ? tangent : side === 1 ? r : side === 2 ? -tangent : -r;
      const z = side === 0 ? -r : side === 1 ? tangent : side === 2 ? r : -tangent;
      const y = height(x, z);
      positions.push(x, y - .025, z);
      // Continuous UVs at corners; 64 repeats close the ring without a seam.
      uvs.push((side+i/along)*16,(r-H)/16+y/24);
      const east=.5+.5*Math.tanh((x+12*Math.sin(z*.025))/18);
      const south=.5+.5*Math.tanh((z+10*Math.sin(x*.032))/18);
      green.copy(greens[0]).lerp(greens[1],east).lerp(southColor.copy(greens[2]).lerp(greens[3],east),south);
      rock.copy(rocks[0]).lerp(rocks[1],east).lerp(southColor.copy(rocks[2]).lerp(rocks[3],east),south);
      const c = green.clone().lerp(rock, THREE.MathUtils.smoothstep(y, 5, 28));
      const slope = Math.hypot(height(x + .7, z) - height(x - .7, z), height(x, z + .7) - height(x, z - .7));
      const snowline = 62 + 5 * Math.sin(x * .21 + z * .16);
      c.lerp(snow, THREE.MathUtils.smoothstep(y, snowline, snowline + 9) * (slope < 12 ? 1 : .3));
      c.multiplyScalar(.92 + .08 * Math.sin(x * .53 + z * .47));
      colors.push(c.r, c.g, c.b);
      if (j < across && i < along) { const a = base + j * (along + 1) + i, b = a + along + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mountains = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, map:createMountainTexture(), roughness: 1 }));
  mountains.name = 'Continuous square mountain range'; mountains.receiveShadow = true;
  return mountains;
}
