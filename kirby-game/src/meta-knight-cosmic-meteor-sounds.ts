export const METEOR_SOUNDS=['cosmic-meteor-draw','cosmic-meteor-throw','cosmic-meteor-reflect','cosmic-meteor-impact'] as const;
export type MeteorSound=typeof METEOR_SOUNDS[number];
export function isMeteorSound(kind:string):kind is MeteorSound{return (METEOR_SOUNDS as readonly string[]).includes(kind);}
/** Offline/network fallback; the game preloads the credited recorded mix. */
export function meteorSound(kind:MeteorSound,rate:number){
 const duration={'cosmic-meteor-draw':1.5,'cosmic-meteor-throw':1.75,'cosmic-meteor-reflect':.75,'cosmic-meteor-impact':1.4}[kind],n=Math.ceil(duration*rate),left=new Float32Array(n),right=new Float32Array(n);let seed=1723,low=0,slow=0,phase=0;
 for(let i=0;i<n;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;const t=i/rate,u=t/duration,noise=seed/4294967296*2-1;low+=(noise-low)*.15;slow+=(low-slow)*.02;
  const edge=Math.min(1,t/.012,(duration-t)/.09),charge=kind.endsWith('draw'),impact=kind.endsWith('impact'),reflect=kind.endsWith('reflect'),env=charge?.12+.88*u*u:Math.exp(-t*(impact?4:reflect?7:2))*Math.min(1,t/.025);
  phase+=2*Math.PI*(charge?65+70*u:impact?42+100*Math.exp(-t*22):reflect?880+350*Math.exp(-t*11):140+240*Math.exp(-t*7))/rate;
  const v=(Math.sin(phase)*(charge?.12:impact?.4:reflect?.20:.08)+(low-slow)*1.2+slow*.9)*env*edge*.6;
  left[i]=Math.tanh(v);right[i]=Math.tanh(v*(.88+.12*Math.cos(t*37))+low*env*edge*.035);
 }return {left,right};
}
