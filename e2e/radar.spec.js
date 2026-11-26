import { test, expect } from '@playwright/test';
import { endpoint, fixture, fulfill, withoutCatalog } from './support.js';

test('radar starts only on request, keeps target and stops live GPS on close', async ({ page }) => {
  await withoutCatalog(page);
  await page.route(endpoint, route => fulfill(route, fixture));
  await page.addInitScript(() => {
    window.radarWatches = 0;
    window.radarClears = 0;
    let callback;
    navigator.geolocation.watchPosition = success => {
      window.radarWatches++;
      callback = success;
      return 17;
    };
    navigator.geolocation.clearWatch = id => {
      if (id === 17) window.radarClears++;
    };
    window.radarFix = (latitude, longitude, accuracy = 12) => {
      callback({
        timestamp: Date.now(),
        coords: { latitude, longitude, accuracy, speed: null, heading: null },
      });
    };
  });
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.locator('#list li')).toHaveCount(2);
  expect(await page.evaluate(() => window.radarWatches)).toBe(0);
  await page.locator('#open-radar').click();
  await expect(page.locator('#radar-title')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.radarWatches)).toBe(1);
  await page.evaluate(() => window.radarFix(60.4518, 22.2666));
  await expect(page.locator('.radar-chart')).toBeVisible();
  await expect(page.locator('#radar-target')).toHaveValue('node/2');
  await page.locator('#radar-target').selectOption('node/1');
  await page.evaluate(() => window.radarFix(60.452, 22.267));
  await expect(page.locator('#radar-target')).toHaveValue('node/1');
  await page.getByRole('button', { name: 'Close radar' }).click();
  await expect(page.locator('#radar-title')).toHaveCount(0);
  expect(await page.evaluate(() => window.radarClears)).toBe(1);
  await expect(page.locator('#open-radar')).toBeFocused();
  await expect(page.locator('#list li')).toHaveCount(2);
});

test('radar retains ordinary search on denied location', async ({ page }) => {
  await withoutCatalog(page);
  await page.route(endpoint, route => fulfill(route, fixture));
  await page.addInitScript(() => {
    navigator.geolocation.watchPosition = (_, fail) => {
      setTimeout(() => fail({ code: 1 }), 0);
      return 12;
    };
    navigator.geolocation.clearWatch = () => {};
  });
  await page.goto('/');
  await page.locator('#search-label').click();
  await page.locator('#open-radar').click();
  await expect(page.locator('.radar-panel')).toContainText('Location unavailable or denied.');
  await page.getByRole('button', { name: 'Close radar' }).click();
  await expect(page.locator('#list li')).toHaveCount(2);
});
