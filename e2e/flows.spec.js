import {test,expect} from '@playwright/test';
const fixture={elements:[{type:'node',id:1,lat:60.47,lon:22.28,tags:{amenity:'pharmacy',name:'Far pharmacy'}},{type:'node',id:2,lat:60.452,lon:22.267,tags:{amenity:'pharmacy',name:'Near pharmacy','addr:street':'Example street'}}]};
const endpoint='https://overpass-api.de/api/interpreter';
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
