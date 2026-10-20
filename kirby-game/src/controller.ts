import type {StarfallState} from './starfall';
import {PushRoll,applyPushArms,pushClip,PUSH_HIT,PUSH_DURATION} from './push-motion';
import {PUSH_COOLDOWN_MS} from './push-target';
import type { ScoreAction } from './score';
import { EmotePose, type PlayerEmote } from './emotes';
import { AnimationAction, AnimationClip, AnimationMixer, Group, LoopOnce, LoopRepeat, Object3D, PropertyBinding, Quaternion, Vector3 } from 'three';
import { constrainToMeadow } from './world-bounds';
import { MAX_BODY_SIZE, MIN_BODY_SIZE } from './body-size';
import { FruitSpeedBoost } from './fruit-speed';
import { Flight, JUMP_SECONDS, flightClip, swimClip, flightCloud, updateFlightCloud } from './flight';
import {PIGEON_CLIP_BY_NAME, type PigeonClipName} from './pigeon-clips';
import {META_KNIGHT_CLIP_BY_NAME, type MetaKnightClipName} from './meta-knight-clips';
import {isPigeonGait,pigeonGaitRate,type PigeonGait} from './pigeon-locomotion';
import {MetaKnightPlayerDash,PLAYER_KNIGHT_DASH} from './meta-knight-player-dash';
import {MetaKnightBattleMotion} from './meta-knight-battle-motion';
import {MetaKnightDashSparks} from './meta-knight-dash-sparks';
import {MetaKnightBladeGlow} from './meta-knight-blade-glow';
import {DuelDazedPose} from './duel-dazed-pose';
import {PigeonFlightWings} from './pigeon-flight-wings';
import {FruitEatingPose} from './fruit-eating';
import {TURN_RATE} from './movement-input';

export type Input = { forward: boolean; backward?: boolean; sprint?: boolean; left: boolean; right: boolean; jump?: boolean; jumpPressed?:boolean; dashHeld?:boolean; attack?: boolean; attackPressed?:boolean; eat?: boolean; steer?: number; moveYaw?:number };

export class CharacterController {
  readonly actor = new Group();
  readonly mixer: AnimationMixer;
  readonly actions = new Map<string, AnimationAction>();
  readonly isPigeon: boolean;
  readonly isMetaKnight: boolean;
  /** Native rigs supply their own poses instead of the original Kirby overlays. */
  readonly hasNativeAnimations: boolean;
  readonly fruitEating: FruitEatingPose;
  state = 'Idle';
  swimming = false;
  surfaceY = 0;
  positionConstraint?: (position: Vector3, size: number) => void;
  private constrainPosition() { (this.positionConstraint ?? constrainToMeadow)(this.actor.position, this.actor.scale.x); }
  yaw = 0;
  private active?: AnimationAction;
  private emotion?:Pick<EmotePose,'elapsed'|'clear'|'update'>&{kind:PlayerEmote};
  private readonly gaitFrom=new Vector3();
  private gaitFrame?:{state:PigeonGait;rate:number;mixerTime:number};
  startEmote(kind:PlayerEmote){
    if(kind==='Peck'&&(!this.isPigeon||this.state!=='Idle'))return false;
    if(this.emotion || this.flight.active || this.swimming || !['Idle','Run','WalkBackward','RotateLeft','RotateRight'].includes(this.state))return false;
    this.setActivity(kind);
    const duration=this.actions.get(kind)?.getClip().duration;
    this.emotion=this.hasNativeAnimations||kind==='Peck'?{kind,elapsed:0,clear(){},update(dt:number){this.elapsed+=dt;return this.elapsed>=(duration??2.4);}}:new EmotePose(kind,this.animationRoot);
    return true;
  }
  readonly flight = new Flight();
  readonly knightDash = new MetaKnightPlayerDash();
  private dashMotion?:MetaKnightBattleMotion;
  private dashSparks?:MetaKnightDashSparks;
  private bladeGlow?:MetaKnightBladeGlow;
  private pigeonFlightWings?:PigeonFlightWings;
  clearPigeonFlightWings(){this.pigeonFlightWings?.clear();}
  updatePigeonFlightWings(flying=this.flight.active&&(this.state==='Fly'||this.airPush!==undefined)){
    if(!this.isPigeon)return;
    if(flying)this.pigeonFlightWings??=new PigeonFlightWings(this.animationRoot.parent!,this.actions.get('Fly')!.getClip());
    this.pigeonFlightWings?.update(this.mixer.time,flying);
  }
  private duelDazedPose?:DuelDazedPose;
  clearDuelDazedPose(){this.duelDazedPose?.clear();}
  updateDuelDazedPose(now:number,dazed:boolean,seat=true){
    if(!dazed){this.clearDuelDazedPose();return;}
    this.duelDazedPose??=new DuelDazedPose(this.actor,this.isMetaKnight?'meta-knight':this.isPigeon?'pigeon':'kirby');this.duelDazedPose.apply(now,seat);
  }
  clearKnightDashPose(){this.dashMotion?.clear();}
  updateKnightBladeGlow(now=this.mixer.time*1000,charged=this.state==='Dash'||this.state==='Push',visible=true){this.bladeGlow?.update(now,charged,visible);}
  updateKnightDashVisual(){
    this.updateKnightBladeGlow();
    const active=this.isMetaKnight&&this.state==='Dash';
    if(active){
      this.dashMotion??=new MetaKnightBattleMotion(this.actor);
      this.dashSparks??=new MetaKnightDashSparks(this.actor.getObjectByName('Galaxia')!);
      this.dashMotion.applyThrust();
    }
    this.dashSparks?.update(this.mixer.time*1000,active);
  }
  disposeEffects(){this.fruitEating.dispose();this.clearKnightDashPose();this.dashSparks?.dispose();this.dashSparks=undefined;this.bladeGlow?.dispose();this.bladeGlow=undefined;this.duelDazedPose?.dispose();this.duelDazedPose=undefined;this.pigeonFlightWings?.dispose();this.pigeonFlightWings=undefined;}
  readonly roll=new PushRoll();
  takePush(dx:number,dz:number){if(this.roll.active)return false;this.setActivity('Roll');this.roll.start(dx,dz,this.surfaceY);return true;}
  readonly cloud = flightCloud();
  private jumpWasHeld = false;
  private attackElapsed: number | undefined;
  private airPush:number|undefined;
  private airPose:{arm:Object3D;p:Vector3;q:Quaternion}[]=[];
  private clearAirPose(){for(const p of this.airPose){p.arm.position.copy(p.p);p.arm.quaternion.copy(p.q);}this.airPose=[];}
  private pushReady = 0;
  private pushArmed = false;
  private readonly pushArms:{arm:Object3D;q:Quaternion;p:Vector3;side:number}[]=[];
  private attackWasHeld = false;
  attackHit = false;
  eatBite = false;
  eatPull = false;
  private eatElapsed: number | undefined;
  private eatWasHeld = false;
  fruitsEaten = 0;
  bonusPoints=0;
  eventPoints=0;
  skyCheckpoint=0;
  mountainCheckpoint=0;
  festival?:StarfallState;
  readonly achievements=new Set<ScoreAction>();
  starBlessed = false;
  starRemaining = 0;
  starCooldown = 0;
  activateStarPower(){this.starRemaining=30;}
  private flightBoost = 1;
  readonly fruitBoost = new FruitSpeedBoost();
  // Keep the size used for speed when the fountain changes only the body.
  private movementScale?: number;
  private growth?: { from: number; to: number; speedFrom: number; speedTo: number; elapsed: number };
  private duelSize?:{body:number;speed:number};
  beginDuel(){if(this.duelSize)return;const body=this.savedSize,speed=this.savedSpeedSize;this.resizeTo(1,true);this.duelSize={body,speed};}
  endDuel(){const saved=this.duelSize;if(!saved)return;this.duelSize=undefined;this.resizeTo(saved.body,true);this.restoreMovementSpeed(saved.speed);this.actor.visible=true;}
  get savedSize() { return this.duelSize?.body ?? this.growth?.to ?? this.actor.scale.x; }
  get sizeSpeedMultiplier() { return Math.max(1, this.movementScale ?? this.actor.scale.x); }
  get savedSpeedSize() { return this.duelSize?.speed ?? this.growth?.speedTo ?? this.movementScale ?? this.actor.scale.x; }
  restoreMovementSpeed(size: number) { this.movementScale = Math.max(MIN_BODY_SIZE, size); }
  shrink(amount:number){
    if(amount<=0)return;
    this.movementScale ??= this.actor.scale.x;
    const floor=(size:number)=>Math.max(MIN_BODY_SIZE,size-amount);
    this.actor.scale.setScalar(floor(this.actor.scale.x));
    if(this.growth){this.growth.from=floor(this.growth.from);this.growth.to=floor(this.growth.to);}
  }
  resizeTo(size:number,immediate=false){
    const to=Math.min(MAX_BODY_SIZE,Math.max(MIN_BODY_SIZE,size));
    if(immediate){this.growth=undefined;this.actor.scale.setScalar(to);this.movementScale=to;return;}
    if(Math.abs(this.savedSize-to)<.001)return;
    this.growth={from:this.actor.scale.x,to,speedFrom:this.movementScale??this.actor.scale.x,speedTo:to,elapsed:0};
  }
  eatFruit() {
    this.fruitBoost.eat();
    this.fruitsEaten++;
    // Swallowing finishes the action; the unused Eat tail must not lock controls.
    this.eatElapsed = undefined;
  }
  readonly animationRoot: Object3D;
  get speed() { return this.duelSize?3.4:3.4 * this.sizeSpeedMultiplier * this.fruitBoost.multiplier * (this.starRemaining > 0 ? 2 : 1); }
  get backwardSpeed() { return this.duelSize?2.8:1.65 * this.sizeSpeedMultiplier * this.fruitBoost.multiplier * (this.starRemaining > 0 ? 2 : 1); }

  constructor(model: Object3D, clips: AnimationClip[]) {
    let pigeon=false,metaKnight=false;
    model.traverse(node=>{if(node.userData.character==='pigeon')pigeon=true;if(node.userData.character==='meta-knight')metaKnight=true;});
    this.isPigeon=pigeon;
    this.isMetaKnight=metaKnight;
    this.hasNativeAnimations=pigeon||metaKnight;
    this.actor.add(model);
    this.fruitEating=new FruitEatingPose(this.actor,metaKnight?'meta-knight':pigeon?'pigeon':'kirby');
    this.actor.add(this.cloud);
    this.mixer = new AnimationMixer(model);
    // Scene and root share a GLB name; GLTFLoader renames the animated node Kirby_1.
    // Find the actual target via animation bindings instead of a display name.
    const rootTrack = clips.find(clip => clip.name === 'RotateLeft')?.tracks.find(track => {
      const binding = PropertyBinding.parseTrackName(track.name);
      const target = PropertyBinding.findNode(model, binding.nodeName);
      return binding.propertyName === 'quaternion' && target instanceof Object3D && (target === model || target.parent === model);
    });
    if (!rootTrack) throw new Error('Не найден анимированный корень персонажа');
    const root = PropertyBinding.findNode(model, PropertyBinding.parseTrackName(rootTrack.name).nodeName);
    if (!(root instanceof Object3D)) throw new Error('Некорректный корень персонажа');
    this.animationRoot = root;
    for (const source of clips) {
      if(source.name==='Attack'&&!this.isMetaKnight)continue;
      const clip = source.clone();
      if(source.name==='Jump'&&!this.hasNativeAnimations){
        // The controller owns the ballistic height; keep only the authored jump pose.
        const rate=JUMP_SECONDS/clip.duration;
        clip.duration=JUMP_SECONDS;
        for(const track of clip.tracks){
          for(let i=0;i<track.times.length;i++)track.times[i]*=rate;
          const binding=PropertyBinding.parseTrackName(track.name);
          if(binding.propertyName==='position'&&PropertyBinding.findNode(model,binding.nodeName)===this.animationRoot)track.values.fill(0);
        }
      }
      // Heading belongs to the game actor. Strip the GLB root yaw from ALL clips
      // so returning to Run/Idle never undoes a completed 90-degree turn.
      clip.tracks = clip.tracks.filter(track => {
        const binding = PropertyBinding.parseTrackName(track.name);
        return binding.propertyName !== 'quaternion' || PropertyBinding.findNode(model, binding.nodeName) !== this.animationRoot;
      });
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    const idleClip=clips.find(c=>c.name==='Idle')!;
    if(!this.hasNativeAnimations)this.actions.set('Fly',this.mixer.clipAction(flightClip(idleClip,model)));
    if(!this.hasNativeAnimations)this.actions.set('Push',this.mixer.clipAction(pushClip(idleClip,model)));
    for(const [label,side] of [['Left',-1],['Right',1]] as const){
      const arm=model.getObjectByName(`${label}_shoulder`);if(!arm)continue;
      const rotation=idleClip.tracks.find(track=>track.name===arm.name+'.quaternion');
      const position=idleClip.tracks.find(track=>track.name===arm.name+'.position');
      this.pushArms.push({arm,side,q:rotation?new Quaternion().fromArray(Array.from(rotation.values).slice(0,4)):arm.quaternion.clone(),p:position?new Vector3().fromArray(Array.from(position.values).slice(0,3)):arm.position.clone()});
    }
    for (const name of ['Idle', 'Run', 'RotateLeft', 'RotateRight', 'WalkBackward', 'Jump', 'Push', 'Eat']) {
      if (!this.actions.has(name)) throw new Error(`В модели отсутствует анимация ${name}`);
    }
    if(!this.hasNativeAnimations)this.actions.set('Swim',this.mixer.clipAction(swimClip(clips.find(c=>c.name==='Idle')!,model)));
    if(this.isMetaKnight){const dash=this.actions.get('Fly')!.getClip().clone();dash.name='Dash';this.actions.set('Dash',this.mixer.clipAction(dash));}
    this.play('Idle');
    if(this.isMetaKnight){this.bladeGlow=new MetaKnightBladeGlow(this.actor.getObjectByName('Galaxia')!);this.updateKnightBladeGlow();}
  }

  private play(name: string) {
    if (this.active && this.state === name) return;
    const next = this.actions.get(name)!;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    const nativeClip=this.isPigeon?PIGEON_CLIP_BY_NAME[name as PigeonClipName]:this.isMetaKnight?META_KNIGHT_CLIP_BY_NAME[name as MetaKnightClipName]:undefined;
    const turning = this.hasNativeAnimations ? !(nativeClip?.loop??true) : name === 'Push' || name === 'Eat' || name === 'Jump';
    next.setLoop(turning ? LoopOnce : LoopRepeat, turning ? 1 : Infinity);
    next.clampWhenFinished = turning;
    next.fadeIn(.12).play();
    if(this.active!==next)this.active?.fadeOut(.12);
    this.active = next;
    this.state = name;
  }
  private replayPush() {
    const next = this.actions.get('Push')!;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.setLoop(LoopOnce, 1);
    next.clampWhenFinished = true;
    next.fadeIn(.05).play();
    if (this.active !== next) this.active?.fadeOut(.05);
    this.active = next;
    this.state = 'Push';
  }
  private beginPush(input: Input) {
    // Galaxia reaches the target after the lunge's windup, at PUSH_HIT.
    this.attackHit = !this.isMetaKnight;
    this.pushArmed = this.isMetaKnight;
    this.pushReady = PUSH_COOLDOWN_MS / 1000;
    this.attackElapsed = 0;
    if (!this.hasNativeAnimations && (input.forward || input.backward)) this.state = 'Push';
    else this.replayPush();
  }

  private locomotion(input: Input) {
    if(this.swimming)return 'Swim';
    if (input.forward === !!input.backward) return 'Idle';
    return input.forward ? 'Run' : 'WalkBackward';
  }

  setActivity(name:string) {
    this.fruitEating.clear();
    this.clearPigeonFlightWings();
    this.clearDuelDazedPose();
    this.clearKnightDashPose();this.knightDash.cancel();this.dashSparks?.update(0,false);
    this.clearAirPose();this.airPush=undefined;
    this.roll.reset();
    this.emotion?.clear();this.emotion=undefined;
    this.flight.reset();this.cloud.visible=false;
    this.attackElapsed=this.eatElapsed=undefined;this.attackHit=false;this.pushArmed=false;
    this.play(this.hasNativeAnimations && this.actions.has(name)?name:'Idle');this.state=name;
    this.animationRoot.rotation.set(0,0,0);this.animationRoot.scale.setScalar(1);
  }

  private move(dt: number, input: Input, factor = 1) {
    if(this.swimming)factor*=.55;
    const direction = Number(input.forward) - Number(!!input.backward);
    const speed = direction > 0 ? this.speed * (input.sprint ? 2 : 1) : this.backwardSpeed;
    const yaw=input.moveYaw??this.yaw;
    this.actor.position.x += Math.sin(yaw) * speed * direction * dt * factor;
    this.actor.position.z += Math.cos(yaw) * speed * direction * dt * factor;
  }

  /** Winged native characters fly with their wings; Kirby keeps his flight puffs. */
  updateFlightVisual(levitating=this.flight.levitating){
    if(this.hasNativeAnimations)this.cloud.visible=false;
    else updateFlightCloud(this.cloud,this.flight,levitating);
  }

  /** Native stance travel determines cadence, including size, sprint and boosts. */
  syncPigeonLocomotion(dt:number,distance:number){
    if(!this.isPigeon||this.flight.active||this.swimming||!isPigeonGait(this.state))return false;
    const model=this.animationRoot.parent;
    const visualScale=this.actor.scale.x*(model&&model!==this.actor?model.scale.x:1);
    this.actions.get(this.state)!.setEffectiveTimeScale(pigeonGaitRate(this.state,distance,dt,visualScale));
    return true;
  }

  private advanceGroundMixer(dt:number){
    if(this.isPigeon&&isPigeonGait(this.state)){
      this.constrainPosition();
      const distance=Math.hypot(this.actor.position.x-this.gaitFrom.x,this.actor.position.z-this.gaitFrom.z);
      if(this.syncPigeonLocomotion(dt,distance)){
        this.gaitFrame={state:this.state,rate:this.actions.get(this.state)!.getEffectiveTimeScale(),mixerTime:this.mixer.time+dt};
      }
    }
    this.mixer.update(dt);
  }

  /** Correct the current gait after walls or deck movement resolve the actor position. */
  finishPigeonGroundMovement(dt:number,previousX:number,previousZ:number){
    const frame=this.gaitFrame;this.gaitFrame=undefined;
    if(dt<=0||!this.isPigeon||!isPigeonGait(this.state)||this.flight.active||this.swimming)return;
    const action=this.actions.get(this.state)!;
    const consumed=frame&&frame.state===this.state&&Math.abs(frame.mixerTime-this.mixer.time)<1e-8?frame.rate:action.getEffectiveTimeScale();
    const distance=Math.hypot(this.actor.position.x-previousX,this.actor.position.z-previousZ);
    this.syncPigeonLocomotion(dt,distance);
    const correction=(action.getEffectiveTimeScale()-consumed)*dt,duration=action.getClip().duration;
    if(Math.abs(correction)>1e-9){
      action.time=((action.time+correction)%duration+duration)%duration;
      this.mixer.update(0);
    }
  }

  private updateGrowth(dt:number){
    const g=this.growth;if(!g)return;
    g.elapsed+=dt;
    const t=Math.min(1,g.elapsed/.45),blend=t*t*(3-2*t);
    this.actor.scale.setScalar(g.from+(g.to-g.from)*blend);
    this.movementScale=g.speedFrom+(g.speedTo-g.speedFrom)*blend;
    if(t===1){this.actor.scale.setScalar(g.to);this.growth=undefined;}
  }

  /** A mount moves the actor while its native pose and growth continue. */
  updateActivity(dt:number){
    this.fruitEating.clear();
    this.clearPigeonFlightWings();
    this.clearDuelDazedPose();
    this.clearKnightDashPose();this.knightDash.tick(dt);this.knightDash.cancelCharge();
    this.updateGrowth(dt);this.pushReady=Math.max(0,this.pushReady-dt);
    this.mixer.update(dt);
    this.updateKnightDashVisual();
  }

  update(dt: number, input: Input) {
    this.fruitEating.clear();
    this.clearPigeonFlightWings();
    this.updateKnightBladeGlow((this.mixer.time+dt)*1000);
    this.clearDuelDazedPose();
    this.clearKnightDashPose();this.knightDash.tick(dt);
    this.dashSparks?.update(0,false);
    this.gaitFrame=undefined;
    this.clearAirPose();
    this.roll.clearPose();
    this.updateGrowth(dt);
    this.constrainPosition();
    this.gaitFrom.copy(this.actor.position);
    this.attackHit = false;
    this.eatBite = false;
    this.eatPull = false;
    if(this.roll.active){this.mixer.update(dt);if(this.roll.update(dt,this.actor,this.surfaceY)){if(!this.hasNativeAnimations)this.roll.applyPose(this.animationRoot,this.yaw);}else this.play('Idle');this.constrainPosition();return;}
    if(this.emotion){
      this.emotion.clear();
      if(input.forward || input.backward || input.left || input.right || input.steer || input.jump || input.attack || input.eat){if(this.emotion.kind==='Peck')this.actions.get('Peck')!.stop();this.emotion=undefined;this.play('Idle');}
      else {
        this.mixer.update(dt);
        const emote=this.emotion;
        if(emote.kind==='Fear' && emote.elapsed<.3){const step=Math.min(dt,.3-emote.elapsed)*2*this.actor.scale.x;this.actor.position.x-=Math.sin(this.yaw)*step;this.actor.position.z-=Math.cos(this.yaw)*step;this.constrainPosition();}
        if(emote.update(dt)){emote.clear();this.emotion=undefined;this.play('Idle');}
        return;
      }
    }
    this.pushReady = Math.max(0, this.pushReady - dt);
    const eatPressed = !!input.eat && !this.eatWasHeld;
    this.eatWasHeld = !!input.eat;
    const attackPressed = !!input.attackPressed || !!input.attack && !this.attackWasHeld;
    this.attackWasHeld = !!input.attack;
    const jumpPressed = !!input.jumpPressed || !!input.jump && !this.jumpWasHeld;
    this.jumpWasHeld = !!input.jump;
    if(jumpPressed && this.flight.active)this.flight.press();
    if(!this.knightDash.active&&this.flight.active&&attackPressed&&this.pushReady<=0){
      this.attackHit=!this.isMetaKnight;this.pushArmed=this.isMetaKnight;this.pushReady=PUSH_COOLDOWN_MS/1000;this.airPush=0;
      if(this.hasNativeAnimations)this.replayPush();
    }
    if (!this.flight.active && this.eatElapsed === undefined && attackPressed && this.pushReady <= 0) this.beginPush(input);
    if (!this.flight.active && this.attackElapsed === undefined && this.eatElapsed === undefined) {
      if (eatPressed) {
        this.play('Eat');
        this.eatElapsed = 0;
      } else if (jumpPressed) {
        this.play('Jump');
        this.flightBoost = this.starRemaining > 0 ? 2 : 1;
        this.flight.press();
      }
    }
    const dashStart=this.isMetaKnight?this.knightDash.chargeHold(dt,input.dashHeld??!!input.jump,(!this.swimming||this.flight.active)&&this.eatElapsed===undefined&&this.attackElapsed===undefined&&this.airPush===undefined):undefined;
    if(dashStart!==undefined){
      if(!this.flight.active){this.flight.press();this.flightBoost=this.starRemaining>0?2:1;}
      this.flight.sustain();
      this.play('Dash');
    }
    if(this.knightDash.active){
      const step=this.knightDash.step(dashStart??dt),distance=step*PLAYER_KNIGHT_DASH.distance/PLAYER_KNIGHT_DASH.duration*this.sizeSpeedMultiplier;
      this.actor.position.x+=Math.sin(this.yaw)*distance;this.actor.position.z+=Math.cos(this.yaw)*distance;
      this.flight.update(dt);this.actor.position.y=this.surfaceY+this.flight.height*Math.max(1,this.actor.scale.x)*this.flightBoost;
      this.updateFlightVisual();this.mixer.update(dt);
      if(!this.knightDash.active)this.play(this.flight.active?'Fly':this.locomotion(input));
      this.constrainPosition();this.updateKnightDashVisual();return;
    }
    if(!this.isPigeon)this.actions.get('Run')!.setEffectiveTimeScale(input.sprint && input.forward && !input.backward ? 2 : 1);
    if (this.eatElapsed !== undefined) {
      const previous = this.eatElapsed;
      this.eatElapsed += dt;
      this.eatBite = previous < .95 && this.eatElapsed >= .95;
      this.eatPull = previous < .18 && this.eatElapsed >= .18;
      this.mixer.update(dt);
      if (this.eatElapsed >= this.actions.get('Eat')!.getClip().duration - 1e-6) {
        this.eatElapsed = undefined;
        this.play(this.locomotion(input));
      }
    } else if (this.attackElapsed !== undefined) {
      const previous = this.attackElapsed;
      this.attackElapsed += dt;
      if(this.pushArmed && previous < PUSH_HIT && this.attackElapsed >= PUSH_HIT){this.attackHit=true;this.pushArmed=false;}
      const steering=input.steer!==undefined?Math.max(-1,Math.min(1,input.steer)):Number(input.left)-Number(input.right);
      if(steering){this.yaw+=steering*TURN_RATE*dt;this.actor.rotation.y=this.yaw;}
      this.move(dt, input);
      const moving=!!(input.forward||input.backward);
      if(!this.hasNativeAnimations && moving && this.active!==this.actions.get('Run') && this.active!==this.actions.get('WalkBackward')){this.play(this.locomotion(input));this.state='Push';}
      this.mixer.update(dt);
      if(moving && !this.hasNativeAnimations)applyPushArms(this.pushArms,this.attackElapsed);
      if (this.attackElapsed >= this.actions.get('Push')!.getClip().duration - 1e-6) {
        this.attackElapsed = undefined;
        const next=this.locomotion(input);
        if(this.active===this.actions.get(next))this.state=next;else this.play(next);
      }
    } else if (this.flight.active) {
      if(this.hasNativeAnimations&&this.airPush!==undefined)this.play('Push');
      else if(this.flight.levitating)this.play('Fly');
      else if(this.state==='Push'){
        this.play('Jump');this.actions.get('Jump')!.time=this.actions.get('Jump')!.getClip().duration*.65;
      }
      this.yaw+=(input.steer ?? (Number(input.left)-Number(input.right)))*TURN_RATE*dt;
      this.actor.rotation.y=this.yaw;
      this.move(dt, this.flight.gliding?{...input,forward:true,backward:false}:input, .8);
      this.flight.update(dt);this.actor.position.y=this.surfaceY+this.flight.height*Math.max(1,this.actor.scale.x)*this.flightBoost;
      if(this.state==='Fly'&&!this.flight.levitating){
        this.play('Jump');
        this.actions.get('Jump')!.time=this.actions.get('Jump')!.getClip().duration*.65;
      }
      this.updateFlightVisual();
      this.mixer.update(dt);
      this.updatePigeonFlightWings();
      if(this.airPush!==undefined){const previous=this.airPush;this.airPush+=dt;if(this.pushArmed&&previous<PUSH_HIT&&this.airPush>=PUSH_HIT){this.attackHit=true;this.pushArmed=false;}if(!this.hasNativeAnimations){this.airPose=this.pushArms.map(({arm})=>({arm,p:arm.position.clone(),q:arm.quaternion.clone()}));applyPushArms(this.pushArms,this.airPush);}if(this.airPush>=PUSH_DURATION)this.airPush=undefined;}
      if(!this.flight.active){this.cloud.visible=false;this.airPush=undefined;this.pushArmed=false;this.play(this.locomotion(input));}
    } else {
      const steering=input.steer!==undefined?Math.max(-1,Math.min(1,input.steer)):Number(input.left)-Number(input.right);
      this.yaw+=steering*TURN_RATE*dt;
      this.actor.rotation.y=this.yaw;
      const motion=this.locomotion(input);
      this.play(motion==='Idle' && steering!==0 ? (steering>0?'RotateLeft':'RotateRight') : motion);
      if(this.state.startsWith('Rotate')) {
        const action=this.actions.get(this.state)!;
        // Native preview clips are one-shot; held steering keeps footwork cycling.
        const speed=2*Math.max(.35,Math.abs(steering));
        action.setLoop(LoopRepeat,Infinity).setEffectiveTimeScale(speed*action.getClip().duration/.4);
      } else if(this.state==='Run'&&!this.isPigeon) {
        this.actions.get('Run')!.setEffectiveTimeScale(input.sprint?2:1);
      }
      this.move(dt, input);
      this.advanceGroundMixer(dt);
    }
    this.constrainPosition();
  }
}
