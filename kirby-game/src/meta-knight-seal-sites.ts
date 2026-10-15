import {MOUNTAIN_PEAK,mountainWorld,isInsideMountainPeak} from './mountain-ledges-layout';
import {TREEHOUSE_LOCATION,TREEHOUSE_DECK_HEIGHT,TREEHOUSE_BALCONY} from './treehouse-site';

export type SealSiteId='maze'|'mountain'|'treehouse';
export type SealSite={id:SealSiteId;x:number;y:number;z:number;yaw:number;surfaceY:number;pickupRadius:number};
type Position=readonly number[]|{x:number;y:number;z:number};
const peak=mountainWorld(MOUNTAIN_PEAK.tangent,MOUNTAIN_PEAK.radial-.35);
export const META_KNIGHT_SEAL_SITES:readonly SealSite[]=[
 {id:'maze',x:-102,y:1.7,z:124,yaw:-Math.PI/2,surfaceY:0,pickupRadius:1.8},
 {id:'mountain',x:peak.x,y:MOUNTAIN_PEAK.y+1.7,z:peak.z,yaw:Math.PI*1.25,surfaceY:MOUNTAIN_PEAK.y,pickupRadius:1.8},
 {id:'treehouse',x:TREEHOUSE_LOCATION.x+2,y:TREEHOUSE_DECK_HEIGHT+1.7,z:TREEHOUSE_LOCATION.z+6.2,yaw:-Math.PI/4,surfaceY:TREEHOUSE_DECK_HEIGHT,pickupRadius:1.8},
];

/** Fixed footprint and foot height prevent reaching a seal through a floor. */
export function isInsideSealPickup(site:SealSite,position:Position,size=1){
 const [x,y,z]='x' in position?[position.x,position.y,position.z]:position;
 if(![x,y,z,size].every(Number.isFinite)||size<=0||Math.abs(y-site.surfaceY)>.65||Math.hypot(x-site.x,z-site.z)>site.pickupRadius)return false;
 if(site.id==='treehouse')return x>=TREEHOUSE_BALCONY.minX&&x<=TREEHOUSE_BALCONY.maxX&&z>=TREEHOUSE_BALCONY.minZ&&z<=TREEHOUSE_BALCONY.maxZ;
 if(site.id==='mountain')return isInsideMountainPeak(x,z,size);
 return true;
}
