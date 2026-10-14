import {MUSICAL_FLOWER_SITE as SITE,canPlayFlower,validFlowerIndex} from './musical-flower-site';
import {FLOWER_FULL_MELODIES} from './musical-flower-melodies';

/** Ten-note phrases, arranged for our existing seven C5–B5 bell recordings.
 * Traditional nursery tunes and Beethoven; note/beat references:
 * https://www.printablegarden.com/sheet-music/ (no recordings copied). */
export const FLOWER_MELODIES=[
 {name:'Маленькая звёздочка',notes:[0,0,4,4,5,5,4,3,3,2],beats:[1,1,1,1,1,1,2,1,1,1]},
 {name:'У Мэри был барашек',notes:[2,1,0,1,2,2,2,1,1,1],beats:[1,1,1,1,1,1,2,1,1,2]},
 {name:'Брат Жак',notes:[0,1,2,0,0,1,2,0,2,3],beats:[1,1,1,1,1,1,1,1,1,1]},
 {name:'Лондонский мост',notes:[4,5,4,3,2,3,4,1,2,3],beats:[1.5,.5,1,1,1,1,2,1,1,2]},
 {name:'Ода к радости',notes:[2,2,3,4,4,3,2,1,0,0],beats:[1,1,1,1,1,1,1,1,1,1]},
 {name:'При свете луны',notes:[4,4,4,5,6,5,4,6,5,5],beats:[1,1,1,1,2,2,1,1,1,1]},
 {name:'Горячие булочки',notes:[6,5,4,6,5,4,4,4,4,4],beats:[1,1,2,1,1,2,.5,.5,.5,.5]},
 {name:'Греби на лодочке',notes:[0,0,0,1,2,2,1,2,3,4],beats:[1.5,1.5,1,.5,1.5,1,.5,1,.5,3]},
 {name:'Янки Дудл',notes:[4,4,5,6,4,6,5,1,4,4],beats:[.5,.5,.5,.5,.5,.5,1,.5,.5,.5]},
 {name:'Звенят колокольчики',notes:[2,4,0,1,2,3,3,3,3,3],beats:[1,1,1.5,.5,4,1,1,1.5,.5,1]},
] as const;
export const FLOWER_ROUNDS=10;
export const FLOWER_BEAT_MS=450,FLOWER_EMPTY_MS=10000,FLOWER_CELEBRATE_MS=9600;
export const FLOWER_SUCCESS_MS=350;
export const FLOWER_FINAL_LEAD_MS=3200,FLOWER_FINAL_TAIL_MS=2400;
const finalDurations=FLOWER_MELODIES.map(m=>FLOWER_FULL_MELODIES[m.name].reduce((sum,n)=>sum+n.beats,0)*FLOWER_BEAT_MS);
export type FlowerPlaybackNote={index:number;at:number;transpose:number};
export type FlowerActor={id:string;p:readonly number[];size:number;available?:boolean;present?:boolean};
export type FlowerStage='listen'|'repeat'|'error'|'echo'|'celebrate';
export type FlowerGame={startedAt:number;melody:number;round:number;cursor:number;stage:FlowerStage;stageAt:number;players:string[];winners:string[];emptySince?:number};
export function validFlowerGame(value:unknown):value is FlowerGame{
 const q=value as FlowerGame;
 return !!q&&Number.isFinite(q.startedAt)&&Number.isFinite(q.stageAt)&&Number.isInteger(q.melody)&&q.melody>=0&&q.melody<10&&Number.isInteger(q.round)&&q.round>=1&&q.round<=FLOWER_ROUNDS&&Number.isInteger(q.cursor)&&q.cursor>=0&&q.cursor<=q.round&&['listen','repeat','error','echo','celebrate'].includes(q.stage)&&(q.emptySince===undefined||Number.isFinite(q.emptySince))&&Array.isArray(q.players)&&q.players.length>0&&q.players.length<=14&&q.players.every(id=>typeof id==='string'&&id.length<=128)&&new Set(q.players).size===q.players.length&&Array.isArray(q.winners)&&q.winners.every(id=>q.players.includes(id))&&(q.stage!=='celebrate'||q.round===FLOWER_ROUNDS&&q.cursor===FLOWER_ROUNDS);
}
export function onFlowerClearing(a:FlowerActor){return a.present!==false&&a.p.length===3&&a.p.every(Number.isFinite)&&Math.abs(a.p[1])<30&&Math.hypot(a.p[0]-SITE.x,a.p[2]-SITE.z)<SITE.radius+6;}
export function nearFlowerButton(a:FlowerActor){return a.available!==false&&a.present!==false&&Number.isFinite(a.size)&&a.p.length===3&&a.p.every(Number.isFinite)&&Math.abs(a.p[1])<3.6&&Math.hypot(a.p[0]-SITE.x,a.p[2]-SITE.z)<2.6+.7*Math.min(3,Math.max(.3,a.size));}
export function startFlowerGame(old:FlowerGame|undefined,a:FlowerActor,now:number,random=Math.random):FlowerGame|undefined{
 if(old||!nearFlowerButton(a)||!Number.isFinite(now))return old;
 return {startedAt:now,melody:Math.min(9,Math.max(0,Math.floor(random()*10))),round:1,cursor:0,stage:'listen',stageAt:now,players:[a.id],winners:[]};
}
export function replayFlowerGame(q:FlowerGame|undefined,a:FlowerActor,now:number){
 if(!q||q.stage!=='repeat'||!nearFlowerButton(a))return q;
 return {...q,stage:'listen' as const,stageAt:now,cursor:0,emptySince:undefined,players:q.players.includes(a.id)?q.players:[...q.players,a.id]};
}
export function flowerPlayback(q:FlowerGame):FlowerPlaybackNote[]{
 if(q.stage==='celebrate'){
  let at=q.stageAt+FLOWER_FINAL_LEAD_MS;
  return FLOWER_FULL_MELODIES[FLOWER_MELODIES[q.melody].name].map(tone=>{const note={index:tone.index,at,transpose:tone.transpose};at+=tone.beats*FLOWER_BEAT_MS;return note;});
 }
 if(q.stage!=='listen')return [];
 const melody=FLOWER_MELODIES[q.melody];let at=q.stageAt+650;
 return melody.notes.slice(0,q.round).map((index,i)=>{const note={index,at,transpose:0};at+=melody.beats[i]*FLOWER_BEAT_MS;return note;});
}
export function flowerFinalEnd(q:FlowerGame){return q.stageAt+FLOWER_FINAL_LEAD_MS+finalDurations[q.melody];}
export function flowerPhraseEnd(q:FlowerGame){return q.stageAt+650+FLOWER_MELODIES[q.melody].beats.slice(0,q.round).reduce((sum,n)=>sum+n,0)*FLOWER_BEAT_MS;}
export function flowerDeadline(q:FlowerGame){
 // Keep the existing wire stage name; success is a brief cue, without replaying the answered phrase.
 const stage=q.stage==='listen'?flowerPhraseEnd(q)+250:q.stage==='echo'?q.stageAt+FLOWER_SUCCESS_MS:q.stage==='error'?q.stageAt+1200:q.stage==='celebrate'?Math.max(q.stageAt+FLOWER_CELEBRATE_MS,flowerFinalEnd(q)+FLOWER_FINAL_TAIL_MS):Infinity;
 return Math.min(stage,q.emptySince===undefined?Infinity:q.emptySince+FLOWER_EMPTY_MS);
}
/** Same clock-driven rules in solo and the room; rendering/audio need no packets per note. */
export function advanceFlowerGame(q:FlowerGame|undefined,now:number,actors?:readonly FlowerActor[]):FlowerGame|undefined{
 if(!q)return;
 if(q.stage==='celebrate')return now>=flowerDeadline(q)?undefined:q;
 if(actors){
  const present=actors.some(a=>q!.players.includes(a.id)&&onFlowerClearing(a));
  if(present&&q.emptySince!==undefined)q={...q,emptySince:undefined};
  else if(!present&&q.emptySince===undefined)q={...q,emptySince:now};
 }
 if(q.emptySince!==undefined&&now>=q.emptySince+FLOWER_EMPTY_MS)return;
 for(let i=0;i<3&&now>=flowerDeadline(q);i++){
  const at=flowerDeadline(q);
  if(q.stage==='listen')q={...q,stage:'repeat',stageAt:at,cursor:0};
  else if(q.stage==='error')q={...q,stage:'listen',stageAt:at,cursor:0};
  else if(q.stage==='echo')q={...q,stage:'listen',stageAt:at,round:q.round+1,cursor:0};
  else break;
 }
 return q;
}
export function playFlowerGame(q:FlowerGame|undefined,index:unknown,a:FlowerActor,now:number,actors:readonly FlowerActor[]=[a]):FlowerGame|undefined{
 if(!q||q.stage!=='repeat'||a.available===false||!onFlowerClearing(a)||!canPlayFlower(index,{x:a.p[0],y:a.p[1],z:a.p[2]},a.size))return q;
 const players=q.players.includes(a.id)?q.players:[...q.players,a.id];
 if(!validFlowerIndex(index)||index!==FLOWER_MELODIES[q.melody].notes[q.cursor])return {...q,players,stage:'error',stageAt:now,emptySince:undefined};
 const cursor=q.cursor+1;
 if(cursor<q.round)return {...q,players,cursor,emptySince:undefined};
 if(q.round<FLOWER_ROUNDS)return {...q,players,cursor,stage:'echo',stageAt:now,emptySince:undefined};
 const winners=players.filter(id=>actors.some(actor=>actor.id===id&&onFlowerClearing(actor)));
 return {...q,players,winners,cursor,stage:'celebrate',stageAt:now,emptySince:undefined};
}
