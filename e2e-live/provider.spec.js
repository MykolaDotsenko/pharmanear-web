import {test,expect} from '@playwright/test';
test('real Turku search returns pharmacies',async({page})=>{
 test.setTimeout(100000);
 page.on('requestfailed',r=>{if(r.url().includes('/api/interpreter'))console.log('Provider request failed:',new URL(r.url()).hostname,r.failure()?.errorText);});
 page.on('response',r=>{if(r.url().includes('/api/interpreter'))console.log('Provider response:',new URL(r.url()).hostname,r.status());});
 await page.goto('/');
 await page.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page.locator('.results')).toHaveAttribute('data-state',/^(found|empty|error)$/, {timeout:90000});
 console.log('Final status:',await page.locator('#status').textContent());
 await expect(page.locator('#list li').first()).toBeVisible();
 console.log('Real pharmacy rows:',await page.locator('#list li').count());
});
