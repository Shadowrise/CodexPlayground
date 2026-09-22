import { createForest } from './forest';
import { spatialInstances } from './spatial-instances';
import { createLandmarks, sceneryClearance } from './landmarks';
import * as THREE from 'three';
import { MEADOW_HALF_SIZE } from './world-bounds';
import { createMountains } from './mountains';

/** Seeded scenery with instanced grass and trees. */
export function addEnvironment(scene: THREE.Scene) {
  let seed = 73219;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-.045, 0, 0, .045, 0, 0, -.025, .22, .025, .025, .22, .025, .07, .43, .07], 3));
  blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  blade.computeVertexNormals();
  const grass = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ color: '#8fbb59', roughness: 1, side: THREE.DoubleSide }), 144000);
  for (let patch = 0; patch < 1440; patch++) {
    const angle = random() * Math.PI * 2, radius = 3 + Math.sqrt(random()) * 64;
    const x = patch < 180 ? Math.cos(angle) * radius : (random() * 2 - 1) * (MEADOW_HALF_SIZE - 5);
    const z = patch < 180 ? Math.sin(angle) * radius : (random() * 2 - 1) * (MEADOW_HALF_SIZE - 5);
    const patchRadius = .9 + random() * 2.5;
    for (let i = 0; i < 100; i++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random()) * patchRadius;
      dummy.position.set(x + Math.cos(a) * r, 0, z + Math.sin(a) * r);
      dummy.rotation.set(0, random() * Math.PI * 2, (random() - .5) * .3);
      const scale=.55 + random() * .9;
      dummy.scale.setScalar(sceneryClearance(dummy.position.x,dummy.position.z) ? scale : 0); dummy.updateMatrix();
      const id = patch * 100 + i;
      grass.setMatrixAt(id, dummy.matrix);
      color.setHSL(.23 + random() * .07, .43, .32 + random() * .15);
      grass.setColorAt(id, color);
    }
  }
  grass.receiveShadow = true;
  scene.add(spatialInstances(grass));

  scene.add(createForest());
  scene.add(createLandmarks());

  scene.add(createMountains());
}


