import { createSiteServer } from './scripts/site.mjs';

const port = Number(process.env.PORT ?? 4173);
const server = await createSiteServer();
server.listen(port, '127.0.0.1', () => console.log(`PharmaNear running at http://127.0.0.1:${port}`));
