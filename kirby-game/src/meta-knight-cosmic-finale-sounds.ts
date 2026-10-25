export const FINALE_SOUNDS=['cosmic-fall','cosmic-landing'] as const;
export type FinaleSound=typeof FINALE_SOUNDS[number];
export const isFinaleSound=(s:string):s is FinaleSound=>(FINALE_SOUNDS as readonly string[]).includes(s);
/** Layered with the credited wind/impact recordings, also a complete offline fallback. */
export function finaleSound(kind:FinaleSound,rate:number){
 const duration=kind==='cosmic-fall'?2.38:1.15,n=Math.ceil(duration*rate),left=new Float32Array(n),right=new Float32Array(n);let seed=6173,low=0,slow=0,phase=0;
 for(let i=0;i<n;i++){const t=i/rate,u=t/duration;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296*2-1;low+=(noise-low)*.16;slow+=(low-slow)*.025;let v=0;
  if(kind==='cosmic-fall'){phase+=2*Math.PI*(620-390*u)/rate;v=(low-slow)*(.16+.85*u*u)+Math.sin(phase)*.035*Math.sin(Math.PI*u);}
  else{v=Math.sin(2*Math.PI*(52*t+1.1*(1-Math.exp(-t*29))))*.38*Math.exp(-t*10)+(low-slow)*.70*Math.exp(-t*20);v+=Math.sin(2*Math.PI*913*t)*.07*Math.exp(-t*14);}
  v*=Math.min(1,t/.012,(duration-t)/.035);const pan=.13*Math.sin(u*Math.PI*2);left[i]=v*(1-pan);right[i]=v*(1+pan);
 }return {left,right};
}
