# PharmaNear — Web

A small, independent pharmacy finder for Finland, built as a Treat Health engineering exercise. Not
affiliated with Treat Health and not medical advice.

**Production:** https://pharmanear-web.vercel.app

## What it does

- Finds the closest mapped pharmacies to the device position (only after an explicit tap) or to one of five
  Finnish city centres.
- Searches a dated national OpenStreetMap catalog **on the device**: no coordinates leave the browser.
- Falls back to live Overpass queries only when the catalog cannot serve the area, sending a coordinate
  rounded to two decimals and widening from 3 to 10 to 30 km.
- Ranks by straight-line distance with the distance beside each name, shows up to 20 results (5 at first)
  and opens a pharmacy's map inside its row or on openstreetmap.org on request.
- Shows community-mapped opening hours in the interface language (`ma–pe 09.00–20.00`, `mån–fre 09:00–20:00`)
  and marks the rule for today in Finland, public holidays included. Mapped hours are labelled as unverified
  and never turned into an "open now" claim; a handful of pharmacies whose hours were checked against their
  own site show that date for ninety days. Rows without hours link to Apteekki.fi.
- A **Radar** button on every result opens, inside that card, a radar that points to it in a straight line, from live GPS and, where allowed,
  the compass. It explains itself before the browser asks for anything, gives no direction while the
  pharmacy is within the GPS uncertainty, never asks again after a denial, sends and stores nothing, and
  stops when closed or when the page is hidden.
- English, Finnish and Swedish, starting in the browser's preferred language; a light and dark theme that
  follows the system until you choose one; reduced motion.
- Depth and motion done by the browser: a frosted sticky header, result cards that arrive in sequence and
  follow the pointer with a soft light, an artwork that leans towards the pointer in 3D, an aurora and
  artwork that move with scrolling, a light that runs once round the closest result, a paper grain, smooth
  disclosures, and view transitions for the theme change and the first results. Each is progressive
  enhancement; reduced motion turns all of it off and forced colours keep every state visible.
- From 25 November to 6 January: a Christmas palette, a string of lights that twinkle on their own rhythms
  (with a button to switch them off), snowflakes that fly from the pointer over the artwork, and optional
  snowfall and a short
  _Jingle Bells_ (public domain), arranged for celesta, bass and chords with sleigh bells and a room reverb,
  synthesized live with the Web Audio API. Neither starts on its own, snow stays still with reduced motion,
  and no audio file or other asset is downloaded.
- Handles denied permission, slow or failed providers, cancellation and empty areas without ever showing a
  stale result.

## Data and privacy

The catalog is derived from the Geofabrik Finland extract, filtered to `amenity=pharmacy`, and refreshed every
Monday by GitHub Actions. Its source date is shown under _About these results_; a snapshot older than 30 days
is never used. See [data/README.md](data/README.md) and
[ADR 0002](docs/0002-local-catalog-and-weekly-refresh.md).

No account, analytics, cookies or location history; the only thing stored is the theme you pick, in this
browser. The live fallback and the optional
map are third-party services that receive normal network metadata, including the IP address. OpenStreetMap can
be incomplete, a building centre is not an entrance, and the nearest mapped pharmacy is not a guarantee of the
nearest real one. Production use would need an SLA-backed or self-hosted data source and a licensing review;
see [ADR 0001](docs/0001-search-and-privacy.md).

Data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

## Run locally

Node.js 20 or later; there are no runtime dependencies to install.

```sh
npm start        # http://127.0.0.1:4173, same security headers as production
npm test         # unit tests (Node test runner)
npm run build    # the static site Vercel publishes, in dist/
```

Browser tests use pinned, test-only packages that are not saved to the project:

```sh
npm install --no-save --package-lock=false @playwright/test@1.56.1 axe-core@4.10.3
npx playwright install chromium
npx playwright test --config e2e/playwright.config.js        # mocked network
npx playwright test --config e2e-live/playwright.config.js   # real catalog, live providers blocked
```

Formatting is checked in CI: `npm run format:check`, or `npm run format` to fix.

## Project layout

| Path                          | Responsibility                                                           |
| ----------------------------- | ------------------------------------------------------------------------ |
| `src/core.js`                 | Pure geometry, OSM normalization, ranking, coverage and map URLs         |
| `src/catalog.js`              | Local catalog lookup, freshness rules and refresh, live fallback         |
| `src/provider.js`             | Overpass transport: timeout, cancellation, one independent fallback      |
| `src/search-controller.js`    | Search lifecycle: one operation at a time, stale results never published |
| `src/app.js`                  | DOM rendering and search events                                          |
| `src/hours.js`                | Localized opening hours and the rule that applies today                  |
| `src/holidays.js`             | Today in Finland: weekday and public holidays                            |
| `src/theme.js`                | Theme toggle, its memory and the circular reveal                         |
| `src/effects.js`              | Decorative pointer depth and the results view transition                 |
| `src/festive.js`              | Seasonal lights, snowflakes, snowfall and melody, and their toggles      |
| `src/radar-*.js`, `radar.css` | Pharmacy radar: geometry, sensor session and view                        |
| `src/pharmacy-details.js`     | Checked sources for a few pharmacies, and possible duplicate entries     |
| `src/theme-init.js`           | Sets the theme and season before the first paint                         |
| `src/strings.js`              | English, Finnish and Swedish copy and the browser-language default       |
| `server.mjs`                  | Loopback development server using the headers in `vercel.json`           |
| `scripts/`                    | Static build, shared file list and the catalog converter                 |
| `tests/`, `e2e/`, `e2e-live/` | Unit, mocked browser and real-catalog browser tests                      |

[docs/architecture.md](docs/architecture.md) explains the dependency direction and the reasons behind it.

## Verification

Every push runs formatting, unit tests, Playwright tests (user flows, every axe WCAG 2.2 A/AA and
best-practice rule in light, dark, Christmas, Finnish, Swedish and 320 px layouts, keyboard order, an
accessibility-tree snapshot, text contrast on rendered pixels, forced colours, and an offline render of the
melody) and the production build. Separate workflows run the real catalog in a browser, rebuild the catalog weekly and check
the deployed data after each publication. [docs/review.md](docs/review.md) records what is verified
automatically and what still needs a person.

## Verification evidence

- [Web CI](https://github.com/MykolaDotsenko/pharmanear-web/actions/workflows/ci.yml): every run uploads the
  `web-ui-evidence` artifact with desktop, mobile and Christmas screenshots made from synthetic data.
- [Production pharmacy data smoke](https://github.com/MykolaDotsenko/pharmanear-web/actions/workflows/production-smoke.yml)
  checks both deployed catalog endpoints.
- [Live pharmacy provider smoke](https://github.com/MykolaDotsenko/pharmanear-web/actions/workflows/live-smoke.yml)
  checks the real bundled catalog in all five cities with Overpass blocked.
- Neither smoke workflow proves that the public Overpass endpoints are available.

## Engineering process

Implementation was AI-assisted; the author reviews every change. The checks above, not the tooling, are what
the claims in this document rest on.
