import {starPosition} from './meta-knight-star-assault';
import {crystalPoint} from './meta-knight-shield';
import type {KnightBattle,KnightPoint} from './meta-knight-battle';
/** Reserve the full higher leap while winding up, so the camera never chases the beak. */
export function pidgeyCameraPoints(s:KnightBattle,boss:KnightPoint,player:KnightPoint,size=1){
 const points:KnightPoint[]=[];
 for(const x of [-1.5,1.5])for(const y of [0,3.2*size])for(const z of [-1.5,1.5])points.push([player[0]+x*size,player[1]+y,player[2]+z*size]);
 const stellar=s.phase===3&&['star-warn','star-fall'].includes(s.stage),leap=s.pattern==='leap'&&['jump-warn','jump'].includes(s.stage),dive=s.pattern==='dive'&&['dive-warn','dive'].includes(s.stage),flight=s.pattern==='flight'&&['dash-warn','dash'].includes(s.stage),top=leap?26:dive?23:stellar?22:boss[1]+12;
 const centres=leap||dive||flight?[boss,s.to]:[boss];if(s.phase===3){const end=starPosition(s,s.until);if(end)centres.push(end);if(s.stage==='shield'&&s.activeCrystal!==undefined)centres.push(crystalPoint(s.activeCrystal));}
 for(const centre of centres)for(const x of [-7,7])for(const y of [0,top])for(const z of [-4,4])points.push([centre[0]+x,y,centre[2]+z]);
 return points;
}
