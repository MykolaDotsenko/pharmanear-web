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
