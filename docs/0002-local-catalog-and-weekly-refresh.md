# ADR 0002: on-device national catalog with weekly refresh

Status: accepted. Supersedes the "live Overpass only" part of [ADR 0001](0001-search-and-privacy.md).

## Context

In a real-browser smoke test both public Overpass endpoints failed. A pharmacy finder that depends on a
best-effort public service is unavailable exactly when it is needed, and every live query shares an
approximate location with a third party.

## Decision

Ship a national snapshot of OpenStreetMap pharmacies and search it on the device.

- **Source.** The Geofabrik Finland extract, filtered with Osmium to `amenity=pharmacy` (nodes, ways and
  relations). Areas are reduced to the centre of their bounding box. Only the `amenity` tag, name, address,
  opening hours and OSM identifiers are kept.
- **Validation.** The converter rejects a catalog with fewer than 300 or more than 3,000 objects, or without a
  pharmacy near each of the five city centres. The workflow rejects an extract older than seven days, older
  than the published one, or 20 % smaller than it.
- **Freshness.** The client rejects a snapshot older than 30 days. When the bundled snapshot is older than
  seven days, it tries `/data/current-finland-pharmacies.json` for at most 2.5 s and keeps the newer valid
  copy. That path is a Vercel rewrite to the file on `main`, so it is same-origin and needs no CSP exception.
- **Publication.** A Monday 03:23 UTC schedule (or a manual run with `publish`) commits the validated file to
  `main`; Vercel redeploys. Two hours later the production smoke requires both routes to serve the same
  extract, at most two days old.
- **Fallback.** Live Overpass, as in ADR 0001, only when the catalog is missing, expired or has nothing within
  30 km.

## Consequences

- Searches work without any third party and send no location.
- The data is up to a week behind OpenStreetMap, and OpenStreetMap itself is not the official register: the
  UI shows the source date and links to Apteekki.fi.
- The catalog is a derived database under ODbL 1.0; it is published with attribution and under the same
  licence.
- About 185 KB of JSON is fetched on the first search and revalidated with normal HTTP caching after that.
