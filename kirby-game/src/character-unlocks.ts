import {allTasks} from './starfall';

export const BANDANA_UNLOCK_KEY='kirby-bandana-unlocked-v1';

/** Earn once in either mode; unavailable browser storage never blocks play. */
export class CharacterUnlocks {
 bandanaUnlocked=false;
 constructor(private storage?:Pick<Storage,'getItem'|'setItem'>){
  try{this.bandanaUnlocked=storage?.getItem(BANDANA_UNLOCK_KEY)==='1';}catch{}
 }
 isLocked(name:string){return name==='Бандана'&&!this.bandanaUnlocked;}
 complete(achievements:Iterable<string>){
  return !this.bandanaUnlocked&&allTasks(achievements)?this.unlockBandana():false;
 }
 unlockBandana(){
  if(this.bandanaUnlocked)return false;
  this.bandanaUnlocked=true;
  try{this.storage?.setItem(BANDANA_UNLOCK_KEY,'1');}catch{}
  return true;
 }
}
