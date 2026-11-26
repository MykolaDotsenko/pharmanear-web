import {test,expect} from '@playwright/test';
const fixture={elements:[{type:'node',id:1,lat:60.47,lon:22.28,tags:{amenity:'pharmacy',name:'Far pharmacy'}},{type:'node',id:2,lat:60.452,lon:22.267,tags:{amenity:'pharmacy',name:'Near pharmacy','addr:street':'Example street'}}]};
// Keep existing live-provider mocks independent of the production catalog.
test.beforeEach(async ({ page }) => {
  await page.route('**/data/current-finland-pharmacies.json', route => route.fulfill({ status: 404 }));
  await page.route('**/data/finland-pharmacies.json', route => route.fulfill({ status: 404 }));
});
const endpoint=/^https:\/\/(overpass-api\.de|overpass\.private\.coffee)\/api\/interpreter$/;
const fulfill=(route,json)=>route.fulfill({json,headers:{'access-control-allow-origin':'*'}});
test('idle is private, search orders results, accessible map link and locale',async({page})=>{
  let requests=0;await page.route(endpoint,r=>{requests++;expect(r.request().postData()).toContain('60.45');return fulfill(r,fixture);});
  await page.goto('/');expect(requests).toBe(0);
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('#list li').first()).toContainText('Near pharmacy');
  await expect(page.getByRole('link',{name:'View on map: Near pharmacy'})).toHaveAttribute('href',/openstreetmap\.org/);
  await page.locator('#language').selectOption('fi');
  await expect(page.locator('html')).toHaveAttribute('lang','fi');
  await expect(page.locator('#list li').first()).toContainText('Lähin karttatulos');
  expect(requests).toBe(1);
});
test('provider failure is recoverable',async({page})=>{
  let fail=true;await page.route(endpoint,r=>fail?r.fulfill({status:503,headers:{'access-control-allow-origin':'*'}}):fulfill(r,fixture));
  await page.goto('/');await page.locator('#search-label').click();
  await expect(page.getByRole('status')).toContainText('temporarily unavailable');
  fail=false;await page.locator('#search-label').click();await expect(page.locator('#list li')).toHaveCount(2);
});
test('cancel invalidates delayed results',async({page})=>{
  let release;const delayed=new Promise(r=>release=r);await page.route(endpoint,async route=>{await delayed;await fulfill(route,fixture).catch(()=>{});});
  await page.goto('/');await page.locator('#search-label').click();await expect(page.getByRole('status')).toContainText('Searching');
  await page.locator('#cancel').click();release();await expect(page.getByRole('status')).toHaveText('Search cancelled.');await expect(page.locator('#list li')).toHaveCount(0);
});
test('mobile reduced motion and dark theme remain usable',async({page})=>{
  await page.setViewportSize({width:320,height:740});await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});await page.goto('/');
  await expect(page.locator('#locate')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.locator-art').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});
test('device search sends rounded coordinates',async({page,context})=>{
  await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:60.4518,longitude:22.2666});
  await page.route(endpoint,r=>{const body=new URLSearchParams(r.request().postData());expect(body.get('data')).toContain('3000,60.45,22.27');expect(body.get('data')).not.toContain('60.4518');return fulfill(r,fixture);});
  await page.goto('/');await page.getByRole('button',{name:'Use my location'}).click();await expect(page.locator('#list li')).toHaveCount(2);
});

test('map requires explicit action and closes with restored focus',async({page})=>{
 let maps=0;
 await page.route(endpoint,r=>fulfill(r,fixture));
 await page.route('https://www.openstreetmap.org/export/embed.html?*',r=>{maps++;return r.fulfill({contentType:'text/html',body:'<p>Mock map</p>'});});
 await page.goto('/');await page.locator('#search-label').click();
 const button=page.getByRole('button',{name:'Map preview: Near pharmacy'});
 await expect(button).toBeVisible();expect(maps).toBe(0);
 await button.click();await expect(page.locator('#map-frame iframe')).toHaveAttribute('src',/marker=60.452%2C22.267/);
 await page.locator('#close-map').click();await expect(page.locator('#map-panel')).toBeHidden();await expect(button).toBeFocused();
});
test('missing or unverified hours never become an open-now claim',async({page})=>{
 await page.route(endpoint,r=>fulfill(r,{elements:[{...fixture.elements[1],tags:{...fixture.elements[1].tags,opening_hours:'Mo-Fr 09:00-18:00'}},fixture.elements[0]]}));
 await page.goto('/');await page.locator('#search-label').click();
 await expect(page.locator('#list li').first()).toContainText('Mapped hours (unverified)');
 await expect(page.locator('#list li').last()).toContainText('Hours not listed');
});
test('capture desktop and mobile screenshots with synthetic results',async({page},testInfo)=>{
 await page.route(endpoint,r=>fulfill(r,fixture));
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');await page.locator('#search-label').click();await expect(page.locator('#list li')).toHaveCount(2);
 await page.screenshot({path:testInfo.outputPath('desktop.png'),fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:testInfo.outputPath('mobile.png'),fullPage:true,animations:'disabled'});
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
        await page.route(endpoint, route => fulfill(route, fixture));
        await page.route('https://www.openstreetmap.org/export/embed.html?*', route =>
          route.fulfill({ contentType: 'text/html', body: '<p>Mock map</p>' }),
        );
        await page.goto('/');
        expect(await audit(page)).toEqual([]);

        await page.locator('#search-label').click();
        await expect(page.locator('#list li')).toHaveCount(2);
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
      'language',
      'locate',
      'privacy-summary',
      'city',
      'search-label',
      'directory',
      'A',
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
    await expect(page.getByRole('status')).toContainText('Åbo');
  });
});

test('task-first results progressively disclose more pharmacies',async({page})=>{
 const rows=Array.from({length:8},(_,i)=>({type:'node',id:i+1,lat:60.4518+i*.0001,lon:22.2666,tags:{amenity:'pharmacy',name:'Pharmacy '+(i+1)}}));
 await page.route(endpoint,r=>fulfill(r,{elements:rows}));await page.goto('/');
 await page.locator('#search-label').click();await expect(page.locator('#list li')).toHaveCount(5);
 await expect(page.locator('.landscape')).toBeHidden();await page.locator('#result-details summary').click();await expect(page.locator('#distance-note')).toBeVisible();
 await page.getByRole('button',{name:'Show more pharmacies'}).click();await expect(page.locator('#list li')).toHaveCount(8);
 await page.getByRole('button',{name:'Show fewer pharmacies'}).click();await expect(page.locator('#list li')).toHaveCount(5);
 await page.getByRole('link',{name:'Change location'}).click();await expect(page.locator('#locate')).toBeFocused();
});
test('recovery offers retry and independent directory',async({page})=>{
 let fail=true;await page.route(endpoint,r=>fail?r.fulfill({status:503,headers:{'access-control-allow-origin':'*'}}):fulfill(r,fixture));
 await page.goto('/');await page.locator('#search-label').click();
 await expect(page.getByRole('link',{name:'Find a pharmacy on Apteekki.fi'})).toBeVisible();
 fail=false;await page.getByRole('button',{name:'Try again'}).click();await expect(page.locator('#list li')).toHaveCount(2);
 await expect(page.locator('#recovery')).toBeHidden();
});

test('Christmas details are seasonal and never obstruct search results',async({page},testInfo)=>{
 await page.clock.setFixedTime(new Date('2026-12-20T12:00:00Z'));
 await page.route(endpoint,r=>fulfill(r,fixture));
 await page.goto('/');
 await expect(page.locator('body')).toHaveAttribute('data-season','christmas');
 await expect(page.locator('.festive-art')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('nordic-christmas.png'),fullPage:true,animations:'disabled'});
 await page.locator('#search-label').click();
 await expect(page.locator('#list li')).toHaveCount(2);
 await expect(page.locator('.festive-art')).toBeHidden();
 await page.clock.setFixedTime(new Date('2027-01-07T12:00:00Z'));
 await page.reload();
 await expect(page.locator('.festive-art')).toBeHidden();
 await expect(page.locator('#locate')).toBeVisible();
});

test('Christmas palette uses accessible festive actions in light and dark mode',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-12-20T12:00:00Z'));
 await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
 await page.goto('/');
 const background=()=>page.locator('#locate').evaluate(el=>getComputedStyle(el).backgroundColor);
 expect(await background()).toBe('rgb(139, 38, 59)');
 await page.emulateMedia({colorScheme:'dark'});
 expect(await background()).toBe('rgb(174, 62, 84)');
 await page.clock.setFixedTime(new Date('2027-01-07T12:00:00Z'));
 await page.reload();
 expect(await background()).not.toBe('rgb(174, 62, 84)');
});

test('independent provider recovers from a primary outage',async({page})=>{
 let primary=0,backup=0;
 await page.route('https://overpass-api.de/api/interpreter',r=>{primary++;return r.fulfill({status:503,headers:{'access-control-allow-origin':'*'}});});
 await page.route('https://overpass.private.coffee/api/interpreter',r=>{backup++;return fulfill(r,fixture);});
 await page.goto('/');await page.locator('#search-label').click();
 await expect(page.locator('#list li').first()).toContainText('Near pharmacy');
 expect(primary).toBe(1);expect(backup).toBe(1);
});

test('local catalog renders results while both live providers are unavailable',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-26T12:00:00Z'));
 let liveRequests=0;
 await page.route(endpoint,route=>{liveRequests++;return route.abort();});
 await page.route('**/data/finland-pharmacies.json',route=>route.fulfill({json:{...fixture,schema:1,region:'FI',license:'ODbL-1.0',sourceDate:'2026-11-25T00:00:00Z'}}));
 await page.goto('/');await page.locator('#search-label').click();
 await expect(page.locator('#list li').first()).toContainText('Near pharmacy');
 await page.locator('#result-details summary').click();
 await expect(page.locator('#source-note')).toContainText('OSM catalog date: 2026-11-25');
 expect(liveRequests).toBe(0);
});

test('mobile search keeps details collapsed and preserves readable hours',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route(endpoint,r=>fulfill(r,{elements:[{...fixture.elements[1],tags:{...fixture.elements[1].tags,opening_hours:'Mo-Fr 09:00-18:00; Sa 10:00-14:00'}}]}));
 await page.goto('/');await page.locator('#search-label').click();
 await expect(page.locator('#list li')).toHaveCount(1);
 await expect(page.locator('#result-details')).not.toHaveAttribute('open','');
 await expect(page.locator('.hours-value')).toHaveText('Mo-Fr 09:00-18:00 · Sa 10:00-14:00');
 await page.locator('#result-details summary').click();await expect(page.locator('#distance-note')).toBeVisible();
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
