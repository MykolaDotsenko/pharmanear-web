import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupPharmacies, searchCatalog } from '../src/catalog.js';

const point = { lat: 60.4518, lon: 22.2666 };
const sourceDate = '2026-11-25T00:00:00Z';
const now = () => Date.parse('2026-11-26T00:00:00Z');
const row = { type: 'node', id: 1, lat: 60.452, lon: 22.267, tags: { amenity: 'pharmacy', name: 'Test fixture only' } };
const catalog = { schema: 1, region: 'FI', license: 'ODbL-1.0', sourceDate, elements: [row] };

test('local search returns dated mapped results without calling live providers', async () => {
  const result = await lookupPharmacies(point, undefined, { load: async () => catalog, live: () => assert.fail('live request'), now });
  assert.equal(result.results[0].id, 'node/1');
  assert.equal(result.source, 'catalog');
  assert.equal(result.sourceDate, sourceDate);
  assert.equal(result.covered, false);
});
test('stale or invalid snapshots do not produce results', () => {
  assert.throws(() => searchCatalog(catalog, point, Date.parse('2027-02-01')));
  assert.throws(() => searchCatalog({ ...catalog, license: 'unknown' }, point, now()));
});
test('outside catalog radius invokes live lookup', async () => {
  let calls = 0;
  const result = await lookupPharmacies({ lat: 65, lon: 25 }, undefined, { load: async () => catalog, now, live: () => { calls++; return { results: [] }; } });
  assert.equal(calls, 1);
  assert.deepEqual(result.results, []);
});
test('cancelled catalog download never starts live lookup', async () => {
  const controller = new AbortController();
  await assert.rejects(lookupPharmacies(point, controller.signal, {
    load: async () => { controller.abort(); throw Error('cancelled'); },
    live: () => assert.fail('live request'), now,
  }), { name: 'AbortError' });
});
