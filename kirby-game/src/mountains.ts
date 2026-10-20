import { createMountainTexture } from './mountain-texture';
import * as THREE from 'three';
import { MEADOW_HALF_SIZE as H, MOUNTAIN_WIDTH as W } from './world-bounds';
import {BIOME_TERRAIN} from './biome-style';
import {mountainElevation as height,MOUNTAIN_ALONG,MOUNTAIN_ACROSS,MOUNTAIN_PEAK_SITE} from './mountain-surface';
import {createMountainWoodland} from './mountain-woodland';

/** Continuous square heightfield: adjoining sides share their corner vertices. */
export function createMountains() {
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [], normals:number[]=[];
  const along = MOUNTAIN_ALONG, across = MOUNTAIN_ACROSS;
  const snow = new THREE.Color('#f1f4f5'),forest=new THREE.Color('#294e37'),forestLight=new THREE.Color('#4e6b42'),summitStone=new THREE.Color('#a9b2b1');
  // Same smooth boundaries as the meadow: spruce, birch, autumn and orchard.
  const order=['spruce','birch','autumn','orchard'] as const;
  const greens=order.map(b=>new THREE.Color(BIOME_TERRAIN[b].foothill));
  const rocks=order.map(b=>new THREE.Color(BIOME_TERRAIN[b].rock));
  const southColor=new THREE.Color(),green=new THREE.Color(),rock=new THREE.Color();
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
      const dx=(height(x+.35,z)-height(x-.35,z))/.7,dz=(height(x,z+.35)-height(x,z-.35))/.7,slope=Math.hypot(dx,dz);
      const normal=new THREE.Vector3(-dx,1,-dz).normalize();normals.push(normal.x,normal.y,normal.z);
      const grove=.5+.25*Math.sin(x*.29+Math.sin(z*.13)*2)+.25*Math.cos(z*.33-x*.16);
      const c=green.clone().lerp(forest.clone().lerp(forestLight,grove),THREE.MathUtils.smoothstep(y,1,9));
      const rockAmount=Math.max(THREE.MathUtils.smoothstep(y,36,61),THREE.MathUtils.smoothstep(slope,2.4,4.7)*.72);
      c.lerp(rock,rockAmount);
      const snowline=58+3.5*Math.sin(x*.055+z*.043)+2*Math.cos(z*.11-x*.07);
      const snowAmount=THREE.MathUtils.smoothstep(y,snowline,snowline+12)*(1-THREE.MathUtils.smoothstep(slope,3.8,6)*.65);
      c.lerp(snow,snowAmount);
      const summitDistance=Math.hypot(x-MOUNTAIN_PEAK_SITE.x,z-MOUNTAIN_PEAK_SITE.z);
      const clearedSummit=(1-THREE.MathUtils.smoothstep(summitDistance,MOUNTAIN_PEAK_SITE.radius-.6,MOUNTAIN_PEAK_SITE.radius+1.2))*THREE.MathUtils.smoothstep(y,83.5,84.6);
      c.lerp(summitStone,clearedSummit*.92);
      c.multiplyScalar(.96+.04*Math.sin(x*.47+z*.39));
      colors.push(c.r, c.g, c.b);
      if (j < across && i < along) { const a = base + j * (along + 1) + i, b = a + along + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setIndex(indices);
  const texture=createMountainTexture();
  const mountains = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, map:texture,bumpMap:texture,bumpScale:.32,roughness: 1 }));
  mountains.name = 'Continuous square mountain range'; mountains.receiveShadow = true;
  mountains.add(createMountainWoodland());
  return mountains;
}
