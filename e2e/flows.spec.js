import { test, expect } from '@playwright/test';
import { endpoint, fixture, fulfill, withHours, withoutCatalog } from './support.js';

test.beforeEach(async ({ page }) => withoutCatalog(page));
test('idle is private, search orders results, accessible map link and locale', async ({ page }) => {
  let requests = 0;
  await page.route(endpoint, r => {
    requests++;
    expect(r.request().postData()).toContain('60.45');
    return fulfill(r, fixture);
  });
  await page.goto('/');
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('#list li').first()).toContainText('Near pharmacy');
  await expect(page.getByRole('link', { name: 'Open in OpenStreetMap: Near pharmacy' })).toHaveAttribute(
    'href',
    /openstreetmap\.org/,
  );
  await page.locator('#language').selectOption('fi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fi');
  await expect(page.locator('#list li').first()).toContainText('Lähin karttatulos');
  expect(requests).toBe(1);
});
test('provider failure is recoverable', async ({ page }) => {
  let fail = true;
  await page.route(endpoint, r =>
    fail ? r.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' } }) : fulfill(r, fixture),
  );
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.getByRole('status')).toContainText('temporarily unavailable');
  fail = false;
  await page.locator('#search-label').click();
  await expect(page.locator('#list li')).toHaveCount(2);
});
test('cancel invalidates delayed results', async ({ page }) => {
  let release;
  const delayed = new Promise(r => (release = r));
  await page.route(endpoint, async route => {
    await delayed;
    await fulfill(route, fixture).catch(() => {});
  });
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.getByRole('status')).toContainText('Searching');
  await page.locator('#cancel').click();
  release();
  await expect(page.getByRole('status')).toHaveText('Search cancelled.');
  await expect(page.locator('#list li')).toHaveCount(0);
});
test('mobile reduced motion and dark theme remain usable', async ({ page }) => {
  // In season the header carries the most controls, so it is the narrowest case.
  await page.clock.setFixedTime(new Date('2026-12-20T12:00:00Z'));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('#locate')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.locator-art').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});
test('device search sends rounded coordinates', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 60.4518, longitude: 22.2666 });
  await page.route(endpoint, r => {
    const body = new URLSearchParams(r.request().postData());
    expect(body.get('data')).toContain('3000,60.45,22.27');
    expect(body.get('data')).not.toContain('60.4518');
    return fulfill(r, fixture);
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.locator('#list li')).toHaveCount(2);
});

test('map requires explicit action and closes with restored focus', async ({ page }) => {
  let maps = 0;
  await page.route(endpoint, r => fulfill(r, fixture));
  await page.route('https://www.openstreetmap.org/export/embed.html?*', r => {
    maps++;
    return r.fulfill({ contentType: 'text/html', body: '<p>Mock map</p>' });
  });
  await page.goto('/');
  await page.locator('#search-label').click();
  const button = page.getByRole('button', { name: 'Map preview: Near pharmacy' });
  await expect(button).toBeVisible();
  expect(maps).toBe(0);
  await button.click();
  await expect(page.locator('#map-frame iframe')).toHaveAttribute('src', /marker=60.452%2C22.267/);
  // The map opens inside the pharmacy's own row.
  await expect(page.locator('#list li').first().locator('#map-panel')).toBeVisible();
  await page.locator('#close-map').click();
  await expect(page.locator('#map-panel')).toBeHidden();
  await expect(button).toBeFocused();
});
test('missing or unverified hours never become an open-now claim', async ({ page }) => {
  await page.route(endpoint, r =>
    fulfill(r, {
      elements: [
        { ...fixture.elements[1], tags: { ...fixture.elements[1].tags, opening_hours: 'Mo-Fr 09:00-18:00' } },
        fixture.elements[0],
      ],
    }),
  );
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.locator('#list li').first()).toContainText('Opening hours');
  await expect(page.locator('#list li').last()).toContainText('Opening hours unavailable');
  await expect(page.locator('#hours-disclosure')).toContainText('OpenStreetMap');
  await expect(page.locator('#list li').last().getByRole('link', { name: 'Check opening hours' })).toBeVisible();
});
test('capture desktop and mobile screenshots with synthetic results', async ({ page }, testInfo) => {
  await page.route(endpoint, r => fulfill(r, fixture));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.locator('#list li')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true, animations: 'disabled' });
});

test.describe('automated accessibility checks', () => {
  test.use({ bypassCSP: true });

  // Every axe rule for WCAG 2.0-2.2 A/AA plus best practices, at every impact level.
  const audit = async page => {
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
    return page.evaluate(async () => {
      const { violations } = await window.axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
        },
      });
      return violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(n => n.target) }));
    });
  };

  for (const colorScheme of ['light', 'dark']) {
    for (const [season, date] of [
      ['regular', '2026-10-15T10:00:00Z'],
      ['Christmas', '2026-12-20T10:00:00Z'],
    ]) {
      test(`no violations in ${season} ${colorScheme} idle, results and map states`, async ({ page }) => {
        await page.clock.setFixedTime(new Date(date));
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.route(endpoint, route => fulfill(route, withHours('Mo-Su 08:00-22:00; PH 10:00-16:00')));
        await page.route('https://www.openstreetmap.org/export/embed.html?*', route =>
          route.fulfill({ contentType: 'text/html', body: '<p>Mock map</p>' }),
        );
        await page.goto('/');
        expect(await audit(page)).toEqual([]);

        await page.locator('#search-label').click();
        await expect(page.locator('#list li')).toHaveCount(2);
        await expect(page.locator('.today-tag')).toHaveCount(1);
        await page.locator('#result-details summary').click();
        await page.getByRole('button', { name: 'Map preview: Near pharmacy' }).click();
        await expect(page.locator('#map-panel')).toBeVisible();
        expect(await audit(page)).toEqual([]);
      });
    }
  }

  for (const language of ['fi', 'sv']) {
    test(`no violations in ${language} at 320 px with recovery and results`, async ({ page }) => {
      let fail = true;
      await page.setViewportSize({ width: 320, height: 640 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.route(endpoint, route =>
        fail
          ? route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' } })
          : fulfill(route, fixture),
      );
      await page.goto('/');
      await page.locator('#language').selectOption(language);
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await page.locator('#search-label').click();
      await expect(page.locator('#recovery')).toBeVisible();
      expect(await audit(page)).toEqual([]);

      fail = false;
      await page.locator('#retry').click();
      await expect(page.locator('#list li')).toHaveCount(2);
      expect(await audit(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }

  test('keyboard order follows the page and every stop shows a focus indicator', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const stops = [];
    for (let step = 0; step < 9; step++) {
      await page.keyboard.press('Tab');
      stops.push(
        await page.evaluate(() => {
          const element = document.activeElement;
          const outline = getComputedStyle(element);
          return {
            id: element.id || element.className || element.tagName,
            visible: outline.outlineStyle !== 'none' && parseFloat(outline.outlineWidth) >= 2,
          };
        }),
      );
    }
    expect(stops.map(stop => stop.id)).toEqual([
      'skip',
      'brand',
      'theme-toggle',
      'language',
      'locate',
      'privacy-summary',
      'city',
      'search-label',
      'directory',
    ]);
    expect(stops.every(stop => stop.visible)).toBe(true);
  });

  test('localized document metadata and Swedish city names', async ({ page }) => {
    await page.route(endpoint, route => fulfill(route, fixture));
    await page.goto('/');
    await page.locator('#language').selectOption('sv');
    await expect(page).toHaveTitle('PharmaNear — Hitta ett apotek');
    await expect(page.locator('#city option[value="Turku"]')).toHaveText('Åbo');
    await page.locator('#search-label').click();
    await expect(page.getByRole('status')).toHaveText('2 kartlagda apotek · Åbo');
  });
});

test('task-first results progressively disclose more pharmacies', async ({ page }) => {
  const rows = Array.from({ length: 8 }, (_, i) => ({
    type: 'node',
    id: i + 1,
    lat: 60.4518 + i * 0.0001,
    lon: 22.2666,
    tags: { amenity: 'pharmacy', name: 'Pharmacy ' + (i + 1) },
  }));
  await page.route(endpoint, r => fulfill(r, { elements: rows }));
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.locator('#list li')).toHaveCount(5);
  await expect(page.locator('.landscape')).toBeHidden();
  await page.locator('#result-details summary').click();
  await expect(page.locator('#distance-note')).toBeVisible();
  await page.getByRole('button', { name: 'Show more pharmacies' }).click();
  await expect(page.locator('#list li')).toHaveCount(8);
  await page.getByRole('button', { name: 'Show fewer pharmacies' }).click();
  await expect(page.locator('#list li')).toHaveCount(5);
  await page.getByRole('link', { name: 'Change location' }).click();
  await expect(page.locator('#locate')).toBeFocused();
});
test('only rows the visitor has not seen yet animate in', async ({ page }) => {
  const elements = Array.from({ length: 8 }, (_, i) => ({
    type: 'node',
    id: i + 1,
    lat: 60.4518 + i * 0.0001,
    lon: 22.2666,
    tags: { amenity: 'pharmacy', name: 'Pharmacy ' + (i + 1) },
  }));
  await page.route(endpoint, r => fulfill(r, { elements }));
  await page.goto('/');
  await page.locator('#search-label').click();
  const arriving = page.locator('#list li.arriving');
  const order = () => arriving.evaluateAll(rows => rows.map(row => row.style.getPropertyValue('--i')));
  await expect(page.locator('#list li')).toHaveCount(5);
  expect(await order()).toEqual(['0', '1', '2', '3', '4']);

  // A language switch rebuilds the rows, but they are the same results and stay still.
  await page.locator('#language').selectOption('fi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fi');
  await expect(arriving).toHaveCount(0);

  await page.locator('#show-all').click();
  await expect(page.locator('#list li')).toHaveCount(8);
  expect(await order()).toEqual(['0', '1', '2']);
});
test('the sticky header never hides the keyboard focus', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-26T12:00:00Z'));
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.route(endpoint, r => fulfill(r, fixture));
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.locator('#list li')).toHaveCount(2);
  await page.locator('footer a').focus();
  const first = page.getByRole('button', { name: 'Map preview: Near pharmacy' });
  for (
    let step = 0;
    step < 12 && !(await first.evaluate(button => button === document.activeElement));
    step++
  ) {
    await page.keyboard.press('Shift+Tab');
  }
  await expect(first).toBeFocused();
  const header = await page.locator('.topbar').boundingBox();
  const focused = await first.boundingBox();
  expect(focused.y).toBeGreaterThanOrEqual(header.y + header.height);
});
test('recovery offers retry and independent directory', async ({ page }) => {
  let fail = true;
  await page.route(endpoint, r =>
    fail ? r.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' } }) : fulfill(r, fixture),
  );
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.getByRole('link', { name: 'Find a pharmacy on Apteekki.fi' })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('#list li')).toHaveCount(2);
  await expect(page.locator('#recovery')).toBeHidden();
});

test('Christmas details are seasonal and never obstruct search results', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-12-20T12:00:00Z'));
  await page.route(endpoint, r => fulfill(r, fixture));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-season', 'christmas');
  await expect(page.locator('.festive-art')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('nordic-christmas.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.locator('#search-label').click();
  await expect(page.locator('#list li')).toHaveCount(2);
  await expect(page.locator('.festive-art')).toBeHidden();
  await page.clock.setFixedTime(new Date('2027-01-07T12:00:00Z'));
  await page.reload();
  await expect(page.locator('.festive-art')).toBeHidden();
  await expect(page.locator('#locate')).toBeVisible();
});

test('Christmas palette uses accessible festive actions in light and dark mode', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-20T12:00:00Z'));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/');
  const locate = page.locator('#locate');
  await expect(locate).toHaveCSS('background-color', 'rgb(139, 38, 59)');
  // The system theme changes asynchronously; toHaveCSS waits for it.
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(locate).toHaveCSS('background-color', 'rgb(174, 62, 84)');
  await page.clock.setFixedTime(new Date('2027-01-07T12:00:00Z'));
  await page.reload();
  await expect(locate).not.toHaveCSS('background-color', 'rgb(174, 62, 84)');
});

test('independent provider recovers from a primary outage', async ({ page }) => {
  let primary = 0,
    backup = 0;
  await page.route('https://overpass-api.de/api/interpreter', r => {
    primary++;
    return r.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('https://overpass.private.coffee/api/interpreter', r => {
    backup++;
    return fulfill(r, fixture);
  });
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.locator('#list li').first()).toContainText('Near pharmacy');
  expect(primary).toBe(1);
  expect(backup).toBe(1);
});

test('local catalog renders results while both live providers are unavailable', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-26T12:00:00Z'));
  let liveRequests = 0;
  await page.route(endpoint, route => {
    liveRequests++;
    return route.abort();
  });
  await page.route('**/data/finland-pharmacies.json', route =>
    route.fulfill({
      json: { ...fixture, schema: 1, region: 'FI', license: 'ODbL-1.0', sourceDate: '2026-11-25T00:00:00Z' },
    }),
  );
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.locator('#list li').first()).toContainText('Near pharmacy');
  await page.locator('#result-details summary').click();
  await expect(page.locator('#source-notes p')).toHaveText([
    'OSM catalog date: 2026-11-25',
    'Only pharmacies mapped in Finland are included.',
  ]);
  expect(liveRequests).toBe(0);
});

test('mobile search keeps details collapsed and preserves readable hours', async ({ page }) => {
  // A Sunday, which neither rule covers, so no rule is marked for today.
  await page.clock.setFixedTime(new Date('2026-10-18T10:00:00Z'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(endpoint, r =>
    fulfill(r, {
      elements: [
        {
          ...fixture.elements[1],
          tags: { ...fixture.elements[1].tags, opening_hours: 'Mo-Fr 09:00-18:00; Sa 10:00-14:00' },
        },
      ],
    }),
  );
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.locator('#list li')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('1 mapped pharmacy · Turku');
  await expect(page.locator('#result-details')).not.toHaveAttribute('open', '');
  await expect(page.locator('.hours-value')).toHaveText('Mon–Fri 09:00–18:00 · Sat 10:00–14:00');
  await page.locator('#result-details summary').click();
  await expect(page.locator('#distance-note')).toBeVisible();

  await page.locator('#language').selectOption('fi');
  await expect(page.locator('.hours-value')).toHaveText('ma–pe 09.00–18.00 · la 10.00–14.00');
  // The distance shares the first line with the name instead of sitting under the hours.
  const name = await page.locator('#list li h3').boundingBox();
  const distance = await page.locator('#list li .distance').boundingBox();
  expect(distance.y).toBeLessThan(name.y + name.height);
});

test.describe('theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
  });

  test('the page follows the system theme until the visitor chooses one', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('a chosen theme overrides the system and is remembered', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Dark theme' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      'rgb(32, 39, 36)',
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#202724');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Dark theme' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  for (const motion of ['no-preference', 'reduce']) {
    test(`the theme change uses a view transition only without reduced motion (${motion})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: motion });
      await page.addInitScript(() => {
        window.viewTransitions = 0;
        const start = document.startViewTransition?.bind(document);
        if (start)
          document.startViewTransition = update => {
            window.viewTransitions++;
            return start(update);
          };
      });
      await page.goto('/');
      await page.locator('#theme-toggle').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      expect(await page.evaluate(() => window.viewTransitions)).toBe(motion === 'reduce' ? 0 : 1);
    });
  }
});

test.describe('season', () => {
  test('snow and the melody start only on request', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-12-20T12:00:00Z'));
    await page.goto('/');
    await expect(page.locator('.garland-bulbs i')).toHaveCount(18);
    await expect(page.locator('#greeting')).toHaveText('Merry Christmas');

    const snow = page.getByRole('button', { name: 'Snowfall' });
    await expect(page.locator('#snowfall')).toBeHidden();
    await snow.click();
    await expect(snow).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#snowfall')).toBeVisible();
    await snow.click();
    await expect(snow).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#snowfall')).toBeHidden();

    const melody = page.getByRole('button', { name: 'Christmas melody' });
    await melody.click();
    await expect(melody).toHaveAttribute('aria-pressed', 'true');
    await melody.click();
    await expect(melody).toHaveAttribute('aria-pressed', 'false');
    expect(errors).toEqual([]);
  });

  test('snow stays still with reduced motion', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-12-20T12:00:00Z'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Snowfall' }).click();
    const frame = () => page.locator('#snowfall').evaluate(canvas => canvas.toDataURL());
    const first = await frame();
    await page.waitForTimeout(300);
    expect(await frame()).toBe(first);
  });

  test('outside the season there are no festive controls or decorations', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
    await page.goto('/');
    await expect(page.locator('#snow-toggle')).toBeHidden();
    await expect(page.locator('#melody-toggle')).toBeHidden();
    await expect(page.locator('#greeting')).toBeHidden();
    await expect(page.locator('.garland-bulbs i')).toHaveCount(0);
  });
});

test.describe('browser language preference', () => {
  test.use({ locale: 'fi-FI' });

  test('Finnish browsers start in Finnish', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fi');
    await expect(page.locator('#language')).toHaveValue('fi');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Löydä apteekki läheltäsi.');
  });
});

test.describe("today's opening hours", () => {
  const hours = 'Mo-Fr 09:00-18:00; Sa 10:00-14:00; PH off';
  for (const [day, date, marked] of [
    ['a weekday', '2026-10-15T12:00:00Z', 'Mon–Fri 09:00–18:00 today ·'],
    ['a Saturday', '2026-10-17T12:00:00Z', 'Sat 10:00–14:00 today ·'],
    ['Independence Day', '2026-12-06T12:00:00Z', 'Public holidays closed today'],
  ]) {
    test(`on ${day} the rule for today is marked`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(date));
      await page.route(endpoint, route => fulfill(route, withHours(hours)));
      await page.goto('/');
      await page.locator('#search-label').click();
      await expect(page.locator('.hours-rule.today')).toHaveText(marked);
      await expect(page.locator('#list li').first()).toContainText('Opening hours');
    });
  }

  test('a holiday the hours do not mention marks nothing, and the tag is translated', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-12-24T12:00:00Z'));
    await page.route(endpoint, route => fulfill(route, withHours('Mo-Fr 09:00-18:00')));
    await page.goto('/');
    await page.locator('#search-label').click();
    await expect(page.locator('.hours-rule')).toHaveCount(1);
    await expect(page.locator('.today-tag')).toHaveCount(0);

    await page.clock.setFixedTime(new Date('2026-12-21T12:00:00Z'));
    await page.locator('#language').selectOption('fi');
    await page.locator('#search-label').click();
    await expect(page.locator('.hours-rule.today')).toHaveText('ma–pe 09.00–18.00 tänään');
  });
});

test('on a phone the actions share one line and nothing widens the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(endpoint, route => fulfill(route, fixture));
  await page.goto('/');
  await page.locator('#search-label').click();
  const row = page.locator('#list li').first();
  // Same row: the two boxes overlap vertically.
  const preview = await row.locator('.map-preview').boundingBox();
  const link = await row.locator('a').boundingBox();
  expect(link.y).toBeLessThan(preview.y + preview.height);
  expect(preview.y).toBeLessThan(link.y + link.height);
  await expect(row.locator('.rank')).toBeHidden();

  // Longer labels may wrap with wider fonts, but never past the edge of a 320 px screen.
  await page.setViewportSize({ width: 320, height: 700 });
  for (const language of ['fi', 'sv']) {
    await page.locator('#language').selectOption(language);
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('the results read as a structured list to assistive technology', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
  await page.route(endpoint, route => fulfill(route, withHours('Mo-Fr 09:00-18:00; Sa 10:00-14:00; PH off')));
  await page.goto('/');
  await page.locator('#search-label').click();
  await expect(page.locator('.results')).toMatchAriaSnapshot(`
    - region "Nearby pharmacies":
      - heading "Nearby pharmacies" [level=2]
      - status: 2 mapped pharmacies · Turku
      - group: About these results
      - list "Nearby pharmacies":
        - listitem:
          - paragraph: Closest mapped result
          - heading "Near pharmacy" [level=3]
          - paragraph: Example street
          - paragraph: Opening hours Mon–Fri 09:00–18:00 today · Sat 10:00–14:00 · Public holidays closed
          - text: 31 m
          - 'button "Map preview: Near pharmacy"'
          - 'link "Open in OpenStreetMap: Near pharmacy"'
        - listitem:
          - heading "Far pharmacy" [level=3]
          - paragraph: Opening hours unavailable
          - text: 2.2 km
          - 'button "Map preview: Far pharmacy"'
          - 'link "Open in OpenStreetMap: Far pharmacy"'
      - link "Change location"
      - paragraph:
        - link "Check Finnish pharmacy details at Apteekki.fi"
  `);
});

test('a second tap cancels a pending audio resume', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-20T12:00:00Z'));
  await page.addInitScript(() => {
    let release;
    window.releaseAudio = () => release();
    window.audioStarts = 0;
    window.AudioContext = class {
      resume() {
        return new Promise(resolve => {
          release = resolve;
        });
      }
      createGain() {
        window.audioStarts++;
        throw new Error('Cancelled audio must not create nodes');
      }
    };
  });
  await page.goto('/');
  const melody = page.getByRole('button', { name: 'Christmas melody' });
  await melody.click();
  await expect(melody).toHaveAttribute('aria-pressed', 'true');
  await melody.click();
  await expect(melody).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => window.releaseAudio());
  await expect.poll(() => page.evaluate(() => window.audioStarts)).toBe(0);
});
