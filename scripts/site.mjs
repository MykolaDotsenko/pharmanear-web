import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';

/** The repository root. */
export const root = new URL('../', import.meta.url);

/** Everything the static deployment publishes; the build and the local server share it. */
export const siteEntries = ['index.html', 'favicon.svg', 'src', 'data'];

/** Response headers for every path, read from the Vercel configuration so both stay identical. */
export async function securityHeaders() {
  const config = JSON.parse(await readFile(new URL('vercel.json', root), 'utf8'));
  const rule = config.headers.find(entry => entry.source === '/(.*)');
  return Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]));
}

const contentTypes = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
};

/** Maps every published file to its URL path. Anything else is a 404, so no path traversal. */
async function publishedFiles() {
  const routes = new Map();
  for (const entry of siteEntries) {
    const location = new URL(entry, root);
    const names = (await stat(location)).isDirectory()
      ? (await readdir(location, { recursive: true })).map(name => `${entry}/${name}`)
      : [entry];
    for (const name of names) {
      if (contentTypes[name.split('.').at(-1)]) routes.set(`/${name}`, name);
    }
  }
  routes.set('/', 'index.html');
  // Production rewrites this path to the latest catalog on main; locally it is the checkout's copy.
  routes.set('/data/current-finland-pharmacies.json', 'data/finland-pharmacies.json');
  return routes;
}

/** A loopback-only static server with the production security headers. */
export async function createSiteServer() {
  const [routes, headers] = await Promise.all([publishedFiles(), securityHeaders()]);

  return createServer(async (request, response) => {
    for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);

    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const file = routes.get(new URL(request.url, 'http://localhost').pathname);
    if (!file) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    try {
      const body = await readFile(new URL(file, root));
      response.writeHead(200, { 'Content-Type': contentTypes[file.split('.').at(-1)] });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Unavailable');
    }
  });
}
