import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, MeshBasicMaterial, Object3D } from 'three';
import { createHealthHeartModel } from './health-heart-model';
import { softMist, softMistMaterial } from './soft-mist';

const mistMaterial = softMistMaterial('#e52b57', .38 * 3);
mistMaterial.blending = AdditiveBlending;
const glintGeometry = new BufferGeometry();
const outline = [[0, 1], [-.16, .16], [-1, 0], [-.16, -.16], [0, -1], [.16, -.16], [1, 0], [.16, .16]];
const glintPositions = [0, 0, .18, 0, 0, -.18], glintIndices: number[] = [];
for (const [x, y] of outline) glintPositions.push(x, y, 0);
for (let i = 0; i < outline.length; i++) {
  const next = (i + 1) % outline.length;
  glintIndices.push(0, 2 + i, 2 + next, 1, 2 + next, 2 + i);
}
glintGeometry.setAttribute('position', new Float32BufferAttribute(glintPositions, 3));
glintGeometry.setIndex(glintIndices); glintGeometry.computeVertexNormals();
const glintMaterial = new MeshBasicMaterial({
  color: '#ffc0ba', transparent: true, opacity: .85,
  blending: AdditiveBlending, depthWrite: false, toneMapped: false,
});

/** Presentation only: attach group to an NPC hand, or place it at a drop.
 * Health amount, hit detection and pickup ownership belong to game rules. */
export class HealthHeart {
  readonly group = new Group();
  readonly visual = new Group();
  readonly model = createHealthHeartModel();
  readonly aura = softMist(mistMaterial);
  readonly glints = new InstancedMesh(glintGeometry, glintMaterial, 6);
  mistEnabled = true;
  glintsEnabled = true;
  floating = true;
  spinEnabled = false;
  private disposed = false;
  private readonly particle = new Object3D();

  constructor(readonly phase = 0) {
    this.group.name = 'Health heart · attachment pivot';
    this.visual.name = 'Health heart · idle presentation';
    this.aura.name = 'Health heart · crimson fruit mist';
    this.glints.name = 'Health heart · healing glints';
    this.glints.frustumCulled = false;
    this.group.add(this.visual);
    this.visual.add(this.model, this.aura, this.glints);
    this.update(0);
  }

  /** Absolute seconds; no drift and no per-frame geometry/material allocation. */
  update(seconds: number) {
    if (this.disposed) return;
    const time = (Number.isFinite(seconds) ? Math.max(0, seconds) : 0) + this.phase;
    this.visual.position.y = this.floating ? .065 * Math.sin(time * 1.6) : 0;
    this.model.rotation.set(0, this.spinEnabled ? time * .34 : 0,
      this.floating ? .025 * Math.sin(time * .9) : 0);
    this.aura.visible = this.mistEnabled;
    this.aura.position.set(0, -.015, -.04);
    const swell = 1 + .035 * Math.sin(time * 1.8);
    this.aura.scale.set(1.08 * 1.6 * swell, 1.04 * 1.6 * swell, .71 * 1.6 * swell);
    this.glints.visible = this.glintsEnabled;
    if (!this.glintsEnabled) return;
    for (let i = 0; i < this.glints.count; i++) {
      const angle = i * 2.39996 + time * .19;
      const rise = ((time * .13 + i / this.glints.count) % 1 + 1) % 1;
      const pulse = Math.sin(Math.PI * rise) ** 2;
      this.particle.position.set(Math.cos(angle) * (.66 + .1 * Math.sin(i * 3)),
        -.7 + rise * 1.6, Math.sin(angle) * .34);
      this.particle.rotation.set(.12, time * .3 + i, .2 * Math.sin(time + i));
      this.particle.scale.set(.022 * pulse, .044 * pulse, .022 * pulse);
      this.particle.updateMatrix(); this.glints.setMatrixAt(i, this.particle.matrix);
    }
    this.glints.instanceMatrix.needsUpdate = true;
  }

  /** Geometry and materials stay cached for other NPCs/pickups. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    this.group.visible = false;
    this.glints.dispose();
  }
}
