import {allTasks} from './starfall';

export const BANDANA_UNLOCK_KEY='kirby-bandana-unlocked-v1';
export const PIDGIE_UNLOCK_KEY='kirby-pidgie-unlocked-v1';
export const META_KNIGHT_UNLOCK_KEY='kirby-meta-knight-unlocked-v1';

/** Earn once in either mode; unavailable browser storage never blocks play. */
export class CharacterUnlocks {
 bandanaUnlocked=false;
 pidgieUnlocked=false;
 metaKnightUnlocked=false;
 constructor(private storage?:Pick<Storage,'getItem'|'setItem'>){
  try{this.bandanaUnlocked=storage?.getItem(BANDANA_UNLOCK_KEY)==='1';}catch{}
  try{this.pidgieUnlocked=storage?.getItem(PIDGIE_UNLOCK_KEY)==='1';}catch{}
  try{this.metaKnightUnlocked=storage?.getItem(META_KNIGHT_UNLOCK_KEY)==='1';}catch{}
 }
 isLocked(name:string){return name==='Бандана'&&!this.bandanaUnlocked||name==='Пиджи'&&!this.pidgieUnlocked||name==='Meta Knight'&&!this.metaKnightUnlocked;}
 complete(achievements:Iterable<string>){
  return !this.bandanaUnlocked&&allTasks(achievements)?this.unlockBandana():false;
 }
 unlockBandana(){
  if(this.bandanaUnlocked)return false;
  this.bandanaUnlocked=true;
  try{this.storage?.setItem(BANDANA_UNLOCK_KEY,'1');}catch{}
  return true;
 }
 unlockPidgie(){
  if(this.pidgieUnlocked)return false;
  this.pidgieUnlocked=true;
  try{this.storage?.setItem(PIDGIE_UNLOCK_KEY,'1');}catch{}
  return true;
 }
 unlockMetaKnight(){
  if(this.metaKnightUnlocked)return false;
  this.metaKnightUnlocked=true;
  try{this.storage?.setItem(META_KNIGHT_UNLOCK_KEY,'1');}catch{}
  return true;
 }
}
