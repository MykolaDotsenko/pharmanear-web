# Architecture

The browser app deliberately uses native ES modules, HTML and CSS; it has no UI framework or runtime dependencies.

- `app.js`: DOM presentation and event binding; holds only language, map and expansion UI state.
- `search-controller.js`: application state and lifetime of the current operation. Injected transport and geolocation; stale operations cannot publish.
- `core.js`: deterministic search geometry, normalization, ranking and map URLs.
- `provider.js`: HTTP transport, timeout, cancellation and status handling.
- `strings.js`: translated copy, separate from control flow.

Dependencies point inward from UI to controller and domain; transport is injected, not a singleton. No persistence of user coordinates, no global event bus, no unnecessary framework.

References: [MDN modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [Node test runner](https://nodejs.org/api/test.html).

Unit tests exercise the controller without a browser and transport without real network requests. Playwright exercises the actual UI. Live provider availability is a separate gate and was previously unsuccessful; this refactor does not claim to resolve provider downtime.

## Domain invariants
Named helpers isolate coordinate validation, OSM element conversion, deterministic ranking and search coverage. Coverage is relative to mapped points, not all real pharmacies. Keep the native ES module boundaries rather than introduce a framework or another abstraction. See [MDN JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) and [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).

## Remaining provider risk
Both live endpoints failed in the real-browser smoke test. A dated, licensed Finnish OSM extract from Geofabrik is a candidate for an independently refreshed local snapshot; no snapshot is bundled until acquisition, coverage and attribution are verified. Do not substitute fixtures for production data.

## Local catalog
`catalog.js` is the lookup policy: attempt a recent Finland extract locally, otherwise use the existing live provider. The static catalog is generated from the Geofabrik Finland PBF via Osmium, stores OSM object IDs, tags and point/area bounding-box centres, and is licensed ODbL 1.0. Its source date is visible in the UI. It does not claim complete coverage or current opening hours. A 30-day age limit prevents indefinite use of outdated data. No coordinates are sent for local lookup. The acquisition workflow is separate from runtime, and only validated real data may enter production. The catalog must be refreshed before expiry.

Weekly catalog acquisition validates date and count before a trusted scheduled job updates only the data file on main. Vercel serves refreshed data through a fixed same-origin rewrite; clients with a snapshot older than seven days try that route for at most 2.5 seconds, falling back to their bundled catalog until its 30-day expiry. The first scheduled publication still needs verification. No user coordinates are included in refresh requests.
