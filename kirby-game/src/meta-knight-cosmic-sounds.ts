/** Generated fallback. The live encounter preloads the CC0 recordings in public/audio/meta-knight-cosmic. */
export const COSMIC_SOUNDS=['cosmic-charge','cosmic-impact','cosmic-draw','cosmic-ascent','cosmic-arrive'] as const;
export type CosmicSound=typeof COSMIC_SOUNDS[number];
export function isCosmicSound(kind:string):kind is CosmicSound{return (COSMIC_SOUNDS as readonly string[]).includes(kind);}
export function cosmicSound(kind:CosmicSound,rate:number){
 const duration={'cosmic-charge':2.8,'cosmic-impact':1.9,'cosmic-draw':1.05,'cosmic-ascent':5.6,'cosmic-arrive':3.2}[kind],length=Math.ceil(rate*duration),left=new Float32Array(length),right=new Float32Array(length);
 let seed=19471+COSMIC_SOUNDS.indexOf(kind)*991,low=0,rumble=0,phase=0,shimmer=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
 for(let i=0;i<length;i++){
  const t=i/rate,u=t/duration,n=random();low+=(n-low)*.07;rumble+=(low-rumble)*.004;const air=low-rumble;
  const attack=Math.min(1,t/.025),tail=Math.min(1,(duration-t)/.16),swelling=Math.sin(Math.PI*u),crackle=Math.pow(Math.max(0,Math.sin(t*41)+Math.sin(t*103)*.45),12)*air;
  let v=0,spread=0;
  if(kind==='cosmic-charge'){
   phase+=2*Math.PI*(52+48*u*u)/rate;shimmer+=2*Math.PI*(360+1800*u*u)/rate;
   const env=attack*(.12+.88*u*u)*tail;
   v=(Math.sin(phase)*.19+Math.sin(phase*1.5)*.075+air*(.6+u*.5)+Math.sin(shimmer)*.035+crackle*.13)*env;
   spread=Math.sin(shimmer*.503)*air*.25*env;
  }else if(kind==='cosmic-impact'){
   phase+=2*Math.PI*(31+105*Math.exp(-t*17))/rate;
   const body=Math.sin(phase)*Math.exp(-t*3.6)*.60,crack=air*Math.exp(-t*30)*1.5,roll=rumble*Math.sin(Math.PI*u)*2.4;
   v=body+crack+roll+crackle*.16*Math.exp(-t*.8);spread=air*Math.sin(t*29)*Math.exp(-t*2)*.25;
  }else if(kind==='cosmic-draw'){
   phase+=2*Math.PI*(170+870*u*u)/rate;
   v=(air*.75+Math.sin(phase)*.08)*swelling**1.4+Math.sin(t*2*Math.PI*587.33)*Math.exp(-t*6)*.08;
   spread=air*Math.sin(t*14)*swelling*.3;
  }else if(kind==='cosmic-ascent'){
   phase+=2*Math.PI*(48+72*Math.sin(Math.PI*u*.5))/rate;shimmer+=2*Math.PI*(600+1550*u)/rate;
   const env=attack*tail*(.15+.85*Math.sin(Math.PI*u)**.7);
   v=(air*.95+rumble*2+Math.sin(phase)*.18+Math.sin(shimmer)*.025)*env;
   v+=(Math.sin(t*2*Math.PI*146.83)+Math.sin(t*2*Math.PI*220))*.045*Math.sin(Math.PI*u)**2;
   spread=(air*Math.sin(t*5.2)*.3+Math.sin(shimmer*1.003)*.015)*env;
  }else{
   const env=Math.min(1,t/.16)*Math.exp(-t*1.15)*tail;
   v=(Math.sin(t*2*Math.PI*293.66)+.48*Math.sin(t*2*Math.PI*440)+.28*Math.sin(t*2*Math.PI*587.33))*.16*env;
   v+=air*.22*Math.sin(Math.PI*u)*Math.exp(-t);spread=Math.sin(t*2*Math.PI*441.3)*.045*env;
  }
  const boundary=Math.min(1,t/.008,(duration-t)/.045);left[i]=(v+spread)*boundary;right[i]=(v-spread)*boundary;
 }
 const dryL=left.slice(),dryR=right.slice();
 for(const [delay,gain] of [[.071,.17],[.139,.12],[.241,.075]]){const offset=Math.round(rate*delay);for(let i=offset;i<length;i++){left[i]+=dryR[i-offset]*gain;right[i]+=dryL[i-offset]*gain;}}
 let peak=0;for(let i=0;i<length;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));const gain=Math.min(1,.67/Math.max(.001,peak));
 for(let i=0;i<length;i++){const tail=Math.min(1,(length-1-i)/(rate*.04));left[i]*=gain*tail;right[i]*=gain*tail;}
 return {left,right};
}
