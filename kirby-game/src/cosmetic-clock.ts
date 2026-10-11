/** Only decorative idle poses use reduced update rates. Movement, collisions,
 * player/NPC animation and network interpolation always keep their full rate. */
export class CosmeticClock {
 private elapsed=0;
 step(dt:number,distanceSquared:number,visible=true){
  this.elapsed+=dt;
  if(!visible)return 0;
  const interval=distanceSquared>120**2?.1:distanceSquared>65**2?1/30:0;
  if(this.elapsed+1e-8<interval)return 0;
  const elapsed=this.elapsed;this.elapsed=0;return elapsed;
 }
}
