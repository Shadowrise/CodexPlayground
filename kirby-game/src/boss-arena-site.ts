/** Static arena footprint; intentionally independent of boss/game state. */
export const BOSS_ARENA={x:140,z:-45,radius:46,playRadius:36,entry:{x:140,z:0}} as const;
export const ARENA_POSTS=[
 ...[-1,1].map(side=>({x:side*7.6,z:40,radius:.85,height:7.4})),
 ...Array.from({length:8},(_,i)=>{const angle=(i+.5)*Math.PI/4;return {x:Math.sin(angle)*42,z:Math.cos(angle)*42,radius:1.25,height:6.8};}),
];
export function constrainArena(p:{x:number;y:number;z:number},size:number){
 if(Math.hypot(p.x-BOSS_ARENA.x,p.z-BOSS_ARENA.z)>50+size)return;
 for(const post of ARENA_POSTS){
  if(p.y>post.height)continue;
  const x=BOSS_ARENA.x+post.x,z=BOSS_ARENA.z+post.z,dx=p.x-x,dz=p.z-z,d=Math.hypot(dx,dz),r=post.radius+.6*size;
  if(d<r){p.x=x+(d>.001?dx/d:1)*r;p.z=z+(d>.001?dz/d:0)*r;}
 }
}

/** NPC-only boundary: movement probes use it to choose a clear heading. */
export function constrainNpcOutsideArena(p:{x:number;y:number;z:number},size:number,previous?:{x:number;z:number}){
 const radius=BOSS_ARENA.radius+.6*size;
 let dx=p.x-BOSS_ARENA.x,dz=p.z-BOSS_ARENA.z;
 if(dx*dx+dz*dz>=radius*radius)return;
 let distance=Math.hypot(dx,dz);
 // Old saves and initial spawns may be inside, including exactly at the centre.
 if(distance<.001){dx=previous?previous.x-BOSS_ARENA.x:0;dz=previous?previous.z-BOSS_ARENA.z:1;distance=Math.hypot(dx,dz);}
 if(distance<.001){dx=0;dz=1;distance=1;}
 p.x=BOSS_ARENA.x+dx/distance*radius;p.z=BOSS_ARENA.z+dz/distance*radius;
}
