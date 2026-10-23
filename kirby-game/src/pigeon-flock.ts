import * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {PidgieNpc,type PidgiePlayer,type PidgieNpcOptions} from './pidgie-npc';
import {PIGEON_CLIP_BY_NAME} from './pigeon-clips';
import {PIGEON_FLOCK_BATCH,type PigeonCheckpoint,type SummonedPigeon} from './pigeon-flock-state';
import {disposeActor} from './actor-lifecycle';
import type {NpcConstraint} from './npcs';
import {insideMeadow} from './world-bounds';
import {PigeonSnapshots} from './pigeon-snapshots';
import {PigeonCrowd} from './pigeon-crowd';

// Full model bounds include the head's height above the feet. Ground spacing
// instead uses the measured horizontal envelope, including the Hello wing.
export const FLOCK_RADIUS=3.2;
export const FLOCK_GROUND_RADIUS=1.8;
const SPACING=FLOCK_GROUND_RADIUS*2+.2;
/** Wings fold for the final descent; vertical separation provides takeoff room. */
export const flockRadius=(height:number)=>FLOCK_GROUND_RADIUS+.6*T.MathUtils.clamp((height-3)/3,0,1);

/** Swept clearance with wings opening gradually along the vertical segment. */
function blocksFlight(previous:T.Vector3,point:T.Vector3,at:T.Vector3){
 const dx=point.x-previous.x,dy=point.y-previous.y,dz=point.z-previous.z,ax=at.x-previous.x,ay=at.y-previous.y,az=at.z-previous.z;
 const length=dx*dx+dy*dy+dz*dz,before=ax*ax+ay*ay+az*az,other=flockRadius(at.y),radius=flockRadius(previous.y)+other;
 if(before<radius*radius-1e-6&&point.distanceToSquared(at)>before+1e-6)return false;
 const dot=ax*dx+ay*dy+az*dz,ground=dy?(3-previous.y)/dy:1,air=dy?(6-previous.y)/dy:1;
 if(dy===0){const u=length?T.MathUtils.clamp(dot/length,0,1):0,x=ax-dx*u,z=az-dz*u;return x*x+ay*ay+z*z<radius*radius-1e-6;}
 const first=T.MathUtils.clamp(Math.min(ground,air),0,1),second=T.MathUtils.clamp(Math.max(ground,air),0,1);let low=0;
 for(let i=0;i<3;i++){
  const high=i===0?first:i===1?second:1;if(high<=low)continue;
  const middleY=previous.y+dy*(low+high)/2,slope=middleY>3&&middleY<6?dy*.2:0;
  const intercept=flockRadius(previous.y+dy*low)+other-slope*low;
  const quadratic=length-slope*slope,u=quadratic?T.MathUtils.clamp((dot+intercept*slope)/quadratic,low,high):low;
  const x=ax-dx*u,y=ay-dy*u,z=az-dz*u,r=intercept+slope*u;
  if(x*x+y*y+z*z<r*r-1e-6)return true;
  low=high;
 }
 return false;
}
type Bird={spec:SummonedPigeon;npc:PidgieNpc;helloIn:number;helloRemaining:number;helloCount:number;departureY?:number;departed?:boolean;applied?:PigeonCheckpoint;snapshots:PigeonSnapshots;slot?:number;searchOffset:number;goal?:T.Vector3;goalAt?:T.Vector3;goalNext:number;stalled:number};
type FlockOptions=PidgieNpcOptions&{prepare?:(actor:T.Object3D)=>void;renderMode?:'individual'|'instanced'};

/** Stable expanding rings add space as the flock grows, without a bird cap. */
export function pigeonSlot(index:number){
 let radius=4;
 for(;;radius+=SPACING){
  const count=Math.floor(Math.PI*2/ (2*Math.asin(SPACING/(2*radius))));
  if(index<count){const angle=index/count*Math.PI*2+radius*.13;return new T.Vector3(Math.sin(angle)*radius,0,Math.cos(angle)*radius);}
  index-=count;
 }
}

export class PigeonFlock{
 readonly group=new T.Group();
 readonly birds=new Map<string,Bird>();
 private cursor=0;
 private now=0;private pathBudget=0;private goalBudget=0;
 private crowds=new Map<'pidgie'|'snowball',PigeonCrowd>();
 constructor(private templates:Record<'pidgie'|'snowball',Pick<GLTF,'scene'|'animations'>>,private options:FlockOptions,private onHello:(position:T.Vector3)=>void=()=>{}){
  this.group.name='Голубиная почта Ветерка';
  if(options.renderMode!=='individual')for(const skin of ['pidgie','snowball'] as const)this.crowds.set(skin,new PigeonCrowd(templates[skin],options.prepare));
 }

 private landingClear(point:T.Vector3,bird:Bird,world?:NpcConstraint,occupied=true){
  const grounded=bird.npc.phase==='follow';
  if(!insideMeadow(point,1)||!(grounded?(this.options.walkGround??this.options.safeGround):this.options.safeGround)(point.x,point.z))return false;
  const constrained=point.clone();world?.(constrained,1,point.clone().setY(1));
  if(constrained.distanceToSquared(point)>.0001)return false;
  if(occupied)for(const other of this.birds.values())if(other!==bird&&other.npc.actor.visible&&other.npc.actor.position.y<3&&other.npc.actor.position.distanceToSquared(point)<(FLOCK_GROUND_RADIUS*2+.05)**2)return false;
  return true;
 }

 private goal(player:PidgiePlayer,index:number,reserved:T.Vector3[],bird:Bird,world?:NpcConstraint){
  let nearest:{point:T.Vector3;slot:number}|undefined,ring=Infinity;
  for(let attempt=0;attempt<32;attempt++){
   const goal=player.position.clone().setY(0).add(pigeonSlot(index+attempt));
   const radius=Math.hypot(goal.x-player.position.x,goal.z-player.position.z);
   if(nearest&&radius>ring+.001)break;
   const occupied=bird.npc.phase!=='follow'||!!bird.goalAt&&Math.hypot(bird.goalAt.x-player.position.x,bird.goalAt.z-player.position.z)<=.5;
   if(!this.landingClear(goal,bird,world,occupied)||!reserved.every(p=>p.distanceToSquared(goal)>=(SPACING-.001)**2))continue;
   if(bird.npc.phase!=='follow')return {point:goal,slot:index+attempt};
   if(!nearest||goal.distanceToSquared(bird.npc.actor.position)<nearest.point.distanceToSquared(bird.npc.actor.position)){nearest={point:goal,slot:index+attempt};ring=radius;}
  }
  return nearest;
 }

 private constraint(bird:Bird,world?:NpcConstraint,terrain=true):NpcConstraint{return (point,size,previous)=>{
  if(terrain&&point.y<1){world?.(point,size,previous);if(!(this.options.walkGround??this.options.safeGround)(point.x,point.z)||!insideMeadow(point,size)){point.copy(previous);return;}}
  // Test the whole movement segment, including remote interpolation, so a fast
  // pursuit or a delayed snapshot cannot pass through another bird.
  const blocked=()=>{for(const other of this.birds.values())if(other!==bird&&other.npc.actor.visible&&blocksFlight(previous,point,other.npc.actor.position))return true;return false;};
  if(!blocked())return;
  if(terrain&&bird.npc.phase!=='follow'){
   const x=point.x,y=point.y,z=point.z;
   // A crowded approach may still climb or move sideways. Rejecting all axes
   // together used to strand birds below their planned flight altitude.
   if(y!==previous.y){point.set(previous.x,y,previous.z);if(!blocked())return;}
   if(previous.y>=1&&(x!==previous.x||z!==previous.z)){point.set(x,previous.y,z);if(!blocked())return;}
  }
  point.copy(previous);
 };}

 update(dt:number,specs:readonly SummonedPigeon[],host:boolean,players:readonly PidgiePlayer[],people:readonly T.Vector3[],world?:NpcConstraint,now?:number){
  this.now=now??this.now+dt*1000;this.pathBudget=1;this.goalBudget=2;
  const live=new Set(specs.map(s=>s.id));
  for(const [id,bird] of this.birds)if(!live.has(id)){disposeActor(bird.npc);this.birds.delete(id);}
  const slots=new Map<string,number>(),reserved:T.Vector3[]=[];
  for(const spec of specs){
   const index=slots.get(spec.playerId)??0;slots.set(spec.playerId,index+1);
   const player=players.find(p=>p.id===spec.playerId);let bird=this.birds.get(spec.id);
   if(!bird){
    const npc=new PidgieNpc(this.templates[spec.skin],{...this.options,clockOnly:this.crowds.size>0,kind:spec.skin,seed:spec.seed,summoned:true,canPlanFollow:()=>this.pathBudget>0&&!!this.pathBudget--});
    npc.model.traverse(node=>{if(node instanceof T.Mesh){node.castShadow=false;if(node instanceof T.SkinnedMesh)node.boundingSphere=new T.Sphere(new T.Vector3(0,1.2,0),6);}});
    if(!this.crowds.size)this.options.prepare?.(npc.actor);
    bird={spec,npc,helloIn:1+(spec.seed%3000)/1000,helloRemaining:0,helloCount:0,snapshots:new PigeonSnapshots(),goalNext:0,stalled:0,searchOffset:0};
    this.birds.set(spec.id,bird);this.group.add(npc.actor);
   }
   if(spec.checkpoint&&bird.applied!==spec.checkpoint){
    bird.snapshots.push(spec.checkpoint,this.now);
    if(!host||bird.npc.phase==='hidden'){
     const first=!bird.applied,c=spec.checkpoint;
     if(first||host||spec.dismissedAt!==undefined)bird.npc.applyNetworkState(c.bird,first);
     bird.helloIn=c.helloIn;bird.helloRemaining=c.helloRemaining;
     bird.departureY=c.departureY;bird.departed=c.departed;
     if(!first&&c.helloCount>bird.helloCount&&c.helloRemaining>0)this.onHello(bird.npc.actor.position);
     bird.helloCount=c.helloCount;
     if(c.slot!==undefined&&player){bird.slot=c.slot;bird.goal=player.position.clone().setY(0).add(pigeonSlot(c.slot));bird.goalAt=player.position.clone();bird.goalNext=this.now+400;}
    }
    bird.applied=spec.checkpoint;
   }
   if(host&&!bird.departed&&bird.npc.phase!=='hidden')bird.npc.actor.visible=true;
   const constrain=this.constraint(bird,host?world:undefined,host);
   if(spec.dismissedAt!==undefined){
    if(bird.departed){bird.npc.actor.visible=false;continue;}
    if(bird.departureY===undefined){
     if(!bird.npc.actor.visible){bird.departed=true;continue;}
     const direction=player?bird.npc.actor.position.clone().sub(player.position).setY(0):pigeonSlot(spec.order);
     if(direction.lengthSq()<.01)direction.copy(pigeonSlot(spec.order));direction.normalize();
     const destination=bird.npc.actor.position.clone().addScaledVector(direction,140);
     bird.departureY=bird.npc.startDeparture(destination,Math.max(26,this.options.flightHeight?.(bird.npc.actor.position,destination)??26)+(spec.order%20)*5.2);this.options.onScare?.(bird.npc.actor.position);
    }
    bird.departed=bird.npc.updateDeparture(dt,bird.departureY,constrain)&&(!player||Math.hypot(bird.npc.actor.position.x-player.position.x,bird.npc.actor.position.z-player.position.z)>=80);
    if(bird.departed)bird.npc.actor.visible=false;continue;
   }
   if(!player)continue;
   if(!host){
    const previous=bird.npc.actor.position.clone(),state=bird.snapshots.sample(this.now,Math.max(280,Math.ceil(specs.length/PIGEON_FLOCK_BATCH)*100+180));
    if(state)bird.npc.presentSummoned(state,dt);else bird.npc.actor.visible=false;
    constrain(bird.npc.actor.position,1,previous);
    bird.helloIn=Math.max(0,bird.helloIn-dt);bird.helloRemaining=Math.max(0,bird.helloRemaining-dt);continue;
   }
   let goal=bird.goal;
   const retry=bird.stalled>=1.5;
   const moved=!bird.goalAt||Math.hypot(bird.goalAt.x-player.position.x,bird.goalAt.z-player.position.z)>.5;
   if(this.goalBudget>0&&this.now>=bird.goalNext&&(!goal||retry||moved||bird.npc.phase==='follow')){
    this.goalBudget--;bird.goalNext=this.now+(bird.npc.phase==='follow'?2000:500);
    const retained=bird.npc.phase==='follow'&&bird.slot!==undefined?player.position.clone().setY(0).add(pigeonSlot(bird.slot)):undefined;
    const compact=bird.slot!==undefined&&pigeonSlot(bird.slot).length()<=pigeonSlot(index).length()+.01;
    const keep=retained&&compact&&this.landingClear(retained,bird,world,false)&&reserved.every(p=>p.distanceToSquared(retained)>=(SPACING-.001)**2);
    const candidate=keep?{point:retained,slot:bird.slot!}:this.goal(player,retry?(bird.slot??index)+1:(bird.npc.phase==='follow'?0:index)+bird.searchOffset,reserved,bird,world);
    if(candidate){goal=bird.goal=candidate.point;bird.slot=candidate.slot;bird.goalAt=player.position.clone();bird.searchOffset=0;}
    else bird.searchOffset=(bird.searchOffset+32)%10000;
    if(retry&&candidate){bird.npc.retryArrival(goal!);bird.stalled=0;}
   }
   if(goal&&bird.goalAt){goal=goal.clone().add(new T.Vector3(player.position.x-bird.goalAt.x,0,player.position.z-bird.goalAt.z));reserved.push(goal);}
   if(!goal)continue;
   if(bird.npc.phase==='hidden'){
    let origin:T.Vector3|undefined;
    for(let attempt=0;attempt<128;attempt++){
     const angle=(spec.seed/0x100000000)*Math.PI*2+attempt*2.4;
     const candidate=goal.clone().add(new T.Vector3(Math.sin(angle)*36,0,Math.cos(angle)*36));
     candidate.y=Math.min(240,Math.max(26,this.options.flightHeight?.(candidate,goal)??26)+((index+attempt)%20)*5.2);
     if(Array.from(this.birds.values()).every(other=>other===bird||!other.npc.actor.visible||other.npc.actor.position.distanceTo(candidate)>=4.8)){origin=candidate;break;}
    }
    if(!origin)continue;bird.npc.startArrival(origin,goal,origin.y);
   }
   if(bird.npc.phase==='follow'){
    bird.helloIn=Math.max(0,bird.helloIn-dt);
    if(bird.helloRemaining>0){bird.helloRemaining=Math.max(0,bird.helloRemaining-dt);bird.npc.updateHello(dt);continue;}
    if(bird.helloIn===0){
     bird.helloCount++;bird.helloRemaining=PIGEON_CLIP_BY_NAME.Hello.duration;bird.helloIn=6+(spec.seed+bird.helloCount*997)%4000/1000;
     bird.npc.updateHello(dt,true);this.onHello(bird.npc.actor.position);continue;
    }
   }
   const before=bird.npc.actor.position.clone();
   bird.npc.updateSummoned(dt,player,goal,people,constrain);
   const arriving=bird.npc.phase==='takeoff'||bird.npc.phase==='fly'||bird.npc.phase==='landing';
   bird.stalled=arriving&&bird.npc.actor.position.distanceToSquared(before)<dt*dt*.04?bird.stalled+dt:0;
  }
  for(const [skin,crowd] of this.crowds){
   crowd.begin(specs.filter(s=>s.skin===skin).length);
   for(const bird of this.birds.values())if(bird.spec.skin===skin)crowd.add(bird.npc);
   crowd.end();if(specs.length&&crowd.group.parent!==this.group)this.group.add(crowd.group);else if(!specs.length)crowd.group.removeFromParent();
  }
 }

 /** Rotate bounded packets through every bird; packet size never caps the flock. */
 checkpoints():PigeonCheckpoint[]{
  const birds=Array.from(this.birds.values()),result:PigeonCheckpoint[]=[];
  for(let i=0;i<Math.min(PIGEON_FLOCK_BATCH,birds.length);i++){
   const bird=birds[(this.cursor+i)%birds.length];if(!bird.npc.actor.visible&&!bird.departed)continue;
   result.push({id:bird.spec.id,bird:bird.npc.networkState(),helloIn:bird.helloIn,helloRemaining:bird.helloRemaining,helloCount:bird.helloCount,at:this.now,slot:bird.slot,...(bird.departureY!==undefined?{departureY:bird.departureY}:{}),...(bird.departed?{departed:true}:{})});
  }
  this.cursor=birds.length?(this.cursor+PIGEON_FLOCK_BATCH)%birds.length:0;return result;
 }
 clear(){for(const bird of this.birds.values())disposeActor(bird.npc);this.birds.clear();this.cursor=0;for(const crowd of this.crowds.values()){crowd.clear();crowd.group.removeFromParent();}}
 dispose(){this.clear();for(const crowd of this.crowds.values())crowd.dispose();}
}
