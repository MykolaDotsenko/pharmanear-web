import { readFile } from 'node:fs/promises';

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
