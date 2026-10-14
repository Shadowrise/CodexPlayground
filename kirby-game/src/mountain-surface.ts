import { MEADOW_HALF_SIZE as H, MOUNTAIN_WIDTH as W } from './world-bounds';

export const MOUNTAIN_ALONG = 240;
export const MOUNTAIN_ACROSS = 40;
const vertices=new Map<number,{x:number;z:number;y:number}>();

/** Original height field used by the mountain mesh, without changing its shape. */
export function mountainElevation(x: number, z: number) {
  const d = Math.max(Math.abs(x), Math.abs(z)) - H;
  const envelope = Math.sin(Math.PI * Math.max(0, Math.min(1, d / W))) ** .85;
  const broad = 51 + 18 * Math.sin(x * .037 + z * .029) + 15 * Math.cos(x * .061 - z * .043);
  const ridges = 14 * Math.abs(Math.sin(x * .14 + Math.sin(z * .09) * 2)) + 7 * Math.sin(z * .25 - x * .12);
  const crags = 3 * Math.sin(x * .71 + z * .53) + 1.5 * Math.cos(x * 1.21 - z * .91);
  return Math.max(0, (broad + ridges + crags) * envelope);
}

/** Interpolate the actual rendered triangles, rather than a smoother approximation. */
export function mountainSurfaceHeight(x: number, z: number) {
  const r = Math.max(Math.abs(x), Math.abs(z));
  if (r <= H || r >= H + W) return 0;
  const side = Math.abs(z) >= Math.abs(x) ? (z < 0 ? 0 : 2) : (x > 0 ? 1 : 3);
  const tangent = side === 0 ? x : side === 1 ? z : side === 2 ? -x : -z;
  const column = Math.min(MOUNTAIN_ALONG - 1, Math.max(0, Math.floor((tangent / r + 1) * MOUNTAIN_ALONG / 2)));
  const row = Math.min(MOUNTAIN_ACROSS - 1, Math.floor((r - H) / W * MOUNTAIN_ACROSS));
  const point = (i: number, j: number) => {
    const key=(side*(MOUNTAIN_ACROSS+1)+j)*(MOUNTAIN_ALONG+1)+i,cached=vertices.get(key);if(cached)return cached;
    const radius = H + W * j / MOUNTAIN_ACROSS, t = (i / MOUNTAIN_ALONG * 2 - 1) * radius;
    const px = side === 0 ? t : side === 1 ? radius : side === 2 ? -t : -radius;
    const pz = side === 0 ? -radius : side === 1 ? t : side === 2 ? radius : -t;
    const value={x:px,z:pz,y:mountainElevation(px,pz)-.025};vertices.set(key,value);return value;
  };
  const a = point(column, row), b = point(column + 1, row), c = point(column, row + 1), d = point(column + 1, row + 1);
  const interpolate = (p: typeof a, q: typeof a, s: typeof a) => {
    const denominator = (q.z - s.z) * (p.x - s.x) + (s.x - q.x) * (p.z - s.z);
    const u = ((q.z - s.z) * (x - s.x) + (s.x - q.x) * (z - s.z)) / denominator;
    const v = ((s.z - p.z) * (x - s.x) + (p.x - s.x) * (z - s.z)) / denominator;
    return { inside: u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8, y: u * p.y + v * q.y + (1 - u - v) * s.y };
  };
  const first = interpolate(a, b, c);
  return Math.max(0, first.inside ? first.y : interpolate(b, d, c).y);
}
