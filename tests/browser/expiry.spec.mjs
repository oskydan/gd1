import {test,expect} from 'playwright/test';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const data=JSON.parse(fs.readFileSync(new URL('../../data/camps.json',import.meta.url),'utf8'));
// Independent expected boundaries from Python's IANA time-zone library.
const expected=JSON.parse(execFileSync(process.env.GD1_TEST_PYTHON_PATH||'python3',['-c',`
import sys,json
from datetime import datetime,date,time,timedelta,timezone
from zoneinfo import ZoneInfo
camps=json.load(sys.stdin)['camps']
print(json.dumps({c['id']:datetime.combine(date.fromisoformat(c['endsOn'])+timedelta(days=1),time.min,ZoneInfo(c['timeZone'])).astimezone(timezone.utc).isoformat() for c in camps}))
`],{input:JSON.stringify(data),encoding:'utf8'}));
const camps=data.camps.filter(c=>c.page&&c.status==='open');
test.use({timezoneId:'America/Los_Angeles'});
async function beforeExpiry(page,camp){
 const boundary=Date.parse(expected[camp.id]);
 await page.clock.install({time:new Date(boundary-2000)});
 await page.clock.pauseAt(new Date(boundary-1000));
}
for(const language of ['en','uk']){
 const suffix=language==='uk'?'-uk':'';
 const completed=language==='uk'?'Кемп завершено':'Camp Completed';
 for(const camp of camps){
  test(`${language}: ${camp.id} expires on camp-local midnight`,async({page,context})=>{
   await beforeExpiry(page,camp);
   await page.goto('/'+camp.page.replace('.html',suffix+'.html'));
   await expect(page.locator('a.camp-detail-cta')).toHaveCount(2);
   await page.clock.runFor(1000);
   await expect(page.locator('a.camp-detail-cta')).toHaveCount(0);
   const buttons=page.locator('.camp-detail-cta');await expect(buttons).toHaveCount(2);
   for(const button of await buttons.all()){
    await expect(button).toHaveText(completed);await expect(button).toHaveAttribute('aria-disabled','true');await expect(button).not.toHaveAttribute('href',/.+/);
   }
   await page.goto('/index'+suffix+'.html');
   await expect(page.locator('#home-camp-list [data-camp-id="'+camp.id+'"]')).toHaveCount(0);
   await page.goto('/camps'+suffix+'.html');
   await expect(page.locator('#upcoming-camps [data-camp-id="'+camp.id+'"]')).toHaveCount(0);
   const past=page.locator('#past-camps [data-camp-id="'+camp.id+'"]');await expect(past).toBeVisible();
   await expect(past.locator('a')).toHaveCount(1);
   await expect(past.locator('.camp-card-hitarea')).toHaveAttribute('href',camp.page.replace('.html',suffix+'.html'));await expect(past.locator('.register-button')).toHaveText(completed);
   await expect(page.locator('.footer-links a[href$="#'+camp.id+'"]')).toBeHidden();
   if(camps.every(c=>Date.parse(expected[c.id])<=Date.parse(expected[camp.id])))await expect(page.locator('.footer-camp-empty')).toBeVisible();
   await past.locator('.camp-card-hitarea').click();
   await expect(page).toHaveURL(new RegExp(camp.page.replace('.html',suffix+'\\.html')+'$'));
   await expect(page.locator('a.camp-detail-cta')).toHaveCount(0);
   await expect(page.locator('.camp-detail-cta').first()).toHaveText(completed);
  });
 }
 test(`${language}: an open Camps tab moves a camp and preserves pagination`,async({page})=>{
  const camp=camps.slice().sort((a,b)=>a.endsOn.localeCompare(b.endsOn))[0];
  await beforeExpiry(page,camp);await page.goto('/camps'+suffix+'.html');
  const more=page.locator('#past-camps-load-more');
  let limit=12;
  if(await more.isVisible()){await more.click();limit=24;}

  await expect(page.locator('#upcoming-camps [data-camp-id="'+camp.id+'"]')).toBeVisible();
  await page.clock.runFor(1000);
  await expect(page.locator('#upcoming-camps [data-camp-id="'+camp.id+'"]')).toHaveCount(0);
  await expect(page.locator('#past-camps [data-camp-id="'+camp.id+'"] .register-button')).toHaveText(completed);
  const total=data.camps.filter(c=>Date.parse(expected[c.id])<=Date.parse(expected[camp.id])).length;
  await expect(page.locator('#past-camps article')).toHaveCount(Math.min(limit,total));
  if(total>limit){await expect(more).toBeVisible();await more.click();await expect(page.locator('#past-camps article')).toHaveCount(Math.min(limit+12,total));}
 });
 test(`${language}: a resumed homepage removes a newly completed camp`,async({page})=>{
  const camp=camps[0];await beforeExpiry(page,camp);await page.goto('/index'+suffix+'.html');
  await expect(page.locator('#home-camp-list [data-camp-id="'+camp.id+'"]')).toBeVisible();
  // System-time changes do not fire timers; focus must recheck the state.
  await page.clock.setSystemTime(new Date(expected[camp.id]));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#home-camp-list [data-camp-id="'+camp.id+'"]')).toHaveCount(0);
 });
 test(`${language}: a stale registration click cannot open a form`,async({page,context})=>{
  const camp=camps[0];await beforeExpiry(page,camp);await page.goto('/'+camp.page.replace('.html',suffix+'.html'));
  const before=context.pages().length;
  await page.clock.setSystemTime(new Date(expected[camp.id]));
  await page.locator('a.camp-detail-cta').first().evaluate(el=>el.click());
  await expect(page.locator('a.camp-detail-cta')).toHaveCount(0);expect(context.pages()).toHaveLength(before);
 });
}
