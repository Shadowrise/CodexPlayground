/** Separate adjacent tiles and give overlapping courses a real physical step.
 * Coplanar overlaps with different colours flicker regardless of texture filtering. */
export const roofTileSpan=(spacing:number)=>spacing-.02;
export const roofTilePitch=(run:number,rise:number)=>Math.atan2(rise,run)+.075;
