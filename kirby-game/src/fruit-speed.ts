export const FRUIT_BOOST_SECONDS = 20;
export const MAX_FRUIT_BOOST_STACKS = 10;
export type FruitBoostState = { stacks: number; remaining: number };

export function validFruitBoost(value: unknown): value is FruitBoostState {
  const boost = value as FruitBoostState;
  return !!boost && Number.isInteger(boost.stacks) && boost.stacks >= 0 && boost.stacks <= MAX_FRUIT_BOOST_STACKS
    && Number.isFinite(boost.remaining) && boost.remaining >= 0 && boost.remaining <= FRUIT_BOOST_SECONDS
    && (boost.stacks === 0) === (boost.remaining === 0);
}

/** All stacks share one refreshed timer; expiration removes the entire bonus. */
export class FruitSpeedBoost {
  stacks = 0;
  remaining = 0;
  get multiplier() { return 1 + this.stacks / 5; }
  eat(count = 1) {
    this.stacks = Math.min(MAX_FRUIT_BOOST_STACKS, (this.remaining > 0 ? this.stacks : 0) + count);
    this.remaining = FRUIT_BOOST_SECONDS;
  }
  update(dt: number) {
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining < 1e-9) { this.remaining = 0; this.stacks = 0; }
  }
  restore(state?: FruitBoostState) {
    this.stacks = state?.stacks ?? 0;
    this.remaining = state?.remaining ?? 0;
  }
  snapshot(): FruitBoostState | undefined {
    return this.remaining > 0 ? { stacks: this.stacks, remaining: this.remaining } : undefined;
  }
}
