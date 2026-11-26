import { distance, validPoint } from './core.js';

export const ranges = [50, 100, 200, 400, 800, 1200, 2000, 5000, 10000, 30000];
export function degrees(value) {
  return Number.isFinite(value) ? ((value % 360) + 360) % 360 : null;
}

export function bearing(from, to) {
  if (!validPoint(from) || !validPoint(to)) return null;
  if (distance(from, to) < 0.01) return null;
  const rad = value => (value * Math.PI) / 180;
  const a = rad(from.lat);
  const b = rad(to.lat);
  const delta = rad(to.lon - from.lon);
  return degrees(
    (Math.atan2(
      Math.sin(delta) * Math.cos(b),
      Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(delta),
    ) *
      180) /
      Math.PI,
  );
}

export function smoothHeading(previous, next, factor = 0.24) {
  const angle = degrees(next);
  if (angle === null) return degrees(previous);
  if (degrees(previous) === null) return angle;
  return degrees(previous + (((angle - previous + 540) % 360) - 180) * factor);
}

export function orientationHeading(event, screenAngle = 0) {
  const heading = Number.isFinite(event.webkitCompassHeading)
    ? event.webkitCompassHeading
    : event.absolute === true && Number.isFinite(event.alpha)
      ? 360 - event.alpha
      : null;
  return heading === null ? null : degrees(heading + (Number.isFinite(screenAngle) ? screenAngle : 0));
}

export function movementHeading(previous, next) {
  if (!validPoint(previous) || !validPoint(next)) return null;
  if (!Number.isFinite(previous.accuracy) || !Number.isFinite(next.accuracy)) return null;
  const accuracy = Math.max(previous.accuracy, next.accuracy);
  if (accuracy < 0 || accuracy > 30 || distance(previous, next) < Math.max(8, accuracy)) return null;
  return bearing(previous, next);
}

export function radarRange(meters, current = null) {
  if (!Number.isFinite(meters) || meters < 0) return current ?? 200;
  const fit = ranges.find(range => range >= meters * 1.25) ?? ranges.at(-1);
  if (!ranges.includes(current) || fit >= current) return fit;
  return ranges.find(range => range >= fit && range < current && meters <= (range * 2) / 3) ?? current;
}

export function radarPoint(angle, heading, meters, range) {
  if (degrees(angle) === null || !Number.isFinite(meters) || meters < 0 || !(range > 0)) return null;
  const rad = ((angle - (degrees(heading) ?? 0)) * Math.PI) / 180;
  const r = Math.min(meters / range, 1) * 41;
  return { x: 50 + r * Math.sin(rad), y: 50 - r * Math.cos(rad), clipped: meters > range };
}

export function isNear(meters, accuracy, wasNear = false) {
  const limit = wasNear ? 40 : 30;
  return (
    Number.isFinite(meters) &&
    meters >= 0 &&
    meters <= limit &&
    Number.isFinite(accuracy) &&
    accuracy >= 0 &&
    accuracy <= limit
  );
}

export function rankedTargets(pharmacies, position, targetId) {
  const ranked = pharmacies
    .filter(validPoint)
    .map(p => ({ ...p, distance: distance(position, p) }))
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
  const nearest = ranked.slice(0, 8);
  const target = ranked.find(p => p.id === targetId);
  return target && !nearest.some(p => p.id === targetId) ? [...nearest, target] : nearest;
}
