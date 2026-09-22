export type SoundKind = 'jump' | 'attack' | 'death' | 'revive' | 'grow' | 'voice' | 'step';
export type SoundActor = { id: string; state: string; down: boolean; size: number; x: number; z: number; player?: boolean; fruitsEaten?: number };
export type SoundEvent = { kind: SoundKind; actor: SoundActor };

/** Animation/health transitions are observed once, not sounded every frame. */
export class SoundEvents {
  private previous = new Map<string, SoundActor>();
  private voiceAfter = 7;
  private now = 0;
  private voiceHistory = new Map<string, number>();
  private strides = new Map<string, number>();
  private stepAfter = new Map<string, number>();
  private npcStepAfter = 0;
  constructor(private random = Math.random) {}

  update(dt: number, actors: SoundActor[], listener: { x: number; z: number }) {
    this.now += dt;
    const events: SoundEvent[] = [];
    const steps: SoundActor[] = [];
    for (const actor of actors) {
      const before = this.previous.get(actor.id);
      if (before) {
        const distance = Math.hypot(actor.x - before.x, actor.z - before.z);
        const walking = !actor.down && ['Walk', 'Run', 'WalkBackward'].includes(actor.state);
        if (walking && distance > .0001 && distance < actor.size * 3) {
          const stride = (this.strides.get(actor.id) ?? 0) + distance;
          if (stride >= .85 * actor.size && this.now >= (this.stepAfter.get(actor.id) ?? 0)) {
            steps.push(actor);
            this.strides.set(actor.id, 0);
            this.stepAfter.set(actor.id, this.now + (actor.player ? .16 : .3));
          } else this.strides.set(actor.id, stride);
        } else this.strides.set(actor.id, 0);
        if (!before.down && actor.down) events.push({ kind: 'death', actor });
        else if (before.down && !actor.down) events.push({ kind: 'revive', actor });
        else if (!actor.down && before.state !== actor.state) {
          if (actor.state === 'Jump' || actor.state === 'Fly') events.push({ kind: 'jump', actor });
          if (actor.state === 'Attack') events.push({ kind: 'attack', actor });
        }
        if (actor.fruitsEaten !== undefined ? actor.fruitsEaten > (before.fruitsEaten ?? actor.fruitsEaten) : actor.size > before.size + .001) events.push({ kind: 'grow', actor });
      }
      this.previous.set(actor.id, { ...actor });
    }
    // Only the closest eligible NPC supplies a quiet step at a time.
    steps.sort((a,b) => Math.hypot(a.x-listener.x,a.z-listener.z)-Math.hypot(b.x-listener.x,b.z-listener.z));
    for (const actor of steps) {
      if (actor.player) events.push({ kind: 'step', actor });
      else if (this.now >= this.npcStepAfter && Math.hypot(actor.x-listener.x,actor.z-listener.z)<9) {
        events.push({ kind: 'step', actor }); this.npcStepAfter=this.now+.3;
      }
    }
    if (this.now >= this.voiceAfter) {
      const candidates = actors.filter(a => !a.player && !a.down && ['Idle', 'Walk', 'Run'].includes(a.state)
        && Math.hypot(a.x - listener.x, a.z - listener.z) < 13
        && this.now - (this.voiceHistory.get(a.id) ?? -100) > 45);
      if (candidates.length && !events.some(e => (e.actor.player && e.kind !== 'step') || e.kind === 'death')) {
        const actor = candidates[Math.floor(this.random() * candidates.length)];
        events.push({ kind: 'voice', actor });
        this.voiceHistory.set(actor.id, this.now);
        this.voiceAfter = this.now + 9 + this.random() * 7;
      } else this.voiceAfter = this.now + 2;
    }
    return events;
  }
}
