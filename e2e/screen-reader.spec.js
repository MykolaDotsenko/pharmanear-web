import { test, expect } from '@playwright/test';
import { endpoint, fulfill, withoutCatalog } from './support.js';

// A scripted screen-reader pass: what the page exposes to assistive technology while someone searches, moves
// through the results by Tab, opens the map and the radar, and switches language. It reads the accessibility
// tree and the live regions as Chromium exposes them; it is no substitute for listening with NVDA, JAWS,
// VoiceOver or TalkBack (see docs/review.md).

const names = ['Near', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh'];
const seven = {
  elements: names.map((name, index) => ({
    type: 'node',
    id: index + 1,
    lat: 60.452 + index * 0.002,
    lon: 22.267,
    tags: { amenity: 'pharmacy', name: `${name} pharmacy`, 'addr:street': `${name} street` },
  })),
};

/** Records every text a live region puts out, as a screen reader would queue it. */
async function listen(page) {
  await page.evaluate(() => {
    window.spoken = [];
    const observer = new MutationObserver(records => {
      const regions = new Set(
        records.map(record => record.target.parentElement?.closest('[role="status"]') ?? record.target),
      );
      for (const region of regions) {
        if (!region.closest?.('[role="status"]')) continue;
        const text = region.textContent.trim().replace(/\s+/g, ' ');
        if (text) window.spoken.push(text);
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  });
}
const spoken = page => page.evaluate(() => window.spoken.splice(0));

/** The focused element as a screen reader names it. */
const focused = page => page.locator(':focus').ariaSnapshot();

test.beforeEach(async ({ page }) => {
  await withoutCatalog(page);
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(endpoint, route => fulfill(route, seven));
  await page.route('https://www.openstreetmap.org/export/embed.html?*', route =>
    route.fulfill({ contentType: 'text/html', body: '<p>Mock map</p>' }),
  );
});

test('landmarks and headings outline the page', async ({ page }) => {
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.locator('#list li')).toHaveCount(5);
  // Templates match in order and may leave nodes out: this is the outline a rotor or landmark list offers.
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - link "Skip to content"
    - banner:
      - link "PharmaNear"
      - button "Dark theme"
      - combobox "Language"
    - main:
      - region "Find a pharmacy near you.":
        - heading "Find a pharmacy near you." [level=1]
        - button "Use my location"
        - combobox "Or search from a city centre"
        - button "Search"
      - region "Nearby pharmacies":
        - heading "Nearby pharmacies" [level=2]
        - status: 7 mapped pharmacies · Turku
        - list "Nearby pharmacies":
          - listitem:
            - heading "Near pharmacy" [level=3]
          - listitem:
            - heading "Second pharmacy" [level=3]
        - button "Show more pharmacies" [expanded=false]
    - contentinfo
  `);
  const outline = await page
    .getByRole('heading')
    .evaluateAll(headings => headings.map(heading => `${heading.tagName} ${heading.textContent.trim()}`));
  expect(outline.slice(0, 3)).toEqual([
    'H1 Find a pharmacy near you.',
    'H2 Nearby pharmacies',
    'H3 Near pharmacy',
  ]);
});

test('the status says each step once, and only when something happened', async ({ page }) => {
  await page.goto('/');
  await listen(page);
  await page.locator('#search-label').click();
  await expect(page.locator('#list li')).toHaveCount(5);
  expect(await spoken(page)).toEqual(['Searching for pharmacies…', '7 mapped pharmacies · Turku']);

  // Looking around the same results changes nothing that was said.
  await page.locator('#show-all').click();
  await expect(page.locator('#list li')).toHaveCount(7);
  await page.locator('#show-all').click();
  await page.getByRole('button', { name: 'Map preview: Near pharmacy' }).click();
  await page.locator('#close-map').click();
  await page.locator('#result-details-label').click();
  expect(await spoken(page)).toEqual([]);

  // A new language says the same thing in that language, once.
  await page.locator('#language').selectOption('fi');
  await expect(page.locator('#status')).toContainText('Turku');
  expect(await spoken(page)).toEqual(['7 kartoitettua apteekkia · Turku']);
});

test('Tab through the results: every stop has a name that stands on its own', async ({ page }) => {
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.locator('#list li')).toHaveCount(5);
  await page.locator('#results-heading').focus();
  const stops = [];
  for (let step = 0; step < 7; step++) {
    await page.keyboard.press('Tab');
    stops.push((await focused(page)).split('\n')[0]);
  }
  // Each name carries its pharmacy, because a list of links or buttons is read out of context.
  expect(stops).toEqual([
    '- text: About these results',
    `- 'link "Check opening hours: Near pharmacy"':`,
    `- 'button "Map preview: Near pharmacy"': Map preview`,
    `- 'button "Radar: Near pharmacy"': Radar`,
    `- 'link "Open in OpenStreetMap: Near pharmacy"':`,
    `- 'link "Check opening hours: Second pharmacy"':`,
    `- 'button "Map preview: Second pharmacy"': Map preview`,
  ]);
  // Label in name (WCAG 2.5.3): what a control shows is part of what it is called, so voice control works.
  const labels = await page
    .locator('#list :is(a, button)')
    .evaluateAll(nodes =>
      nodes.map(node => [node.getAttribute('aria-label') ?? '', node.textContent.trim()]),
    );
  expect(labels.length).toBeGreaterThan(0);
  for (const [name, visible] of labels) expect(name).toContain(visible);
});

test('the map and the radar take focus to their heading and give it back', async ({ page }) => {
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.locator('#list li')).toHaveCount(5);

  const preview = page.getByRole('button', { name: 'Map preview: Second pharmacy' });
  await preview.focus();
  await page.keyboard.press('Enter');
  expect(await focused(page)).toBe('- heading "Map of Second pharmacy" [level=3]');
  await page.keyboard.press('Tab');
  expect(await focused(page)).toBe('- button "Close map"');
  await page.keyboard.press('Enter');
  await expect(preview).toBeFocused();

  const radar = page.getByRole('button', { name: 'Radar: Second pharmacy' });
  await radar.focus();
  await page.keyboard.press('Enter');
  await expect(radar).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#radar-title')).toBeFocused();
  expect(await focused(page)).toMatch(/^- heading "/);
  await page.getByRole('button', { name: 'Close radar' }).click();
  await expect(radar).toBeFocused();
  await expect(radar).toHaveAttribute('aria-expanded', 'false');
});
