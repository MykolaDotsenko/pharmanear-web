import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchController } from '../src/search-controller.js';
import { fetchPharmacies } from '../src/provider.js';

const fixture = {
  elements: [{ type: 'node', id: 1, lat: 60.452, lon: 22.267, tags: { amenity: 'pharmacy' } }],
};

test('search publishes a coherent loading and result snapshot', async () => {
  const states = [];
  const controller = createSearchController({ fetcher: async () => fixture, onChange: s => states.push(s) });
  await controller.city('Turku');
  assert.deepEqual(
    states.map(s => s.status),
    ['loading', 'found'],
  );
  assert.equal(controller.state.origin, 'Turku');
  assert.equal(controller.state.busy, false);
  assert.equal(controller.state.result.results.length, 1);
});

test('cancel prevents a late location callback from starting a search', () => {
  let callback,
    requests = 0;
  const controller = createSearchController({
    geolocation: {
      getCurrentPosition: success => {
        callback = success;
      },
    },
    fetcher: async () => {
      requests++;
      return fixture;
    },
  });
  controller.locate();
  controller.cancel();
  callback({ coords: { latitude: 60.45, longitude: 22.27 } });
  assert.equal(controller.state.status, 'cancelled');
  assert.equal(requests, 0);
});

test('new search supersedes an old response', async () => {
  let release;
  const controller = createSearchController({
    fetcher: query =>
      query.includes('60.45,22.27')
        ? new Promise(r => {
            release = r;
          })
        : Promise.resolve({ elements: [] }),
  });
  const first = controller.city('Turku');
  await controller.city('Helsinki');
  release(fixture);
  await first;
  assert.equal(controller.state.status, 'empty');
  assert.equal(controller.state.origin, 'Helsinki');
});

test('retry repeats selected city and recovers after provider failure', async () => {
  let fail = true;
  const controller = createSearchController({
    fetcher: async () => {
      if (fail) throw Error('offline');
      return fixture;
    },
  });
  await controller.city('Turku');
  assert.equal(controller.state.status, 'error');
  fail = false;
  await controller.retry();
  assert.equal(controller.state.status, 'found');
});

test('geolocation denial leaves a coherent non-busy state', () => {
  const controller = createSearchController({
    fetcher: async () => fixture,
    geolocation: { getCurrentPosition: (_, failure) => failure() },
  });
  controller.locate();
  assert.equal(controller.state.status, 'denied');
  assert.equal(controller.state.busy, false);
});

test('transport checks HTTP status and never includes credentials', async () => {
  await assert.rejects(
    fetchPharmacies('query', new AbortController().signal, async (url, options) => {
      assert.equal(options.credentials, 'omit');
      assert.equal(options.body.get('data'), 'query');
      return { ok: false, status: 503 };
    }),
    /503/,
  );
});

test('transport propagates cancellation to fetch', async () => {
  const c = new AbortController();
  const result = fetchPharmacies(
    'query',
    c.signal,
    (_, options) =>
      new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      }),
  );
  c.abort();
  await assert.rejects(result, { name: 'AbortError' });
});

test('transport switches providers after a 503', async () => {
  const calls = [];
  const data = await fetchPharmacies('query', new AbortController().signal, async (url, options) => {
    calls.push(url);
    assert.equal(options.body.get('data'), 'query');
    return calls.length === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => fixture };
  });
  assert.deepEqual(data, fixture);
  assert.deepEqual(calls, [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ]);
});
test('transport respects rate limits and never falls back after a 429', async () => {
  let calls = 0;
  await assert.rejects(
    fetchPharmacies('query', new AbortController().signal, async () => {
      calls++;
      return { ok: false, status: 429 };
    }),
    /429/,
  );
  assert.equal(calls, 1);
});
test('transport tries backup for partial provider data, not a valid empty result', async () => {
  let calls = 0;
  const data = await fetchPharmacies('query', new AbortController().signal, async () => ({
    ok: true,
    json: async () => (++calls === 1 ? { elements: [], remark: 'timeout' } : { elements: [] }),
  }));
  assert.deepEqual(data, { elements: [] });
  assert.equal(calls, 2);
  calls = 0;
  await fetchPharmacies('query', new AbortController().signal, async () => {
    calls++;
    return { ok: true, json: async () => ({ elements: [] }) };
  });
  assert.equal(calls, 1);
});
