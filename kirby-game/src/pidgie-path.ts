import {PIDGIE_FOLLOW_DISTANCE,type PidgiePoint} from './pidgie-state';

const CELL=1.5,MAX_NODES=1024;
type Node={x:number;z:number;point:PidgiePoint;cost:number;gap:number;parent?:Node};

/** Bounded ground search, used only when direct following is blocked.
 * A detour may initially lead away from the player, including out of a grove.
 * Every edge obeys the same surface/collision rules as actual movement.
 */
export function pidgieFollowPath(from:PidgiePoint,player:PidgiePoint,clear:(a:PidgiePoint,b:PidgiePoint)=>boolean,followDistance=PIDGIE_FOLLOW_DISTANCE):PidgiePoint[]{
 const gap=(p:PidgiePoint)=>Math.abs(Math.hypot(p[0]-player[0],p[1]-player[1])-followDistance);
 const start:Node={x:0,z:0,point:from,cost:0,gap:gap(from)},open=[start],costs=new Map<string,number>([['0,0',0]]);
 let best=start;
 for(let visited=0;open.length&&visited<MAX_NODES;visited++){
  let index=0;for(let i=1;i<open.length;i++)if(open[i].cost+open[i].gap<open[index].cost+open[index].gap)index=i;
  const current=open.splice(index,1)[0];
  if(current.cost!==costs.get(`${current.x},${current.z}`))continue;
  if(current.gap<best.gap)best=current;
  if(current.gap<.45){best=current;break;}
  for(const [dx,dz] of [[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]]){
   const x=current.x+dx,z=current.z+dz,key=`${x},${z}`,cost=current.cost+Math.hypot(dx,dz)*CELL;
   if(cost>=(costs.get(key)??Infinity))continue;
   const point:PidgiePoint=[from[0]+x*CELL,from[1]+z*CELL];
   if(!clear(current.point,point))continue;
   costs.set(key,cost);open.push({x,z,point,cost,gap:gap(point),parent:current});
  }
 }
 if(best.gap>=start.gap-.25)return [];
 const path:PidgiePoint[]=[];for(let node=best;node.parent;node=node.parent)path.push(node.point);
 return path.reverse();
}
