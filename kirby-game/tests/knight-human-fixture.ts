import type {KnightBattle} from '../src/meta-knight-battle';
import {HELPER} from '../src/meta-knight-helper';

/** Keep tests of authored helper attacks independent of autonomous AI opponents. */
export function humanKnightFixture(s:KnightBattle){
 if(!s.opponents)return s;
 for(const id of Object.keys(s.opponents))delete s.players[id];delete s.opponents;delete s.sharedOpponents;
 const heroes=Object.values(s.players).filter(p=>p.side!=='boss');for(const p of heroes)p.hp=HELPER.opponentHearts;
 s.teamMaxHp=HELPER.opponentHearts;if(heroes.length>1)s.teamHp=HELPER.opponentHearts;else delete s.teamHp;
 return s;
}
