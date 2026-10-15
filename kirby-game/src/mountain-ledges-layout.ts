import { MEADOW_HALF_SIZE } from './world-bounds';
import { mountainSurfaceHeight } from './mountain-surface';

export const MOUNTAIN_LEDGE_SITE = { x: MEADOW_HALF_SIZE - 8, z: MEADOW_HALF_SIZE - 8, radius: 25 };
export const LEDGE_STAND_SECONDS = 3;
export const LEDGE_RETRACT_SECONDS = .7;
export const LEDGE_HIDDEN_SECONDS = 4;
export const LEDGE_EXTEND_SECONDS = .9;
export const LEDGE_RETRACT_DISTANCE = 4.6;
export const MOUNTAIN_LEDGE_YAW = Math.PI / 4;
export type MountainLedge = { tangent: number; radial: number; y: number; width: number; depth: number; shape?: 'semicircle'; embedDepth?:number };

/** Crest ledges retract towards a fixed rear seam instead of crossing the ridge. */
export function mountainLedgePose(p:MountainLedge,slide:number){
  if(p.embedDepth===undefined)return {radial:p.radial+slide,scale:1};
  const scale=Math.max(0,1-slide/(p.depth+p.embedDepth));
  return {radial:p.radial+(1-scale)*(p.depth/2+p.embedDepth),scale};
}

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
export const MOUNTAIN_MAIN_STEP_COUNT=offsets.length;
const mainSteps: MountainLedge[] = offsets.map((tangent,i)=>{
  const y=(i+1)*2.56;
  return {tangent,radial:mountainFace(y,tangent)-MOUNTAIN_STEP_RADIUS/2,y,width:2*MOUNTAIN_STEP_RADIUS,depth:MOUNTAIN_STEP_RADIUS,shape:'semicircle'};
});
// Triple the previous half-circle's area and embed its left end in the real slope.
export const MOUNTAIN_SUMMIT_RADIUS = Math.sqrt(12 * 4.4 * 4.2 / Math.PI);
const summitTangent=-4,summitHeight=30.72;
const summitBack=Math.max(mountainFace(summitHeight,summitTangent),mountainFace(summitHeight,summitTangent-MOUNTAIN_SUMMIT_RADIUS)+.15);
export const MOUNTAIN_SUMMIT: MountainLedge = { tangent: summitTangent, radial: summitBack - MOUNTAIN_SUMMIT_RADIUS / 2, y: summitHeight, width: MOUNTAIN_SUMMIT_RADIUS * 2, depth: MOUNTAIN_SUMMIT_RADIUS, shape: 'semicircle' };
// A second ascent continues above the bread overlook, following the existing
// ridge's actual contours. Original eleven network IDs are never reordered.
const upperTangents=[3.5,9,16.5,9.5,6,13,6.5,13,15.5,8.5,15.5,9.5,16.5,9.5,16.5,9.5,16.5,19.5,14.5,16.5];
export const MOUNTAIN_UPPER_STEPS:readonly MountainLedge[]=upperTangents.map((tangent,i)=>{
  const y=summitHeight+(i+1)*2.56;
  if(i>=upperTangents.length-7){
    // A narrow crest cannot hide the old five-metre rectangular tail. Keep
    // the entire landing arc in front of the first uphill terrain contact.
    let back=Infinity;
    for(let sample=0;sample<=32;sample++){
      try{back=Math.min(back,mountainFace(y-.08,tangent-MOUNTAIN_STEP_RADIUS+2*MOUNTAIN_STEP_RADIUS*sample/32)-.08);}catch{/* Adjacent cross-section ends below this step. */}
    }
    return {tangent,radial:back-MOUNTAIN_STEP_RADIUS/2,y,width:2*MOUNTAIN_STEP_RADIUS,depth:MOUNTAIN_STEP_RADIUS,shape:'semicircle',embedDepth:.15};
  }
  return {tangent,radial:mountainFace(y,tangent)-MOUNTAIN_STEP_RADIUS/2,y,width:2*MOUNTAIN_STEP_RADIUS,depth:MOUNTAIN_STEP_RADIUS,shape:'semicircle'};
});
export const MOUNTAIN_STEPS:readonly MountainLedge[]=[...mainSteps,...MOUNTAIN_UPPER_STEPS];
// Vertex (side1,row25,column232) is the highest rendered vertex of this corner.
// The flat cap ends at that crest rather than reaching onto the mountain's back.
export const MOUNTAIN_PEAK_VERTEX={x:MEADOW_HALF_SIZE+45,z:(MEADOW_HALF_SIZE+45)*14/15};
const peakLocal=mountainLocal(MOUNTAIN_PEAK_VERTEX.x,MOUNTAIN_PEAK_VERTEX.z),peakRadius=5.6;
export const MOUNTAIN_PEAK:MountainLedge={tangent:peakLocal.tangent,radial:peakLocal.radial-peakRadius/2,y:mountainSurfaceHeight(MOUNTAIN_PEAK_VERTEX.x,MOUNTAIN_PEAK_VERTEX.z),width:peakRadius*2,depth:peakRadius,shape:'semicircle',embedDepth:0};
/** Kept for callers which treat a permanent seal rest as another bread floor. */
export const MOUNTAIN_SEAL_NICHE=MOUNTAIN_PEAK;
export function isInsideMountainPeak(x:number,z:number,size=1){
  if(![x,z,size].every(Number.isFinite)||size<=0)return false;
  const local=mountainLocal(x,z),margin=Math.min(.8,.2*size),dx=local.tangent-MOUNTAIN_PEAK.tangent,dz=local.radial-(MOUNTAIN_PEAK.radial+MOUNTAIN_PEAK.depth/2),radius=peakRadius-margin;
  return dz<=-margin&&dx*dx+dz*dz<radius*radius;
}
/** The permitted outer edge shrinks continuously back into the meadow on a fall. */
export function mountainCourseEnvelope(y:number,tangent:number,size=1){
  const margin=.35*Math.max(.3,size),minT=MOUNTAIN_SUMMIT.tangent-MOUNTAIN_SUMMIT.width/2-1+margin,maxT=Math.max(...upperTangents)+MOUNTAIN_STEP_RADIUS+1-margin;
  const t=Math.max(minT,Math.min(maxT,tangent)),ground=(MEADOW_HALF_SIZE-MOUNTAIN_LEDGE_SITE.x-1.5*size)*Math.SQRT2-Math.abs(t);
  const progress=Math.pow(Math.max(0,Math.min(1,y/MOUNTAIN_PEAK.y)),.55),back=MOUNTAIN_PEAK.radial+MOUNTAIN_PEAK.depth/2-margin;
  return {tangent:t,minT,maxT,radial:ground+(back-ground)*progress};
}
export function mountainWorld(tangent: number, radial: number) {
  return { x: MOUNTAIN_LEDGE_SITE.x + (tangent + radial) / Math.SQRT2, z: MOUNTAIN_LEDGE_SITE.z + (radial - tangent) / Math.SQRT2 };
}
export function mountainLocal(x: number, z: number) {
  const dx = x - MOUNTAIN_LEDGE_SITE.x, dz = z - MOUNTAIN_LEDGE_SITE.z;
  return { tangent: (dx - dz) / Math.SQRT2, radial: (dx + dz) / Math.SQRT2 };
}
