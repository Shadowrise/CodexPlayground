import * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {BOSS_ARENA} from './boss-arena-site';
import {ACTOR_DISTANCE} from './visibility';
import {centipedeSegments,centipedeRoot,centipedeWheel,centipedeGatherDistance,centipedeRestDistance,centipedePhase,CENTIPEDE_STEP,CENTIPEDE_BALLS,CENTIPEDE_REST_WALK_MS,type CentipedeEvent,type Point} from './centipede-event';
import {CENTIPEDE_CLIPS} from './centipede-clips';
import {CentipedeCollision} from './centipede-collision';

export type RoamAnimation='Walk'|'Run'|'Idle';
const SCALE=1.25,STEP=1.35,RAMP=.85,FADE=.35;
export const ROAM_STAGES:readonly {animation:RoamAnimation;duration:number;speed:number}[]=[
 {animation:'Walk',duration:20,speed:2.5},{animation:'Idle',duration:6,speed:0},
 {animation:'Run',duration:12,speed:5.4},{animation:'Idle',duration:5,speed:0},
 {animation:'Walk',duration:26,speed:2.5},{animation:'Idle',duration:7,speed:0},
 {animation:'Run',duration:9,speed:5.4},{animation:'Idle',duration:6,speed:0},
];
const period=ROAM_STAGES.reduce((sum,s)=>sum+s.duration,0);
const cycleDistance=ROAM_STAGES.reduce((sum,s)=>sum+s.speed*(s.duration-RAMP),0);
const smoothIntegral=(u:number)=>u*u*u-.5*u*u*u*u;
function stageDistance(t:number,duration:number,speed:number){
 if(t<RAMP)return speed*RAMP*smoothIntegral(t/RAMP);
 if(t>duration-RAMP)return speed*(duration-RAMP)-speed*RAMP*smoothIntegral((duration-t)/RAMP);
 return speed*(t-RAMP*.5);
}
/** Absolute clock makes this decorative motion identical on every client. */
export function centipedeRoam(seconds:number){
 const t=Math.max(0,seconds),cycles=Math.floor(t/period);let elapsed=t-cycles*period,distance=cycles*cycleDistance,index=0;
 for(;index<ROAM_STAGES.length-1;index++){
  const stage=ROAM_STAGES[index];if(elapsed<stage.duration)break;
  elapsed-=stage.duration;distance+=stage.speed*(stage.duration-RAMP);
 }
 const stage=ROAM_STAGES[index];distance+=stageDistance(elapsed,stage.duration,stage.speed);
 const speed=stage.speed*T.MathUtils.smoothstep(elapsed,0,RAMP)*(1-T.MathUtils.smoothstep(elapsed,stage.duration-RAMP,stage.duration));
 return {animation:stage.animation,previous:ROAM_STAGES[(index+ROAM_STAGES.length-1)%ROAM_STAGES.length].animation,elapsed,distance,speed,blend:T.MathUtils.smoothstep(elapsed,0,FADE)};
}
const route=new T.CatmullRomCurve3([
 new T.Vector3(0,0,21),new T.Vector3(17,0,12),new T.Vector3(20,0,-8),
 new T.Vector3(5,0,-21),new T.Vector3(-14,0,-16),new T.Vector3(-20,0,1),new T.Vector3(-13,0,18),
].map(p=>p.multiplyScalar(1.4)),true,'centripetal');
route.arcLengthDivisions=1024;route.updateArcLengths();const routeLength=route.getLength();
export function centipedeRoute(distance:number,target:T.Vector3){return route.getPointAt(T.MathUtils.euclideanModulo(distance,routeLength)/routeLength,target);}

const EVENT_ANIMATION={invite:'Idle',warning:'ChargeAnticipation',charge:'Charge',balls:'Sneeze',exhausted:'Exhausted',tickle:'TailTickle',gather:'Walk',coil:'CoilArena',stomp:'Stomp',lower:'LowerBack',back:'BackVulnerable',bell:'BellHit',rise:'Rise',curl:'CurlWheel',wheelWarning:'WheelDizzy',wheelRoll:'WheelRoll',dizzy:'WheelDizzy',ballShot:'WheelDizzy',wheelHit:'WheelHit',uncurl:'Uncurl',celebrate:'Celebrate',rest:'Idle'} as const;
const loopClips=new Set(CENTIPEDE_CLIPS.filter(c=>c.loop).map(c=>c.name));
export class ArenaCentipede{
 readonly group=new T.Group();
 readonly collision=new CentipedeCollision();
 private readonly mixer:T.AnimationMixer;
 private readonly actions:Record<string,T.AnimationAction>;
 private readonly segments:T.Object3D[];
 private readonly followers:T.Group[];
 private readonly shadow:T.InstancedMesh;
 private readonly form=new T.Group();private readonly motion:T.Object3D;
 private readonly formStart=new T.Vector3();private readonly formTurn=new T.Quaternion();private followerStart:{p:T.Vector3;q:T.Quaternion}[]=[];
 private readonly position=new T.Vector3();private readonly ahead=new T.Vector3();private readonly behind=new T.Vector3();
 private readonly turn=new T.Quaternion();private readonly matrix=new T.Matrix4();private readonly scaleMatrix=new T.Matrix4();
 private readonly up=new T.Vector3(0,1,0);
 private lastStage?:string;private lastClip?:string;private blendClip?:string;private blendTime=0;private blendStart=-Infinity;
 constructor(gltf:GLTF){
  this.group.name='Топотушка — прогулка по арене';this.group.position.set(BOSS_ARENA.x,0,BOSS_ARENA.z);this.group.scale.setScalar(SCALE);
  const model=gltf.scene;this.group.add(this.form);this.form.add(model);this.motion=model.getObjectByName('Motion')!;model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=false;o.receiveShadow=true;}});
  this.mixer=new T.AnimationMixer(model);
  this.actions=Object.fromEntries(CENTIPEDE_CLIPS.map(({name})=>{
   const clip=T.AnimationClip.findByName(gltf.animations,name);if(!clip)throw Error(`Missing centipede clip: ${name}`);
   return [name,this.mixer.clipAction(clip).setLoop(T.LoopRepeat,Infinity).setEffectiveWeight(0).play()];
  })) as Record<string,T.AnimationAction>;
  this.segments=Array.from({length:12},(_,i)=>{const segment=model.getObjectByName(`Segment_${i}`);if(!segment)throw Error(`Missing centipede segment ${i}`);return segment;});
  this.followers=this.segments.map((segment,i)=>{const follower=new T.Group();follower.name=`Arena path segment ${i}`;segment.parent!.add(follower);follower.add(segment);return follower;});
  this.shadow=new T.InstancedMesh(new T.SphereGeometry(1,10,6),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}),12);
  this.shadow.name='Topotushka simple body shadows';this.shadow.castShadow=true;this.shadow.instanceMatrix.setUsage(T.DynamicDrawUsage);
  this.shadow.boundingSphere=new T.Sphere(new T.Vector3(),BOSS_ARENA.playRadius/SCALE);this.group.add(this.shadow);
  this.update(0);
 }
 startTrail(seconds:number):Point[]{
  const {distance}=centipedeRoam(seconds);return Array.from({length:12},(_,i)=>{const p=centipedeRoute(distance-(11-i)*CENTIPEDE_STEP,new T.Vector3());return [p.x+BOSS_ARENA.x,p.z+BOSS_ARENA.z] as Point;});
 }
 update(seconds:number,camera?:T.Vector3,event?:CentipedeEvent,now=0){
  this.group.visible=!camera||camera.distanceToSquared(this.group.position)<(ACTOR_DISTANCE+BOSS_ARENA.playRadius)**2;
  if(!this.group.visible)return;
  const state=centipedeRoam(seconds);
  const goingToRest=event?.stage==='rest'&&now-event.stageAt<CENTIPEDE_REST_WALK_MS;
  const eventClip=event?(goingToRest?'Walk':EVENT_ANIMATION[event.stage]):undefined;
  const stage=event?`${event.startedAt}:${event.stageAt}:${event.stage}:${eventClip}`:undefined;
  if(stage!==this.lastStage){this.blendClip=this.lastClip??state.animation;this.blendTime=this.actions[this.blendClip].time;this.blendStart=now;this.lastStage=stage;this.lastClip=eventClip;this.formStart.copy(this.form.position);this.formTurn.copy(this.form.quaternion);this.followerStart=this.followers.map(f=>({p:f.position.clone(),q:f.quaternion.clone()}));}
  const fade=T.MathUtils.smoothstep((now-this.blendStart)/1000,0,.18);
  for(const name of Object.keys(this.actions)){
   const action=this.actions[name];let weight=0;
   if(eventClip){weight=Number(name===eventClip)*fade;}else {if(name===state.animation)weight+=state.blend*fade;if(name===state.previous)weight+=(1-state.blend)*fade;}if(name===this.blendClip)weight+=1-fade;
   action.setEffectiveWeight(weight);
   if(fade<1&&name===this.blendClip&&name!==eventClip){const elapsed=this.blendTime+(now-this.blendStart)/1000,duration=action.getClip().duration;action.time=loopClips.has(name as any)?elapsed%duration:Math.min(elapsed,duration-.00001);continue;}
   if(event){let elapsed=Math.max(0,(now-event.stageAt)/1000);if(name==='Stomp')elapsed*=.6;if(name==='Walk'&&event.stage==='gather')elapsed=centipedeGatherDistance(event,now)/3.5*action.getClip().duration;if(name==='Walk'&&goingToRest)elapsed=centipedeRestDistance(event,now)/3.5*action.getClip().duration;if(name==='WheelRoll'&&event.stage==='wheelRoll')elapsed=centipedeWheel(event,now).distance/(2*Math.PI*5)*action.getClip().duration;
    action.time=name==='Sneeze'?(elapsed<CENTIPEDE_BALLS.waves*CENTIPEDE_BALLS.interval/1000?elapsed%(CENTIPEDE_BALLS.interval/1000):action.getClip().duration-.00001):!loopClips.has(name as any)?Math.min(elapsed,action.getClip().duration-.00001):elapsed%action.getClip().duration;continue;}
   action.time=name==='Idle'?seconds%action.getClip().duration:(state.distance/(name==='Walk'?3.5:4.5)*action.getClip().duration)%action.getClip().duration;
  }
  this.mixer.update(0);
  const whole=!!event&&event.stage!=='rest'&&(centipedePhase(event)>1&&event.stage!=='gather'||event.stage==='celebrate');
  const root=whole?centipedeRoot(event!,now):{x:BOSS_ARENA.x,z:BOSS_ARENA.z,yaw:0},formFade=T.MathUtils.smoothstep((now-this.blendStart)/1000,0,.45);
  this.form.position.set((root.x-BOSS_ARENA.x)/SCALE,0,(root.z-BOSS_ARENA.z)/SCALE).lerp(this.formStart,1-formFade);
  this.form.quaternion.copy(this.turn.setFromAxisAngle(this.up,root.yaw)).slerp(this.formTurn,1-formFade);
  // Route poses already contain the outgoing model's world location. Reset its
  // parent atomically so root blending cannot apply that offset a second time.
  if(event&&!whole){this.form.position.set(0,0,0);this.form.quaternion.identity();}
  this.form.updateMatrix();this.motion.updateMatrix();
  const eventSegments=event&&!whole?centipedeSegments(event,now):undefined;
  for(let i=0;i<this.segments.length;i++){
   const segment=this.segments[i],distance=state.distance-i*STEP*SCALE;
   const pose=eventSegments?.[i];
   if(pose)this.position.set(pose.x-BOSS_ARENA.x,0,pose.z-BOSS_ARENA.z);
   else {centipedeRoute(distance,this.position);centipedeRoute(distance+.12,this.ahead);centipedeRoute(distance-.12,this.behind);}
   let yaw=pose?.yaw??Math.atan2(this.ahead.x-this.behind.x,this.ahead.z-this.behind.z);
   // Route transforms live on separate parents. Never overwrite mixer-owned
   // properties: unchanged animation keys may otherwise retain last frame's route.
   const follower=this.followers[i],restZ=segment.position.z;
   if(whole){follower.position.set(0,0,0);follower.quaternion.identity();}
   else {follower.position.set(this.position.x/SCALE-Math.sin(yaw)*restZ,0,this.position.z/SCALE-Math.cos(yaw)*restZ);follower.quaternion.copy(this.turn.setFromAxisAngle(this.up,yaw));}
   if(whole||!event){const start=this.followerStart[i];if(start){follower.position.lerp(start.p,1-formFade);follower.quaternion.slerp(start.q,1-formFade);}}
   follower.updateMatrix();segment.updateMatrix();this.matrix.multiplyMatrices(this.form.matrix,this.motion.matrix).multiply(follower.matrix).multiply(segment.matrix);
   this.scaleMatrix.makeScale(i===0?1.13:.86*(1-i/48),i===0?1:.77*(1-i/48),i===0?1.05:.8);
   this.matrix.multiply(this.scaleMatrix);this.shadow.setMatrixAt(i,this.matrix);
   const m=this.matrix.elements,b=this.collision.bodies[i];
   b.x=BOSS_ARENA.x+m[12]*SCALE;b.y=m[13]*SCALE;b.z=BOSS_ARENA.z+m[14]*SCALE;
   b.rx=Math.hypot(m[0],m[4],m[8])*SCALE;b.ry=Math.hypot(m[1],m[5],m[9])*SCALE;b.rz=Math.hypot(m[2],m[6],m[10])*SCALE;
  }
  this.shadow.instanceMatrix.needsUpdate=true;
 }
}
