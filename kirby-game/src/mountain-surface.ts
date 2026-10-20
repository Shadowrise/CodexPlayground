import { MEADOW_HALF_SIZE as H, MOUNTAIN_WIDTH as W } from './world-bounds';

export const MOUNTAIN_ALONG = 480;
export const MOUNTAIN_ACROSS = 96;
const vertices=new Map<number,{x:number;z:number;y:number}>();
const peakX=H+45,peakZ=peakX*14/15,peakDistance=Math.hypot(peakX-H,peakZ-H);
const peakTangent=(peakX-peakZ)/Math.SQRT2;
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export const MOUNTAIN_PEAK_SITE={x:peakX-2.8/Math.SQRT2,z:peakZ-2.8/Math.SQRT2,y:84.64709581827832,radius:7.2};

/** Rounded massifs and long erosion folds, shared by rendering and collisions. */
export function mountainElevation(x: number, z: number) {
  const dx=Math.max(0,Math.abs(x)-H),dz=Math.max(0,Math.abs(z)-H),d=Math.hypot(dx,dz);
  if(d<=0||d>=W)return 0;
  const distance=Math.hypot(x-MOUNTAIN_PEAK_SITE.x,z-MOUNTAIN_PEAK_SITE.z);
  if(distance<=MOUNTAIN_PEAK_SITE.radius+1.2)return MOUNTAIN_PEAK_SITE.y+.025;
  const envelope=Math.sin(Math.PI*d/W)**1.35;
  const mass=66+17*Math.sin(x*.024+z*.019)+12*Math.cos(x*.041-z*.031);
  const folds=8*Math.sin(x*.072+z*.056+1.7*Math.sin(z*.017))*Math.sin(x*.035-z*.067);
  const detail=1.1*Math.sin(x*.17+z*.11)*Math.sin(z*.14-x*.09);
  const height=(mass+folds+detail)*envelope;
  // The quest mountain retains its crest and all landing heights. A broad,
  // smooth shoulder leaves room for the upper zigzag and its fitted ledges.
  const blend=1-smooth(66,108,Math.hypot(x-peakX,z-peakZ));
  if(blend===0)return Math.max(0,height);
  const t=(x-z)/Math.SQRT2,profile=d<=peakDistance
    ?Math.sin(Math.PI/2*d/peakDistance)**1.3
    :Math.cos(Math.PI/2*(d-peakDistance)/(W-peakDistance))**1.4;
  const questPeak=84.67209581827832*profile*Math.exp(-(((t-peakTangent)/92)**2));
  const mountain=height+(questPeak-height)*blend;
  // Flatten the mountain itself into a circular summit, then round its shoulder
  // into the slope. The extra metre covers interpolation at the landing's rim.
  const plateau=1-smooth(MOUNTAIN_PEAK_SITE.radius+1.2,MOUNTAIN_PEAK_SITE.radius+7.5,distance);
  return Math.max(0,mountain+(MOUNTAIN_PEAK_SITE.y+.025-mountain)*plateau);
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
  if(a.y===b.y&&a.y===c.y&&a.y===d.y)return Math.max(0,a.y);
  const interpolate = (p: typeof a, q: typeof a, s: typeof a) => {
    const denominator = (q.z - s.z) * (p.x - s.x) + (s.x - q.x) * (p.z - s.z);
    const u = ((q.z - s.z) * (x - s.x) + (s.x - q.x) * (z - s.z)) / denominator;
    const v = ((s.z - p.z) * (x - s.x) + (p.x - s.x) * (z - s.z)) / denominator;
    return { inside: u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8, y: u * p.y + v * q.y + (1 - u - v) * s.y };
  };
  const first = interpolate(a, b, c);
  return Math.max(0, first.inside ? first.y : interpolate(b, d, c).y);
}
