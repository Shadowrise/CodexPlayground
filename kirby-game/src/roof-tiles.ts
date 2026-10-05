/** Separate adjacent tiles and give the courses a slight physical tilt.
 * Coplanar overlaps with different colours flicker regardless of texture filtering. */
export const roofTileSpan=(spacing:number)=>spacing-.02;
export const roofTilePitch=(run:number,rise:number)=>Math.atan2(rise,run)+.075;

/** Leave a gap in the slope direction too: overlapping boxes share coplanar
 * end faces even when their top faces are stepped. Include the tile thickness. */
export function roofTileLength(run:number,rise:number,thickness:number,ridgeSpacing?:number){
  const length=(Math.hypot(run,rise)-.02-thickness*Math.sin(.075))/Math.cos(.075);
  if(ridgeSpacing===undefined)return length;
  const pitch=roofTilePitch(run,rise);
  return Math.min(length,(ridgeSpacing-.02-thickness*Math.sin(pitch))/Math.cos(pitch));
}
