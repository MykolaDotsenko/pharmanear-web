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
