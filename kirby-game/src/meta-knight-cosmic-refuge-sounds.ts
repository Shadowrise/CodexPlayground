export const REFUGE_SOUNDS=['cosmic-refuge-call','cosmic-refuge-shield','cosmic-refuge-pull','cosmic-refuge-roll','cosmic-refuge-break'] as const;
export type RefugeSound=typeof REFUGE_SOUNDS[number];
export function isRefugeSound(kind:string):kind is RefugeSound{return (REFUGE_SOUNDS as readonly string[]).includes(kind);}
/** Harmonics layer over the already credited electrical, wind and impact recordings. */
export function refugeSound(kind:RefugeSound,rate:number){
 const seconds={'cosmic-refuge-call':1.2,'cosmic-refuge-shield':.85,'cosmic-refuge-pull':2.4,'cosmic-refuge-roll':COSMIC_REFUGE.sweepMs/1000,'cosmic-refuge-break':1.4}[kind],n=Math.ceil(seconds*rate),left=new Float32Array(n),right=new Float32Array(n);let seed=94821,low=0,rumble=0,phase=0;
 const bell=(t:number,hz:number)=>t<0?0:(Math.sin(t*2*Math.PI*hz)+.25*Math.sin(t*2*Math.PI*hz*2.76))*Math.exp(-t*6);
 for(let i=0;i<n;i++){
  const t=i/rate,u=t/seconds;seed=(Math.imul(seed,1664525)+1013904223)>>>0;low+=(seed/4294967296*2-1-low)*.08;rumble+=(low-rumble)*.012;
  const edge=Math.min(1,t/.012,(seconds-t)/.09),env=Math.sin(Math.PI*u)**.65;let v=0;
  if(kind.endsWith('call'))v=(bell(t,880)+bell(t-.13,1174.66)+bell(t-.26,1760))*.12+low*env*.22;
  if(kind.endsWith('shield'))v=(bell(t,1174.66)+bell(t-.045,1760)+bell(t-.09,2349.32))*.14+low*Math.exp(-t*12)*.16;
  if(kind.endsWith('pull')){phase+=2*Math.PI*(43+45*u*u)/rate;v=(Math.sin(phase)*.18+rumble*3+low*.35)*env;}
  if(kind.endsWith('roll'))v=(Math.sin(t*2*Math.PI*37)+.30*Math.sin(t*2*Math.PI*55.4))*.09*env+rumble*env*3.5+low*env*.17*(.7+.3*Math.sin(t*17));
  if(kind.endsWith('break')){phase+=2*Math.PI*(38+80*Math.exp(-t*18))/rate;v=Math.sin(phase)*Math.exp(-t*5)*.3+low*Math.exp(-t*13)*.7+bell(t,783.99)*.07+bell(t-.08,1174.66)*.05;}
  left[i]=Math.tanh(v*edge);right[i]=Math.tanh((v*.9+low*env*.05*Math.sin(t*29))*edge);
 }return {left,right};
}
import {COSMIC_REFUGE} from './meta-knight-cosmic-refuge';
