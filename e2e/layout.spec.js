import { test, expect } from '@playwright/test';
import { endpoint, fulfill, withHours, withoutCatalog } from './support.js';

// Screen checks for every state at phone, tablet and desktop widths: nothing scrolls sideways, every target is
// at least 24 × 24 px (WCAG 2.5.8), no two controls overlap, and no text is cut off by its box.

const widths = [
  [320, 640],
  [390, 844],
  [768, 1024],
  [1280, 800],
];

async function prepare(page) {
  await withoutCatalog(page);
  await page.route(endpoint, route => fulfill(route, withHours('Mo-Fr 09:00-18:00; Sa 10:00-14:00; PH off')));
  await page.route('https://www.openstreetmap.org/export/embed.html?*', route =>
    route.fulfill({ contentType: 'text/html', body: '<p>Mock map</p>' }),
  );
  await page.addInitScript(() => {
    let success;
    navigator.geolocation.watchPosition = onFix => {
      success = onFix;
      return 1;
    };
    navigator.geolocation.clearWatch = () => {};
    window.radarFix = () =>
      success({
        timestamp: Date.now(),
        coords: { latitude: 60.4518, longitude: 22.2666, accuracy: 12, speed: null, heading: null },
      });
  });
}

const states = {
  async idle() {},
  async results(page) {
    await page.locator('#search-label').click();
    await expect(page.locator('#list li')).toHaveCount(2);
  },
  async radar(page) {
    await states.results(page);
    await page.locator('[data-radar-id="node/2"]').click();
    await page.locator('.radar-start').click();
    await page.evaluate(() => window.radarFix());
    await expect(page.locator('.radar-chart')).toBeVisible();
  },
  async map(page) {
    await states.results(page);
    await page.locator('[data-map-id="node/1"]').click();
    await expect(page.locator('#map-panel')).toBeVisible();
  },
};

/** Collects layout problems in the page as it is now. */
function problems(page) {
  return page.evaluate(() => {
    const found = [];
    const describe = node =>
      `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''} “${(node.getAttribute('aria-label') || node.textContent).trim().slice(0, 30)}”`;
    if (document.documentElement.scrollWidth > innerWidth) found.push('the page scrolls sideways');

    const controls = [...document.querySelectorAll('a[href], button, select, summary')].filter(node =>
      node.checkVisibility({ visibilityProperty: true }),
    );
    for (const node of controls) {
      const box = node.getBoundingClientRect();
      // A link inside a sentence is exempt from the target size (WCAG 2.5.8 "inline").
      const inline =
        node.tagName === 'A' && node.parentElement.textContent.trim() !== node.textContent.trim();
      if (!inline && (box.width < 24 || box.height < 24)) {
        found.push(`${describe(node)} is ${Math.round(box.width)}×${Math.round(box.height)}`);
      }
    }
    for (let a = 0; a < controls.length; a++) {
      for (let b = a + 1; b < controls.length; b++) {
        const [one, two] = [controls[a], controls[b]];
        if (one.contains(two) || two.contains(one)) continue;
        // Content scrolls under the sticky glass header by design; focus never stops there (WCAG 2.4.11 test).
        if (Boolean(one.closest('.topbar')) !== Boolean(two.closest('.topbar'))) continue;
        const p = one.getBoundingClientRect();
        const q = two.getBoundingClientRect();
        const overlap =
          Math.max(0, Math.min(p.right, q.right) - Math.max(p.left, q.left)) *
          Math.max(0, Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top));
        if (overlap > 4) found.push(`${describe(one)} overlaps ${describe(two)}`);
      }
    }

    // Text cut off by its own box: content wider or taller than a box that hides overflow.
    for (const node of document.querySelectorAll('main *, header *, footer *')) {
      if (!node.checkVisibility() || node.closest('svg, .landscape')) continue;
      const style = getComputedStyle(node);
      const hides = value => value === 'hidden' || value === 'clip';
      if (!hides(style.overflowX) && !hides(style.overflowY)) continue;
      // Visually hidden text (1 × 1 px) is meant for screen readers only.
      if (node.clientWidth <= 2 || node.clientHeight <= 2) continue;
      if (!node.textContent.trim()) continue;
      if (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1) {
        found.push(`${describe(node)} cuts off its text`);
      }
    }
    return found;
  });
}

for (const [width, height] of widths) {
  for (const [colorScheme, language] of [
    ['light', 'en'],
    ['dark', 'fi'],
    ['light', 'sv'],
  ]) {
    test(`screens at ${width} px, ${colorScheme}, ${language}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.clock.setFixedTime(new Date('2026-12-14T10:00:00Z'));
      await prepare(page);
      await page.goto('/');
      await page.locator('#language').selectOption(language);
      for (const [name, reach] of Object.entries(states)) {
        await page.reload();
        await page.locator('#language').selectOption(language);
        await reach(page);
        expect(await problems(page), `${name} at ${width} px`).toEqual([]);
      }
    });
  }
}
