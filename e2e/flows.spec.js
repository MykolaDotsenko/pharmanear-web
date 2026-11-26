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
 await expect(page.locator('#list li').first()).toContainText('Mapped hours (unverified): Mo-Fr 09:00-18:00');
 await expect(page.locator('#list li').last()).toContainText('Hours not listed');
});
test('capture desktop and mobile screenshots with synthetic results',async({page},testInfo)=>{
 await page.route(endpoint,r=>fulfill(r,fixture));
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');await page.locator('#search-label').click();await expect(page.locator('#list li')).toHaveCount(2);
 await page.screenshot({path:testInfo.outputPath('desktop.png'),fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:testInfo.outputPath('mobile.png'),fullPage:true,animations:'disabled'});
});

test.describe('automated accessibility checks',()=>{
 test.use({bypassCSP:true});
 test('no serious or critical axe WCAG A/AA issues in idle and results states',async({page})=>{
  await page.route(endpoint,r=>fulfill(r,fixture));
  await page.goto('/');
  await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
  const audit=()=>page.evaluate(async()=>{const result=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});return result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});
  expect(await audit()).toEqual([]);
  await page.locator('#search-label').click();await expect(page.locator('#list li')).toHaveCount(2);
  expect(await audit()).toEqual([]);
 });
});

test('task-first results progressively disclose more pharmacies',async({page})=>{
 const rows=Array.from({length:8},(_,i)=>({type:'node',id:i+1,lat:60.4518+i*.0001,lon:22.2666,tags:{amenity:'pharmacy',name:'Pharmacy '+(i+1)}}));
 await page.route(endpoint,r=>fulfill(r,{elements:rows}));await page.goto('/');
 await page.locator('#search-label').click();await expect(page.locator('#list li')).toHaveCount(5);
 await expect(page.locator('.landscape')).toBeHidden();await expect(page.locator('#distance-note')).toBeVisible();
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
