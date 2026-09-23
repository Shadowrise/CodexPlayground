export type WaterSound='enter'|'exit'|'paddle'|'float';
export class WaterSoundEvents {
 private wet=false;
 private next=0;
 private transitionCooldown=0;
 update(dt:number,swimming:boolean,moving:boolean,available=true):WaterSound|undefined{
  this.next=Math.max(0,this.next-dt);this.transitionCooldown=Math.max(0,this.transitionCooldown-dt);
  if(!available){this.wet=false;this.next=0;return;}
  if(swimming!==this.wet){
   this.wet=swimming;this.next=.65;
   if(this.transitionCooldown>0)return;
   this.transitionCooldown=.25;return swimming?'enter':'exit';
  }
  if(swimming && this.next===0){this.next=moving?.55:1.1;return moving?'paddle':'float';}
 }
}
/** Soft splash noise with short falling-pitch water bubbles; silent ends avoid clicks. */
export function waterSamples(kind:WaterSound,rate=22050){
 const swimming=kind==='paddle'||kind==='float';
 const smoothing=1-Math.exp(-2*Math.PI*650/rate);let soft=0,rounded=0;
 const duration=kind==='enter'?.85:kind==='exit'?.65:.75;
 const data=new Float32Array(Math.ceil(duration*rate));let seed=173,noise=0,deep=0;
 for(let i=0;i<data.length;i++){
  const t=i/rate,u=t/duration;
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  noise=.68*noise+.32*(seed/4294967296*2-1);deep=.95*deep+.05*noise;
  const attack=Math.min(1,t/(swimming?.12:.025)),release=Math.min(1,(duration-t)/(swimming?.25:.12));
  const wash=kind==='enter'?Math.exp(-t*4):kind==='exit'?Math.exp(-t*5):Math.sin(Math.PI*u)**2;
  let bubbles=0;
  for(let j=0;j<5;j++){
   const start=.035+j*(kind==='exit'?.085:.115),b=t-start;
   if(b>=0 && b<.16){const f=swimming?180+j*45:kind==='enter'?210+j*78:330+j*110;const phase=2*Math.PI*f*(1-Math.exp(-b*9))/9;bubbles+=Math.sin(phase)*Math.sin(Math.PI*b/.16)**2*Math.exp(-b*15)*(swimming?.06:.18);}
  }
  const sample=(noise*(swimming?.25:.58)+deep*.9)*wash+bubbles;
  // Two gentle low-pass stages remove the sharp splash hiss while swimming.
  soft+=smoothing*(sample-soft);rounded+=smoothing*(soft-rounded);
  data[i]=(swimming?rounded:sample)*attack*release;
 }
 return data;
}
