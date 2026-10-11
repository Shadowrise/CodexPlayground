import {BRIDGES,flatGround as dryGround} from './pond-layout';
import {LANDMARKS,POND_SCALE} from './landmark-sites';
import {BALLOON_SITES} from './balloon-sites';
import {HOME_SITE} from './home-site';
import {MAZE_SITE,MAZE_HALF} from './maze-layout';
import {BOSS_ARENA} from './boss-arena-site';
import {FOUNTAIN_SITE} from './fountain-site';
import {SKY_TRAIL_SITE,SKY_PLATFORMS} from './sky-trail-layout';
import {MEADOW_HALF_SIZE} from './world-bounds';

export type MeadowTree={x:number;z:number;crownRadius:number};
export type MeadowPoint={x:number;z:number};
export type MeadowPath={points:MeadowPoint[];width:number};
export type GroundPatch=MeadowPoint&{rx:number;rz:number};
type Segment={a:MeadowPoint;b:MeadowPoint;halfA:number;halfB:number};
const STEP=2.5,HALF=Math.floor((MEADOW_HALF_SIZE-5)/STEP),SIDE=HALF*2+1;

/** A tiny startup-only heap: paths use the same dry banks and bridges as the game. */
class Heap {
 private entries:{id:number;score:number}[]=[];
 get length(){return this.entries.length;}
 push(id:number,score:number){
  const item={id,score};let i=this.entries.length;this.entries.push(item);
  while(i){const p=(i-1)>>1;if(this.entries[p].score<=score)break;this.entries[i]=this.entries[p];i=p;}this.entries[i]=item;
 }
 pop(){
  const first=this.entries[0],last=this.entries.pop()!;if(!this.entries.length)return first;
  let i=0;while(i*2+1<this.entries.length){let c=i*2+1;if(c+1<this.entries.length&&this.entries[c+1].score<this.entries[c].score)c++;if(this.entries[c].score>=last.score)break;this.entries[i]=this.entries[c];i=c;}this.entries[i]=last;return first;
 }
}
const distanceToSegment=(x:number,z:number,s:Segment)=>{
 const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,len=dx*dx+dz*dz;
 const t=len?Math.max(0,Math.min(1,((x-s.a.x)*dx+(z-s.a.z)*dz)/len)):0;
 return Math.hypot(x-s.a.x-t*dx,z-s.a.z-t*dz)-(s.halfA+(s.halfB-s.halfA)*t);
};
/** The painted edge and plant clearance share the same slow width variation. */
export const meadowPathHalfWidth=(path:MeadowPath,p:MeadowPoint)=>path.width*.5*(.92+.09*Math.sin(p.x*.16+p.z*.11)+.06*Math.cos(p.z*.21-p.x*.065));
export function onMeadowBridge(x:number,z:number){
 return BRIDGES.some(s=>{const dx=x-s.x,dz=z-s.z,c=Math.cos(s.yaw),sn=Math.sin(s.yaw);return Math.abs(dx*c-dz*sn)<11.6&&Math.abs(dx*sn+dz*c)<1.7;});
}

/** One deterministic layout for the baked ground and its vegetation. Nothing
 * here runs in the animation loop, changes collisions or enters network frames. */
export class MeadowLayout {
 readonly paths:MeadowPath[]=[];
 readonly patches:GroundPatch[]=[];
 readonly flowerBeds:GroundPatch[]=[];
 readonly entrances:MeadowPoint[]=[];
 readonly fruitClearings:MeadowPoint[]=[];
 private segments=new Map<string,Segment[]>();
 private blocked:(x:number,z:number)=>boolean=()=>false;
 constructor(trees:readonly MeadowTree[]){
  const treeCells=new Map<string,MeadowTree[]>();
  for(const t of trees){const key=`${Math.floor(t.x/8)},${Math.floor(t.z/8)}`;if(!treeCells.has(key))treeCells.set(key,[]);treeCells.get(key)!.push(t);}
  const blocked=(x:number,z:number)=>{
   // Entrances lead to the actual door/ladder, not the centres of solid buildings.
   if(Math.abs(x-HOME_SITE.x)<7.5&&z>HOME_SITE.z-6.8&&z<HOME_SITE.z+5.2)return true;
   if(Math.abs(x-MAZE_SITE.x)<MAZE_HALF+2.6&&Math.abs(z-MAZE_SITE.z)<MAZE_HALF+2.6)return true;
   if(Math.abs(x-49)<7.2&&z>26&&z<39.5)return true;
   if(Math.hypot(x-135,z-39)<5.2||Math.hypot(x-143,z-58)<6)return true;
   if(Math.hypot(x-FOUNTAIN_SITE.x,z-FOUNTAIN_SITE.z)<12.5)return true;
   if(Math.hypot(x-BOSS_ARENA.x,z-BOSS_ARENA.z)<41)return true;
   if(Math.hypot(x-SKY_TRAIL_SITE.x,z-SKY_TRAIL_SITE.z)<6)return true;
   if(SKY_PLATFORMS.slice(0,2).some(p=>Math.hypot(x-SKY_TRAIL_SITE.x-p.x,z-SKY_TRAIL_SITE.z-p.z)<p.size*.5+2.7))return true;
   if(BALLOON_SITES.some(p=>Math.hypot(x-p.x,z-p.z)<6.5))return true;
   if(LANDMARKS.some(p=>p.kind!==0&&p.kind!==4&&Math.hypot(x-p.x,z-p.z)<(p.kind===1?6:10)))return true;
   // Keep short crowns/trunks off the paths without moving established trees.
   const cx=Math.floor(x/8),cz=Math.floor(z/8);
   for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const t of treeCells.get(`${cx+dx},${cz+dz}`)??[])if((x-t.x)**2+(z-t.z)**2<3.1**2)return true;
   return false;
  };
  this.blocked=blocked;
  const free=(x:number,z:number)=>(onMeadowBridge(x,z)||dryGround(x,z,2.7))&&!blocked(x,z);
  const world=(id:number)=>({x:(id%SIDE-HALF)*STEP,z:(Math.floor(id/SIDE)-HALF)*STEP});
  const cell=(p:MeadowPoint)=>(Math.round(p.z/STEP)+HALF)*SIDE+Math.round(p.x/STEP)+HALF;
  const pass=new Uint8Array(SIDE*SIDE);
  for(let id=0;id<pass.length;id++){const p=world(id);pass[id]=free(p.x,p.z)?1:0;}
  const nearest=(p:MeadowPoint)=>{
   let chosen=-1,distance=Infinity;
   const cx=Math.round(p.x/STEP)+HALF,cz=Math.round(p.z/STEP)+HALF;
   for(let dz=-8;dz<=8;dz++)for(let dx=-8;dx<=8;dx++){
    const x=cx+dx,z=cz+dz,id=z*SIDE+x;if(x<0||z<0||x>=SIDE||z>=SIDE||!pass[id])continue;
    const q=world(id),d=(q.x-p.x)**2+(q.z-p.z)**2;if(d<distance){distance=d;chosen=id;}
   }
   return chosen;
  };
  const branch=(p:MeadowPoint,width:number,rx=3,rz=3)=>{this.entrances.push(p);this.patches.push({...p,rx,rz});return {p,width};};
  const first=SKY_PLATFORMS[0];
  const targets=[
   branch({x:HOME_SITE.x,z:HOME_SITE.z+6},3.4,3.8,2.8),
   branch({x:0,z:214},4.2,6,3),
   branch({x:49,z:46},3.8,5,3),
   branch({x:131,z:56},3.2,2.8,2.8),branch({x:124,z:54},2.5,2.8,2.5),
   branch({x:MAZE_SITE.x,z:MAZE_SITE.z+40},3.8,3.8,3),
   branch({x:FOUNTAIN_SITE.x,z:FOUNTAIN_SITE.z+15},3.8,3.5,2.5),
   branch({x:SKY_TRAIL_SITE.x+first.x,z:SKY_TRAIL_SITE.z+first.z-6},3.3,3.3,2.8),
   branch({x:BOSS_ARENA.entry.x,z:BOSS_ARENA.entry.z+1.5},4.2,4.5,2.8),
   ...BALLOON_SITES.map(p=>branch({x:p.x,z:p.z+10},3.5,4.5,3)),
   ...LANDMARKS.filter(p=>p.kind===4).map(p=>branch({x:p.x,z:p.z+7},2.8,5,2.8)),
   ...BRIDGES.flatMap(p=>[-1,1].map(side=>branch({x:p.x+side*9.8*Math.cos(p.yaw),z:p.z-side*9.8*Math.sin(p.yaw)},3.2,2.6,2.6))),
  ];
  for(const p of LANDMARKS.filter(p=>p.kind===4)){
   this.flowerBeds.push({x:p.x+4.7,z:p.z+4.5,rx:1.6,rz:2.4},{x:p.x-8,z:p.z-2,rx:1.5,rz:2});
   this.patches.push({x:p.x-5,z:p.z-3,rx:2.8,rz:1.8});
  }
  // The right garden sits beside the Shiba cottage, clear of its porch and roof.
  this.flowerBeds.push({x:HOME_SITE.x-7.8,z:HOME_SITE.z+6,rx:1.5,rz:2.7},{x:HOME_SITE.x+12.3,z:HOME_SITE.z+5.6,rx:1.5,rz:2.7},
   {x:-7.7,z:213,rx:1.7,rz:2.3},{x:7.7,z:213,rx:1.7,rz:2.3});
  const network:MeadowPoint[]=[world(nearest({x:0,z:0}))],used=new Uint8Array(pass.length);
  used[cell(network[0])]=1;
  const connect=(start:number,end:number)=>{
   const cost=new Float32Array(pass.length);cost.fill(Infinity);cost[start]=0;
   const parent=new Int32Array(pass.length);parent.fill(-1);
   const closed=new Uint8Array(pass.length),heap=new Heap(),goal=world(end);
   heap.push(start,0);
   while(heap.length){
    const n=heap.pop().id;if(closed[n])continue;closed[n]=1;if(n===end)break;
    const ix=n%SIDE,iz=Math.floor(n/SIDE);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
     const x=ix+dx,z=iz+dz,id=z*SIDE+x;
     if(x<0||z<0||x>=SIDE||z>=SIDE||!pass[id]||closed[id])continue;
     // Diagonals cannot cut across a shoreline, trunk or building corner.
     if(dx&&dz&&(!pass[iz*SIDE+x]||!pass[z*SIDE+ix])){
      const mid=world(n);mid.x+=dx*STEP/2;mid.z+=dz*STEP/2;if(!onMeadowBridge(mid.x,mid.z))continue;
     }
     const p=world(id),variation=1+.12*Math.sin(p.x*.062+Math.sin(p.z*.047))*Math.cos(p.z*.055);
     const next=cost[n]+Math.hypot(dx,dz)*STEP*(used[id]?.82:variation);
     if(next>=cost[id])continue;cost[id]=next;parent[id]=n;
     heap.push(id,next+.8*Math.hypot(p.x-goal.x,p.z-goal.z));
    }
   }
   if(!closed[end])return [];
   const points:MeadowPoint[]=[];let n=end;while(n!==start){points.push(world(n));used[n]=1;n=parent[n];}points.push(world(start));used[start]=1;return points.reverse();
  };
  while(targets.length){
   // Attach the closest attraction to the existing trail, producing shared
   // main paths and short branches rather than a dense web of straight lines.
   let ti=0,ni=0,best=Infinity;
   targets.forEach((t,i)=>network.forEach((p,j)=>{const d=(p.x-t.p.x)**2+(p.z-t.p.z)**2;if(d<best){best=d;ti=i;ni=j;}}));
   const target=targets.splice(ti,1)[0],start=nearest(target.p),end=cell(network[ni]);
   if(start<0)continue;
   let points=connect(start,end);if(!points.length)continue;const nodes=points;
   // Corner cutting is accepted only when it retains full bank/tree clearance.
   for(let pass=0;pass<3;pass++){
    const smooth=[points[0]];
    for(let i=1;i<points.length-1;i++){
     const a=points[i-1],p=points[i],b=points[i+1],q={x:a.x*.25+p.x*.75,z:a.z*.25+p.z*.75},r={x:p.x*.75+b.x*.25,z:p.z*.75+b.z*.25};
     const middle={x:(q.x+2*p.x+r.x)/4,z:(q.z+2*p.z+r.z)/4};
     if([q,r,middle].every(p=>free(p.x,p.z)))smooth.push(q,middle,r);else smooth.push(p);
    }
    smooth.push(points.at(-1)!);
    points=smooth;
   }
   // Keep the lookup/raster budget tied to metres, not the smoothing passes.
   const spaced=[points[0]];let carry=0;
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<1e-7)continue;
    let distance=1-carry;
    while(distance<length){const t=distance/length;spaced.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});distance++;}
    carry=length-(distance-1);
   }
   spaced.push(points.at(-1)!);points=spaced;
   // The few exact entrances are also validated; no trail finishes in water.
   const head=points[0];if(free(target.p.x,target.p.z)&&Array.from({length:5},(_,i)=>({x:head.x+(target.p.x-head.x)*i/4,z:head.z+(target.p.z-head.z)*i/4})).every(p=>free(p.x,p.z)))points.unshift(target.p);
   else if(Array.from({length:12},(_,i)=>({x:head.x+(target.p.x-head.x)*i/11,z:head.z+(target.p.z-head.z)*i/11})).every(p=>!blocked(p.x,p.z)&&dryGround(p.x,p.z,.95)))this.paths.push({points:[target.p,head],width:1.8});
   this.paths.push({points,width:target.width});network.push(...nodes.filter((_,i)=>i%4===0),nodes.at(-1)!);
  }
  // Bend whole stretches, not just grid corners. Pin junctions/doors and bridge
  // approaches; constrained displacements keep the existing tree/bank clearance.
  const anchors=this.paths.flatMap(p=>[p.points[0],p.points.at(-1)!]);
  const smoothstep=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  for(const path of this.paths){
   const source=path.points,offsets=source.map(p=>{
    let fade=1;
    for(const a of anchors)fade=Math.min(fade,smoothstep(1,11,Math.hypot(p.x-a.x,p.z-a.z)));
    for(const b of BRIDGES)fade=Math.min(fade,smoothstep(17,27,Math.hypot(p.x-b.x,p.z-b.z)));
    const dx=fade*6.5*Math.sin(p.x*.061+p.z*.027+.7*Math.sin(p.z*.044));
    const dz=fade*6*Math.sin(p.z*.058-p.x*.031+.8*Math.sin(p.x*.037));
    let weight=1;
    for(let s=.125;s<=1;s+=.125)if(!free(p.x+dx*s,p.z+dz*s)){weight=Math.max(0,s-.125);break;}
    return {dx,dz,weight,fade};
   });
   // Spread reductions over several metres, avoiding kinks beside obstacles.
   for(let pass=0;pass<8;pass++){
    const weights=offsets.map((p,i)=>Math.min(p.weight,(offsets[Math.max(0,i-2)].weight+2*p.weight+offsets[Math.min(offsets.length-1,i+2)].weight)/4));
    offsets.forEach((p,i)=>p.weight=weights[i]);
   }
   let curved=source.map((p,i)=>({x:p.x+offsets[i].dx*offsets[i].weight,z:p.z+offsets[i].dz*offsets[i].weight}));
   for(let pass=0;pass<3;pass++)curved=curved.map((p,i)=>{
    const a=curved[Math.max(0,i-3)],b=curved[Math.min(curved.length-1,i+3)],f=offsets[i].fade*.5;
    const q={x:p.x*(1-f)+(a.x+b.x)*f*.5,z:p.z*(1-f)+(a.z+b.z)*f*.5};
    return free(q.x,q.z)?q:p;
   });
   // Validate the short spans too: no curve may skip across a narrow obstacle.
   for(let i=0;i<curved.length;i++)if(!free(curved[i].x,curved[i].z))curved[i]=source[i];
   for(let pass=0;pass<6;pass++){
    let changed=false;
    for(let i=1;i<curved.length;i++){
     const a=curved[i-1],b=curved[i];
     if(![.25,.5,.75].every(t=>free(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))){
      for(let j=Math.max(0,i-2);j<=Math.min(curved.length-1,i+2);j++)if(curved[j]!==source[j]){curved[j]=source[j];changed=true;}
     }
    }
    if(!changed)break;
   }
   path.points=curved;
  }
  for(const path of this.paths)for(let i=1;i<path.points.length;i++){
   const a=path.points[i-1],b=path.points[i],s={a,b,halfA:meadowPathHalfWidth(path,a),halfB:meadowPathHalfWidth(path,b)};
   const r=Math.max(s.halfA,s.halfB)+6;
   for(let x=Math.floor((Math.min(s.a.x,s.b.x)-r)/16);x<=Math.floor((Math.max(s.a.x,s.b.x)+r)/16);x++)for(let z=Math.floor((Math.min(s.a.z,s.b.z)-r)/16);z<=Math.floor((Math.max(s.a.z,s.b.z)+r)/16);z++){
    const key=`${x},${z}`;if(!this.segments.has(key))this.segments.set(key,[]);this.segments.get(key)!.push(s);
   }
  }
 }
 /** Signed distance from the trail edge, used only during static placement. */
 trailDistance(x:number,z:number){
  let d=Infinity;for(const s of this.segments.get(`${Math.floor(x/16)},${Math.floor(z/16)}`)??[])d=Math.min(d,distanceToSegment(x,z,s));return d;
 }
 clearOfTrails(x:number,z:number,radius=0){
  // Include the irregular painted rim and its filtered fringe, not just the
  // mathematical centre strip. Only queried during static scene placement.
  return this.trailDistance(x,z)>radius+1.4&&this.patches.every(p=>((x-p.x)/(p.rx+radius+.8))**2+((z-p.z)/(p.rz+radius+.8))**2>1);
 }
 moveOffTrail(x:number,z:number,radius:number,valid:(x:number,z:number)=>boolean){
  if(this.clearOfTrails(x,z,radius)&&valid(x,z))return {x,z};
  const phase=x*.7+z*.3;
  for(let distance=.75;distance<=24;distance+=.75){
   const count=Math.min(96,Math.ceil(distance*Math.PI*2/1.1));
   for(let i=0;i<count;i++){
    const a=phase+i/count*Math.PI*2,px=x+Math.cos(a)*distance,pz=z+Math.sin(a)*distance;
    if(this.clearOfTrails(px,pz,radius)&&!this.blocked(px,pz)&&valid(px,pz))return {x:px,z:pz};
   }
  }
  return undefined;
 }
}
