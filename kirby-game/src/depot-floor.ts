/** Shared dimensions for the visible depot and its walkable surfaces. */
export const DEPOT_PLATFORM={x:0,z:224,width:24,depth:10,height:.7};
/** Faces the rails (+Z). Shared by the model and interactive sitting targets. */
export const DEPOT_BENCHES=[{x:-7.45,z:222.4},{x:7.45,z:222.4}] as const;
export const DEPOT_STEPS=Array.from({length:3},(_,i)=>({x:0,z:217+i*.7,width:7,depth:1.2,height:.24+i*.2}));
export function depotFloorHeight(x:number,z:number){
 let height=0;
 for(const surface of [DEPOT_PLATFORM,...DEPOT_STEPS])if(Math.abs(x-surface.x)<=surface.width/2 && Math.abs(z-surface.z)<=surface.depth/2)height=Math.max(height,surface.height);
 return height;
}
