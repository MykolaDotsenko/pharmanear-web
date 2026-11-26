import { degrees, movementHeading, orientationHeading, smoothHeading } from './radar-geometry.js';

/**
 * Asks for compass access where the browser requires it (iOS Safari). Call it inside the click that starts
 * the radar: Safari shows its prompt only during a user gesture. Resolves to whether the compass may be read.
 */
export function requestCompass(api = globalThis.DeviceOrientationEvent) {
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

// A fix older than this is no longer live, and a direction of travel older than this is dropped.
const staleAfter = 15_000;

function browser() {
  return {
    document,
    window,
    screen: globalThis.screen,
    wakeLock: navigator.wakeLock,
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: id => clearTimeout(id),
  };
}

/**
 * One radar session: a high-accuracy location watch, compass listeners and a screen wake lock. All of it is
 * released by `close` and while the page is hidden; a denied location ends the session for good, so the
 * browser is never asked again. Samples go only to `onChange`. `env` stands in for the browser in tests.
 */
export function createRadarSession({
  onChange,
  geo = navigator.geolocation,
  compass = Promise.resolve(false),
  env = browser(),
}) {
  const { document: page, window: view } = env;
  let closed = false;
  let watch = null;
  let generation = 0;
  let position = null;
  let anchor = null;
  let heading = null;
  let motion = null;
  let motionTimer;
  let fixTimer;
  let compassAllowed = false;
  let status = 'locating';
  let wake = null;
  let waking = false;

  const publish = () => {
    if (closed) return;
    onChange({
      position,
      status,
      heading: heading ?? motion,
      mode: heading !== null ? 'compass' : motion !== null ? 'motion' : 'north',
    });
  };

  async function holdScreen() {
    if (closed || page.hidden || wake || waking || !position) return;
    waking = true;
    try {
      const lock = await env.wakeLock?.request('screen');
      if (closed || page.hidden || watch === null) await lock?.release();
      else {
        wake = lock;
        lock?.addEventListener('release', () => {
          if (wake === lock) wake = null;
        });
      }
    } catch {
      // The wake lock is optional: the radar still works if the screen may dim.
    } finally {
      waking = false;
    }
  }

  function orientation(event) {
    if (closed || page.hidden || !compassAllowed) return;
    const next = orientationHeading(event, env.screen?.orientation?.angle ?? view.orientation ?? 0);
    if (next === null) return;
    heading = smoothHeading(heading, next);
    // Without a position there is nothing to point at, so compass events alone do not redraw.
    if (position) publish();
  }

  function stopWatch() {
    generation++;
    if (watch !== null) geo?.clearWatch(watch);
    watch = null;
    env.clearTimeout(motionTimer);
    env.clearTimeout(fixTimer);
    anchor = null;
    motion = null;
    heading = null;
    const lock = wake;
    wake = null;
    void lock?.release().catch(() => {});
  }

  function fixed(fix, run) {
    if (closed || run !== generation || page.hidden) return;
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
    const recent = anchor && Math.abs(next.timestamp - anchor.timestamp) <= staleAfter;
    // The device's own course is trusted only when moving with a good fix; otherwise two fixes far enough
    // apart give the direction of travel.
    const direction =
      Number.isFinite(course) && Number.isFinite(speed) && speed >= 0.5 && accuracy <= 30
        ? degrees(course)
        : recent
          ? movementHeading(anchor, next)
          : null;
    if (!recent || direction !== null) anchor = next;
    if (direction !== null) {
      motion = smoothHeading(motion, direction, 0.32);
      env.clearTimeout(motionTimer);
      motionTimer = env.setTimeout(() => {
        motion = null;
        publish();
      }, staleAfter);
    }
    position = next;
    status = 'active';
    env.clearTimeout(fixTimer);
    fixTimer = env.setTimeout(() => {
      status = 'stale';
      publish();
    }, staleAfter);
    publish();
    void holdScreen();
  }

  function failed(error, run) {
    if (closed || run !== generation) return;
    if (error.code === 1) {
      stopWatch();
      position = null;
      status = 'denied';
    } else status = position ? 'stale' : 'unavailable';
    publish();
  }

  function start() {
    if (closed || page.hidden || watch !== null || status === 'denied') return;
    status = position ? 'stale' : 'locating';
    publish();
    if (!geo?.watchPosition) {
      status = 'denied';
      publish();
      return;
    }
    const run = ++generation;
    watch = geo.watchPosition(
      fix => fixed(fix, run),
      error => failed(error, run),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 1500 },
    );
  }

  function visibility() {
    if (status === 'denied') return;
    if (page.hidden) {
      stopWatch();
      status = 'paused';
      publish();
    } else start();
  }

  view.addEventListener('deviceorientationabsolute', orientation);
  view.addEventListener('deviceorientation', orientation);
  page.addEventListener('visibilitychange', visibility);
  compass.then(allowed => {
    if (!closed) compassAllowed = allowed;
  });
  start();

  return {
    close() {
      closed = true;
      stopWatch();
      position = null;
      view.removeEventListener('deviceorientationabsolute', orientation);
      view.removeEventListener('deviceorientation', orientation);
      page.removeEventListener('visibilitychange', visibility);
    },
  };
}
