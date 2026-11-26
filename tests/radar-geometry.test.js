import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bearing,
  degrees,
  smoothHeading,
  orientationHeading,
  movementHeading,
  radarRange,
  radarPoint,
  isNear,
  rankedTargets,
} from '../src/radar-geometry.js';

test('cardinal bearings and north wrap', () => {
  const origin = { lat: 0, lon: 0 };
  assert.equal(bearing(origin, { lat: 1, lon: 0 }), 0);
  assert.equal(bearing(origin, { lat: 0, lon: 1 }), 90);
  assert.equal(bearing(origin, origin), null);
  assert.equal(degrees(null), null);
  assert.equal(smoothHeading(359, 1, 0.5), 0);
});

test('only absolute orientation is accepted; screen rotation is accounted for', () => {
  assert.equal(orientationHeading({ alpha: 30, absolute: false }), null);
  assert.equal(orientationHeading({ alpha: 30, absolute: true }, 90), 60);
  assert.equal(orientationHeading({ webkitCompassHeading: 270 }, 90), 0);
});

test('GPS jitter is not a direction', () => {
  const a = { lat: 60, lon: 22, accuracy: 20 };
  assert.equal(movementHeading(a, { ...a, lat: 60.00001 }), null);
  assert.equal(movementHeading(a, { ...a, lat: 60.001, accuracy: 50 }), null);
  assert.equal(movementHeading(a, { ...a, lat: 60.001 }), 0);
});

test('range hysteresis, edge clipping and near-area accuracy', () => {
  assert.equal(radarRange(30), 50);
  assert.equal(radarRange(70), 100);
  assert.equal(radarRange(70, 200), 200);
  assert.equal(radarRange(60, 200), 100);
  assert.deepEqual(radarPoint(90, 90, 200, 100), { x: 50, y: 9, clipped: true });
  assert.equal(isNear(20, 80), false);
  assert.equal(isNear(35, 35, true), true);
  assert.equal(isNear(20, null), false);
});

test('selected target stays available outside nearest eight', () => {
  const points = Array.from({ length: 10 }, (_, i) => ({ id: String(i), lat: 60 + i / 100, lon: 22 }));
  const targets = rankedTargets(points, { lat: 60, lon: 22 }, '9');
  assert.equal(targets.length, 9);
  assert.equal(targets.at(-1).id, '9');
});
