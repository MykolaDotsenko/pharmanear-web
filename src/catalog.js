import { normalize, search, validPoint } from './core.js';
import { fetchPharmacies } from './provider.js';

const catalogURL = './data/finland-pharmacies.json';
const maxRadius = 30_000;
const maxAgeDays = 30;

export function searchCatalog(payload, origin, now = Date.now()) {
  const timestamp = Date.parse(payload?.sourceDate);
  const age = now - timestamp;
  if (payload?.schema !== 1 || payload.region !== 'FI' || payload.license !== 'ODbL-1.0'
      || !Number.isFinite(timestamp) || age < -86_400_000 || age > maxAgeDays * 86_400_000
      || !Array.isArray(payload.elements) || payload.elements.length < 1 || !validPoint(origin)) {
    throw new Error('Invalid or expired pharmacy catalog');
  }
  const results = normalize(payload, origin).filter(pharmacy => pharmacy.distance <= maxRadius);
  return { results, radius: maxRadius, covered: false, source: 'catalog', sourceDate: payload.sourceDate };
}

/** Search Finland's local snapshot first; use live data when it cannot serve the area. */
export async function lookupPharmacies(origin, signal, {
  load = async () => {
    const response = await fetch(catalogURL, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error('Catalog unavailable');
    return response.json();
  },
  live = (point, abortSignal) => search(point, fetchPharmacies, abortSignal),
  now = Date.now,
} = {}) {
  signal?.throwIfAborted();
  if (validPoint(origin) && origin.lat >= 59 && origin.lat <= 71 && origin.lon >= 19 && origin.lon <= 33) {
    try {
      const payload = await load();
      signal?.throwIfAborted();
      const result = searchCatalog(payload, origin, now());
      if (result.results.length) return result;
    } catch {
      signal?.throwIfAborted();
    }
  }
  return live(origin, signal);
}
