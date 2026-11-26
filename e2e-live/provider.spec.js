import {test,expect} from '@playwright/test';
// One public city-centre search, never actual user coordinates. No mocks or retries.
test('Turku city centre: real browser search, CORS and nearest-result rendering',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('#list li').first()).toBeVisible({timeout:75000});
  const first=page.locator('#list li').first();
  await expect(first).toContainText('Closest mapped result');
  await expect(first.locator('h3')).not.toBeEmpty();
  await expect(first.getByRole('link',{name:/View on map:/})).toHaveAttribute('href',/^https:\/\/www\.openstreetmap\.org\//);
  console.log('Live browser search returned',await page.locator('#list li').count(),'visible pharmacy rows');
});
