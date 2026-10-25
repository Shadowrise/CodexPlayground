import type {KnightBattle,KnightPoint} from './meta-knight-battle';
import {cosmicHeight,cosmicCombat,cosmicDescent,easeCosmic} from './meta-knight-cosmic';
import type {FollowCamera} from './follow-camera';

/** The regular third-person orbit/zoom, with room above the shoulder for Galaxia. */
export function cosmicCameraPose(s:KnightBattle,now:number,player:readonly number[],width:number,height:number,follow:Pick<FollowCamera,'azimuth'|'elevation'|'distance'>,size=1){
 const fall=cosmicDescent(s,now);if(fall){
  const end=s.stage==='won'?easeCosmic((now-s.since)/1200):0,shot=easeCosmic(fall.elapsed/400)*(1-end),nativeDistance=follow.distance*size,wide=height>width?1.6:1,distance=nativeDistance*((2*wide)*(1-end)+end),base=fall.height+.9*size;
  const focus:KnightPoint=[player[0]*(1-.30*shot),base+(1.4+1.2*shot)*size*(1-end),player[2]*(1-.30*shot)],elevation=follow.elevation+(.38-follow.elevation)*shot;
  const shake=fall.landed?Math.exp(-fall.landAge/110)*.13:0,position:KnightPoint=[player[0]+distance*Math.cos(elevation)*Math.sin(follow.azimuth)+shake*Math.sin(fall.landAge*.073),base+distance*Math.sin(elevation)+shake*Math.cos(fall.landAge*.089),player[2]+distance*Math.cos(elevation)*Math.cos(follow.azimuth)];
  return {position,focus,fov:height>width?75:64-4*shot-9*end};
 }
 const altitude=cosmicHeight(s,now),f=(now-s.since)/Math.max(1,s.until-s.since);
 const framing=cosmicCombat(s)||s.stage==='cosmic-descent'?0:s.stage==='cosmic-flight'?1-easeCosmic((now-s.since)/1600):s.stage==='transition'?easeCosmic(f/.8):s.stage.startsWith('cosmic-')?1:0;
 const lift=3.7*framing,base=altitude+.9*size,distance=follow.distance*size*2*(height>width?1.6:1)+4*framing;
 const focus:KnightPoint=[player[0],base+1.4*size+lift,player[2]];
 const position:KnightPoint=[player[0]+distance*Math.cos(follow.elevation)*Math.sin(follow.azimuth),base+lift+distance*Math.sin(follow.elevation),player[2]+distance*Math.cos(follow.elevation)*Math.cos(follow.azimuth)];
 return {position,focus,fov:height>width?75:64+4*framing};
}
