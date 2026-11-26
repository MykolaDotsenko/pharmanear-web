import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { get } from 'node:http';
import { createSiteServer, securityHeaders } from '../scripts/site.mjs';

async function withServer(run) {
  const server = await createSiteServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test('local responses carry exactly the production security headers', async () => {
  const expected = await securityHeaders();
  assert.match(expected['Content-Security-Policy'], /object-src 'none'/);
  await withServer(async origin => {
    const response = await fetch(`${origin}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/html/);
    for (const [name, value] of Object.entries(expected)) {
      assert.equal(response.headers.get(name), value, name);
    }
  });
});

test('only published files are served', async () => {
  await withServer(async origin => {
    assert.equal((await fetch(`${origin}/src/app.js`)).status, 200);
    assert.equal((await fetch(`${origin}/data/finland-pharmacies.json`)).status, 200);
    assert.equal((await fetch(`${origin}/data/current-finland-pharmacies.json`)).status, 200);
    assert.equal((await fetch(`${origin}/package.json`)).status, 404);
  });
});

/** Sends the path exactly as written; fetch would resolve the dot segments before sending. */
function rawStatus(origin, path) {
  const { hostname, port } = new URL(origin);
  return new Promise((resolve, reject) => {
    get({ hostname, port, path }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
}

test('dot segments cannot reach files outside the site', async () => {
  await withServer(async origin => {
    for (const path of [
      '/src/../server.mjs',
      '/../package.json',
      '/src/%2e%2e/package.json',
      '/%2e%2e/server.mjs',
    ]) {
      assert.equal(await rawStatus(origin, path), 404, path);
    }
  });
});

test('unsupported methods are rejected with an Allow header', async () => {
  await withServer(async origin => {
    const response = await fetch(`${origin}/`, { method: 'POST' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
  });
});
