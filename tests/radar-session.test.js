import test from 'node:test';
import assert from 'node:assert/strict';
import { createRadarSession } from '../src/radar-session.js';
import { requestCompass } from '../src/row-radar.js';

/** An event target that counts its listeners. */
function target(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    removeEventListener(type, listener) {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter(other => other !== listener),
      );
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
    listening: () => [...listeners.values()].reduce((sum, list) => sum + list.length, 0),
  };
}

/** A stand-in browser with a manual clock, a wake lock and a geolocation watch. */
function fakeBrowser() {
  let time = 0;
  let nextTimer = 1;
  const timers = new Map();
  const locks = [];
  const page = target({ hidden: false });
  const env = {
    document: page,
    window: target(),
    screen: { orientation: { angle: 0 } },
    wakeLock: {
      async request() {
        const lock = {
          released: false,
          async release() {
            lock.released = true;
          },
          addEventListener() {},
        };
        locks.push(lock);
        return lock;
      },
    },
    setTimeout(callback, delay) {
      timers.set(nextTimer, { at: time + delay, callback });
      return nextTimer++;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  const geo = {
    watches: 0,
    clears: 0,
    watchPosition(success, failure) {
      geo.watches++;
      geo.success = success;
      geo.failure = failure;
      return geo.watches;
    },
    clearWatch() {
      geo.clears++;
    },
  };
  return {
    env,
    geo,
    page,
    locks,
    advance(ms) {
      time += ms;
      for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at <= time && timers.has(id)) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
    fix(latitude = 60.45, longitude = 22.27, accuracy = 10) {
      geo.success({ timestamp: time, coords: { latitude, longitude, accuracy, speed: null, heading: null } });
    },
    setHidden(hidden) {
      page.hidden = hidden;
      page.dispatch('visibilitychange');
    },
  };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

function start(browser, options = {}) {
  const updates = [];
  const session = createRadarSession({
    onChange: next => updates.push(next),
    geo: browser.geo,
    env: browser.env,
    ...options,
  });
  return { session, updates, last: () => updates.at(-1) };
}

test('a fix makes the radar live, and fifteen silent seconds make it stale', () => {
  const browser = fakeBrowser();
  const { last } = start(browser);
  assert.equal(last().status, 'locating');
  browser.fix();
  assert.equal(last().status, 'active');
  assert.equal(last().position.accuracy, 10);
  browser.advance(14_999);
  assert.equal(last().status, 'active');
  browser.advance(1);
  assert.equal(last().status, 'stale');
  // The last position is kept, so the view can still say "near" to someone standing still.
  assert.equal(last().position.lat, 60.45);
});

test('a hidden page pauses the watch and releases the wake lock; showing it resumes', async () => {
  const browser = fakeBrowser();
  const { last } = start(browser);
  browser.fix();
  await settle();
  assert.equal(browser.locks.length, 1);
  browser.setHidden(true);
  assert.equal(last().status, 'paused');
  assert.equal(browser.geo.clears, 1);
  assert.equal(browser.locks[0].released, true);
  browser.setHidden(false);
  assert.equal(browser.geo.watches, 2);
  assert.equal(last().status, 'stale');
});

test('a denied location is final: the browser is never asked again', () => {
  const browser = fakeBrowser();
  const { last } = start(browser);
  browser.geo.failure({ code: 1 });
  assert.equal(last().status, 'denied');
  assert.equal(last().position, null);
  browser.setHidden(true);
  browser.setHidden(false);
  assert.equal(browser.geo.watches, 1);
  assert.equal(last().status, 'denied');
});

test('other location errors wait for a signal without ending the session', () => {
  const browser = fakeBrowser();
  const { last } = start(browser);
  browser.geo.failure({ code: 3 });
  assert.equal(last().status, 'unavailable');
  browser.fix();
  browser.geo.failure({ code: 2 });
  assert.equal(last().status, 'stale');
});

test('the compass counts only once allowed, and alone it does not redraw', async () => {
  const browser = fakeBrowser();
  let allow;
  const { updates, last } = start(browser, { compass: new Promise(resolve => (allow = resolve)) });
  browser.env.window.dispatch('deviceorientation', { webkitCompassHeading: 90 });
  const before = updates.length;
  allow(true);
  await settle();
  browser.env.window.dispatch('deviceorientation', { webkitCompassHeading: 90 });
  assert.equal(updates.length, before);
  browser.fix();
  assert.equal(last().mode, 'compass');
  assert.equal(last().heading, 90);
});

test('closing removes every listener, clears the watch and stops publishing', async () => {
  const browser = fakeBrowser();
  const { session, updates } = start(browser);
  browser.fix();
  await settle();
  session.close();
  assert.equal(browser.geo.clears, 1);
  assert.equal(browser.locks[0].released, true);
  assert.equal(browser.env.window.listening() + browser.page.listening(), 0);
  const count = updates.length;
  browser.advance(60_000);
  assert.equal(updates.length, count);
});

test('compass permission follows Safari’s answer and defaults to the API being present', async () => {
  assert.equal(await requestCompass(undefined), false);
  assert.equal(await requestCompass(function DeviceOrientationEvent() {}), true);
  assert.equal(await requestCompass({ requestPermission: async () => 'granted' }), true);
  assert.equal(await requestCompass({ requestPermission: async () => 'denied' }), false);
  assert.equal(
    await requestCompass({
      requestPermission: () => {
        throw new Error('not in a gesture');
      },
    }),
    false,
  );
});
