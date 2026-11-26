import { test, expect } from '@playwright/test';

test('real Finnish catalog works for every city with Overpass unavailable', async ({ page }) => {
  let liveRequests = 0;
  await page.route('**/api/interpreter', route => {
    liveRequests++;
    return route.abort();
  });
  await page.goto('/');
  for (const city of ['Turku', 'Helsinki', 'Tampere', 'Oulu', 'Vaasa']) {
    await page.locator('#city').selectOption(city);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.results')).toHaveAttribute('data-state', 'found');
    await page.locator('#result-details summary').click();
    await expect(page.locator('#source-notes p').first()).toContainText('OSM catalog date:');
    await page.locator('#result-details summary').click();
    const row = page.locator('#list li').first();
    await expect(row).toBeVisible();
    await expect(row.locator('h3')).not.toBeEmpty();
    console.log(city + ': ' + (await row.innerText()));
  }
  expect(liveRequests).toBe(0);
});
