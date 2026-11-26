// Pure geographic calculations and search rules. No DOM or network access.
const EARTH_RADIUS_METERS = 6_371_008.8;
export const radii = Object.freeze([3000, 10000, 30000]);
export const cities = Object.freeze({
  Turku: Object.freeze({ lat: 60.4518, lon: 22.2666 }),
  Helsinki: Object.freeze({ lat: 60.1699, lon: 24.9384 }),
  Tampere: Object.freeze({ lat: 61.4978, lon: 23.761 }),
  Oulu: Object.freeze({ lat: 65.0121, lon: 25.4651 }),
  Vaasa: Object.freeze({ lat: 63.0951, lon: 21.6165 }),
});

export function validPoint(point) {
  return Boolean(
    point &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lon) &&
      Math.abs(point.lat) <= 90 &&
      Math.abs(point.lon) <= 180,
  );
}

export function approximate(point) {
  if (!validPoint(point)) throw new RangeError('Invalid geographic point');
  return { lat: Math.round(point.lat * 100) / 100, lon: Math.round(point.lon * 100) / 100 };
}

export function distance(from, to) {
  const radians = degrees => (degrees * Math.PI) / 180;
  const latitude = radians(to.lat - from.lat);
  const longitude = radians(to.lon - from.lon);
  const haversine =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(longitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.max(0, Math.min(1, haversine))));
}

export function query(center, radius) {
  if (!validPoint(center) || !radii.includes(radius)) throw new RangeError('Invalid search area');
  return `[out:json][timeout:15];nwr["amenity"="pharmacy"](around:${radius},${center.lat},${center.lon});out center;`;
}

function pharmacyFromElement(element, origin) {
  if (!element || typeof element !== 'object') return null;
  const point = { lat: element.lat ?? element.center?.lat, lon: element.lon ?? element.center?.lon };
  const tags = element.tags;
  if (
    !validPoint(point) ||
    !['node', 'way', 'relation'].includes(element.type) ||
    !Number.isSafeInteger(element.id) ||
    tags?.amenity !== 'pharmacy'
  )
    return null;

  return {
    id: `${element.type}/${element.id}`,
    ...point,
    name: typeof tags.name === 'string' ? tags.name : '',
    address: [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']]
      .filter(value => typeof value === 'string')
      .join(' '),
    hours: typeof tags.opening_hours === 'string' ? tags.opening_hours.trim().slice(0, 240) : '',
    distance: distance(origin, point),
  };
}

function comparePharmacies(left, right) {
  if (left.distance !== right.distance) return left.distance - right.distance;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function normalize(payload, origin) {
  if (!validPoint(origin)) throw new RangeError('Invalid origin');
  if (!Array.isArray(payload?.elements) || payload.remark) throw new Error('Incomplete provider response');
  const unique = new Map();
  for (const element of payload.elements) {
    const pharmacy = pharmacyFromElement(element, origin);
    if (pharmacy && !unique.has(pharmacy.id)) unique.set(pharmacy.id, pharmacy);
  }
  return [...unique.values()].sort(comparePharmacies);
}

/** A rounded search area proves nearest mapped coverage only strictly inside its boundary. */
function coversNearest(results, radius, roundingOffset) {
  return results.length > 0 && results[0].distance + roundingOffset < radius;
}

export async function search(origin, fetcher, signal) {
  const center = approximate(origin);
  const roundingOffset = distance(origin, center);
  let results = [];
  for (const radius of radii) {
    signal?.throwIfAborted();
    const payload = await fetcher(query(center, radius), signal);
    signal?.throwIfAborted();
    results = normalize(payload, origin);
    if (coversNearest(results, radius, roundingOffset)) return { results, radius, covered: true };
  }
  return { results, radius: radii.at(-1), covered: false };
}

export function mapsUrl(point) {
  if (!validPoint(point)) throw new RangeError('Invalid map point');
  const url = new URL('https://www.openstreetmap.org/');
  url.searchParams.set('mlat', String(point.lat));
  url.searchParams.set('mlon', String(point.lon));
  url.hash = `map=18/${point.lat}/${point.lon}`;
  return url.href;
}

/** Only the selected pharmacy's coordinates are sent, not the search origin. */
export function embedUrl(point) {
  if (!validPoint(point)) throw new RangeError('Invalid map point');
  const lonDelta = Math.min(0.08, 0.008 / Math.max(0.1, Math.cos((point.lat * Math.PI) / 180)));
  const bounds = [
    Math.max(-180, point.lon - lonDelta),
    Math.max(-85.05, Math.min(85.04, point.lat - 0.008)),
    Math.min(180, point.lon + lonDelta),
    Math.max(-85.04, Math.min(85.05, point.lat + 0.008)),
  ];
  const url = new URL('https://www.openstreetmap.org/export/embed.html');
  url.search = new URLSearchParams({
    bbox: bounds.join(','),
    layer: 'mapnik',
    marker: [point.lat, point.lon].join(','),
  }).toString();
  return url.href;
}
