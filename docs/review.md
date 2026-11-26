# Verification record

What is verified, how, and what still needs a person. Claims elsewhere in the documentation rest on this
page.

## Automated on every push (Web CI)

| Check                  | What it proves                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check` | Consistent formatting (Prettier 3.6.2)                                                                                                                                                                                                                                                                                                                                                             |
| 53 unit tests          | Geometry, ranking, coverage, normalization, catalog freshness and refresh, transport fallback and cancellation, controller lifecycle, translations and plural forms, opening-hours formatting and today's rule, Finnish holidays and Helsinki time, local server headers and allowlist                                                                                                             |
| 48 Playwright tests    | Privacy before consent, rounded coordinates, ordering, cancellation, recovery, the map inside its row and focus handling, localized hours and today's rule, theme toggle and its memory, seasonal palette, snow and melody only on request, snow still under reduced motion, local catalog with providers down, browser language, compact phone rows, view transitions only without reduced motion |
| Accessibility tree     | An ARIA snapshot of the results: region, status, named list, one heading per pharmacy, and uniquely named actions                                                                                                                                                                                                                                                                                  |
| Rendered contrast      | Every text colour against the rendered pixels behind it, including the aurora, card gradients, pointer light and grain, at 4.5:1 or more in light, dark and Christmas themes                                                                                                                                                                                                                       |
| Forced colours         | Pressed toggles, the closest result and today's tag stay distinct with system colours                                                                                                                                                                                                                                                                                                              |
| Melody                 | An offline render of the arrangement: the first note is in tune, the peak stays below 0.9, the level is moderate, and it rings out within its stated length                                                                                                                                                                                                                                        |
| axe-core 4.10.3        | No violation of any WCAG 2.0–2.2 A/AA or best-practice rule, at any impact, in light, dark and Christmas themes (idle, results, details, map) and in Finnish and Swedish at 320 px                                                                                                                                                                                                                 |
| Keyboard test          | The start page's tab order follows the page; each stop shows a focus outline of at least 2 px                                                                                                                                                                                                                                                                                                      |
| Build                  | `npm run build` succeeds                                                                                                                                                                                                                                                                                                                                                                           |

## Automated on a schedule or on demand

- **Catalog acquisition** (Mondays 03:23 UTC): downloads, filters, validates and publishes the Finland extract.
- **Production smoke** (Mondays 05:41 UTC): both deployed catalog routes are valid, identical and fresh.
- **Real catalog in a browser**: every city returns named results with both live providers blocked.

## Needs a person

- [ ] Screen reader pass: NVDA with Firefox and VoiceOver with Safari. Status announcements after search,
      cancellation and errors; the map panel's heading and close button; language switching.
- [ ] Zoom to 200 % and 400 %, and the WCAG 1.4.12 text-spacing bookmarklet, on desktop.
- [ ] Windows contrast themes on a real machine (forced colours are emulated in CI).
- [ ] Physical phone: location permission prompt, denial, and a known location compared with an independent
      map.
- [ ] Native speakers review the Finnish and Swedish copy.
- [ ] Listen to the melody on phone and laptop speakers: how natural it sounds, its volume, and that it stops
      at once when toggled off.
- [ ] After the first scheduled publication: a bot commit on `main`, a Vercel deployment, and a green
      production smoke.

Automated accessibility tools find only part of WCAG failures, so none of the checks above is a claim of
conformance.
