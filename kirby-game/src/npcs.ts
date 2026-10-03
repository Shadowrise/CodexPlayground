import {PushRoll,pushClip} from './push-motion';
import type { ScoreAction } from './score';
import { AnimationAction, AnimationClip, AnimationMixer, Group, LoopOnce, LoopRepeat, Object3D, PropertyBinding, Vector3 } from 'three';
import { cloneVariant, KIRBY_VARIANTS, remainingVariants, type KirbyVariant } from './variants';
import { Flight, flightClip, swimClip, flightCloud, updateFlightCloud } from './flight';
import { constrainToMeadow, insideMeadow, worldLimit, MEADOW_HALF_SIZE } from './world-bounds';
export { NPC_COLORS } from './variants';

const repertoire = ['Idle', 'Walk', 'Run', 'RotateLeft', 'RotateRight', 'Jump', 'Eat', 'Push'];
const loops = new Set(['Idle', 'Walk', 'Run', 'WalkBackward','Swim']);
export type NpcConstraint=(position:Vector3,size:number,previous:Vector3)=>void;

export class KirbyNpc {
  readonly actor = new Group();
  readonly flight = new Flight();
  readonly cloud = flightCloud();
  private flightTime=0;
  readonly mixer: AnimationMixer;
  readonly actions = new Map<string, AnimationAction>();
  readonly model: Object3D;
  state = 'Idle';
  yaw = 0;
  swimming=false;
  surfaceY=0;
  waterDestination?:Vector3;
  private swimYaw=0;
  private swimAvoid=0;
  setWaterDestination(target?:Vector3){this.waterDestination=target?.clone();if(target&&!this.swimming)this.start('Walk');}
  syncSwimming(){
    if(this.swimming&&this.state!=='Swim'){this.greeting=undefined;this.start('Swim');this.swimYaw=this.yaw;}
    else if(!this.swimming&&this.state==='Swim')this.start('Walk');
  }
  private active?: AnimationAction;
  private elapsed = 0;
  private duration = 1;
  private turnStart = 0;
  private turnAngle = Math.PI / 2;
  private avoiding = false;
  private deck: string[] = [];
  private seed: number;
  private next = new Vector3();
  readonly roll=new PushRoll();
  readonly animationRoot:Object3D;
  // Legacy snapshot slots stay neutral for saved rooms; pushes never damage anyone.
  get health(){return 3;}
  get isDown(){return false;}
  get canBoardBalloon(){return !this.swimming&&!this.waterDestination&&!this.roll.active && !this.greeting && !this.flight.active && ['Idle','Walk','Run','WalkBackward'].includes(this.state);}
  get fireflyIndex(){const match=/^Firefly(?:Ride|Approach):(\d+)$/.exec(this.state);return match?Number(match[1]):undefined;}
  get approachingFirefly(){return this.state.startsWith('FireflyApproach:');}
  beginFireflyApproach(index:number){this.start('Walk');this.state=`FireflyApproach:${index}`;this.hello=false;}
  get fireflyRideTime(){return this.elapsed;}
  beginFirefly(index:number){this.start('Idle');this.state=`FireflyRide:${index}`;this.hello=false;}
  poseFirefly(){for(const side of ['Left','Right']){const foot=this.actor.getObjectByName(`${side}_foot_pivot`),arm=this.actor.getObjectByName(`${side}_shoulder`);if(foot)foot.rotation.x=-.85;if(arm){arm.rotation.x=-.45;arm.rotation.z=(side==='Left'?-1:1)*.25;}}}
  beginBalloon(walking=false){this.start(walking?'Walk':'Idle');this.state=walking?'BalloonWalk':'Balloon';this.hello=false;}
  endBalloon(){this.actor.rotation.set(0,this.yaw,0);this.start('Walk');}
  eatBite = false;
  eatPull = false;
  private appetite = 0;
  private eatingFruit = false;
  private greeted = false;
  private greeting?: {elapsed:number;yaw:number;landed:boolean};
  hello = false;
  greet(player: Vector3) {
    if(this.greeted || this.isDown || !['Idle','Walk','Run','WalkBackward'].includes(this.state))return false;
    this.greeted=true;
    this.start('Jump');
    this.state='Hello';
    this.greeting={elapsed:0,yaw:Math.atan2(player.x-this.actor.position.x,player.z-this.actor.position.z),landed:false};
    return true;
  }
  fruitsEaten = 0;
  readonly achievements=new Set<ScoreAction>();
  private growth?: { from: number; to: number; elapsed: number };
  get savedSize() { return this.growth?.to ?? this.actor.scale.x; }
  grow() {
    this.fruitsEaten++;
    this.growth={from:this.actor.scale.x,to:(this.growth?.to ?? this.actor.scale.x)+.1,elapsed:0};
  }
  get canEat() { return !this.isDown && !this.greeting && this.appetite <= 0 && ['Walk', 'Run', 'Idle', 'WalkBackward'].includes(this.state); }
  requestEat() {
    if (!this.canEat) return false;
    this.start('Eat'); this.eatingFruit = true;
    this.appetite = 12 + this.random() * 10;
    return true;
  }

  constructor(template: Object3D, clips: AnimationClip[], readonly index: number, readonly variant: KirbyVariant) {
    this.seed = 8191 + index * 173;
    this.model = cloneVariant(template, variant, true);
    this.appetite = 4 + index * .6;
    this.actor.name = `NPC ${index + 1} · ${variant[0]}`;
    this.actor.add(this.model);
    this.actor.add(this.cloud);
    this.mixer = new AnimationMixer(this.model);
    const rootTrack = clips.find(c => c.name === 'RotateLeft')!.tracks.find(track => {
      const binding = PropertyBinding.parseTrackName(track.name);
      const target = PropertyBinding.findNode(this.model, binding.nodeName);
      return binding.propertyName === 'quaternion' && target instanceof Object3D && target.parent === this.model;
    })!;
    this.animationRoot=PropertyBinding.findNode(this.model,PropertyBinding.parseTrackName(rootTrack.name).nodeName) as Object3D;
    for (const source of clips) {
      if(source.name==='Attack')continue;
      const clip = source.clone();
      // Transfer only turning yaw to actor; Death retains its sideways fall.
      if (clip.name.startsWith('Rotate')) clip.tracks = clip.tracks.filter(t => t.name !== rootTrack.name);
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.actions.set('Push',this.mixer.clipAction(pushClip(clips.find(c=>c.name==='Idle')!,this.model)));
    this.actions.set('Fly',this.mixer.clipAction(flightClip(clips.find(c=>c.name==='Idle')!,this.model)));
    this.actions.set('Swim',this.mixer.clipAction(swimClip(clips.find(c=>c.name==='Idle')!,this.model)));
    for (const name of [...repertoire, 'Death']) if (!this.actions.has(name)) throw new Error(`NPC: отсутствует ${name}`);
    // Separate starting sectors leave space between neighbours and around the player.
    const cells = [0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15];
    const cell = cells[index % cells.length], spacing = MEADOW_HALF_SIZE * .35;
    this.actor.position.set(
      (cell % 4 - 1.5 + (this.random() - .5) * .35) * spacing,
      0,
      (Math.floor(cell / 4) - 1.5 + (this.random() - .5) * .35) * spacing,
    );
    this.yaw = this.random() * Math.PI * 2;
    this.actor.rotation.y = this.yaw;
    this.start(index % 3 === 0 ? 'Walk' : index % 3 === 1 ? 'Idle' : 'Run');
    this.duration += index * .13;
  }

  // Reuse the retired damage slots for greeting recovery; row length stays 15.
  networkLife(){return [3,Number(this.greeted),this.greeting?.elapsed??-1,this.elapsed,this.duration,this.seed,this.turnStart,...this.flight.networkState()];}
  networkApplyLife(v:number[]){[this.elapsed,this.duration,this.seed,this.turnStart]=v.slice(3,7);this.flight.networkApply(v.slice(7));this.greeted=!!v[1];if(this.greeted&&v[2]>=0)this.greeting={elapsed:v[2],yaw:this.yaw,landed:v[2]>=this.actions.get('Jump')!.getClip().duration};else this.greeting=undefined;}
  networkAnimate(state:string,dt:number,moving=true){
    this.roll.clearPose();
    const walking=['Walk','Run','WalkBackward','BalloonWalk'].includes(state)||state.startsWith('FireflyApproach:');
    const clip=walking?(moving?(state==='Run'?'Run':'Walk'):'Idle'):this.actions.has(state)?state:'Idle';
    if(this.active!==this.actions.get(clip))this.start(clip);
    this.state=state;this.mixer.update(dt);
  }
  private random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }

  takeHit(){return this.takePush(Math.sin(this.yaw),Math.cos(this.yaw));}
  takePush(dx:number,dz:number):boolean {
    if(this.roll.active||this.state==='Balloon'||this.state==='BalloonWalk')return false;
    this.roll.clearPose();this.flight.reset();this.cloud.visible=false;this.greeting=undefined;
    this.start('Idle');this.state='Roll';this.roll.start(dx,dz,0);return true;
  }

  private start(name: string) {
    this.eatingFruit = false;
    const next = this.actions.get(name)!;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(name === 'Walk' ? 1.5 : name === 'Run' ? 2 : 1);
    next.setLoop(loops.has(name) ? LoopRepeat : LoopOnce, loops.has(name) ? Infinity : 1);
    next.clampWhenFinished = !loops.has(name);
    next.fadeIn(.16).play();
    if (this.active !== next) this.active?.fadeOut(.16);
    this.active = next;
    this.state = name;
    this.elapsed = 0;
    this.duration = loops.has(name) ? 1.5 + this.random() * 2 : next.getClip().duration;
    if (name === 'Death') this.duration += .65;
    this.turnStart = this.yaw;
    this.turnAngle=Math.PI/2;this.avoiding=false;
  }

  private pathClear(yaw:number,distance:number,neighbors:readonly Vector3[],constrain?:NpcConstraint){
    const from=this.actor.position,size=this.actor.scale.x;
    this.next.copy(from);this.next.x+=Math.sin(yaw)*distance;this.next.z+=Math.cos(yaw)*distance;
    if(!insideMeadow(this.next,size))return false;
    const x=this.next.x,z=this.next.z;
    constrain?.(this.next,size,from);
    if(Math.hypot(this.next.x-x,this.next.z-z)>.001)return false;
    return !neighbors.some(p=>p!==from&&Math.hypot(p.x-this.next.x,p.z-this.next.z)<2.3&&this.next.distanceToSquared(p)<from.distanceToSquared(p));
  }

  private clearTurn(neighbors:readonly Vector3[],constrain?:NpcConstraint){
    const sign=this.random()<.5?1:-1,distance=Math.min(6,1.2+this.actor.scale.x);
    let angle=Math.PI;
    for(const candidate of [Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2,Math.PI*2/3,-Math.PI*2/3,Math.PI]){
      if(this.pathClear(this.yaw+candidate*sign,distance,neighbors,constrain)){angle=candidate*sign;break;}
    }
    return angle;
  }
  private avoid(neighbors:readonly Vector3[],constrain?:NpcConstraint){
    const angle=this.clearTurn(neighbors,constrain);
    this.start(angle>0?'RotateLeft':'RotateRight');this.turnAngle=Math.abs(angle);this.duration=.25+.4*Math.abs(angle)/Math.PI;this.avoiding=true;
  }

  private choose() {
    // At the edge, turn inward instead of walking out of the meadow.
    const p = this.actor.position;
    const outward = p.x * Math.sin(this.yaw) + p.z * Math.cos(this.yaw);
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) > worldLimit(this.actor.scale.x) - 4 && outward > 0) {
      this.start(this.random() < .5 ? 'RotateLeft' : 'RotateRight');
      return;
    }
    if (!this.deck.length) {
      this.deck = [...repertoire];
      for (let i = this.deck.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
      }
    }
    const next=this.deck.pop()!;
    if(next==='Jump' && this.random()<.55) {
      this.start('Fly');this.flight.press();this.flightTime=0;
      this.actions.get('Fly')!.setLoop(LoopRepeat,Infinity);
    } else this.start(next);
  }

  update(dt: number, neighbors: readonly Vector3[], constrain?:NpcConstraint) {
    this.roll.clearPose();
    if(this.growth) {
      const g=this.growth;g.elapsed+=dt;
      const t=Math.min(1,g.elapsed/.45);
      this.actor.scale.setScalar(g.from+(g.to-g.from)*t*t*(3-2*t));
      if(t===1)this.growth=undefined;
    }
    this.hello=false;
    if(this.roll.active){this.mixer.update(dt);if(this.roll.update(dt,this.actor,0))this.roll.applyPose(this.animationRoot,this.yaw);else this.start('Walk');constrainToMeadow(this.actor.position,this.actor.scale.x);return;}
    if(this.fireflyIndex!==undefined){this.elapsed+=dt;this.mixer.update(dt);if(!this.approachingFirefly)this.poseFirefly();return;}
    constrainToMeadow(this.actor.position, this.actor.scale.x);
    this.eatBite = false;
    this.eatPull = false;
    this.appetite = Math.max(0, this.appetite - dt);
    this.model.position.y *= Math.exp(-14 * dt);
    if(this.flight.active) {
      const before=this.flightTime;this.flightTime+=dt;
      if(before<.5 && this.flightTime>=.5)this.flight.press();
      if(before<1.3 && this.flightTime>=1.3)this.flight.press();
      this.flight.update(dt);this.actor.position.y=this.surfaceY+this.flight.height*this.actor.scale.x;
      this.actor.position.x+=Math.sin(this.yaw)*1.5*this.actor.scale.x*dt;
      this.actor.position.z+=Math.cos(this.yaw)*1.5*this.actor.scale.x*dt;
      constrainToMeadow(this.actor.position,this.actor.scale.x);
      updateFlightCloud(this.cloud,this.flight);this.mixer.update(dt);
      if(!this.flight.active){this.cloud.visible=false;this.start('Walk');}
      return;
    }
    if(this.swimming){
      this.syncSwimming();this.elapsed+=dt;this.swimAvoid=Math.max(0,this.swimAvoid-dt);
      const target=this.waterDestination,p=this.actor.position;
      if(target&&this.swimAvoid===0)this.swimYaw=Math.atan2(target.x-p.x,target.z-p.z);
      else if(!target&&this.elapsed>=this.duration){this.swimYaw=this.yaw+(this.random()-.5)*1.8;this.elapsed=0;this.duration=2+this.random()*3;}
      this.yaw+=Math.atan2(Math.sin(this.swimYaw-this.yaw),Math.cos(this.swimYaw-this.yaw))*(1-Math.exp(-5*dt));this.actor.rotation.y=this.yaw;
      if(!target||Math.hypot(target.x-p.x,target.z-p.z)>.8){
        if(!this.pathClear(this.yaw,Math.min(5,.7+this.actor.scale.x),neighbors,constrain)){this.swimYaw=this.yaw+this.clearTurn(neighbors,constrain);this.swimAvoid=.8;}
        else if(this.pathClear(this.yaw,.95*this.actor.scale.x*dt,neighbors,constrain))p.copy(this.next);
      }
      this.mixer.update(dt);return;
    }
    if(this.greeting) {
      const greeting=this.greeting,previous=greeting.elapsed;
      greeting.elapsed+=dt;
      this.yaw+=Math.atan2(Math.sin(greeting.yaw-this.yaw),Math.cos(greeting.yaw-this.yaw))*(1-Math.exp(-12*dt));
      this.actor.rotation.y=this.yaw;
      this.hello=previous<.35 && greeting.elapsed>=.35;
      if(!greeting.landed && greeting.elapsed>=this.actions.get('Jump')!.getClip().duration){this.start('Idle');this.state='Hello';greeting.landed=true;}
      this.mixer.update(dt);
      const arm=this.model.getObjectByName('Right_shoulder') ?? this.model.getObjectByName('Right shoulder');
      const envelope=Math.min(1,greeting.elapsed/.25)*Math.min(1,Math.max(0,(2.7-greeting.elapsed)/.3));
      if(arm)arm.rotateZ((1.05+.3*Math.sin(greeting.elapsed*17))*envelope);
      if(greeting.elapsed>=2.7){this.greeting=undefined;this.start('Idle');}
      return;
    }
    if (this.elapsed >= this.duration - 1e-6) {if(this.avoiding||this.waterDestination)this.start('Walk');else this.choose();}
    if(this.waterDestination&&!this.avoiding&&this.state==='Walk'){
      const target=this.waterDestination,p=this.actor.position,heading=Math.atan2(target.x-p.x,target.z-p.z);
      this.yaw+=Math.atan2(Math.sin(heading-this.yaw),Math.cos(heading-this.yaw))*(1-Math.exp(-6*dt));this.actor.rotation.y=this.yaw;
    }
    const previousElapsed = this.elapsed;
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    this.eatBite = this.eatingFruit && this.state === 'Eat' && previousElapsed < .95 && this.elapsed >= .95;
    this.eatPull = this.eatingFruit && this.state === 'Eat' && previousElapsed < .18 && this.elapsed >= .18;
    const turning = this.state.startsWith('Rotate');
    if (turning) {
      const u = Math.min(1, this.elapsed / this.duration);
      this.yaw = this.turnStart + (this.state === 'RotateLeft' ? 1 : -1) * this.turnAngle * u * u * (3 - 2 * u);
      this.actor.rotation.y = this.yaw;
    }
    const speed = (this.state === 'Walk' ? 1.725 : this.state === 'Run' ? 5.2 : 0) * this.actor.scale.x;
    if (speed) {
      if(!this.pathClear(this.yaw,Math.max(speed*dt,Math.min(6,.6+this.actor.scale.x)),neighbors,constrain))this.avoid(neighbors,constrain);
      else if(this.pathClear(this.yaw,speed*dt,neighbors,constrain))this.actor.position.copy(this.next);
    }
    this.mixer.update(dt);
  }


}

export function createNpcs(template: Object3D, clips: AnimationClip[], selected: KirbyVariant = KIRBY_VARIANTS[0]) {
  return remainingVariants(selected).map((variant, index) => new KirbyNpc(template, clips, index, variant));
}
