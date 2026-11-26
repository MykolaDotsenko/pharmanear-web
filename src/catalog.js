import { normalize, search, validPoint } from './core.js';
import { fetchPharmacies } from './provider.js';

const catalogURL = './data/finland-pharmacies.json';
const maxRadius = 30_000;
const maxAgeDays = 30;
const refreshAgeDays = 7;
const dayMs = 86_400_000;

async function loadCatalog(url, signal) {
  const request = new AbortController();
  const cancel = () => request.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, 2500);
  try {
    const response = await fetch(url, {
      signal: request.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error('Catalog unavailable');
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export function searchCatalog(payload, origin, now = Date.now()) {
  const timestamp = Date.parse(payload?.sourceDate);
  const age = now - timestamp;
  if (
    payload?.schema !== 1 ||
    payload.region !== 'FI' ||
    payload.license !== 'ODbL-1.0' ||
    !Number.isFinite(timestamp) ||
    age < -86_400_000 ||
    age > maxAgeDays * 86_400_000 ||
    !Array.isArray(payload.elements) ||
    payload.elements.length < 1 ||
    !validPoint(origin)
  ) {
    throw new Error('Invalid or expired pharmacy catalog');
  }
  const results = normalize(payload, origin).filter(pharmacy => pharmacy.distance <= maxRadius);
  // The snapshot holds every mapped pharmacy in Finland, so its first result is the nearest
  // mapped one; unlike a bounded live query, the search area cannot hide a closer one.
  return {
    results,
    radius: maxRadius,
    covered: results.length > 0,
    source: 'catalog',
    sourceDate: payload.sourceDate,
  };
}

/** Search Finland's local snapshot first; use live data when it cannot serve the area. */
export async function lookupPharmacies(
  origin,
  signal,
  {
    load = () => loadCatalog(catalogURL, signal),
    refresh = () => loadCatalog('./data/current-finland-pharmacies.json', signal),
    live = (point, abortSignal) => search(point, fetchPharmacies, abortSignal),
    now = Date.now,
  } = {},
) {
  signal?.throwIfAborted();
  if (validPoint(origin) && origin.lat >= 59 && origin.lat <= 71 && origin.lon >= 19 && origin.lon <= 33) {
    try {
      let payload;
      try {
        payload = await load();
      } catch {
        signal?.throwIfAborted();
      }
      let validSnapshot = false;
      try {
        searchCatalog(payload, origin, now());
        validSnapshot = true;
      } catch {
        /* refresh invalid snapshots */
      }
      if (!validSnapshot || now() - Date.parse(payload.sourceDate) > refreshAgeDays * dayMs) {
        try {
          const latest = await refresh();
          searchCatalog(latest, origin, now());
          if (!validSnapshot || Date.parse(latest.sourceDate) > Date.parse(payload.sourceDate))
            payload = latest;
        } catch {
          signal?.throwIfAborted();
        }
      }
      signal?.throwIfAborted();
      const result = searchCatalog(payload, origin, now());
      if (result.results.length) return result;
    } catch {
      signal?.throwIfAborted();
    }
  }
  return live(origin, signal);
}
