# PharmaNear — Web

A small, independent pharmacy finder built as a Treat Health engineering application exercise. Not affiliated with Treat Health and not medical advice.

## What it does
- On explicit request, obtains a device position; alternatively search from one of five Finnish city centres.
- Queries OpenStreetMap pharmacies via Overpass, expanding the search from 3 km to 10 km to 30 km if needed.
- Calculates great-circle distances on the device and presents the closest returned mapped pharmacies first (up to 20 displayed).
- Opens a selected pharmacy in a map application/site; supports English, Finnish and Swedish.
- Handles permission denial, loading, cancellation, empty results, and provider failures without displaying stale search results.

## Privacy and limitations
No account, analytics, location history or persistent application storage. The search sends a coordinate rounded to two decimal places (not anonymous; the external provider also receives normal network metadata, including IP address). The device-provided position is retained in memory during the search and used for distance calculation. Location precision depends on the OS/browser; distances are straight-line estimates, not travel distance. Map links only open on request and are external services with their own privacy policies. OpenStreetMap may be incomplete, and building centres may differ from entrances. The nearest result means nearest returned mapped location within the bounded search, not a guarantee of the nearest real-world pharmacy. No opening-hours claims are made. Public Overpass is best-effort, not an SLA-backed production service. Production rollout would require a reviewed EU-hosted provider or self-hosted dataset, rate limiting, monitoring and licensing review. See [ADR](docs/0001-search-and-privacy.md).

Data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. No OSM data is bundled.

## Run locally
Node.js 20+; no dependency installation required.

```sh
npm test
npm start
```

Open http://localhost:4173. Geolocation requires HTTPS or localhost. A static HTTPS deployment can serve `index.html` and `src/` as-is. No API keys are required. The local server binds to loopback and uses a restrictive CSP.

## Structure
- `src/core.js`: distance, normalization, bounded search and map links.
- `src/app.js`: browser UI, localized text, location permission and request cancellation.
- `src/style.css`: responsive interface.
- `tests/core.test.js`: dependency-free Node test runner.
- `.github/workflows/ci.yml`: automated checks on pushes and pull requests.

## Verification
The original core implementation reported nine passing tests. The refreshed UI adds five Playwright scenarios with mocked Overpass responses; check the current GitHub Actions run for actual results. Live Overpass requests, independent accessibility review and real-device checks remain pending. Run the manual checklist before submission.

## Engineering process
AI-assisted implementation was used. See [review checklist and limitations](docs/review.md). This is an initial candidate deliverable, not a claim of production certification.

## Design
The 2026 refresh draws on Finnish functionalism: paper and pine tones, an editorial serif heading, a decorative abstract contour illustration (not a geographic map), restrained motion, dark mode, numbered result rows and responsive controls. No tracking, web fonts or image requests. Motion respects reduced-motion preferences.

Run browser tests after installing the pinned test-only dependency:
```sh
npm install --no-save --package-lock=false @playwright/test@1.56.1 axe-core@4.10.3
npx playwright install chromium
npx playwright test --config e2e/playwright.config.js
```

## Map and hours
Select Map preview to load an interactive OpenStreetMap view for that pharmacy. The list works without it. Community-sourced schedules are explicitly unverified; use the linked Apteekki.fi directory to confirm. See the CI artifact `web-ui-evidence` for generated desktop/mobile screenshots using synthetic test data. Vercel uses `node scripts/build.mjs` to publish only static application files.

Automated axe checks target serious/critical WCAG A/AA issues on the idle and results screens; a manual conformance review remains necessary.

## Verification evidence
- [Passing Web CI run](https://github.com/MykolaDotsenko/pharmanear-web/actions/runs/45821510171) — 12 unit tests, nine browser tests (including axe) and static build.
- [Desktop/mobile screenshots from CI (ZIP artifact)](https://github.com/MykolaDotsenko/pharmanear-web/actions/runs/45821510171/artifacts/15117962502) — synthetic pharmacy data; GitHub sign-in and artifact retention may apply.
- [Hosted demo](https://pharmanear-web.vercel.app).
- Live provider smoke is deliberately separate from deterministic tests. Run the **Live pharmacy provider smoke** workflow manually when needed, not on every commit. It performs one public Turku city-centre search; provider downtime or CORS failure is recorded as a failed smoke check, not hidden by mocks.
