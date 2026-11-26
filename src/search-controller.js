import { cities, search } from './core.js';

/**
 * Owns one search operation and one immutable UI snapshot.
 * No DOM, network globals, or persisted coordinates. Dependencies are injected.
 */
export function createSearchController({ fetcher, geolocation, onChange = () => {} }) {
  let state = Object.freeze({ status: 'idle', result: null, origin: '', busy: false, canRetry: false });
  let active = null;
  let lastAction = null;

  function publish(status, origin = '', result = null) {
    state = Object.freeze({
      status, origin, result,
      busy: status === 'loading' || status === 'locating',
      canRetry: lastAction !== null,
    });
    onChange(state);
  }

  function begin(status, origin) {
    active?.abort();
    const job = new AbortController();
    active = job;
    publish(status, origin);
    return job;
  }

  function finish(job, status, origin, result = null) {
    if (active !== job) return;
    active = null;
    publish(status, origin, result);
  }

  async function run(job, point, origin) {
    if (active !== job) return;
    if (state.status !== 'loading') publish('loading', origin);
    try {
      const result = await search(point, fetcher, job.signal);
      finish(job, result.results.length ? 'found' : 'empty', origin, result);
    } catch {
      finish(job, 'error', origin);
    }
  }

  function city(name) {
    if (!Object.hasOwn(cities, name)) return;
    lastAction = () => city(name);
    return run(begin('loading', name), cities[name], name);
  }

  function locate() {
    lastAction = locate;
    const job = begin('locating', 'device');
    if (!geolocation) {
      finish(job, 'denied', 'device');
      return;
    }
    try {
      geolocation.getCurrentPosition(
        position => run(job, { lat: position.coords.latitude, lon: position.coords.longitude }, 'device'),
        () => finish(job, 'denied', 'device'),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 },
      );
    } catch {
      finish(job, 'denied', 'device');
    }
  }

  function cancel() {
    active?.abort();
    active = null;
    publish('cancelled');
  }

  return { get state() { return state; }, city, locate, cancel, retry: () => lastAction?.() };
}
