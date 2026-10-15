import {NUMBER_MIDI} from './number-garden-site';
export type NumberSound=number|'correct'|'wrong'|'finish';
/** Soft celesta attack, tuned bell partials and a warm wooden fundamental.
 * The ten keys follow a pentatonic scale so free play stays consonant. */
export function numberSound(kind:NumberSound,rate=22050){
 const duration=typeof kind==='number'?1.65:kind==='finish'?2.7:kind==='wrong'?.48:.65;
 const samples=new Float32Array(Math.ceil(duration*rate));
 const notes=typeof kind==='number'?[{midi:NUMBER_MIDI[kind],at:0}]:kind==='wrong'?[{midi:55,at:0},{midi:53,at:.16}]:kind==='finish'?[72,76,79,84,88].map((midi,i)=>({midi,at:i*.16})):[{midi:84,at:0},{midi:88,at:.12}];
 for(let i=0;i<samples.length;i++){
  const t=i/rate;let sum=0;
  for(const note of notes){const age=t-note.at;if(age<0)continue;const f=440*2**((note.midi-69)/12),phase=2*Math.PI*f*age;
   const attack=1-Math.exp(-age*240),tail=Math.min(1,(duration-t)/.09);
   const body=Math.sin(phase)*Math.exp(-age*3.7)+.28*Math.sin(phase*2)*Math.exp(-age*6)+.12*Math.sin(phase*3)*Math.exp(-age*9)+.045*Math.sin(phase*4)*Math.exp(-age*13);
   sum+=body*attack*tail*(kind==='wrong'?.18:.24);
  }
  samples[i]=sum;
 }
 return samples;
}
