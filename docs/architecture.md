# Architecture

The app is native ES modules, HTML and CSS with no framework and no runtime dependencies. A page that finds a
pharmacy does not need more, and every dependency it avoids is one less thing to audit, update or ship.

## Modules and dependency direction

```
app.js ─┬─► search-controller.js ─► core.js
        ├─► catalog.js ─┬─────────► core.js
        │               └─► provider.js
        ├─► core.js            (map URLs)
        ├─► hours.js           (opening hours)
        ├─► festive.js         (lights, snow, melody)
        └─► strings.js

theme-init.js                  (classic script in <head>, before the first paint)
```

`app.js` passes `catalog.js`'s lookup to the controller, so the controller never imports the catalog or the
network.

- **`core.js`** is pure: geometry, OSM element validation, deterministic ranking, the search coverage rule and
  map URLs. No DOM, no network, no clock.
- **`provider.js`** owns HTTP to Overpass: a 12 s timeout, cancellation through `AbortSignal`, and at most one
  independent fallback for transient failures. HTTP 403 and 429 are never retried elsewhere.
- **`catalog.js`** is the lookup policy: the bundled national snapshot first, a newer published snapshot when
  the bundled one is older than seven days, live Overpass only when the catalog cannot serve the area.
- **`search-controller.js`** owns the lifetime of one search. Starting, replacing or cancelling a search aborts
  the previous one, and a superseded operation can never publish. It publishes one frozen state object per
  change. Transport and geolocation are injected, so it is tested without a browser.
- **`app.js`** renders that state and binds events. It holds only presentation state: language, expanded list
  and the open map.
- **`strings.js`** holds all copy; a unit test keeps the three languages' keys identical.
- **`hours.js`** turns the common OpenStreetMap opening-hours syntax (weekday ranges and lists, public holidays,
  time ranges, `off`, `24/7`) into the interface language; about 98 % of the catalog's values. Anything else is
  shown as mapped. It never evaluates a rule against today: the data is unverified, and an "open now" would be
  wrong on public holidays.
- **`theme-init.js`** is a classic, blocking script in `<head>`: it sets `data-theme` (the stored choice, else
  the system's) and `data-season` on `<html>` before the first paint, so neither flashes. The stylesheet reads
  only those attributes; `app.js` keeps following the system theme until the visitor chooses one.
- **`festive.js`** builds the string of lights and drives the snow canvas and the Web Audio melody. Both start
  only from their toggle buttons (`aria-pressed`), snow is drawn once and kept still under reduced motion and
  pauses in hidden tabs, and the melody is a synthesized public-domain tune with no downloaded asset.

## Visual layer

Depth and motion are CSS, with three small hooks in `app.js`; nothing is added to the bundle and nothing
needs a relaxed CSP, because the script only sets custom properties through the CSSOM.

- **Tokens.** Radii, two tinted shadow levels and one easing curve live beside the colour tokens, so each
  theme and the season restyle them together.
- **Sticky glass header** (wide screens): `backdrop-filter`, with a shadow that a scroll-driven animation
  fades in over the first 96 px. `scroll-padding-top` keeps anything scrolled to, keyboard focus included,
  below the header (WCAG 2.4.11).
- **Result cards** arrive in sequence (`--i`). Rows are rebuilt on every render, so `app.js` marks only rows
  the visitor has not seen: a new result set, or the rows _Show more_ adds, but not a language switch. On
  hover-capable mouse pointers a soft light follows the pointer (`--mx`, `--my`).
- **Aurora** behind the hero: three radial gradients on a masked pseudo-element whose drift stays inside its
  box, so it never widens the page.
- **Theme reveal**: `document.startViewTransition` with the new theme clipped to a circle growing from the
  toggle. Without the API, or with reduced motion, the theme changes at once.
- **Smooth disclosures** (`::details-content` with `interpolate-size`) and the map's fade-in (`@starting-style`)
  apply only where the browser supports them.

Gradient buttons keep their solid accent as `background-color` underneath, and the gradient only darkens it,
so contrast never falls below the token's. Text over the aurora and the card backgrounds measures at least
5.4:1 on rendered pixels in every theme and season.

Dependencies point inward, from the UI to the controller and the domain. There is no global store, event bus
or persistence of coordinates.

## Search and coverage

Live search queries a coordinate rounded to two decimals and ranks results by distance from the precise
position, which never leaves the device. A radius proves the nearest mapped pharmacy only if that pharmacy is
closer than the radius minus the rounding offset; otherwise the search widens. The catalog contains every
pharmacy mapped in Finland but none across the border, so near Sweden, Norway or Russia a closer pharmacy can
be missing: catalog results therefore make no coverage claim and say that only pharmacies mapped in Finland
are included. Coverage is always relative to OpenStreetMap, not to the official register.

## Catalog freshness

See [ADR 0002](0002-local-catalog-and-weekly-refresh.md). In short: the weekly workflow publishes a validated
extract to `main`, Vercel redeploys it, and a same-origin rewrite serves the newest copy to pages that are
still running an older deployment. A snapshot older than 30 days is rejected.

## Security headers

`vercel.json` is the single source of the Content Security Policy and other headers. The local server reads
the same file, so development and production cannot drift. `connect-src` allows only the site itself and the
two Overpass endpoints; `frame-src` allows only the OpenStreetMap embed.

## References

- [JavaScript modules (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Using the Fetch API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) and
  [AbortSignal (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
- [Geolocation API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [Content Security Policy (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Node.js test runner](https://nodejs.org/api/test.html)
