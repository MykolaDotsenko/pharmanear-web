import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createSiteServer } from '../server.mjs';
import { securityHeaders } from '../scripts/site.mjs';

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
    assert.equal((await fetch(`${origin}/src/../server.mjs`)).status, 404);
    assert.equal((await fetch(`${origin}/%2e%2e/server.mjs`)).status, 404);
  });
});

test('unsupported methods are rejected with an Allow header', async () => {
  await withServer(async origin => {
    const response = await fetch(`${origin}/`, { method: 'POST' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
  });
});
