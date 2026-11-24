import {test,expect} from 'playwright/test';
import fs from 'node:fs';
const camps=JSON.parse(fs.readFileSync(new URL('../../data/camps.json',import.meta.url),'utf8')).camps.filter(c=>c.page&&c.status==='open');
const starts={'prague-december-2026':'2026-12-20T23:00:00Z','elektrenai-december-2026':'2026-12-26T22:00:00Z','kranevo-april-2027':'2027-04-05T21:00:00Z'};
test.use({timezoneId:'America/Los_Angeles'});
for(const lang of ['en','uk'])for(const camp of camps){
 test(`${lang}: ${camp.id} switches from registration to photos at venue midnight`,async({page})=>{
  const boundary=Date.parse(starts[camp.id]);
  await page.clock.install({time:new Date(boundary-2000)});await page.clock.pauseAt(new Date(boundary-1000));
  await page.goto('/'+camp.page.replace('.html',lang==='uk'?'-uk.html':'.html'));
  await expect(page.locator('a.camp-detail-cta')).toHaveCount(2);
  await page.clock.runFor(1000);
  await expect(page.locator('a.camp-detail-cta')).toHaveCount(0);
  expect(await page.locator('#gd1-event-data').evaluate(e=>JSON.parse(e.textContent).offers)).toBeUndefined();
  await expect(page.locator('.camp-is-running')).toContainText(lang==='uk'?'КЕМП ТРИВАЄ':'CAMP IN PROGRESS');
  await expect(page.locator('.camp-detail-registration')).toBeHidden();
  await expect(page.locator('.camp-calendar')).toBeHidden();
  await expect(page.locator('.camp-photos-note')).toBeVisible();
  const photo=page.locator('.camp-share .camp-photos-button');
  await expect(photo).toBeVisible();
  await expect(page.locator('.camp-share > .camp-share-button')).toBeVisible();
  expect(await photo.evaluate(e=>e.nextElementSibling.classList.contains('camp-share-button'))).toBe(true);
  if(camp.photosUrl){await expect(photo).toHaveAttribute('href',camp.photosUrl);await expect(photo).toHaveAttribute('target','_blank');}
  else {await expect(photo).toHaveAttribute('aria-disabled','true');await expect(photo).not.toHaveAttribute('href',/.+/);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto('/camps'+(lang==='uk'?'-uk':'')+'.html');
  await expect(page.locator(`[data-camp-id="${camp.id}"] .register-button`)).toHaveAttribute('aria-disabled','true');
 });
}
