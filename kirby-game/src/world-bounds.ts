// Eight times the area of the former 180-by-180 m meadow footprint.
export const MEADOW_HALF_SIZE = 90 * Math.sqrt(8);
export const MOUNTAIN_WIDTH = 72;
export function worldLimit(size = 1) { return Math.max(0, MEADOW_HALF_SIZE - 1.5 * size); }
export function constrainToMeadow(position: { x: number; z: number }, size = 1) {
  const limit = worldLimit(size);
  position.x = Math.max(-limit, Math.min(limit, position.x));
  position.z = Math.max(-limit, Math.min(limit, position.z));
}
export function insideMeadow(position: { x: number; z: number }, size = 1) {
  const limit = worldLimit(size);
  return Math.abs(position.x) <= limit && Math.abs(position.z) <= limit;
}
