import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FollowCamera } from '../src/follow-camera';
const settle = (c: FollowCamera, yaw = 0, moving = false) => {
  for (let i = 0; i < 240; i++) c.update(1 / 60, yaw, moving, 0, 0);
};
test('heading steps are smoothed and settle after turning stops; wrap uses shortest path', () => {
  const c = new FollowCamera(), yaw = Math.PI / 18;
  c.update(1 / 60, yaw, true, 0, 0);
  assert(c.azimuth > Math.PI && c.azimuth < Math.PI + yaw / 2);
  settle(c, yaw);
  assert(Math.abs(c.azimuth - Math.PI - yaw) < 1e-8);
  c.reset(Math.PI - .01);
  const previous = c.azimuth;
  c.update(1 / 60, -Math.PI + .01, true, 0, 0);
  assert(c.azimuth > previous && c.azimuth - previous < .01);
});
test('mouse and arrows orbit at rest, movement smoothly returns behind', () => {
  const c = new FollowCamera();
  c.orbit(-120, 60); settle(c);
  assert(Math.abs(c.azimuth - Math.PI - .6) < 1e-8);
  assert(Math.abs(c.elevation - .55) < 1e-8);
  for (let i = 0; i < 60; i++) c.update(1 / 60, 0, false, 1, 0);
  settle(c);
  const manual = c.azimuth;
  c.update(1 / 60, 0, true, 0, 0);
  assert(c.azimuth < manual && manual - c.azimuth < .1);
  settle(c, 0, true);
  assert(Math.abs(c.azimuth - Math.PI) < .001);
});
test('held mouse preserves manual orbit even when the character turns', () => {
  const c = new FollowCamera();
  c.orbit(-100, 0); settle(c);
  const initial = c.azimuth;
  for (let i = 0; i < 120; i++) c.update(1 / 60, i * .03, true, 0, 0, true);
  assert(Math.abs(c.azimuth - initial) < 1e-8);
});
test('zoom and pitch are bounded, eased, and reset restores defaults', () => {
  const c = new FollowCamera();
  for (let i = 0; i < 20; i++) c.zoom(-1000);
  c.orbit(0, 10000); c.update(1 / 60, 0, false, 0, 0);
  assert(c.distance < 10 && c.distance > 5);
  settle(c);
  assert(Math.abs(c.distance - 5) < 1e-8);
  assert(c.elevation <= 1.25);
  for (let i = 0; i < 20; i++) c.zoom(1000);
  settle(c);
  assert(Math.abs(c.distance - 24) < 1e-8);
  c.reset(2);
  assert.equal(c.azimuth, 2 + Math.PI);
  assert.equal(c.elevation, .25); assert.equal(c.distance, 10);
});
