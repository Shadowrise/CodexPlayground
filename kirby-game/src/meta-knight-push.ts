import {knightBattleActive,type KnightBattle} from './meta-knight-battle';
import {helperLocked} from './meta-knight-helper';
import {knightCosmicAlly} from './meta-knight-cosmic-ally';
import {cosmicControlsLocked} from './meta-knight-cosmic';

/** Normal, non-damaging player pushes never interrupt a locked boss ability or a cinematic. */
export function knightPlayerPushable(s:KnightBattle|undefined,id:string,now:number){
 const p=s?.players[id];return !!p&&knightBattleActive(s)&&p.hp>0&&!p.withdrawn&&!['intro','side-choice','transition'].includes(s!.stage)&&!cosmicControlsLocked(s)&&!knightCosmicAlly(s,id,now)&&!(p.helper&&helperLocked(p.helper,now));
}
