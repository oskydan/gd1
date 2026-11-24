import {test,expect} from 'playwright/test';
import fs from 'node:fs';
const root=new URL('../../',import.meta.url);
const date=fs.readFileSync(new URL('index.html',root),'utf8').match(/camp-listings-as-of: ([\d-]+)/)[1];
const camps=JSON.parse(fs.readFileSync(new URL('data/camps.json',root),'utf8')).camps;
const upcoming=camps.filter(c=>c.endsOn>=date).sort((a,b)=>a.startsOn.localeCompare(b.startsOn));
const past=camps.filter(c=>c.endsOn<date);
const pages=['index.html','index-uk.html','camps.html','camps-uk.html'];
test.describe('Camp listings without JavaScript',()=>{
 test.use({javaScriptEnabled:false});
 for(const file of pages)test(file,async({page})=>{
  await page.goto('/'+file);
  const list=page.locator(file.startsWith('index')?'#home-camp-list':'#upcoming-camps');
  const expected=file.startsWith('index')?upcoming.slice(0,3):upcoming;
  await expect(list.locator('article')).toHaveCount(expected.length);
  if(expected.length)await expect(list.locator('article').first()).toBeVisible();
  expect(await list.locator('article').evaluateAll(cards=>cards.map(c=>c.dataset.campId))).toEqual(expected.map(c=>c.id));
  for(const card of await list.locator('article').all()){
   const id=await card.getAttribute('data-camp-id');const camp=camps.find(c=>c.id===id);
   if(camp.status==='open'&&camp.startsOn>date)await expect(card.locator('a.register-button')).toHaveAttribute('target','_blank');
   else await expect(card.locator('.register-button')).toHaveAttribute('aria-disabled','true');
   if(camp.page&&camp.status==='open')expect(await card.locator('a[href$=".html"]').count()).toBeGreaterThan(0);
   await expect(card.locator('img')).toHaveAttribute('alt',/.+/);
  }
  if(file.startsWith('camps'))await expect(page.locator('#past-camps article')).toHaveCount(Math.min(12,past.length));
 });
});
for(const file of pages)test(`Static and interactive cards match: ${file}`,async({page})=>{
 await page.clock.install({time:new Date(date+'T12:00:00Z')});
 const response=await page.goto('/'+file);const source=await response.text();
 const ids=file.startsWith('index')?['home-camp-list']:['upcoming-camps','past-camps'];
 for(const id of ids){
  const expected=await page.evaluate(({source,id})=>new DOMParser().parseFromString(source,'text/html').getElementById(id).innerHTML.replace(/<!--.*?-->/gs,'').trim(),{source,id});
  await expect.poll(()=>page.locator('#'+id).evaluate(e=>e.innerHTML.replace(/<!--.*?-->/gs,'').trim())).toBe(expected);
 }
});
