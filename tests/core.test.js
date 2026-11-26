import test from 'node:test';
import assert from 'node:assert/strict';
import { distance, approximate, normalize, search, query, mapsUrl } from '../src/core.js';
const origin = { lat: 60.4518, lon: 22.2666 };
const pharmacy = (id, lat, lon, type = 'node') => ({
  id,
  type,
  ...(type === 'node' ? { lat, lon } : { center: { lat, lon } }),
  tags: { amenity: 'pharmacy', name: `Apteekki ${id}` },
});
test('distance identity and known meridian', () => {
  assert.equal(distance(origin, origin), 0);
  assert.ok(Math.abs(distance({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - 111195) < 1);
});
test('distance handles antimeridian', () =>
  assert.ok(distance({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 }) < 23000));
test('rounds coordinates and rejects invalid input', () => {
  assert.deepEqual(approximate(origin), { lat: 60.45, lon: 22.27 });
  assert.throws(() => approximate({ lat: 91, lon: 0 }));
});
test('normalizes nodes and ways, deduplicates, filters invalid coordinates and sorts', () => {
  const nearest = pharmacy(2, 60.452, 22.267, 'way');
  const r = normalize(
    {
      elements: [
        pharmacy(1, 60.48, 22.3),
        nearest,
        nearest,
        pharmacy(3, NaN, 22.2),
        { ...pharmacy(4, 60.45, 22.26), tags: { amenity: 'cafe' } },
      ],
    },
    origin,
  );
  assert.deepEqual(
    r.map(x => x.id),
    ['way/2', 'node/1'],
  );
});
test('rejects partial responses', () =>
  assert.throws(() => normalize({ elements: [], remark: 'timeout' }, origin)));
test('expands empty search, uses rounded location and stops when nearest is within coverage', async () => {
  const calls = [];
  const r = await search(origin, async q => {
    calls.push(q);
    return { elements: calls.length === 1 ? [] : [pharmacy(1, 60.46, 22.27)] };
  });
  assert.equal(calls.length, 2);
  assert.match(calls[0], /3000,60\.45,22\.27/);
  assert.equal(r.covered, true);
});
test('no results is bounded', async () => {
  let n = 0;
  const r = await search(origin, async () => {
    n++;
    return { elements: [] };
  });
  assert.equal(n, 3);
  assert.equal(r.covered, false);
});
test('pre-aborted search never calls provider', async () => {
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    search(origin, () => assert.fail(), c.signal),
    { name: 'AbortError' },
  );
});
test('query radius allowlist and map link', () => {
  assert.throws(() => query(origin, 1));
  assert.match(mapsUrl(origin), /^https:\/\/www\.openstreetmap\.org\//);
});

test('hours are bounded and invalid elements ignored', () => {
  const r = normalize(
    {
      elements: [
        null,
        undefined,
        { ...pharmacy(1, 60.45, 22.27), tags: { amenity: 'pharmacy', opening_hours: ' Mo-Fr 09:00-18:00 ' } },
      ],
    },
    origin,
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].hours, 'Mo-Fr 09:00-18:00');
});
test('aborted response cannot produce results', async () => {
  const c = new AbortController();
  await assert.rejects(
    search(
      origin,
      async () => {
        c.abort();
        return { elements: [pharmacy(1, 60.45, 22.27)] };
      },
      c.signal,
    ),
    { name: 'AbortError' },
  );
});
test('map embeds only selected pharmacy coordinates', async () => {
  const { embedUrl } = await import('../src/core.js');
  const u = new URL(embedUrl({ lat: 60.452, lon: 22.267 }));
  assert.equal(u.origin, 'https://www.openstreetmap.org');
  assert.equal(u.searchParams.get('marker'), '60.452,22.267');
  assert.throws(() => embedUrl({ lat: 100, lon: 0 }));
});

test('equal distances use a stable ID order independent of input order', () => {
  const rows = [pharmacy(2, origin.lat, origin.lon), pharmacy(1, origin.lat, origin.lon)];
  assert.deepEqual(
    normalize({ elements: rows }, origin).map(row => row.id),
    ['node/1', 'node/2'],
  );
});
test('invalid coordinates never generate map URLs or normalized results', () => {
  const invalid = { lat: 91, lon: 0 };
  assert.throws(() => mapsUrl(invalid), RangeError);
  assert.throws(() => normalize({ elements: [] }, invalid), RangeError);
});
test('invalid provider items do not corrupt valid results', () => {
  const good = pharmacy(7, origin.lat, origin.lon);
  const payload = { elements: [null, false, { type: 'node', id: 8, lat: 0, lon: 0, tags: [] }, good] };
  assert.equal(normalize(payload, origin).length, 1);
});
