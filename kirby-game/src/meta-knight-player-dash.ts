export const PLAYER_KNIGHT_DASH={hold:.3,cooldown:6,duration:.7,distance:12} as const;

/** One thrust per continuous hold; a press during cooldown is never queued. */
export class MetaKnightPlayerDash{
 cooldown=0;
 private heldFor=0;
 private spent=false;
 private remaining=0;
 get active(){return this.remaining>0;}
 get progress(){return 1-this.remaining/PLAYER_KNIGHT_DASH.duration;}
 get charge(){return this.heldFor/PLAYER_KNIGHT_DASH.hold;}
 tick(dt:number){this.cooldown=Math.max(0,this.cooldown-dt);if(this.cooldown<1e-9)this.cooldown=0;}
 cancelCharge(){this.heldFor=0;this.spent=true;}
 cancel(){this.remaining=0;this.cancelCharge();}
 /** Returns the part of this frame after reaching the charge threshold. */
 chargeHold(dt:number,held:boolean,allowed:boolean):number|undefined{
  if(!held){this.heldFor=0;this.spent=false;return;}
  if(!allowed||this.cooldown>0){this.cancelCharge();return;}
  if(this.spent)return;
  this.heldFor+=dt;
  if(this.heldFor+1e-9<PLAYER_KNIGHT_DASH.hold)return;
  const overflow=Math.max(0,this.heldFor-PLAYER_KNIGHT_DASH.hold);
  this.cancelCharge();this.remaining=PLAYER_KNIGHT_DASH.duration;this.cooldown=PLAYER_KNIGHT_DASH.cooldown;
  return overflow;
 }
 step(dt:number){const step=Math.min(dt,this.remaining);this.remaining=Math.max(0,this.remaining-step);if(this.remaining<1e-9)this.remaining=0;return step;}
}
