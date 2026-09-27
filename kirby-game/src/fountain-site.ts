export const FOUNTAIN_SITE={x:-30,z:40,radius:15};
export const FOUNTAIN_POOL_RADIUS=9.3;
export const FOUNTAIN_WATER_Y=.27;
export function fountainDistance(x:number,z:number){return Math.hypot(x-FOUNTAIN_SITE.x,z-FOUNTAIN_SITE.z);}
export function inFountain(x:number,z:number){return fountainDistance(x,z)<FOUNTAIN_POOL_RADIUS;}
