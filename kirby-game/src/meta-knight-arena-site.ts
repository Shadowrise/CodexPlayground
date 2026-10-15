/** The remote origin keeps arena actors outside every meadow interaction. */
export const META_KNIGHT_ARENA={x:2000,z:0,radius:46,playRadius:36,spawnZ:14,exitZ:38} as const;
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
export function constrainMetaKnightArena(p:{x:number;y:number;z:number},size:number){
 const dx=p.x-META_KNIGHT_ARENA.x,dz=p.z-META_KNIGHT_ARENA.z,d=Math.hypot(dx,dz),r=Math.max(12,42-size);
 if(d>r){p.x=META_KNIGHT_ARENA.x+dx/d*r;p.z=META_KNIGHT_ARENA.z+dz/d*r;}
}
