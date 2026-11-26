# Candidate review checklist

## AI-assisted work
The initial implementation, tests and ADR were generated with ChatGPT assistance. Review code and decisions personally before submitting. Do not claim independent reviewer approval, simulator testing, deployment or production usage until performed.

## Manual acceptance checklist (pending)
- Start with no location permission and confirm no provider request occurs until explicit action.
- Grant location permission; verify results with a known location and compare with an independent map.
- Deny permission and select Turku or Helsinki; verify city centre is clearly indicated.
- Simulate slow network, HTTP error, empty response and cancellation; verify stale results never reappear.
- Switch EN/FI/SV before and during a search; review copy with native speakers.
- Use keyboard and screen reader (web), or VoiceOver and large Dynamic Type (iOS).
- Check small screens, high contrast, zoom and dark mode where supported.
- Verify map links, opening-hours disclaimer, and OSM attribution.
- Inspect network requests to confirm rounded coordinates only, no analytics, and no personal secrets.
- Run GitHub Actions; verify build and test results; perform human code review before applying.

## Known gaps
No live provider smoke test, independent accessibility audit or production-grade availability guarantees. iOS full compilation needs Apple SDK. Do not represent these checks as passed until verified.
 
Web browser tests now exist with mocked network responses; execution is tracked in CI. They do not replace live provider or manual accessibility checks.

## Release gate
Review source, run unit and mocked browser tests, review generated screenshots, then verify real Overpass and map availability, keyboard/screen-reader usability and pharmacy hours. Do not claim WCAG conformance or verified schedules from these checks alone.

## UX review — three source passes
1. Journey: reduce post-search visual competition; progressive result disclosure; retry and independent directory on provider errors.
2. Hierarchy: concise mobile header, preserve Finnish contour identity only before results, distance caveat beside results.
3. Accessibility: explicit expanded state, keyboard focus on change location/cancel, native details disclosure. Added deterministic tests. Live provider remains a separate gate.
