export const PLAYER_KNIGHT_DASH={cooldown:6,duration:.7,distance:12} as const;

/** A press starts immediately; presses during cooldown are discarded. */
export class MetaKnightPlayerDash{
 cooldown=0;
 private remaining=0;
 get active(){return this.remaining>0;}
 get progress(){return 1-this.remaining/PLAYER_KNIGHT_DASH.duration;}
 /** Network poses retain the charge slot for compatibility with existing peers. */
 get charge(){return 0;}
 tick(dt:number){this.cooldown=Math.max(0,this.cooldown-dt);if(this.cooldown<1e-9)this.cooldown=0;}
 cancel(){this.remaining=0;}
 press(allowed:boolean){
  if(!allowed||this.cooldown>0||this.active)return false;
  this.remaining=PLAYER_KNIGHT_DASH.duration;this.cooldown=PLAYER_KNIGHT_DASH.cooldown;return true;
 }
 step(dt:number){const step=Math.min(dt,this.remaining);this.remaining=Math.max(0,this.remaining-step);if(this.remaining<1e-9)this.remaining=0;return step;}
}
