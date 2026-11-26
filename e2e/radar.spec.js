import { test, expect } from '@playwright/test';
import { endpoint, fixture, fulfill, withoutCatalog } from './support.js';

// A controllable stand-in for the browser's location watch and page visibility.
async function fakeSensors(page, { deny = false } = {}) {
  await page.addInitScript(deny => {
    window.radarWatches = 0;
    window.radarClears = 0;
    window.pageHidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.pageHidden });
    let success;
    navigator.geolocation.watchPosition = (onFix, onError) => {
      window.radarWatches++;
      success = onFix;
      if (deny) setTimeout(() => onError({ code: 1 }), 0);
      return 17;
    };
    navigator.geolocation.clearWatch = id => {
      if (id === 17) window.radarClears++;
    };
    window.radarFix = (latitude, longitude, accuracy = 12) =>
      success({
        timestamp: Date.now(),
        coords: { latitude, longitude, accuracy, speed: null, heading: null },
      });
    window.setPageHidden = hidden => {
      window.pageHidden = hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    };
  }, deny);
}

async function searchAndOpen(page) {
  await withoutCatalog(page);
  await page.route(endpoint, route => fulfill(route, fixture));
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.locator('#list li')).toHaveCount(2);
  await page.locator('#open-radar').click();
}

test('the radar explains itself and asks for nothing until it is started', async ({ page }) => {
  await fakeSensors(page);
  await searchAndOpen(page);
  await expect(page.locator('#radar-title')).toBeFocused();
  await expect(page.locator('.radar-intro')).toContainText('Your browser asks for permission');
  expect(await page.evaluate(() => window.radarWatches)).toBe(0);

  await page.getByRole('button', { name: 'Start radar' }).click();
  await expect.poll(() => page.evaluate(() => window.radarWatches)).toBe(1);
  await expect(page.locator('.radar-intro')).toBeHidden();
  await expect(page.locator('#radar-title')).toBeFocused();
  // No position yet: no empty disc.
  await expect(page.locator('.radar-chart')).toBeHidden();
});

test('the radar keeps the chosen pharmacy and stops live GPS on close', async ({ page }) => {
  await fakeSensors(page);
  await searchAndOpen(page);
  await page.getByRole('button', { name: 'Start radar' }).click();
  await page.evaluate(() => window.radarFix(60.4518, 22.2666));
  await expect(page.locator('.radar-chart')).toBeVisible();
  await expect(page.locator('#radar-target')).toHaveValue('node/2');
  await page.locator('#radar-target').selectOption('node/1');
  await page.evaluate(() => window.radarFix(60.452, 22.267));
  await expect(page.locator('#radar-target')).toHaveValue('node/1');
  await expect(page.locator('.radar-readout strong')).toHaveText('Far pharmacy');

  await page.getByRole('button', { name: 'Close radar' }).click();
  await expect(page.locator('#radar-title')).toHaveCount(0);
  expect(await page.evaluate(() => window.radarClears)).toBe(1);
  await expect(page.locator('#open-radar')).toBeFocused();
  await expect(page.locator('#list li')).toHaveCount(2);
});

test('a direction is given only outside the GPS uncertainty', async ({ page }) => {
  await fakeSensors(page);
  await searchAndOpen(page);
  await page.getByRole('button', { name: 'Start radar' }).click();
  const detail = page.locator('.radar-readout p').nth(1);
  const note = page.locator('.radar-readout p').nth(2);

  // About 30 m away with a 12 m fix: a direction, and a needle towards the pharmacy.
  await page.evaluate(() => window.radarFix(60.4518, 22.2666, 12));
  await expect(detail).toContainText('·');
  await expect(page.locator('.radar-needle')).toHaveCount(1);

  // The same place with a 60 m fix: the pharmacy is inside the uncertainty, so no direction at all.
  await page.evaluate(() => window.radarFix(60.4518, 22.2666, 60));
  await expect(note).toHaveText('The pharmacy is within GPS uncertainty, so no direction is shown.');
  await expect(detail).not.toContainText('·');
  await expect(page.locator('.radar-needle')).toHaveCount(0);
});

test('a denied location is final, and the search results still work', async ({ page }) => {
  await fakeSensors(page, { deny: true });
  await searchAndOpen(page);
  await page.getByRole('button', { name: 'Start radar' }).click();
  await expect(page.locator('.radar-panel')).toContainText('Location unavailable or denied.');
  // Leaving and returning to the tab must not bring the permission prompt back.
  await page.evaluate(() => window.setPageHidden(true));
  await page.evaluate(() => window.setPageHidden(false));
  expect(await page.evaluate(() => window.radarWatches)).toBe(1);
  await expect(page.locator('.radar-panel')).toContainText('Location unavailable or denied.');
  await page.getByRole('button', { name: 'Close radar' }).click();
  await expect(page.locator('#list li')).toHaveCount(2);
});

test('with reduced motion the chart stays north-up', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fakeSensors(page);
  await searchAndOpen(page);
  await page.getByRole('button', { name: 'Start radar' }).click();
  await page.evaluate(() => window.radarFix(60.4518, 22.2666));
  await page.evaluate(() =>
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 90, absolute: true })),
  );
  await expect(page.locator('.radar-meta').first()).toContainText('North-up');
});

test.describe('radar accessibility', () => {
  test.use({ bypassCSP: true });

  for (const colorScheme of ['light', 'dark']) {
    test(`no axe violations with the radar running (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await fakeSensors(page);
      await searchAndOpen(page);
      await page.getByRole('button', { name: 'Start radar' }).click();
      await page.evaluate(() => window.radarFix(60.4518, 22.2666));
      await expect(page.locator('.radar-chart')).toBeVisible();
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const violations = await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
          },
        });
        return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }));
      });
      expect(violations).toEqual([]);
    });
  }

  test('forced colours keep the target distinct from the other pharmacies', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await fakeSensors(page);
    await searchAndOpen(page);
    await page.getByRole('button', { name: 'Start radar' }).click();
    await page.evaluate(() => window.radarFix(60.4518, 22.2666));
    const fill = selector =>
      page
        .locator(selector)
        .first()
        .evaluate(node => getComputedStyle(node).fill);
    await expect(page.locator('.radar-target')).toHaveCount(1);
    expect(await fill('.radar-target')).not.toBe(await fill('.radar-user'));
  });
});
