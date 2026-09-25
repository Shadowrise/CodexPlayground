import type { ScoreAction } from './score';
import { AnimationAction, AnimationClip, AnimationMixer, Color, Group, LoopOnce, LoopRepeat, Mesh, MeshStandardMaterial, Object3D, PropertyBinding, Vector3 } from 'three';
import { cloneVariant, KIRBY_VARIANTS, remainingVariants, type KirbyVariant } from './variants';
import { Flight, flightClip, flightCloud, updateFlightCloud } from './flight';
import { constrainToMeadow, insideMeadow, worldLimit, MEADOW_HALF_SIZE } from './world-bounds';
export { NPC_COLORS } from './variants';

const repertoire = ['Idle', 'Walk', 'Run', 'WalkBackward', 'RotateLeft', 'RotateRight', 'Jump', 'Eat', 'Attack'];
const loops = new Set(['Idle', 'Walk', 'Run', 'WalkBackward']);

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
  private active?: AnimationAction;
  private elapsed = 0;
  private duration = 1;
  private turnStart = 0;
  private deck: string[] = [];
  private seed: number;
  private obstructed = false;
  private next = new Vector3();
  health = 3;
  private downRemaining = 0;
  private flashRemaining = 0;
  private readonly originalColors = new Map<MeshStandardMaterial, { color: Color; emissive: Color; intensity: number }>();
  get isDown() { return this.health === 0; }
  get canBoardBalloon(){return !this.isDown && !this.greeting && !this.flight.active && this.flashRemaining<=0 && ['Idle','Walk','Run','WalkBackward'].includes(this.state);}
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
    this.greeting={elapsed:0,yaw:Math.atan2(player.x-this.actor.position.x,player.z-this.actor.position.z),landed:false};
    return true;
  }
  private readonly body: Mesh;
  private readonly bodyCenter = new Vector3();
  private readonly bodyRadii = new Vector3();
  private readonly contactCenter = new Vector3();
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
    let body: Mesh | undefined;
    this.model.traverse(object => { if (object instanceof Mesh && object.name.startsWith('Body')) body = object; });
    if (!body) throw new Error('NPC body mesh missing');
    this.body = body;
    this.body.geometry.computeBoundingBox();
    this.body.geometry.boundingBox!.getCenter(this.bodyCenter);
    this.body.geometry.boundingBox!.getSize(this.bodyRadii).multiplyScalar(.5);
    this.appetite = 4 + index * .6;
    this.model.traverse(object => {
      if (!(object instanceof Mesh)) return;
      for (const material of (Array.isArray(object.material) ? object.material : [object.material]) as MeshStandardMaterial[]) {
        if (!this.originalColors.has(material)) this.originalColors.set(material, { color: material.color.clone(), emissive: material.emissive.clone(), intensity: material.emissiveIntensity });
      }
    });
    this.actor.name = `NPC ${index + 1} · ${variant[0]}`;
    this.actor.add(this.model);
    this.actor.add(this.cloud);
    this.mixer = new AnimationMixer(this.model);
    const rootTrack = clips.find(c => c.name === 'RotateLeft')!.tracks.find(track => {
      const binding = PropertyBinding.parseTrackName(track.name);
      const target = PropertyBinding.findNode(this.model, binding.nodeName);
      return binding.propertyName === 'quaternion' && target instanceof Object3D && target.parent === this.model;
    })!;
    for (const source of clips) {
      const clip = source.clone();
      // Transfer only turning yaw to actor; Death retains its sideways fall.
      if (clip.name.startsWith('Rotate')) clip.tracks = clip.tracks.filter(t => t.name !== rootTrack.name);
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.actions.set('Fly',this.mixer.clipAction(flightClip(clips.find(c=>c.name==='Idle')!,this.model)));
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

  networkLife(){return [this.health,this.downRemaining,this.flashRemaining,this.elapsed,this.duration,this.seed,this.turnStart,...this.flight.networkState()];}
  networkApplyLife(v:number[]){[this.health,this.downRemaining,this.flashRemaining,this.elapsed,this.duration,this.seed,this.turnStart]=v;this.flight.networkApply(v.slice(7));
    for(const [material,original] of this.originalColors){if(this.flashRemaining>0){material.color.set('#ff1824');material.emissive.set('#ff0000');material.emissiveIntensity=.65;}else{material.color.copy(original.color);material.emissive.copy(original.emissive);material.emissiveIntensity=original.intensity;}}
  }
  networkAnimate(state:string,dt:number){if(this.state!==state){if(this.actions.has(state))this.start(state);else {this.state=state;if(this.fireflyIndex!==undefined){this.actions.forEach(a=>a.stop());this.actions.get(this.approachingFirefly?'Walk':'Idle')?.reset().play();}}}this.mixer.update(dt);if(this.isDown)this.groundFallenBody();}
  private random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }

  takeHit(): boolean {
    if (this.isDown || this.state==='Balloon') return false;
    const mounted=this.fireflyIndex!==undefined&&!this.approachingFirefly;
    if(this.approachingFirefly)this.start('Idle');
    if(this.flight.active){this.flight.reset();this.actor.position.y=0;this.cloud.visible=false;this.start('Idle');}
    this.greeting=undefined;
    this.health=mounted?0:this.health-1;
    this.flashRemaining = .28;
    for (const [material] of this.originalColors) {
      material.color.set('#ff1824'); material.emissive.set('#ff0000'); material.emissiveIntensity = .65;
    }
    if (this.isDown) {
      this.start('Death');
      // Full fall animation, followed by ten seconds held in its final pose.
      this.downRemaining = this.actions.get('Death')!.getClip().duration + 10;
    }
    return true;
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
    this.obstructed = false;
  }

  private choose() {
    // At the edge, turn inward instead of walking out of the meadow.
    const p = this.actor.position;
    const outward = p.x * Math.sin(this.yaw) + p.z * Math.cos(this.yaw);
    if ((Math.max(Math.abs(p.x), Math.abs(p.z)) > worldLimit(this.actor.scale.x) - 4 && outward > 0) || this.obstructed) {
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

  update(dt: number, neighbors: readonly Vector3[]) {
    if(this.growth) {
      const g=this.growth;g.elapsed+=dt;
      const t=Math.min(1,g.elapsed/.45);
      this.actor.scale.setScalar(g.from+(g.to-g.from)*t*t*(3-2*t));
      if(t===1)this.growth=undefined;
    }
    this.hello=false;
    if(this.fireflyIndex!==undefined){this.elapsed+=dt;this.mixer.update(dt);if(!this.approachingFirefly)this.poseFirefly();return;}
    constrainToMeadow(this.actor.position, this.actor.scale.x);
    this.eatBite = false;
    this.eatPull = false;
    this.appetite = Math.max(0, this.appetite - dt);
    if (this.flashRemaining > 0) {
      this.flashRemaining = Math.max(0, this.flashRemaining - dt);
      if (this.flashRemaining === 0) for (const [material, original] of this.originalColors) {
        material.color.copy(original.color); material.emissive.copy(original.emissive); material.emissiveIntensity = original.intensity;
      }
    }
    if (this.isDown) {
      this.elapsed+=dt;
      this.actor.position.y=Math.max(0,this.actor.position.y-24*(this.elapsed-dt/2)*dt);
      this.mixer.update(dt);
      this.groundFallenBody();
      this.downRemaining = Math.max(0, this.downRemaining - dt);
      if (this.downRemaining < 1e-6) {
        this.health = 3;
        this.start('Walk');
      }
      return;
    }
    this.model.position.y *= Math.exp(-14 * dt);
    if(this.flight.active) {
      const before=this.flightTime;this.flightTime+=dt;
      if(before<.5 && this.flightTime>=.5)this.flight.press();
      if(before<1.3 && this.flightTime>=1.3)this.flight.press();
      this.flight.update(dt);this.actor.position.y=this.flight.height*this.actor.scale.x;
      this.actor.position.x+=Math.sin(this.yaw)*1.5*this.actor.scale.x*dt;
      this.actor.position.z+=Math.cos(this.yaw)*1.5*this.actor.scale.x*dt;
      constrainToMeadow(this.actor.position,this.actor.scale.x);
      updateFlightCloud(this.cloud,this.flight);this.mixer.update(dt);
      if(!this.flight.active){this.cloud.visible=false;this.start('Walk');}
      return;
    }
    if(this.greeting) {
      const greeting=this.greeting,previous=greeting.elapsed;
      greeting.elapsed+=dt;
      this.yaw+=Math.atan2(Math.sin(greeting.yaw-this.yaw),Math.cos(greeting.yaw-this.yaw))*(1-Math.exp(-12*dt));
      this.actor.rotation.y=this.yaw;
      this.hello=previous<.35 && greeting.elapsed>=.35;
      if(!greeting.landed && greeting.elapsed>=this.actions.get('Jump')!.getClip().duration){this.start('Idle');greeting.landed=true;}
      this.mixer.update(dt);
      const arm=this.model.getObjectByName('Right_shoulder') ?? this.model.getObjectByName('Right shoulder');
      const envelope=Math.min(1,greeting.elapsed/.25)*Math.min(1,Math.max(0,(2.7-greeting.elapsed)/.3));
      if(arm)arm.rotateZ((1.05+.3*Math.sin(greeting.elapsed*17))*envelope);
      if(greeting.elapsed>=2.7){this.greeting=undefined;this.start('Idle');}
      return;
    }
    if (this.elapsed >= this.duration - 1e-6) this.choose();
    const previousElapsed = this.elapsed;
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    this.eatBite = this.eatingFruit && this.state === 'Eat' && previousElapsed < .95 && this.elapsed >= .95;
    this.eatPull = this.eatingFruit && this.state === 'Eat' && previousElapsed < .18 && this.elapsed >= .18;
    const turning = this.state.startsWith('Rotate');
    if (turning) {
      const u = Math.min(1, this.elapsed / this.actions.get(this.state)!.getClip().duration);
      this.yaw = this.turnStart + (this.state === 'RotateLeft' ? 1 : -1) * Math.PI / 2 * u * u * (3 - 2 * u);
      this.actor.rotation.y = this.yaw;
    }
    const speed = (this.state === 'Walk' ? 1.725 : this.state === 'Run' ? 5.2 : this.state === 'WalkBackward' ? -.9 : 0) * this.actor.scale.x;
    if (speed && !this.obstructed) {
      this.next.copy(this.actor.position);
      this.next.x += Math.sin(this.yaw) * speed * dt;
      this.next.z += Math.cos(this.yaw) * speed * dt;
      const blocked = !insideMeadow(this.next, this.actor.scale.x) || neighbors.some(p => p !== this.actor.position && this.next.distanceToSquared(p) < 5.3);
      if (blocked) { this.obstructed = true; this.elapsed = this.duration; }
      else this.actor.position.copy(this.next);
    }
    this.mixer.update(dt);
  }

  private groundFallenBody() {
    // The GLB was grounded against the dangling arm. Ground the round head/body
    // instead, using exact ellipsoid support under its current world transform.
    this.model.position.y = 0;
    this.actor.updateWorldMatrix(true, true);
    this.contactCenter.copy(this.bodyCenter).applyMatrix4(this.body.matrixWorld);
    const m = this.body.matrixWorld.elements;
    const radiusY = Math.hypot(m[1] * this.bodyRadii.x, m[5] * this.bodyRadii.y, m[9] * this.bodyRadii.z);
    const bottom = this.contactCenter.y - radiusY;
    const u = Math.min(1, this.actions.get('Death')!.time / .7);
    this.model.position.y = (this.actor.position.y-.02 - bottom) / this.actor.scale.y * u * u * (3 - 2 * u);
    this.actor.updateWorldMatrix(true, true);
  }
}

export function createNpcs(template: Object3D, clips: AnimationClip[], selected: KirbyVariant = KIRBY_VARIANTS[0]) {
  return remainingVariants(selected).map((variant, index) => new KirbyNpc(template, clips, index, variant));
}
