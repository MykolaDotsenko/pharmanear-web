import test from 'node:test';
import assert from 'node:assert/strict';
import { ease, flightAt } from '../src/sleigh.js';

const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance);

test('the flight starts at the name, ends at the action and rises above both in between', () => {
  const start = { x: 300, y: 200 };
  const end = { x: 1100, y: 260 };
  near(flightAt(start, end, 0).x, 300);
  near(flightAt(start, end, 0).y, 200);
  near(flightAt(start, end, 1).x, 1100);
  near(flightAt(start, end, 1).y, 260);
  assert.ok(flightAt(start, end, 0.5).y < 200, 'the sleigh climbs over the card');
  assert.equal(flightAt(start, end, 0.5).leftwards, false);
});

test('it never climbs above the ceiling, never noses over, and faces the way it flies', () => {
  const start = { x: 300, y: 40 };
  const end = { x: 1100, y: 60 };
  for (let t = 0; t <= 1; t += 0.05) {
    const point = flightAt(start, end, t, 30);
    assert.ok(point.y >= 30 - 1e-9, `y ${point.y} at ${t}`);
    assert.ok(Math.abs(point.angle) <= 22);
  }
  // Leftwards, as on a phone where the action is under the start of the name.
  const back = flightAt({ x: 280, y: 200 }, { x: 80, y: 420 }, 0.5);
  assert.equal(back.leftwards, true);
  assert.ok(Math.abs(back.angle) <= 22);
});

test('the easing starts and ends gently and is symmetric', () => {
  near(ease(0), 0);
  near(ease(1), 1);
  near(ease(0.5), 0.5);
  near(ease(0.25) + ease(0.75), 1);
  assert.ok(ease(0.1) < 0.1);
});
