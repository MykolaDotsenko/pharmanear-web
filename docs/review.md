# Verification record

What is verified, how, and what still needs a person. Claims elsewhere in the documentation rest on this
page.

## Automated on every push (Web CI)

| Check                  | What it proves                                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check` | Consistent formatting (Prettier 3.6.2)                                                                                                                                                 |
| 40 unit tests          | Geometry, ranking, coverage, normalization, catalog freshness and refresh, transport fallback and cancellation, controller lifecycle, translations, local server headers and allowlist |
| 24 Playwright tests    | Privacy before consent, rounded coordinates, ordering, cancellation, recovery, map focus handling, hours, seasonal palette, local catalog with providers down, browser language        |
| axe-core 4.10.3        | No violation of any WCAG 2.0–2.2 A/AA or best-practice rule, at any impact, in light, dark and Christmas themes (idle, results, details, map) and in Finnish and Swedish at 320 px     |
| Keyboard test          | Tab order follows the page; every stop has a visible 3 px focus outline                                                                                                                |
| Build                  | `dist/` contains only the published files                                                                                                                                              |

## Automated on a schedule or on demand

- **Catalog acquisition** (Mondays 03:23 UTC): downloads, filters, validates and publishes the Finland extract.
- **Production smoke** (Mondays 05:41 UTC): both deployed catalog routes are valid, identical and fresh.
- **Real catalog in a browser**: every city returns named results with both live providers blocked.

## Needs a person

- [ ] Screen reader pass: NVDA with Firefox and VoiceOver with Safari. Status announcements after search,
      cancellation and errors; the map panel's heading and close button; language switching.
- [ ] Zoom to 200 % and 400 %, and the WCAG 1.4.12 text-spacing bookmarklet, on desktop.
- [ ] Windows contrast themes (forced colors).
- [ ] Physical phone: location permission prompt, denial, and a known location compared with an independent
      map.
- [ ] Native speakers review the Finnish and Swedish copy.
- [ ] After the first scheduled publication: a bot commit on `main`, a Vercel deployment, and a green
      production smoke.

Automated accessibility tools find only part of WCAG failures, so none of the checks above is a claim of
conformance.
