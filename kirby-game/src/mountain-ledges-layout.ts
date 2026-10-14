import { MEADOW_HALF_SIZE } from './world-bounds';
import { mountainSurfaceHeight } from './mountain-surface';

export const MOUNTAIN_LEDGE_SITE = { x: MEADOW_HALF_SIZE - 8, z: MEADOW_HALF_SIZE - 8, radius: 25 };
export const LEDGE_STAND_SECONDS = 3;
export const LEDGE_RETRACT_SECONDS = .7;
export const LEDGE_HIDDEN_SECONDS = 4;
export const LEDGE_EXTEND_SECONDS = .9;
export const LEDGE_RETRACT_DISTANCE = 4.6;
export const MOUNTAIN_LEDGE_YAW = Math.PI / 4;
export type MountainLedge = { tangent: number; radial: number; y: number; width: number; depth: number; shape?: 'semicircle' };

// Locate each back edge on the first uphill face of the existing rendered mesh.
export function mountainFace(y: number, tangent = 0) {
  const start = (MEADOW_HALF_SIZE - MOUNTAIN_LEDGE_SITE.x) * Math.SQRT2 - Math.abs(tangent);
  if (y <= 0) return start;
  let previous = start;
  for (let radial = start + .25; radial <= start + 65; radial += .25) {
    const p = mountainWorld(tangent, radial);
    if (mountainSurfaceHeight(p.x, p.z) >= y) {
      let lo = previous, hi = radial;
      for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2, p = mountainWorld(tangent, mid); if (mountainSurfaceHeight(p.x, p.z) < y) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    }
    previous = radial;
  }
  throw new Error('The existing mountain has no face at height ' + y);
}
// Tuned against the actual triangles: ~9 m flights follow its uneven face.
const offsets = [-4.2,4.8,-3.8,5.2,.5,6.9,2.2,8.8,3.6,10.2,4.8];
// Keep the former 2.4 × 2.8 m landing area when rounding the exposed rock.
export const MOUNTAIN_STEP_RADIUS = Math.sqrt(2 * 2.4 * 2.8 / Math.PI);
export const MOUNTAIN_STEPS: readonly MountainLedge[] = offsets.map((tangent,i)=>{
  const y=(i+1)*2.56;
  return {tangent,radial:mountainFace(y,tangent)-MOUNTAIN_STEP_RADIUS/2,y,width:2*MOUNTAIN_STEP_RADIUS,depth:MOUNTAIN_STEP_RADIUS,shape:'semicircle'};
});
// Triple the previous half-circle's area and embed its left end in the real slope.
export const MOUNTAIN_SUMMIT_RADIUS = Math.sqrt(12 * 4.4 * 4.2 / Math.PI);
const summitTangent=-4,summitHeight=30.72;
const summitBack=Math.max(mountainFace(summitHeight,summitTangent),mountainFace(summitHeight,summitTangent-MOUNTAIN_SUMMIT_RADIUS)+.15);
export const MOUNTAIN_SUMMIT: MountainLedge = { tangent: summitTangent, radial: summitBack - MOUNTAIN_SUMMIT_RADIUS / 2, y: summitHeight, width: MOUNTAIN_SUMMIT_RADIUS * 2, depth: MOUNTAIN_SUMMIT_RADIUS, shape: 'semicircle' };
export function mountainWorld(tangent: number, radial: number) {
  return { x: MOUNTAIN_LEDGE_SITE.x + (tangent + radial) / Math.SQRT2, z: MOUNTAIN_LEDGE_SITE.z + (radial - tangent) / Math.SQRT2 };
}
export function mountainLocal(x: number, z: number) {
  const dx = x - MOUNTAIN_LEDGE_SITE.x, dz = z - MOUNTAIN_LEDGE_SITE.z;
  return { tangent: (dx - dz) / Math.SQRT2, radial: (dx + dz) / Math.SQRT2 };
}
