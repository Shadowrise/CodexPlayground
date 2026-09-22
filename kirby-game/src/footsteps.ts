/** Seven size bands: 100%, 150%, ... 400%; larger characters use the last band. */
export function footstepProfile(size:number) {
  const band=Math.min(6,Math.max(0,Math.floor((size-1+1e-6)/.5)));
  return {gain:.38+band*.095,rate:1-band*.055,cutoff:1600-band*190};
}
