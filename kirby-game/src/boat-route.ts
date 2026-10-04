import * as T from 'three';
import {PONDS,RIVERS,streamX,WATER_Y} from './pond-layout';
import {POND_SCALE} from './landmark-sites';

export const BOAT_SPEED=3.4;
export const BOAT_COUNT=8;
export const BOAT_OCCUPIED=[1,3,5,7] as const;
const points:T.Vector3[]=[];
for(let i=0;i<PONDS.length;i++){
 const pond=PONDS[i];points.push(new T.Vector3(pond.x,WATER_Y,pond.z));
 for(let z=2;z<=20;z+=2)points.push(new T.Vector3(pond.x+streamX(Math.max(6,z))*POND_SCALE*Math.min(1,z/6),WATER_Y,pond.z+z*POND_SCALE));
 for(const p of RIVERS[i])if(points.at(-1)!.distanceToSquared(p.clone().setY(WATER_Y))>.04)points.push(p.clone().setY(WATER_Y));
}
if(points[0].distanceTo(points.at(-1)!)<.1)points.pop();
const clean=points.filter((p,i)=>!i||p.distanceToSquared(points[i-1])>.04);
const source=new T.CatmullRomCurve3(clean,true,'centripetal');source.arcLengthDivisions=10000;
const raw=source.getSpacedPoints(Math.ceil(source.getLength()));raw.pop();
// Round the river routing grid's sharp corners inside the seven-metre channel.
const rounded=raw.filter((_,i)=>i%2===0).map((_,i)=>{
 const p=new T.Vector3();let total=0;
 for(let j=-4;j<=4;j++){const weight=5-Math.abs(j);p.addScaledVector(raw[(i*2+j+raw.length)%raw.length],weight);total+=weight;}
 return p.divideScalar(total);
});
const curve=new T.CatmullRomCurve3(rounded,true,'centripetal');curve.arcLengthDivisions=10000;
export const BOAT_ROUTE_LENGTH=curve.getLength();
// A metre-spaced lookup table avoids curve searches or allocations every frame.
const count=Math.ceil(BOAT_ROUTE_LENGTH),samples=curve.getSpacedPoints(count);
export function boatPose(distance:number,position:T.Vector3){
 const u=((distance%BOAT_ROUTE_LENGTH)+BOAT_ROUTE_LENGTH)%BOAT_ROUTE_LENGTH/BOAT_ROUTE_LENGTH*count,i=Math.floor(u),a=samples[i],b=samples[i+1];
 position.lerpVectors(a,b,u-i);
 // Look several metres ahead/behind to keep the heading smooth through knots.
 const before=samples[(i-4+count)%count],after=samples[(i+5)%count];
 const nextBefore=samples[(i-3+count)%count],nextAfter=samples[(i+6)%count];
 return Math.atan2(T.MathUtils.lerp(after.x-before.x,nextAfter.x-nextBefore.x,u-i),T.MathUtils.lerp(after.z-before.z,nextAfter.z-nextBefore.z,u-i));
}
export function boatDistance(index:number,seconds:number){return seconds*BOAT_SPEED+index/BOAT_COUNT*BOAT_ROUTE_LENGTH;}
/** Exclude floating lilies from the navigation corridor, evaluated at scene creation. */
export function outsideBoatRoute(x:number,z:number,radius=0){
 return samples.every(p=>(p.x-x)**2+(p.z-z)**2>(1.6+radius)**2);
}
