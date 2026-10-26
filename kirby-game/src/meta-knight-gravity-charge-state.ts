import {easeCosmic} from './meta-knight-cosmic';
import {COSMIC_REFUGE as R} from './meta-knight-cosmic-refuge';

type ChargeState={phase:number;stage:string;since:number;until:number;cosmicRefuge?:{at:number}};

/** The sound and the visible sphere follow the same authoritative charge envelope. */
export function gravityChargeRadius(s:ChargeState|undefined,now:number){
 if(s?.phase!==4||!s.cosmicRefuge||!['cosmic-star-draw','cosmic-star-open','cosmic-planet-draw','cosmic-planet-sweep'].includes(s.stage))return 0;
 const elapsed=Math.max(0,now-s.cosmicRefuge.at),f=Math.max(0,Math.min(1,(now-s.since)/Math.max(1,s.until-s.since)));
 return s.stage==='cosmic-planet-sweep'?3.1:s.stage==='cosmic-planet-draw'?2.6+.5*easeCosmic(f):.40+2.2*easeCosmic(elapsed/(R.drawMs+R.openMs));
}
export function gravityChargeVolume(s:ChargeState|undefined,now:number){
 const radius=gravityChargeRadius(s,now);return radius>0?.06+.64*Math.max(0,Math.min(1,(radius-.4)/2.7)):0;
}

/** Crossfade the tail into the start of the same ascent recording for a quiet loop seam. */
export function gravityCrackleLoop(samples:Float32Array,rate:number){
 const start=Math.min(Math.round(rate*.65),Math.floor(samples.length*.25)),end=Math.min(samples.length,Math.round(rate*4.95)),fade=Math.min(Math.round(rate*.12),Math.floor((end-start)/4)),length=end-start-fade,out=new Float32Array(length);
 for(let i=0;i<length;i++){
  const blend=i<fade?i/fade:1;
  out[i]=i<fade?samples[start+length+i]*(1-blend)+samples[start+i]*blend:samples[start+i];
 }
 return out;
}
