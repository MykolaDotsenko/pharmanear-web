import { test, expect } from '@playwright/test';
import { withoutCatalog } from './support.js';

const christmas = '2026-12-20T12:00:00Z';

test.beforeEach(async ({ page }) => withoutCatalog(page));

test('the lights glow on their own rhythms, and their button switches them off', async ({ page }) => {
  await page.clock.setFixedTime(new Date(christmas));
  await page.goto('/');
  const garland = page.locator('#garland');
  const toggle = page.getByRole('button', { name: 'Christmas lights' });
  await expect(garland).toHaveAttribute('data-lights', 'on');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  const bulbs = page.locator('.garland-bulbs i');
  const rhythms = await bulbs.evaluateAll(items => items.map(item => item.style.getPropertyValue('--dur')));
  expect(new Set(rhythms).size).toBeGreaterThan(5);
  await expect(bulbs.first()).toHaveCSS('animation-iteration-count', 'infinite');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(garland).toHaveAttribute('data-lights', 'off');
  await expect(bulbs.first()).toHaveCSS('animation-name', 'none');
});

test('with reduced motion the lights stay lit without blinking', async ({ page }) => {
  await page.clock.setFixedTime(new Date(christmas));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#garland')).toHaveAttribute('data-lights', 'on');
  await expect(page.locator('.garland-bulbs i').first()).toHaveCSS('animation-name', 'none');
});

async function sweepArtwork(page) {
  const box = await page.locator('.landscape').boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.6, { steps: 24 });
}

test('snowflakes fly from the pointer over the artwork and melt away', async ({ page }) => {
  await page.clock.setFixedTime(new Date(christmas));
  await page.goto('/');
  await sweepArtwork(page);
  const flakes = page.locator('.flake-layer .flake');
  await expect.poll(() => flakes.count()).toBeGreaterThan(2);
  await expect(page.locator('.flake-layer')).toHaveAttribute('aria-hidden', 'true');
  // Finishing every flight removes the flakes, and the page never grows sideways.
  await page.evaluate(() =>
    document
      .getAnimations()
      .filter(animation => animation.effect?.target?.classList?.contains('flake'))
      .forEach(animation => animation.finish()),
  );
  await expect(flakes).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('no snowflakes with reduced motion or outside the season', async ({ page }) => {
  await page.clock.setFixedTime(new Date(christmas));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await sweepArtwork(page);
  await expect(page.locator('.flake')).toHaveCount(0);

  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  await sweepArtwork(page);
  await expect(page.locator('.flake')).toHaveCount(0);
});
