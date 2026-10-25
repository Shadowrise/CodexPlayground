import {COSMIC_SPIN,cosmicSpinAngle} from './meta-knight-cosmic-spin';
export const COSMIC_SPIN_SOUNDS=['cosmic-spin','cosmic-orb','cosmic-tired'] as const;
export type CosmicSpinSound=typeof COSMIC_SPIN_SOUNDS[number];
export function isCosmicSpinSound(kind:string):kind is CosmicSpinSound{return (COSMIC_SPIN_SOUNDS as readonly string[]).includes(kind);}
/** A rising rotating rush, short electric releases and an audible exhausted sigh. */
export function cosmicSpinSound(kind:CosmicSpinSound,rate:number){
 const duration=kind==='cosmic-spin'?COSMIC_SPIN.spinMs/1000:kind==='cosmic-orb'?.19:1.35,n=Math.ceil(duration*rate),left=new Float32Array(n),right=new Float32Array(n);
 let seed=17431,filtered=0,bass=0,phase=0;
 for(let i=0;i<n;i++){
  const t=i/rate,u=t/duration;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296*2-1;
  filtered+=(noise-filtered)*.11;bass+=(filtered-bass)*.014;const air=filtered-bass;
  const envelope=Math.min(1,t/.025,(duration-t)/.06);let value=0,pan=0;
  if(kind==='cosmic-spin'){
   const turn=cosmicSpinAngle(t),rush=.32+.68*(.5+.5*Math.cos(turn))**3;
   phase+=2*Math.PI*(55+u*80)/rate;
   value=(air*.55+bass*1.3+Math.sin(phase)*.045)*rush*(.5+.5*u);pan=Math.sin(turn)*.40;
  }else if(kind==='cosmic-orb'){
   phase+=2*Math.PI*(850+2400*Math.exp(-t*31))/rate;
   value=(air*.75+Math.sin(phase)*.07)*Math.exp(-t*24);pan=Math.sin(t*47)*.18;
  }else{
   phase+=2*Math.PI*(130-70*u)/rate;value=air*Math.sin(Math.PI*u)**1.2*.35+Math.sin(phase)*Math.exp(-t*7)*.08;
   value+=Math.sin(2*Math.PI*587.33*t)*Math.exp(-t*5)*.055;
  }
  left[i]=value*envelope*(1-pan);right[i]=value*envelope*(1+pan);
 }
 left[n-1]=right[n-1]=0;return {left,right};
}
