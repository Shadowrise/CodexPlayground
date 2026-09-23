import { AnimationAction, AnimationClip, AnimationMixer, Group, LoopOnce, LoopRepeat, Object3D, PropertyBinding } from 'three';
import { constrainToMeadow } from './world-bounds';
import { Flight, flightClip, flightCloud, updateFlightCloud } from './flight';

export type Input = { forward: boolean; backward?: boolean; sprint?: boolean; left: boolean; right: boolean; jump?: boolean; attack?: boolean; eat?: boolean; steer?: number };
type Turn = { direction: number; startYaw: number; elapsed: number; duration: number };

export class CharacterController {
  readonly actor = new Group();
  readonly mixer: AnimationMixer;
  readonly actions = new Map<string, AnimationAction>();
  state = 'Idle';
  swimming = false;
  surfaceY = 0;
  yaw = 0;
  private active?: AnimationAction;
  private turn?: Turn;
  readonly flight = new Flight();
  readonly cloud = flightCloud();
  private jumpWasHeld = false;
  private attackElapsed: number | undefined;
  private attackWasHeld = false;
  attackHit = false;
  eatBite = false;
  eatPull = false;
  private eatElapsed: number | undefined;
  private eatWasHeld = false;
  fruitsEaten = 0;
  starBlessed = false;
  starRemaining = 0;
  starCooldown = 0;
  private flightBoost = 1;
  private growth?: { from: number; to: number; elapsed: number };
  get savedSize() { return this.growth?.to ?? this.actor.scale.x; }
  grow() {
    this.growth = { from: this.actor.scale.x, to: (this.growth?.to ?? this.actor.scale.x) + .1, elapsed: 0 };
    this.fruitsEaten++;
    // Swallowing finishes the action; the unused Eat tail must not lock controls.
    this.eatElapsed = undefined;
  }
  readonly animationRoot: Object3D;
  get speed() { return 3.4 * this.actor.scale.x * (this.starRemaining > 0 ? 2 : 1); }
  get backwardSpeed() { return 1.65 * this.actor.scale.x * (this.starRemaining > 0 ? 2 : 1); }
  readonly turnStep = Math.PI / 18;
  readonly turnDuration = .1;

  constructor(model: Object3D, clips: AnimationClip[]) {
    this.actor.add(model);
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
      const clip = source.name==='Jump' ? flightClip(clips.find(c=>c.name==='Idle')!,model,'Jump') : source.clone();
      // Heading belongs to the game actor. Strip the GLB root yaw from ALL clips
      // so returning to Run/Idle never undoes a completed 90-degree turn.
      clip.tracks = clip.tracks.filter(track => {
        const binding = PropertyBinding.parseTrackName(track.name);
        return binding.propertyName !== 'quaternion' || PropertyBinding.findNode(model, binding.nodeName) !== this.animationRoot;
      });
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    for (const name of ['Idle', 'Run', 'RotateLeft', 'RotateRight', 'WalkBackward', 'Jump', 'Attack', 'Eat']) {
      if (!this.actions.has(name)) throw new Error(`В модели отсутствует анимация ${name}`);
    }
    const swim=flightClip(clips.find(c=>c.name==='Idle')!,model,'Swim');
    swim.duration*=3;for(const track of swim.tracks)for(let i=0;i<track.times.length;i++)track.times[i]*=3;
    this.actions.set('Swim',this.mixer.clipAction(swim));
    this.play('Idle');
  }

  private play(name: string) {
    if (this.active && this.state === name) return;
    const next = this.actions.get(name)!;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    const turning = name === 'Attack' || name === 'Eat';
    next.setLoop(turning ? LoopOnce : LoopRepeat, turning ? 1 : Infinity);
    next.clampWhenFinished = turning;
    next.fadeIn(.12).play();
    if(this.active!==next)this.active?.fadeOut(.12);
    this.active = next;
    this.state = name;
  }

  private locomotion(input: Input) {
    if(this.swimming)return 'Swim';
    if (input.forward === !!input.backward) return 'Idle';
    return input.forward ? 'Run' : 'WalkBackward';
  }

  setActivity(name:string) {
    this.flight.reset();this.cloud.visible=false;this.turn=undefined;
    this.attackElapsed=this.eatElapsed=undefined;this.attackHit=false;
    this.play('Idle');this.state=name;
    this.animationRoot.rotation.set(0,0,0);this.animationRoot.scale.setScalar(1);
  }

  private move(dt: number, input: Input, factor = 1) {
    if(this.swimming)factor*=.55;
    const direction = Number(input.forward) - Number(!!input.backward);
    const speed = direction > 0 ? this.speed * (input.sprint ? 2 : 1) : this.backwardSpeed;
    this.actor.position.x += Math.sin(this.yaw) * speed * direction * dt * factor;
    this.actor.position.z += Math.cos(this.yaw) * speed * direction * dt * factor;
  }

  update(dt: number, input: Input) {
    if(input.steer!==undefined)this.turn=undefined;
    if (this.growth) {
      const g=this.growth;
      g.elapsed+=dt;
      const t=Math.min(1,g.elapsed/.45), blend=t*t*(3-2*t);
      this.actor.scale.setScalar(g.from+(g.to-g.from)*blend);
      if(t===1){this.actor.scale.setScalar(g.to);this.growth=undefined;}
    }
    constrainToMeadow(this.actor.position, this.actor.scale.x);
    this.attackHit = false;
    this.eatBite = false;
    this.eatPull = false;
    const eatPressed = !!input.eat && !this.eatWasHeld;
    this.eatWasHeld = !!input.eat;
    const attackPressed = !!input.attack && !this.attackWasHeld;
    this.attackWasHeld = !!input.attack;
    const jumpPressed = !!input.jump && !this.jumpWasHeld;
    this.jumpWasHeld = !!input.jump;
    if(jumpPressed && this.flight.active)this.flight.press();
    if (!this.turn && !this.flight.active && this.attackElapsed === undefined && this.eatElapsed === undefined) {
      const direction = input.steer===undefined ? Number(input.left) - Number(input.right) : 0;
      if (eatPressed) {
        this.play('Eat');
        this.eatElapsed = 0;
      } else if (attackPressed) {
        this.play('Attack');
        this.attackElapsed = 0;
      } else if (jumpPressed) {
        this.play('Jump');
        this.flightBoost = this.starRemaining > 0 ? 2 : 1;
        this.flight.press();
      } else if (direction) {
        this.turn = { direction, startYaw: this.yaw, elapsed: 0, duration: this.turnDuration };
      } else if(input.steer===undefined) {
        this.play(this.locomotion(input));
      }
    }
    this.actions.get('Run')!.setEffectiveTimeScale(input.sprint && input.forward && !input.backward ? 2 : 1);
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
      // One hit event at the extended fist pose, not one hit per render frame.
      this.attackHit = previous < .48 && this.attackElapsed >= .48;
      this.mixer.update(dt);
      if (this.attackElapsed >= this.actions.get('Attack')!.getClip().duration - 1e-6) {
        this.attackElapsed = undefined;
        this.play(this.locomotion(input));
      }
    } else if (this.flight.active) {
      this.yaw+=(input.steer ?? (Number(input.left)-Number(input.right)))*Math.PI*.55*dt;
      this.actor.rotation.y=this.yaw;
      this.move(dt, this.flight.gliding?{...input,forward:true,backward:false}:input, .8);
      this.flight.update(dt);this.actor.position.y=this.surfaceY+this.flight.height*this.actor.scale.x*this.flightBoost;
      updateFlightCloud(this.cloud,this.flight);
      this.mixer.update(dt);
      if(!this.flight.active){this.cloud.visible=false;this.play(this.locomotion(input));}
    } else if (this.turn) {
      const t = this.turn;
      const locomotion=this.locomotion(input);
      const name=locomotion==='Idle' ? (t.direction>0?'RotateLeft':'RotateRight') : locomotion;
      this.play(name);
      this.actions.get(name)!.setEffectiveTimeScale(name.startsWith('Rotate') ? this.actions.get(name)!.getClip().duration/.4 : name==='Run' && input.sprint ? 2 : 1);
      t.elapsed = Math.min(t.duration, t.elapsed + dt);
      // GLB time keys are float32: 1.2 may decode as 1.2000000477.
      if (t.duration - t.elapsed < 1e-6) t.elapsed = t.duration;
      const u = t.elapsed / t.duration;
      this.yaw = t.startYaw + t.direction * this.turnStep * u * u * (3 - 2 * u);
      this.actor.rotation.y = this.yaw;
      this.move(dt,input);
      this.mixer.update(dt);
      if (t.elapsed >= t.duration - 1e-8) {
        this.turn = undefined;
        const heldDirection = Number(input.left) - Number(input.right);
        if (heldDirection !== t.direction) this.play(this.locomotion(input));
      }
    } else {
      if(input.steer!==undefined) {
        const steering=Math.max(-1,Math.min(1,input.steer));
        this.yaw+=steering*Math.PI*.55*dt;
        this.actor.rotation.y=this.yaw;
        const motion=this.locomotion(input);
        this.play(motion==='Idle' && steering!==0 ? (steering>0?'RotateLeft':'RotateRight') : motion);
        if(this.state.startsWith('Rotate'))this.actions.get(this.state)!.setLoop(LoopRepeat,Infinity).setEffectiveTimeScale(Math.max(.35,Math.abs(steering))*this.actions.get(this.state)!.getClip().duration/.4);
      }
      this.move(dt, input);
      this.mixer.update(dt);
    }
    constrainToMeadow(this.actor.position, this.actor.scale.x);
  }
}
