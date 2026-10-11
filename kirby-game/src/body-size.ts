export const MIN_BODY_SIZE = .3;
export const MAX_BODY_SIZE = 10;

export function stepBodySize(current: number, delta: number) {
  const next = Math.round((current + delta) * 1000) / 1000;
  return Math.min(MAX_BODY_SIZE, Math.max(MIN_BODY_SIZE, next));
}
