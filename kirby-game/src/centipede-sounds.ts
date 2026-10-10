import type {CentipedeStage} from './centipede-event';
/** Soft, cached voices with attack/release ramps; no hard oscillator resets. */
export function centipedeSound(stage:CentipedeStage,rate=22050){
 const duration=stage==='balls'?2.05:stage==='warning'?1.25:stage==='exhausted'?1.7:stage==='celebrate'?2.4:stage==='charge'?1.2:1;
 const samples=new Float32Array(Math.ceil(rate*duration));let phase=0;
 const happy=['invite','tickle','bell','wheelHit','uncurl','celebrate'].includes(stage);
 const notes=stage==='celebrate'?[523.25,659.25,783.99,1046.5]:['tickle','bell','wheelHit'].includes(stage)?[659.25,783.99,1046.5]:[523.25,659.25];
 for(let i=0;i<samples.length;i++){
  const t=i/rate,u=t/duration,edge=Math.min(1,t/.035,(duration-t)/.08);let v=0;
  if(happy)for(let n=0;n<notes.length;n++){const age=t-n*.19;if(age>=0)v+=(Math.sin(2*Math.PI*notes[n]*age)+.16*Math.sin(4*Math.PI*notes[n]*age))*Math.min(1,age/.035)*Math.exp(-age*4)*.2;}
  else if(stage==='stomp'){phase+=2*Math.PI*(105+140*Math.exp(-t*14))/rate;v=(Math.sin(phase)+.12*Math.sin(phase*2))*Math.min(1,t/.035)*Math.exp(-t*7)*.37;}
  else if(['wheelWarning','curl','coil'].includes(stage)){phase+=2*Math.PI*(220+180*u+20*Math.sin(t*16))/rate;v=Math.sin(phase)*Math.sin(Math.PI*u)**2*.27;}
  else if(stage==='wheelRoll'){phase+=2*Math.PI*(135+50*Math.sin(t*23))/rate;v=(Math.sin(phase)+.15*Math.sin(phase*2))*Math.sin(t*18)**4*Math.sin(Math.PI*u)**2*.3;}
  else if(stage==='balls'){
   // Breath rises with the 1.45-second inhale, then a soft voiced "ap-choo".
   const age=t-1.42,hz=age<0?175+t*45:390-170*Math.min(1,age/.45);
   phase+=2*Math.PI*hz/rate;
   const envelope=age<0?Math.sin(Math.PI*t/1.42)**2*.1:Math.min(1,age/.035)*Math.exp(-age*6)*.34;
   v=(Math.sin(phase)+.16*Math.sin(phase*2)+.06*Math.sin(phase*3))*envelope;
  }else{
   const hz=stage==='warning'?190+180*u+25*Math.sin(t*12):stage==='charge'?125+55*Math.sin(t*28):260-150*u;
   phase+=2*Math.PI*hz/rate;const pulse=stage==='charge'?Math.sin(t*24)**4:stage==='exhausted'?.65+.35*Math.sin(t*10):.8;
   v=(Math.sin(phase)+.15*Math.sin(phase*2))*pulse*Math.sin(Math.PI*u)**2*.28;
   if(stage==='exhausted')v+=Math.sin(2*Math.PI*880*t)*Math.exp(-t*6)*.09;
  }
  samples[i]=v*edge;
 }
 return samples;
}
