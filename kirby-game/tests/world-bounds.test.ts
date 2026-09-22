import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MEADOW_HALF_SIZE, constrainToMeadow, insideMeadow } from '../src/world-bounds';
import { createMountains } from '../src/mountains';

test('meadow area is eight times larger and boundary contains large steps, corners and enlarged actors', () => {
  assert(Math.abs((2 * MEADOW_HALF_SIZE) ** 2 / 180 ** 2 - 8) < 1e-10);
  for (const size of [1, 5, 30, 1000]) for (const x of [-10000, 0, 10000]) for (const z of [-10000, 0, 10000]) {
    const p = { x, z }; constrainToMeadow(p, size); assert(insideMeadow(p, size));
  }
});
test('mountain range has a continuous square inner border, matching corners and upward faces', () => {
  const mesh = createMountains(), p = mesh.geometry.getAttribute('position'), n = mesh.geometry.getAttribute('normal');
  const row = 241, side = row * 41;
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < row; i++) {
      const id = s * side + i;
      assert(Math.abs(Math.max(Math.abs(p.getX(id)), Math.abs(p.getZ(id))) - MEADOW_HALF_SIZE) < .001);
      assert(Math.abs(p.getY(id) + .025) < .001);
    }
    for (let j = 0; j <= 40; j++) {
      const a = s * side + j * row + 240, b = ((s + 1) % 4) * side + j * row;
      assert(Math.abs(p.getX(a) - p.getX(b)) < .001);
      assert(Math.abs(p.getY(a) - p.getY(b)) < .001);
      assert(Math.abs(p.getZ(a) - p.getZ(b)) < .001);
    }
  }
  assert(n.getY(side / 2 | 0) > 0);
});
