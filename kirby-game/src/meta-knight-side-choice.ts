import {KNIGHT,startKnightBattle,type KnightActor,type KnightBattle} from './meta-knight-battle';
import {helperChoiceAvailable,type KnightSide} from './meta-knight-helper';

export const KNIGHT_SIDE_CHOICE_MS=KNIGHT.sideChoiceMs;
export type KnightSideChoices={knightBattle?:KnightBattle;knightSides?:Record<string,KnightSide>};
/** Persisted deadlines also resolve on the room alarm while both clients are idle. */
export function advanceKnightSideChoices(room:KnightSideChoices,actors:readonly KnightActor[],now:number){
 const s=room.knightBattle,c=s?.choice;if(s?.stage!=='side-choice'||!c)return false;
 const present=new Set(actors.filter(a=>a.available&&!s.players[a.id]?.withdrawn).map(a=>a.id)),captured=c.actors.filter(a=>present.has(a.id)),knights=captured.filter(a=>a.metaKnight);
 let changed=false;
 if(now>=c.until||!helperChoiceAvailable(captured))for(const {id} of knights)if(!room.knightSides?.[id]){(room.knightSides??={})[id]='players';changed=true;}
 if(knights.some(a=>!room.knightSides?.[a.id]))return changed;
 const ready=captured.map(a=>({...a,side:room.knightSides?.[a.id]})),owner=ready.find(a=>a.id===c.owner)??ready.find(a=>a.side!=='boss')??ready[0];
 // Starting was already authorized at the boss. A different surviving fighter need not walk back to restart it.
 const occupied=actors.filter(a=>!ready.some(p=>p.id===a.id)).map(a=>({...a,available:false}));
 const origin=c.actors.find(a=>a.id===c.owner)!.p,battle=owner&&startKnightBattle([...ready.map(a=>a.id===owner.id?{...a,p:origin}:a),...occupied],owner.id,now);
 if(battle){battle.revision=s.revision+1;for(const [id,p] of Object.entries(s.players))if(!battle.players[id])battle.players[id]={...p,withdrawn:true};room.knightBattle=battle;return true;}
 s.stage='cancelled';s.since=s.checked=now;s.until=now+1e12;delete s.choice;s.revision++;return true;
}
export function knightSideChoiceDeadline(room:KnightSideChoices|undefined){return room?.knightBattle?.stage==='side-choice'?room.knightBattle.choice?.until??Infinity:Infinity;}
