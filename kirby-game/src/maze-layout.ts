export const MAZE_SITE={x:-94,z:94,radius:54};
export const MAZE_CELLS=7,MAZE_CELL=10,MAZE_HALF=35;
/** Seeded depth-first maze: one entrance, connected passages and real dead ends. */
export function mazeLayout(){
  const walls=Array.from({length:49},()=>[true,true,true,true]);
  let seed=729;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const visited=new Set<number>([45]),stack=[45],directions=[[0,-1],[1,0],[0,1],[-1,0]];
  while(stack.length){const cell=stack[stack.length-1],x=cell%7,z=Math.floor(cell/7);
    const options=directions.map(([dx,dz],d)=>({x:x+dx,z:z+dz,d})).filter(p=>p.x>=0&&p.x<7&&p.z>=0&&p.z<7&&!visited.has(p.z*7+p.x));
    if(!options.length){stack.pop();continue;}const p=options[Math.floor(random()*options.length)],next=p.z*7+p.x;
    walls[cell][p.d]=false;walls[next][(p.d+2)%4]=false;visited.add(next);stack.push(next);
  }
  walls[45][2]=false;
  return walls;
}
