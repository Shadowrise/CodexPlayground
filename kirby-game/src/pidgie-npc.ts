import * as T from 'three';
import {clonePigeon} from './pigeon-appearance';
import {wildPigeonName,type WildPigeonId} from './wild-pigeons';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {NpcConstraint} from './npcs';
import {constrainToMeadow,insideMeadow,worldLimit} from './world-bounds';
import {pigeonGaitRate} from './pigeon-locomotion';
import {PIGEON_CLIP_BY_NAME} from './pigeon-clips';
import {PIDGIE_CLIPS,PIDGIE_FOLLOW_DISTANCE,PIDGIE_FOLLOW_REACTION_SECONDS,PIDGIE_FOLLOW_MAX_SPEED,PIDGIE_PECK_REACH,beginPidgieFeeding,validPidgieState,type PidgieState,type PidgieClip,type PidgiePoint} from './pidgie-state';
import type {BreadOffering} from './bread-state';
import {pidgieFollowPath} from './pidgie-path';

export const PIDGIE_APPROACH_DISTANCE=10;
export const PIDGIE_REFUGE_RADIUS=8;
export const PIDGIE_FLIGHT_DISTANCE=60;
const FEAR_SECONDS=.9,STEP=.05,WALK_SPEED=.95;
const FOLLOW_BAND=.45,FOLLOW_START_BAND=.85,FOLLOW_RUN_SPEED=6.5;
const wrap=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
const smooth=(u:number)=>{const v=T.MathUtils.clamp(u,0,1);return v*v*(3-2*v);};
const xz=(p:T.Vector3):PidgiePoint=>[p.x,p.z];
const distance=(a:PidgiePoint,b:PidgiePoint)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const copyState=(s:PidgieState):PidgieState=>({...s,p:[...s.p],refuge:[...s.refuge],target:[...s.target],origin:[...s.origin],destination:[...s.destination],...(s.friend?{friend:structuredClone(s.friend)}:{})});

export type PidgiePlayer={id:string;position:T.Vector3;hasBread:boolean;isPigeon?:boolean;points?:number};
export type PidgieNpcOptions={
 kind?:WildPigeonId;
 safeGround:(x:number,z:number)=>boolean;
 /** Grounded body clearance; takeoff/landing still require safeGround. */
 walkGround?:(x:number,z:number)=>boolean;
 seed?:number;
 people?:readonly T.Vector3[];
 /** Absolute safe flight altitude for this route; the game knows its trees. */
 flightHeight?:(from:T.Vector3,to:T.Vector3)=>number;
 /** Fires once on the authoritative update, with the player that caused the scare. */
 onScare?:(person:T.Vector3)=>void;
 onInterest?:(person:T.Vector3)=>void;
};

/** A separate, elusive ambient bird: never enters the fourteen Kirby NPCs. */
export class PidgieNpc {
 readonly actor=new T.Group();
 readonly model:T.Object3D;
 readonly mixer:T.AnimationMixer;
 readonly actions=new Map<PidgieClip,T.AnimationAction>();
 private active?:T.AnimationAction;
 private data:PidgieState;
 private remote?:PidgieState;
 private options:PidgieNpcOptions;
 private followRoute:PidgiePoint[]=[];
 private followRoutePlayer?:PidgiePoint;
 private followRetry=0;
 get state(){return this.data.clip;}
 get phase(){return this.data.phase;}
 get fearCount(){return this.data.fearCount;}

 constructor(template:Pick<GLTF,'scene'|'animations'>,options:PidgieNpcOptions){
  this.options=options;this.model=clonePigeon(template.scene,options.kind==='snowball');
  this.actor.name=`Дикий ${wildPigeonName(options.kind??'pidgie')}`;this.actor.userData.elusivePidgie=true;this.actor.userData.wildPigeon=options.kind??'pidgie';this.actor.add(this.model);
  this.mixer=new T.AnimationMixer(this.model);
  for(const name of PIDGIE_CLIPS){
   const source=template.animations.find(clip=>clip.name===name);if(!source)throw new Error(`Пиджи: отсутствует анимация ${name}`);
   this.actions.set(name,this.mixer.clipAction(source.clone()));
  }
  const seed=options.seed===undefined?(Math.random()*0x100000000)>>>0:options.seed>>>0;
  this.data={phase:'hidden',p:[0,0,0],yaw:0,elapsed:0,refuge:[0,0],target:[0,0],origin:[0,0],destination:[0,0],walkTimer:0,pause:0,cooldown:0,height:26,flightDuration:0,turnStart:0,turnTarget:0,clip:'Idle',clipTime:0,seed,fearCount:0};
  this.actor.visible=false;this.animate('Idle',true);this.spawn(options.people??[]);
 }

 private random(){this.data.seed=(Math.imul(this.data.seed,1664525)+1013904223)>>>0;return this.data.seed/0x100000000;}
 private safe(point:PidgiePoint){return insideMeadow({x:point[0],z:point[1]},this.actor.scale.x)&&this.options.safeGround(point[0],point[1]);}
 private walkable(point:PidgiePoint){return insideMeadow({x:point[0],z:point[1]},this.actor.scale.x)&&(this.options.walkGround??this.options.safeGround)(point[0],point[1]);}
 private near(point:PidgiePoint,people:readonly T.Vector3[],radius:number){return people.some(person=>Number.isFinite(person.x)&&Number.isFinite(person.y)&&Number.isFinite(person.z)&&Math.hypot(point[0]-person.x,person.y,point[1]-person.z)<radius);}

 private refuge(people:readonly T.Vector3[],from?:PidgiePoint):PidgiePoint|undefined {
  const limit=worldLimit(this.actor.scale.x)-PIDGIE_REFUGE_RADIUS-3;
  const acceptable=(point:PidgiePoint)=>this.safe(point)&&!this.near(point,people,from?18:12)&&(!from||distance(point,from)>=PIDGIE_FLIGHT_DISTANCE);
  for(let attempt=0;attempt<144;attempt++){
   const point:PidgiePoint=[(this.random()*2-1)*limit,(this.random()*2-1)*limit];if(acceptable(point))return point;
  }
  // Sparse deterministic fallback still finds a safe open sector if random
  // trials happen to hit the pond, buildings or a dense group of players.
  for(let z=-limit;z<=limit;z+=24)for(let x=-limit;x<=limit;x+=24){const point:PidgiePoint=[x,z];if(acceptable(point))return point;}
 }

 private spawn(people:readonly T.Vector3[]){
  const point=this.refuge(people);
  if(!point){this.data.phase='hidden';this.data.walkTimer=3;this.actor.visible=false;return;}
  this.actor.visible=true;this.actor.position.set(point[0],0,point[1]);
  this.data.refuge=[...point];this.data.origin=[...point];this.data.destination=[...point];this.data.target=[...point];
  this.data.yaw=wrap(this.random()*Math.PI*2);this.actor.rotation.y=this.data.yaw;
  this.data.phase='wander';this.data.elapsed=0;this.data.pause=.35+this.random()*.8;this.data.walkTimer=0;
  this.animate('Idle');this.syncPosition();
 }

 private animate(name:PidgieClip,reset=false,time=0){
  if(this.data.clip===name&&this.active&&!reset)return;
  const next=this.actions.get(name)!;next.reset().setEffectiveWeight(1).setEffectiveTimeScale(name==='Fear'?1.15:1);
  const loop=PIGEON_CLIP_BY_NAME[name].loop;next.setLoop(loop?T.LoopRepeat:T.LoopOnce,loop?Infinity:1);next.clampWhenFinished=!loop;
  next.time=time;next.fadeIn(.13).play();if(this.active!==next)this.active?.fadeOut(.13);
  this.active=next;this.data.clip=name;this.data.clipTime=time;
 }
 private syncPosition(){this.data.p=this.actor.position.toArray() as [number,number,number];this.data.clipTime=this.active?.time??0;}
 private heading(target:PidgiePoint){return Math.atan2(target[0]-this.actor.position.x,target[1]-this.actor.position.z);}
 private setYaw(yaw:number){this.data.yaw=wrap(yaw);this.actor.rotation.set(0,this.data.yaw,0);}
 private verticalDuration(){return 1.1+this.data.height/20;}
 private duration(){return this.data.phase==='fear'?FEAR_SECONDS:this.data.phase==='takeoff'||this.data.phase==='landing'?this.verticalDuration():this.data.phase==='fly'?this.data.flightDuration:Infinity;}

 private flightPlan(destination:PidgiePoint){
  this.data.origin=xz(this.actor.position);this.data.destination=[...destination];
  const from=this.actor.position.clone(),to=new T.Vector3(destination[0],0,destination[1]);
  const altitude=this.options.flightHeight?.(from,to)??26;
  this.data.height=T.MathUtils.clamp(Number.isFinite(altitude)&&altitude>0?altitude:26,8,256);
  this.data.flightDuration=Math.max(3.5,distance(this.data.origin,destination)/18);
 }

 private scare(people:readonly T.Vector3[],players:readonly PidgiePlayer[]){
  if(this.data.cooldown>0)return;
  let nearest:T.Vector3|undefined,best=PIDGIE_APPROACH_DISTANCE;
  for(const person of people){const d=person.distanceTo(this.actor.position);if(Number.isFinite(d)&&d<best){nearest=person;best=d;}}
  if(!nearest)return;
  const player=players.find(player=>player.position===nearest);
  if(player&&player.id.length>0&&player.id.length<=64&&(player.hasBread||player.isPigeon)){
   this.startFollowing(player);return;
  }
  this.fleeFrom(nearest,people);
 }

 private startFollowing(player:PidgiePlayer){
  this.followRoute=[];this.followRoutePlayer=undefined;this.followRetry=0;
  this.data.phase=player.hasBread?'follow':'greet';this.data.followId=player.id;this.data.followSpeed=0;this.data.elapsed=0;
  this.data.pause=0;this.data.walkTimer=0;this.data.target=xz(this.actor.position);this.animate(player.hasBread?'Idle':'Hello',true);
  if(player.hasBread)this.options.onInterest?.(player.position);
 }

 private fleeFrom(person:T.Vector3,people:readonly T.Vector3[]){
  const destination=this.refuge(people,xz(this.actor.position));
  if(!destination){this.data.cooldown=.8;this.data.pause=.8;this.animate('Idle');return;}
  this.flightPlan(destination);this.data.phase='fear';this.data.elapsed=0;this.data.turnStart=this.data.yaw;
  this.data.turnTarget=this.heading(xz(person));this.data.fearCount=Math.min(0xffffffff,this.data.fearCount+1);
  delete this.data.followId;delete this.data.followSpeed;
  this.animate('Idle');
  this.options.onScare?.(person);
 }

 private chooseWalk(){
  for(let attempt=0;attempt<16;attempt++){
   const angle=this.random()*Math.PI*2,radius=1.4+this.random()*5.4;
   const target:PidgiePoint=[this.data.refuge[0]+Math.sin(angle)*radius,this.data.refuge[1]+Math.cos(angle)*radius];
   if(this.safe(target)){this.data.target=target;this.data.walkTimer=2+this.random()*7;this.animate('Walk');return;}
  }
  this.data.pause=1.5;this.data.walkTimer=0;this.animate('Idle');
 }

 private rest(){
  const peck=this.random()<.4;
  this.data.walkTimer=0;this.data.pause=peck?PIGEON_CLIP_BY_NAME.Peck.duration:.7+this.random()*1.6;
  this.animate(peck?'Peck':'Idle');
 }

 private wander(dt:number,people:readonly T.Vector3[],players:readonly PidgiePlayer[],constrain?:NpcConstraint){
  this.scare(people,players);if(this.data.phase!=='wander')return;
  if(this.data.pause>0){if(this.data.clip!=='Peck')this.animate('Idle');return;}
  if(this.data.walkTimer<=0)this.chooseWalk();
  if(this.data.clip!=='Walk')return;
  this.setYaw(this.data.yaw+wrap(this.heading(this.data.target)-this.data.yaw)*(1-Math.exp(-5*dt)));
  const previous=this.actor.position.clone(),point=previous.clone();
  point.x+=Math.sin(this.data.yaw)*WALK_SPEED*dt;point.z+=Math.cos(this.data.yaw)*WALK_SPEED*dt;
  constrain?.(point,this.actor.scale.x,previous);point.y=0;constrainToMeadow(point,this.actor.scale.x);
  const finite=Number.isFinite(point.x)&&Number.isFinite(point.z);
  const legal=finite&&Math.hypot(point.x-this.data.refuge[0],point.z-this.data.refuge[1])<=PIDGIE_REFUGE_RADIUS&&this.safe(xz(point));
  const moved=legal?point.distanceTo(previous):0;
  if(legal&&moved<=WALK_SPEED*dt+.05)this.actor.position.copy(point);
  else {this.data.walkTimer=0;this.data.pause=.4+this.random()*.6;this.animate('Idle');}
  if(this.data.clip==='Walk')this.active!.setEffectiveTimeScale(pigeonGaitRate('Walk',this.actor.position.distanceTo(previous),dt,this.actor.scale.x));
  if(distance(xz(this.actor.position),this.data.target)<.3||this.data.walkTimer<=0)this.rest();
 }

 private follow(dt:number,people:readonly T.Vector3[],players:readonly PidgiePlayer[],constrain?:NpcConstraint){
  this.followRetry=Math.max(0,this.followRetry-dt);
  const player=players.find(player=>player.id===this.data.followId);
  const greeting=this.data.phase==='greet';
  if(player&&!player.hasBread&&!player.isPigeon){this.fleeFrom(player.position,people);return;}
  if(player&&greeting===player.hasBread){this.startFollowing(player);return;}
  if(!player||!player.position.toArray().every(Number.isFinite)||(greeting&&player.position.distanceTo(this.actor.position)>PIDGIE_APPROACH_DISTANCE+2)){
   delete this.data.followId;delete this.data.followSpeed;this.data.phase='wander';
   this.data.refuge=xz(this.actor.position);this.data.target=[...this.data.refuge];this.data.pause=.6;this.data.walkTimer=0;this.animate('Idle');return;
  }
  const from=this.actor.position,dx=from.x-player.position.x,dz=from.z-player.position.z,d=Math.hypot(dx,dz),gap=d-PIDGIE_FOLLOW_DISTANCE;
  this.data.followSpeed=0;
  const facePlayer=()=>this.setYaw(this.data.yaw+wrap(this.heading(xz(player.position))-this.data.yaw)*Math.min(1,8*dt));
  const stand=()=>this.animate(greeting&&this.data.clip==='Hello'&&this.active!.time<PIGEON_CLIP_BY_NAME.Hello.duration-1e-8?'Hello':'Idle');
  if((greeting&&gap>=0)||Math.abs(gap)<=(this.data.elapsed>=PIDGIE_FOLLOW_REACTION_SECONDS?FOLLOW_BAND:FOLLOW_START_BAND)){
   this.followRoute=[];this.followRoutePlayer=undefined;this.followRetry=0;
   this.data.elapsed=0;
   this.data.target=xz(from);facePlayer();stand();return;
  }
  // A wider start band and a checkpointed reaction clock avoid tiny Run/Idle
  // bursts whenever the player takes a step or the network pose shifts.
  this.data.elapsed=Math.min(PIDGIE_FOLLOW_REACTION_SECONDS,this.data.elapsed+dt);
  if(this.data.elapsed<PIDGIE_FOLLOW_REACTION_SECONDS-1e-8){this.data.target=xz(from);facePlayer();stand();return;}
  const away=d>1e-6?new T.Vector3(dx/d,0,dz/d):new T.Vector3(Math.sin(this.data.yaw),0,Math.cos(this.data.yaw));
  const goal=player.position.clone().setY(0).addScaledVector(away,PIDGIE_FOLLOW_DISTANCE);
  const clear=(a:PidgiePoint,b:PidgiePoint)=>{
   let previous=new T.Vector3(a[0],0,a[1]);const count=Math.max(1,Math.ceil(distance(a,b)/.35));
   for(let i=1;i<=count;i++){
    const point=new T.Vector3(T.MathUtils.lerp(a[0],b[0],i/count),0,T.MathUtils.lerp(a[1],b[1],i/count));
    if(!this.walkable(xz(point)))return false;
    const constrained=point.clone();constrain?.(constrained,this.actor.scale.x,previous);
    if(!(Math.hypot(constrained.x-point.x,constrained.z-point.z)<=1e-5))return false;
    if(people.some(other=>other!==player.position&&point.distanceTo(other)<Math.min(3,previous.distanceTo(other))-1e-6))return false;
    previous=point;
   }
   return true;
  };
  if(this.followRoutePlayer&&distance(this.followRoutePlayer,xz(player.position))>3){this.followRoute=[];this.followRetry=0;}
  while(this.followRoute.length&&distance(xz(from),this.followRoute[0])<.2)this.followRoute.shift();
  if(this.followRoute.length&&!clear(xz(from),this.followRoute[0])){this.followRoute=[];this.followRetry=0;}
  let target=from.clone().lerp(goal,Math.min(1,3/from.distanceTo(goal)));
  if(!this.followRoute.length&&!clear(xz(from),xz(target))){
   if(this.followRetry===0){this.followRoute=pidgieFollowPath(xz(from),xz(player.position),clear);this.followRoutePlayer=xz(player.position);this.followRetry=.6;}
   if(!this.followRoute.length){this.data.target=xz(from);this.animate('Idle');return;}
  }
  if(this.followRoute.length)target.set(this.followRoute[0][0],0,this.followRoute[0][1]);
  const heading=this.heading(xz(target)),speed=Math.min(PIDGIE_FOLLOW_MAX_SPEED,Math.max(FOLLOW_RUN_SPEED,Math.abs(gap)*12));
  const step=from.clone().addScaledVector(target.clone().sub(from).normalize(),Math.min(speed*dt,from.distanceTo(target)));
  if(!clear(xz(from),xz(step))){this.followRoute=[];this.data.target=xz(from);this.animate('Idle');return;}
  this.data.target=xz(target);
  this.setYaw(this.data.yaw+T.MathUtils.clamp(wrap(heading-this.data.yaw),-8*dt,8*dt));
  if(Math.abs(wrap(heading-this.data.yaw))>.15){this.animate('Idle');return;}
  const moved=step.distanceTo(from);this.actor.position.copy(step);this.data.followSpeed=Math.min(PIDGIE_FOLLOW_MAX_SPEED,moved/dt);
  this.animate('Run');this.active!.setEffectiveTimeScale(pigeonGaitRate('Run',moved,dt,this.actor.scale.x));
 }

 private redirect(people:readonly T.Vector3[]){
  const destination=this.refuge(people,xz(this.actor.position));if(!destination)return false;
  const currentHeight=this.actor.position.y;this.flightPlan(destination);this.data.turnStart=this.data.yaw;this.data.turnTarget=this.heading(destination);
  if(this.data.height>currentHeight+.05){
   // Resume the same vertical curve at the current height: no teleport and no
   // second fear/coo when a player reaches the intended landing area.
   let lo=0,hi=1;for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(smooth(mid)<currentHeight/this.data.height)lo=mid;else hi=mid;}
   this.data.phase='takeoff';this.data.elapsed=(lo+hi)/2*this.verticalDuration();
  }else {this.data.height=currentHeight;this.data.phase='fly';this.data.elapsed=0;}
  this.animate('Fly');return true;
 }

 private tick(dt:number,people:readonly T.Vector3[],players:readonly PidgiePlayer[],constrain?:NpcConstraint){
  if(this.data.friend){this.feeding(dt,constrain);this.mixer.update(dt);this.syncPosition();return;}
  this.data.cooldown=Math.max(0,this.data.cooldown-dt);this.data.pause=Math.max(0,this.data.pause-dt);this.data.walkTimer=Math.max(0,this.data.walkTimer-dt);
  if(this.data.phase==='hidden'){if(this.data.walkTimer===0)this.spawn(people);return;}
  if(this.data.phase==='wander'){
   this.wander(dt,people,players,constrain);
   if(this.data.phase==='wander'){this.mixer.update(dt);this.syncPosition();return;}
  }
  if(this.data.phase==='follow'||this.data.phase==='greet'){this.follow(dt,people,players,constrain);this.mixer.update(dt);this.syncPosition();return;}
  this.data.elapsed=Math.min(this.duration(),this.data.elapsed+dt);
  if(this.data.phase==='fear'){
   this.setYaw(this.data.turnStart+wrap(this.data.turnTarget-this.data.turnStart)*smooth(this.data.elapsed/.25));
   if(this.data.elapsed>=.25)this.animate('Fear');
   if(this.data.elapsed>=FEAR_SECONDS-1e-9){this.data.phase='takeoff';this.data.elapsed=0;this.data.turnStart=this.data.yaw;this.data.turnTarget=this.heading(this.data.destination);this.animate('Jump',true);}
  }else if(this.data.phase==='takeoff'){
   const u=this.data.elapsed/this.verticalDuration();this.actor.position.set(this.data.origin[0],this.data.height*smooth(u),this.data.origin[1]);
   this.setYaw(this.data.turnStart+wrap(this.data.turnTarget-this.data.turnStart)*smooth(this.data.elapsed/.65));
   if(this.data.elapsed>=.18)this.animate('Fly');
   if(u>=1-1e-9){this.data.phase='fly';this.data.elapsed=0;this.animate('Fly');}
  }else if(this.data.phase==='fly'){
   const u=smooth(this.data.elapsed/this.data.flightDuration),a=this.data.origin,b=this.data.destination;
   this.actor.position.set(T.MathUtils.lerp(a[0],b[0],u),this.data.height,T.MathUtils.lerp(a[1],b[1],u));this.setYaw(Math.atan2(b[0]-a[0],b[1]-a[1]));
   if(this.data.elapsed>=this.data.flightDuration-1e-9){
    if(this.safe(b)&&!this.near(b,people,18)){this.data.phase='landing';this.data.elapsed=0;this.animate('Fly');}
    else if(this.data.walkTimer===0){this.data.walkTimer=.5;this.redirect(people);}
   }
  }else if(this.data.phase==='landing'){
   if(!this.safe(this.data.destination)||this.near(this.data.destination,people,PIDGIE_APPROACH_DISTANCE)){
    this.data.elapsed=Math.max(0,this.data.elapsed-dt);
    if(this.data.walkTimer===0){this.data.walkTimer=.5;this.redirect(people);}
    // If every alternative is temporarily blocked, hover instead of falling
    // into a player, pond or newly occupied piece of ground.
    this.mixer.update(dt);this.syncPosition();return;
   }
   const duration=this.verticalDuration(),u=this.data.elapsed/duration;
   this.actor.position.set(this.data.destination[0],this.data.height*(1-smooth(u)),this.data.destination[1]);
   if(duration-this.data.elapsed<.22){this.animate('Jump');this.active!.time=.70+(u-(1-.22/duration))/.22*duration*.35;}
   if(u>=1-1e-9){
    this.actor.position.y=0;this.data.refuge=[...this.data.destination];this.data.target=[...this.data.destination];
    this.data.phase='wander';this.data.elapsed=0;this.data.walkTimer=0;this.data.pause=.4;this.data.cooldown=.35;this.animate('Idle');
   }
  }
  this.mixer.update(dt);this.syncPosition();
 }

 /** The offering is permanent; later proximity and dropped items cannot scare this bird. */
 acceptBread(offering:BreadOffering){
  if((offering.target??'pidgie')!==(this.options.kind??'pidgie'))return false;
  const current=this.networkState(),next=beginPidgieFeeding(current,offering);
  if(next===current)return false;
  this.applyNetworkState(next,true);return true;
 }

 private feeding(dt:number,constrain?:NpcConstraint){
  const food=this.data.friend!.bread,target:PidgiePoint=[food[0],food[2]];
  this.actor.visible=true;this.setYaw(this.data.yaw+T.MathUtils.clamp(wrap(this.heading(target)-this.data.yaw),-8*dt,8*dt));
  if(this.data.phase==='joy'){
   this.animate('Joy');this.data.elapsed+=dt;
   if(this.data.elapsed>=PIGEON_CLIP_BY_NAME.Joy.duration-1e-8){this.data.phase='toBread';this.data.elapsed=0;this.animate('Run');}
   return;
  }
  if(this.data.phase==='toBread'){
   const from=this.actor.position.clone(),reach=PIDGIE_PECK_REACH*this.actor.scale.x,gap=Math.hypot(food[0]-from.x,food[2]-from.z)-reach;
   if(Math.abs(gap)<=.01){this.setYaw(this.heading(target));this.data.phase='feast';this.data.elapsed=0;this.animate('Peck',true);return;}
   const yaw=this.heading(target)+(gap<0?Math.PI:0),travel=Math.min(Math.abs(gap),4.2*dt);let moved=0;
   for(const offset of [0,.45,-.45,.9,-.9,1.35,-1.35]){
    const point=from.clone().add(new T.Vector3(Math.sin(yaw+offset),0,Math.cos(yaw+offset)).multiplyScalar(travel));
    constrain?.(point,this.actor.scale.x,from);point.y=food[1];
    if(!this.walkable(xz(point))||point.distanceTo(from)>travel+.001||Math.abs(Math.hypot(food[0]-point.x,food[2]-point.z)-reach)>=Math.abs(gap)-.00001)continue;
    moved=point.distanceTo(from);this.actor.position.copy(point);break;
   }
   this.data.target=target;this.animate('Run');this.active!.setEffectiveTimeScale(pigeonGaitRate('Run',moved,dt,this.actor.scale.x));return;
  }
  this.data.phase='feast';this.data.elapsed+=dt;
  const clip=this.data.clip==='Joy'?'Joy':'Peck';this.animate(clip);
  if(this.data.elapsed>=PIGEON_CLIP_BY_NAME[clip].duration-1e-8){this.data.elapsed=0;this.animate(clip==='Peck'?'Joy':'Peck',true);}
 }

 /** Only the solo game or current room host calls the decision-making update. */
 update(dt:number,people:readonly T.Vector3[],constrain?:NpcConstraint,players:readonly PidgiePlayer[]=[]){
  if(!Number.isFinite(dt)||dt<=0)return;
  if(this.remote){
   this.data=copyState(this.networkState());this.actor.position.fromArray(this.data.p);this.setYaw(this.data.yaw);this.remote=undefined;
  }
  let remaining=dt;
  while(remaining>1e-8){
   const until=this.duration()-this.data.elapsed;
   const step=Math.min(remaining,STEP,until>1e-8?until:STEP);this.tick(step,people,players,constrain);remaining-=step;
  }
 }

 networkState():PidgieState{
  if(this.remote)return {...copyState(this.remote),clipTime:this.active?.time??this.remote.clipTime};
  this.syncPosition();return copyState(this.data);
 }

 /** Invalid snapshots do not corrupt either animation or the host checkpoint. */
 applyNetworkState(snapshot:PidgieState,snap=false){
  if(!validPidgieState(snapshot))return false;
  // Friendship is permanent. An older wild/hidden checkpoint must not undo
  // acceptance of the bread while the bird is still running towards it.
  if(this.data.friend&&!snapshot.friend)return false;
  this.followRoute=[];this.followRoutePlayer=undefined;this.followRetry=0;
  const first=!this.remote,sameClip=this.data.clip===snapshot.clip;this.data=copyState(snapshot);this.remote=copyState(snapshot);
  this.actor.visible=snapshot.phase!=='hidden';
  if(snap||first){this.actor.position.fromArray(snapshot.p);this.setYaw(snapshot.yaw);}
  if(!sameClip||snap||first){this.mixer.stopAllAction();this.active=undefined;this.animate(snapshot.clip,true,snapshot.clipTime);this.active!.setEffectiveWeight(1);}
  else {const action=this.active!,duration=action.getClip().duration,delta=PIGEON_CLIP_BY_NAME[snapshot.clip].loop?wrap((snapshot.clipTime-action.time)/duration*Math.PI*2)*duration/(Math.PI*2):snapshot.clipTime-action.time;action.time+=delta*.2;}
  this.mixer.update(0);return true;
 }

 /** Remote presentation follows host checkpoints; it never starts another flee. */
 updateRemote(dt:number,constrain?:NpcConstraint){
  if(!this.remote||!Number.isFinite(dt)||dt<=0)return;
  if(this.remote.friend){
   const displayed=this.actor.position.clone();this.data=copyState(this.remote);this.remote=undefined;
   this.actor.position.fromArray(this.data.p);this.setYaw(this.data.yaw);this.update(dt,[],constrain);
   this.remote=copyState(this.data);this.actor.position.lerpVectors(displayed,new T.Vector3().fromArray(this.remote.p),1-Math.exp(-14*dt));return;
  }
  const checkpoint=this.remote;
  if(!['wander','hidden','follow','greet'].includes(checkpoint.phase))checkpoint.elapsed=Math.min(this.duration(),checkpoint.elapsed+dt);
  checkpoint.cooldown=Math.max(0,checkpoint.cooldown-dt);checkpoint.pause=Math.max(0,checkpoint.pause-dt);checkpoint.walkTimer=Math.max(0,checkpoint.walkTimer-dt);
  const point=new T.Vector3().fromArray(checkpoint.p);
  if(checkpoint.phase==='fear'){
   checkpoint.yaw=wrap(checkpoint.turnStart+wrap(checkpoint.turnTarget-checkpoint.turnStart)*smooth(checkpoint.elapsed/.25));
   if(checkpoint.elapsed>=.25&&checkpoint.clip!=='Fear'){checkpoint.clip='Fear';this.animate('Fear');}
  }
  else if(checkpoint.phase==='takeoff'){
   point.set(checkpoint.origin[0],checkpoint.height*smooth(checkpoint.elapsed/this.verticalDuration()),checkpoint.origin[1]);
   checkpoint.yaw=wrap(checkpoint.turnStart+wrap(checkpoint.turnTarget-checkpoint.turnStart)*smooth(checkpoint.elapsed/.65));
  }else if(checkpoint.phase==='fly'){
   const u=smooth(checkpoint.elapsed/checkpoint.flightDuration),a=checkpoint.origin,b=checkpoint.destination;
   point.set(T.MathUtils.lerp(a[0],b[0],u),checkpoint.height,T.MathUtils.lerp(a[1],b[1],u));checkpoint.yaw=Math.atan2(b[0]-a[0],b[1]-a[1]);
  }else if(checkpoint.phase==='landing')point.set(checkpoint.destination[0],checkpoint.height*(1-smooth(checkpoint.elapsed/this.verticalDuration())),checkpoint.destination[1]);
  else if((checkpoint.phase==='follow'||checkpoint.phase==='greet')&&checkpoint.clip==='Run'&&(checkpoint.followSpeed??0)>0){
   const target=new T.Vector3(checkpoint.target[0],0,checkpoint.target[1]),remaining=point.distanceTo(target);
   const proposed=point.clone().addScaledVector(target.sub(point).normalize(),Math.min(remaining,checkpoint.followSpeed!*Math.min(dt,.2)));
   const travel=point.distanceTo(proposed);constrain?.(proposed,this.actor.scale.x,point);proposed.y=0;
   if(this.walkable(xz(proposed))&&point.distanceTo(proposed)<=travel+1e-6)point.copy(proposed);
  }
  else if(checkpoint.phase==='wander'&&checkpoint.clip==='Walk'&&checkpoint.pause===0&&checkpoint.walkTimer>0){
   const direction=Math.atan2(checkpoint.target[0]-point.x,checkpoint.target[1]-point.z);checkpoint.yaw=wrap(checkpoint.yaw+wrap(direction-checkpoint.yaw)*(1-Math.exp(-5*dt)));
   const proposed=point.clone();proposed.x+=Math.sin(checkpoint.yaw)*WALK_SPEED*dt;proposed.z+=Math.cos(checkpoint.yaw)*WALK_SPEED*dt;
   if(this.safe(xz(proposed))&&distance(xz(proposed),checkpoint.refuge)<=PIDGIE_REFUGE_RADIUS)point.copy(proposed);
  }
  checkpoint.p=point.toArray() as [number,number,number];
  const previous=this.actor.position.clone(),blend=1-Math.exp(-14*dt);
  this.actor.position.lerp(point,blend);
  this.setYaw(this.actor.rotation.y+wrap(checkpoint.yaw-this.actor.rotation.y)*blend);
  if(this.data.clip==='Walk'||this.data.clip==='Run')this.active!.setEffectiveTimeScale(pigeonGaitRate(this.data.clip,this.actor.position.distanceTo(previous),dt,this.actor.scale.x));
  this.mixer.update(dt);
 }
}
