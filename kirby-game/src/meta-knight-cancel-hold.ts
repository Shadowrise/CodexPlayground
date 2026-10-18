export const KNIGHT_CANCEL_SECONDS=2;

/** A continuous, fresh hold; taps, interruptions and input changes cannot add up. */
export class KnightCancelHold{
 private battle?:number;private source?:string;private elapsed=0;private blocked=false;
 get progress(){return Math.min(1,this.elapsed/KNIGHT_CANCEL_SECONDS);}
 reset(){this.battle=undefined;this.source=undefined;this.elapsed=0;this.blocked=false;}
 update(battle:number|undefined,source:string|undefined,dt:number){
  if(this.battle!==battle){this.battle=battle;this.source=undefined;this.elapsed=0;this.blocked=!!source;return false;}
  if(battle===undefined||!source){this.source=undefined;this.elapsed=0;this.blocked=false;return false;}
  if(this.blocked)return false;
  if(this.source!==source){this.source=source;this.elapsed=0;}
  this.elapsed+=Math.max(0,Math.min(.1,dt));
  if(this.elapsed+1e-8<KNIGHT_CANCEL_SECONDS)return false;
  this.blocked=true;return true;
 }
}
