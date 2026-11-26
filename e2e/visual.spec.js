import { test, expect } from '@playwright/test';
import { endpoint, fixture, fulfill, withHours, withoutCatalog } from './support.js';

test.beforeEach(async ({ page }) => withoutCatalog(page));

const christmas = '2026-12-20T10:00:00Z';
const regular = '2026-10-15T10:00:00Z';

test('the melody is in tune, never clips, and rings out within its length', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { scheduleMelody, melodyDuration } = await import('/src/festive.js');
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const rate = 22050;
    const audio = new OfflineAudioContext(2, Math.ceil((melodyDuration + 0.5) * rate), rate);
    scheduleMelody(audio, audio.destination, { start: 0.05, random });
    const buffer = await audio.startRendering();
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    let peak = 0;
    let energy = 0;
    let lastSound = 0;
    for (let index = 0; index < left.length; index++) {
      const level = Math.max(Math.abs(left[index]), Math.abs(right[index]));
      peak = Math.max(peak, level);
      energy += left[index] ** 2;
      if (level > 0.001) lastSound = index / rate;
    }

    // Goertzel power at one frequency over the first note: E5 must stand out from its neighbours.
    const power = frequency => {
      const from = Math.floor(0.08 * rate);
      const to = Math.floor(0.3 * rate);
      const coefficient = 2 * Math.cos((2 * Math.PI * frequency) / rate);
      let [previous, beforePrevious] = [0, 0];
      for (let index = from; index < to; index++) {
        const next = left[index] + coefficient * previous - beforePrevious;
        [beforePrevious, previous] = [previous, next];
      }
      return previous ** 2 + beforePrevious ** 2 - coefficient * previous * beforePrevious;
    };
    return {
      melodyDuration,
      peak,
      rms: Math.sqrt(energy / left.length),
      lastSound,
      e5: power(659.25),
      neighbours: Math.max(power(622.25), power(698.46)),
    };
  });
  expect(result.peak).toBeLessThan(0.9);
  expect(result.rms).toBeGreaterThan(0.02);
  expect(result.rms).toBeLessThan(0.15);
  expect(result.e5).toBeGreaterThan(20 * result.neighbours);
  expect(result.lastSound).toBeGreaterThan(result.melodyDuration - 3);
  expect(result.lastSound).toBeLessThan(result.melodyDuration + 0.3);
});

test.describe('contrast on rendered pixels', () => {
  // Axe cannot see backgrounds drawn by pseudo-elements (the aurora, card gradients, the paper grain), so
  // text colour is compared with the pixels actually rendered behind it, with the text hidden.
  test.use({ bypassCSP: true });

  const ratio = (a, b) => {
    const luminance = rgb =>
      rgb
        .map(value => value / 255)
        .map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };

  const texts = [
    '.eyebrow > span',
    'h1',
    '.intro',
    '#city-label',
    '#status',
    '.closest-label',
    '.pharmacy h3',
    '.pharmacy-info > p:not(.hours, .closest-label)',
    '.hours-label',
    '.hours-rule',
    '.today-tag',
    '.distance',
    '.map-preview',
    '.pharmacy-action a',
  ];

  for (const colorScheme of ['light', 'dark']) {
    for (const [season, date] of [
      ['regular', regular],
      ['Christmas', christmas],
    ]) {
      test(`text stays at 4.5:1 or more in ${season} ${colorScheme}`, async ({ page, context }) => {
        await page.clock.setFixedTime(new Date(date));
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.route(endpoint, route => fulfill(route, withHours('Mo-Su 08:00-22:00')));
        await page.goto('/');
        await page.locator('#search-label').click();
        await expect(page.locator('#list li')).toHaveCount(2);
        // Under a mouse pointer the card's light is part of what the text sits on.
        const card = await page.locator('#list li').first().boundingBox();
        await page.mouse.move(card.x + card.width / 3, card.y + card.height / 2);

        const items = await page.evaluate(selectors => {
          return selectors.flatMap(selector =>
            [...document.querySelectorAll(selector)]
              .filter(node => node.checkVisibility())
              .map(node => {
                const style = getComputedStyle(node);
                const inset = side =>
                  parseFloat(style[`padding${side}`]) + parseFloat(style[`border${side}Width`]);
                const box = node.getBoundingClientRect();
                return {
                  selector,
                  color: style.color
                    .match(/\d+(\.\d+)?/g)
                    .slice(0, 3)
                    .map(Number),
                  x: box.x + scrollX + inset('Left'),
                  y: box.y + scrollY + inset('Top'),
                  width: box.width - inset('Left') - inset('Right'),
                  height: box.height - inset('Top') - inset('Bottom'),
                };
              }),
          );
        }, texts);
        await page.addStyleTag({
          content: `*, *::before, *::after { color: transparent !important; text-shadow: none !important; }
            svg, .status-dot, .topbar { visibility: hidden !important; }`,
        });
        const shot = (await page.screenshot({ fullPage: true })).toString('base64');

        const decoder = await context.newPage();
        const lowest = await decoder.evaluate(
          async ({ shot, items }) => {
            const image = new Image();
            image.src = `data:image/png;base64,${shot}`;
            await image.decode();
            const canvas = new OffscreenCanvas(image.width, image.height);
            const drawing = canvas.getContext('2d');
            drawing.drawImage(image, 0, 0);
            return items.map(({ x, y, width, height }) => {
              const { data } = drawing.getImageData(x, y, Math.max(1, width), Math.max(1, height));
              const pixels = [];
              for (let index = 0; index < data.length; index += 12) {
                pixels.push([data[index], data[index + 1], data[index + 2]]);
              }
              return pixels;
            });
          },
          { shot, items },
        );
        const failures = items
          .map(({ selector, color }, index) => ({
            selector,
            ratio: Math.min(...lowest[index].map(pixel => ratio(color, pixel))),
          }))
          .filter(({ ratio }) => ratio < 4.5);
        expect(failures).toEqual([]);
      });
    }
  }
});

test('forced colours keep the pressed state and the closest result distinct', async ({ page }) => {
  await page.clock.setFixedTime(new Date(christmas));
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.route(endpoint, route => fulfill(route, fixture));
  await page.goto('/');
  const snow = page.locator('#snow-toggle');
  await snow.click();
  await expect(snow).toHaveAttribute('aria-pressed', 'true');
  const background = locator => locator.evaluate(node => getComputedStyle(node).backgroundColor);
  expect(await background(snow)).not.toBe(await background(page.locator('#melody-toggle')));

  await page.locator('#search-label').click();
  await expect(page.locator('#list li.closest')).toHaveCSS('border-left-width', '4px');
  await expect(page.locator('#list li').nth(1)).toHaveCSS('border-left-width', '1px');
});

test.describe('page transitions', () => {
  for (const motion of ['no-preference', 'reduce']) {
    test(`results arrive in a view transition only without reduced motion (${motion})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await page.addInitScript(() => {
        window.viewTransitions = 0;
        const start = document.startViewTransition?.bind(document);
        if (start)
          document.startViewTransition = update => {
            window.viewTransitions++;
            return start(update);
          };
      });
      await page.route(endpoint, route => fulfill(route, fixture));
      await page.goto('/');
      await page.locator('#search-label').click();
      await expect(page.locator('#list li')).toHaveCount(2);
      await expect(page.locator('html')).not.toHaveAttribute('data-transition');
      // A language switch keeps the same outcome, so nothing glides.
      await page.locator('#language').selectOption('sv');
      await expect(page.locator('#list li')).toHaveCount(2);
      expect(await page.evaluate(() => window.viewTransitions)).toBe(motion === 'reduce' ? 0 : 1);
    });
  }

  test('the artwork leans towards a mouse pointer, but not with reduced motion', async ({ page }) => {
    for (const motion of ['no-preference', 'reduce']) {
      await page.emulateMedia({ reducedMotion: motion });
      await page.goto('/');
      const art = page.locator('.landscape');
      const box = await art.boundingBox();
      await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1);
      await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.05, { steps: 3 });
      const lean = () => art.evaluate(node => node.style.getPropertyValue('--lean-x'));
      if (motion === 'reduce') expect(await lean()).toBe('');
      else await expect.poll(lean).not.toBe('');
    }
  });
});
