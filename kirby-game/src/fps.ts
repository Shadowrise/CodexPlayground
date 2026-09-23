/** Average real render intervals; never use the simulation's clamped delta. */
export class FpsCounter {
 private previous?:number;
 private elapsed=0;
 private frames=0;
 sample(time:number,visible=true){
  if(!visible){this.previous=undefined;this.elapsed=this.frames=0;return undefined;}
  const delta=this.previous===undefined?0:time-this.previous;this.previous=time;
  if(delta<=0)return undefined;
  this.elapsed+=delta;this.frames++;
  if(this.elapsed<500)return undefined;
  const fps=Math.round(this.frames*1000/this.elapsed);this.elapsed=this.frames=0;return fps;
 }
}
