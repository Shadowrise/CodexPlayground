import type {KnightBattle,KnightPoint} from './meta-knight-battle';
/** Reserve the full higher leap while winding up, so the camera never chases the beak. */
export function pidgeyCameraPoints(s:KnightBattle,boss:KnightPoint,player:KnightPoint,size=1){
 const points:KnightPoint[]=[];
 for(const x of [-1.5,1.5])for(const y of [0,3.2*size])for(const z of [-1.5,1.5])points.push([player[0]+x*size,player[1]+y,player[2]+z*size]);
 const leap=s.pattern==='leap'&&['jump-warn','jump'].includes(s.stage),dive=s.pattern==='dive'&&['dive-warn','dive'].includes(s.stage),flight=s.pattern==='flight'&&['dash-warn','dash'].includes(s.stage),top=leap?26:dive?23:boss[1]+12;
 for(const centre of leap||dive||flight?[boss,s.to]:[boss])for(const x of [-7,7])for(const y of [0,top])for(const z of [-4,4])points.push([centre[0]+x,y,centre[2]+z]);
 return points;
}
