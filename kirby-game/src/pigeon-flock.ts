import * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {PidgieNpc,type PidgiePlayer,type PidgieNpcOptions} from './pidgie-npc';
import {PIGEON_CLIP_BY_NAME} from './pigeon-clips';
import {PIDGIE_FOLLOW_DISTANCE} from './pidgie-state';
import {PIGEON_FLOCK_BATCH,type PigeonCheckpoint,type SummonedPigeon} from './pigeon-flock-state';
import {disposeActor} from './actor-lifecycle';
import type {NpcConstraint} from './npcs';
import {insideMeadow} from './world-bounds';

// Includes the animated wings: takeoff, landing and Hello need clearance too.
export const FLOCK_RADIUS=3.2;
const SPACING=FLOCK_RADIUS*2+.6;
type Bird={spec:SummonedPigeon;npc:PidgieNpc;helloIn:number;helloRemaining:number;helloCount:number;departureY?:number;departed?:boolean;applied?:PigeonCheckpoint};

/** Stable expanding rings add space as the flock grows, without a bird cap. */
export function pigeonSlot(index:number){
 let radius=PIDGIE_FOLLOW_DISTANCE;
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
 constructor(private templates:Record<'pidgie'|'snowball',Pick<GLTF,'scene'|'animations'>>,private options:PidgieNpcOptions,private onHello:(position:T.Vector3)=>void=()=>{}){this.group.name='Голубиная почта Ветерка';}

 private goal(player:PidgiePlayer,index:number,reserved:T.Vector3[]){
  for(let attempt=0;attempt<128;attempt++){
   const goal=player.position.clone().setY(0).add(pigeonSlot(index+attempt));
   if(insideMeadow(goal,1)&&this.options.safeGround(goal.x,goal.z)&&reserved.every(p=>p.distanceTo(goal)>=SPACING-.001)){reserved.push(goal);return goal;}
  }
 }

 private constraint(bird:Bird,world?:NpcConstraint):NpcConstraint{return (point,size,previous)=>{
  if(point.y<1){world?.(point,size,previous);if(!(this.options.walkGround??this.options.safeGround)(point.x,point.z)||!insideMeadow(point,size)){point.copy(previous);return;}}
  // Test the whole movement segment, including remote interpolation, so a fast
  // pursuit or a delayed snapshot cannot pass through another bird.
  for(const other of this.birds.values()){
   if(other===bird||!other.npc.actor.visible)continue;
   const at=other.npc.actor.position,travel=point.clone().sub(previous),length=travel.lengthSq();
   const u=length?T.MathUtils.clamp(at.clone().sub(previous).dot(travel)/length,0,1):0;
   const closest=previous.clone().addScaledVector(travel,u),minimum=FLOCK_RADIUS*2;
   if(closest.distanceToSquared(at)<minimum**2-1e-6&&!(previous.distanceToSquared(at)<minimum**2&&point.distanceToSquared(at)>previous.distanceToSquared(at)+1e-6)){point.copy(previous);return;}
  }
 };}

 update(dt:number,specs:readonly SummonedPigeon[],host:boolean,players:readonly PidgiePlayer[],people:readonly T.Vector3[],world?:NpcConstraint){
  const live=new Set(specs.map(s=>s.id));
  for(const [id,bird] of this.birds)if(!live.has(id)){disposeActor(bird.npc);this.birds.delete(id);}
  const slots=new Map<string,number>(),reserved:T.Vector3[]=[];
  for(const spec of specs){
   const index=slots.get(spec.playerId)??0;slots.set(spec.playerId,index+1);
   const player=players.find(p=>p.id===spec.playerId);let bird=this.birds.get(spec.id);
   if(!bird){
    const npc=new PidgieNpc(this.templates[spec.skin],{...this.options,kind:spec.skin,seed:spec.seed,summoned:true});
    bird={spec,npc,helloIn:1+(spec.seed%3000)/1000,helloRemaining:0,helloCount:0};
    this.birds.set(spec.id,bird);this.group.add(npc.actor);
   }
   if(spec.checkpoint&&bird.applied!==spec.checkpoint){
    if(!host||bird.npc.phase==='hidden'){
     const first=!bird.applied,c=spec.checkpoint;
     bird.npc.applyNetworkState(c.bird,first);bird.helloIn=c.helloIn;bird.helloRemaining=c.helloRemaining;
     bird.departureY=c.departureY;bird.departed=c.departed;
     if(!first&&c.helloCount>bird.helloCount&&c.helloRemaining>0)this.onHello(bird.npc.actor.position);
     bird.helloCount=c.helloCount;
    }
    bird.applied=spec.checkpoint;
   }
   const constrain=this.constraint(bird,world);
   if(spec.dismissedAt!==undefined){
    if(bird.departed){bird.npc.actor.visible=false;continue;}
    if(bird.departureY===undefined){
     if(!bird.npc.actor.visible){bird.departed=true;continue;}
     const direction=pigeonSlot(spec.order).normalize(),destination=bird.npc.actor.position.clone().addScaledVector(direction,140);
     bird.departureY=bird.npc.startDeparture(destination,Math.max(26,this.options.flightHeight?.(bird.npc.actor.position,destination)??26)+(spec.order%20)*5.2);this.options.onScare?.(bird.npc.actor.position);
    }
    bird.departed=bird.npc.updateDeparture(dt,bird.departureY,constrain)&&(!player||Math.hypot(bird.npc.actor.position.x-player.position.x,bird.npc.actor.position.z-player.position.z)>=80);
    if(bird.departed)bird.npc.actor.visible=false;continue;
   }
   if(!player)continue;
   const goal=this.goal(player,index,reserved);
   if(!host){
    const previous=bird.npc.actor.position.clone();bird.npc.updateRemote(dt,world);
    constrain(bird.npc.actor.position,1,previous);
    bird.helloIn=Math.max(0,bird.helloIn-dt);bird.helloRemaining=Math.max(0,bird.helloRemaining-dt);continue;
   }
   if(!goal)continue;
   if(bird.npc.phase==='hidden'){
    let origin:T.Vector3|undefined;
    for(let attempt=0;attempt<128;attempt++){
     const angle=(spec.seed/0x100000000)*Math.PI*2+attempt*2.4;
     const candidate=goal.clone().add(new T.Vector3(Math.sin(angle)*36,0,Math.cos(angle)*36));
     candidate.y=Math.min(240,Math.max(26,this.options.flightHeight?.(candidate,goal)??26)+((index+attempt)%20)*5.2);
     if(Array.from(this.birds.values()).every(other=>other===bird||!other.npc.actor.visible||other.npc.actor.position.distanceTo(candidate)>=FLOCK_RADIUS*2)){origin=candidate;break;}
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
   bird.npc.updateSummoned(dt,player,goal,people,constrain);
  }
 }

 /** Rotate bounded packets through every bird; packet size never caps the flock. */
 checkpoints():PigeonCheckpoint[]{
  const birds=Array.from(this.birds.values()),result:PigeonCheckpoint[]=[];
  for(let i=0;i<Math.min(PIGEON_FLOCK_BATCH,birds.length);i++){
   const bird=birds[(this.cursor+i)%birds.length];if(!bird.npc.actor.visible&&!bird.departed)continue;
   result.push({id:bird.spec.id,bird:bird.npc.networkState(),helloIn:bird.helloIn,helloRemaining:bird.helloRemaining,helloCount:bird.helloCount,...(bird.departureY!==undefined?{departureY:bird.departureY}:{}),...(bird.departed?{departed:true}:{})});
  }
  this.cursor=birds.length?(this.cursor+PIGEON_FLOCK_BATCH)%birds.length:0;return result;
 }
 clear(){for(const bird of this.birds.values())disposeActor(bird.npc);this.birds.clear();this.cursor=0;}
}
