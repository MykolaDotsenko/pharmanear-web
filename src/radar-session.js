import { degrees, movementHeading, orientationHeading, smoothHeading } from './radar-geometry.js';

export function requestCompass() {
  const api = globalThis.DeviceOrientationEvent;
  if (typeof api?.requestPermission !== 'function') return Promise.resolve(Boolean(api));
  try {
    return api.requestPermission(true).then(
      value => value === 'granted',
      () => false,
    );
  } catch {
    return Promise.resolve(false);
  }
}

// Each session owns its own watch and listeners. No samples leave this module except to its view.
export function createRadarSession({
  onChange,
  geo = navigator.geolocation,
  compass = Promise.resolve(false),
}) {
  let closed = false;
  let watch = null;
  let generation = 0;
  let position = null;
  let anchor = null;
  let heading = null;
  let motion = null;
  let motionAt = 0;
  let timer;
  let fixTimer;
  let compassAllowed = false;
  let status = 'locating';
  let wake = null;
  let waking = false;
  const publish = () => {
    if (!closed)
      onChange({
        position,
        status,
        heading: heading ?? motion,
        mode: heading !== null ? 'compass' : motion !== null ? 'motion' : 'north',
      });
  };
  async function holdScreen() {
    if (closed || document.hidden || wake || waking || !position) return;
    waking = true;
    try {
      const lock = await navigator.wakeLock?.request('screen');
      if (closed || document.hidden) await lock?.release();
      else {
        wake = lock;
        lock?.addEventListener('release', () => {
          if (wake === lock) wake = null;
        });
      }
    } catch {
      // Wake lock is optional.
    } finally {
      waking = false;
    }
  }
  function orientation(event) {
    if (closed || document.hidden || !compassAllowed) return;
    const next = orientationHeading(event, screen.orientation?.angle ?? window.orientation ?? 0);
    if (next !== null) {
      heading = smoothHeading(heading, next);
      publish();
    }
  }
  function stopWatch() {
    generation++;
    if (watch !== null) geo?.clearWatch(watch);
    watch = null;
    clearTimeout(timer);
    clearTimeout(fixTimer);
    anchor = null;
    motion = null;
    heading = null;
    const lock = wake;
    wake = null;
    void lock?.release().catch(() => {});
  }
  function start() {
    if (closed || document.hidden || watch !== null) return;
    status = position ? 'stale' : 'locating';
    publish();
    if (!geo?.watchPosition) {
      status = 'denied';
      publish();
      return;
    }
    const run = ++generation;
    watch = geo.watchPosition(
      fix => {
        if (closed || run !== generation || document.hidden) return;
        const { latitude: lat, longitude: lon, accuracy, speed, heading: course } = fix.coords;
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lon) ||
          Math.abs(lat) > 90 ||
          Math.abs(lon) > 180 ||
          !Number.isFinite(accuracy) ||
          accuracy < 0
        )
          return;
        const next = { lat, lon, accuracy, timestamp: fix.timestamp };
        const fresh = anchor && Math.abs(next.timestamp - anchor.timestamp) <= 15000;
        const direction =
          Number.isFinite(course) && Number.isFinite(speed) && speed >= 0.5 && accuracy <= 30
            ? degrees(course)
            : fresh
              ? movementHeading(anchor, next)
              : null;
        if (!fresh || direction !== null) anchor = next;
        if (direction !== null) {
          motion = smoothHeading(motion, direction, 0.32);
          motionAt = Date.now();
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (Date.now() - motionAt >= 15000) {
              motion = null;
              publish();
            }
          }, 15000);
        }
        position = next;
        status = 'active';
        clearTimeout(fixTimer);
        fixTimer = setTimeout(() => {
          status = 'stale';
          publish();
        }, 15000);
        publish();
        void holdScreen();
      },
      error => {
        if (closed || run !== generation) return;
        if (error.code === 1) {
          stopWatch();
          position = null;
          status = 'denied';
        } else status = position ? 'stale' : 'unavailable';
        publish();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1500 },
    );
  }
  function visibility() {
    if (document.hidden) {
      stopWatch();
      status = 'paused';
      publish();
    } else start();
  }
  window.addEventListener('deviceorientationabsolute', orientation);
  window.addEventListener('deviceorientation', orientation);
  document.addEventListener('visibilitychange', visibility);
  compass.then(allowed => {
    if (!closed) compassAllowed = allowed;
  });
  start();
  return {
    close() {
      closed = true;
      stopWatch();
      position = null;
      window.removeEventListener('deviceorientationabsolute', orientation);
      window.removeEventListener('deviceorientation', orientation);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
