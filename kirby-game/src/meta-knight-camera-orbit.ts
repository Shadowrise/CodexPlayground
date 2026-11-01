import type {KnightPoint} from './meta-knight-battle';
import type {FollowCamera} from './follow-camera';

/** Keep each encounter's composition while giving the player its heading, tilt and zoom. */
export function orbitKnightCamera<P extends {position:KnightPoint;focus:KnightPoint}>(pose:P,follow:Pick<FollowCamera,'azimuth'|'elevation'|'distance'>,floor=0):P{
 const [x,y,z]=pose.position.map((v,i)=>v-pose.focus[i]),radius=Math.hypot(x,y,z)*follow.distance/10;
 const minimum=Math.asin(Math.max(-1,Math.min(1,(floor+.5-pose.focus[1])/radius)));
 const elevation=Math.max(minimum,Math.min(1.45,Math.atan2(y,Math.hypot(x,z))+follow.elevation-.25));
 const horizontal=radius*Math.cos(elevation),position:KnightPoint=[pose.focus[0]+horizontal*Math.sin(follow.azimuth),pose.focus[1]+radius*Math.sin(elevation),pose.focus[2]+horizontal*Math.cos(follow.azimuth)];
 return {...pose,position};
}
