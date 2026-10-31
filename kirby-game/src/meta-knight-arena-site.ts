/** The remote origin keeps arena actors outside every meadow interaction. */
const ANNEX_ANGLE=Math.PI/8;
export const META_KNIGHT_ANNEX={angle:ANNEX_ANGLE,start:36,gate:42,bridgeHalfWidth:5,portalRadius:64,radius:9} as const;
export const META_KNIGHT_ARENA={x:2000,z:0,radius:46,playRadius:36,walkRadius:42,spawnX:Math.sin(ANNEX_ANGLE)*56,spawnZ:Math.cos(ANNEX_ANGLE)*56,exitX:Math.sin(ANNEX_ANGLE)*64,exitZ:Math.cos(ANNEX_ANGLE)*64} as const;
export type KnightArenaSide='arena'|'annex';
/** Local coordinates along the bridge, which passes between two crystals. */
export function knightAnnexCoordinates(x:number,z:number){return {across:x*Math.cos(ANNEX_ANGLE)-z*Math.sin(ANNEX_ANGLE),along:x*Math.sin(ANNEX_ANGLE)+z*Math.cos(ANNEX_ANGLE)};}
export function knightAnnexPoint(across:number,along:number){return {x:across*Math.cos(ANNEX_ANGLE)+along*Math.sin(ANNEX_ANGLE),z:-across*Math.sin(ANNEX_ANGLE)+along*Math.cos(ANNEX_ANGLE)};}
export function insideKnightFightingArea(p:readonly number[]){const {along}=knightAnnexCoordinates(p[0],p[2]);return Math.hypot(p[0],p[2])<=META_KNIGHT_ARENA.walkRadius+1e-6&&along<META_KNIGHT_ANNEX.gate-1e-6;}
/** Save validation includes the bridge and portal landing, not the void around them. */
export function insideMetaKnightArena(x:number,z:number){const {across,along}=knightAnnexCoordinates(x,z);return Math.hypot(x,z)<=META_KNIGHT_ARENA.radius||Math.abs(across)<=META_KNIGHT_ANNEX.bridgeHalfWidth&&along>=META_KNIGHT_ANNEX.start&&along<=META_KNIGHT_ANNEX.portalRadius||Math.hypot(across,along-META_KNIGHT_ANNEX.portalRadius)<=META_KNIGHT_ANNEX.radius;}
export function arenaPortalFloor(x:number,z:number){return portalLocalFloor(x-META_KNIGHT_ARENA.exitX,z-META_KNIGHT_ARENA.exitZ);}
export function arenaPortalCoordinates(x:number,z:number){return knightAnnexCoordinates(x-META_KNIGHT_ARENA.exitX,z-META_KNIGHT_ARENA.exitZ);}
export const META_KNIGHT_PORTAL={x:-231,z:-235,radius:12.5,returnOffset:9} as const;
export const META_KNIGHT_PORTAL_APPROACH={x:META_KNIGHT_PORTAL.x,z:META_KNIGHT_PORTAL.z+6.8} as const;
export const PORTAL_STEPS=[{radius:6.2,height:.18},{radius:5.55,height:.36},{radius:4.8,height:.54}] as const;
/** The visual treads and foot/flight support share these exact dimensions. */
export function portalLocalFloor(x:number,z:number){
 const d=Math.hypot(x,z);for(let i=PORTAL_STEPS.length-1;i>=0;i--)if(d<=PORTAL_STEPS[i].radius)return PORTAL_STEPS[i].height;return 0;
}
export function metaKnightPortalFloor(x:number,z:number){return portalLocalFloor(x-META_KNIGHT_PORTAL.x,z-META_KNIGHT_PORTAL.z);}
export function nearMetaKnightPortal(p:{x:number;y:number;z:number}){
 return Math.abs(p.y-metaKnightPortalFloor(p.x,p.z))<.7&&Math.hypot(p.x-META_KNIGHT_PORTAL.x,p.z-META_KNIGHT_PORTAL.z)<5;
}
export function insideMetaKnightPortal(p:{x:number;y:number;z:number}){
 return Math.abs(p.y-metaKnightPortalFloor(p.x,p.z))<.7&&Math.abs(p.x-META_KNIGHT_PORTAL.x)<1.8&&Math.abs(p.z-META_KNIGHT_PORTAL.z)<.65;
}
export function constrainMetaKnightArena(p:{x:number;y:number;z:number},size:number,side?:KnightArenaSide){
 const x=p.x-META_KNIGHT_ARENA.x,z=p.z-META_KNIGHT_ARENA.z,{across,along}=knightAnnexCoordinates(x,z),a=META_KNIGHT_ANNEX;
 const radius=Math.max(12,META_KNIGHT_ARENA.walkRadius-size),d=Math.hypot(x,z),width=Math.max(.75,a.bridgeHalfWidth-size),padRadius=Math.max(1.5,a.radius-size);
 let nearest={x:d>radius?x/d*radius:x,z:d>radius?z/d*radius:z},best=side==='annex'?Infinity:(nearest.x-x)**2+(nearest.z-z)**2;
 if(side!=='arena'){
  const bridge=knightAnnexPoint(Math.max(-width,Math.min(width,across)),Math.max(side==='annex'?a.gate+size:a.start,Math.min(a.portalRadius,along)));
  const padDistance=Math.hypot(across,along-a.portalRadius),scale=padDistance>padRadius?padRadius/padDistance:1,pad=knightAnnexPoint(across*scale,a.portalRadius+(along-a.portalRadius)*scale);
  for(const candidate of [bridge,pad]){const distance=(candidate.x-x)**2+(candidate.z-z)**2;if(distance<best){best=distance;nearest=candidate;}}
 }
 if(best<=1e-12)return false;p.x=META_KNIGHT_ARENA.x+nearest.x;p.z=META_KNIGHT_ARENA.z+nearest.z;return true;
}
