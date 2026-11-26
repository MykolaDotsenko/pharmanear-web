import { cp, mkdir, rm } from 'node:fs/promises';
import { root, siteEntries } from './site.mjs';

// Vercel publishes dist/ only, so nothing outside the site entries can be served.
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const entry of siteEntries) {
  await cp(new URL(entry, root), new URL(entry, dist), { recursive: true });
}
