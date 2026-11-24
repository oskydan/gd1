import {test,expect} from 'playwright/test';
import fs from 'node:fs';
const analytics=fs.readFileSync(new URL('../../analytics.js',import.meta.url),'utf8');
const host='https://gd1-referrals.example';
const key='gd1_chatgpt_referral_v1';
async function setup(page,lang,privacy='allowed'){
 await page.addInitScript(({privacy})=>{
  localStorage.setItem('gd1_analytics_consent_v2',JSON.stringify({allowed:privacy!=='rejected',savedAt:Date.now()}));
  Object.defineProperty(navigator,'globalPrivacyControl',{value:privacy==='gpc'});
  Object.defineProperty(navigator,'doNotTrack',{value:privacy==='dnt'?'1':null});
  window.events=[];window.mixpanel={init(token,options){options.loaded({track:(name,props)=>events.push({name,props}),opt_in_tracking(){},opt_out_tracking(){},start_session_recording(){}})}};
 },{privacy});
 await page.route(host+'/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="${lang}"><body data-camp-id="prague-december-2026"><a href="${host}/camps${lang==='uk'?'-uk':''}.html" id="next">Camps</a><a class="register-button" href="https://forms.gle/example">Register</a><script>document.addEventListener('click',e=>{if(e.target.closest('.register-button'))e.preventDefault()});</script><script>${analytics}</script></body></html>`}));
}
for(const lang of ['en','uk']){
 const indexPath=lang==='uk'?'/index-uk.html':'/index.html';
 const campsPath=lang==='uk'?'/camps-uk.html':'/camps.html';
 for(const method of ['utm','referrer'])test(`${lang}: ChatGPT ${method} persists to registration without raw URLs`,async({page})=>{
  await setup(page,lang);
  await page.goto(host+indexPath+(method==='utm'?'?utm_source=chatgpt.com&private=secret':''),method==='referrer'?{referer:'https://chatgpt.com/c/private-conversation?secret=yes'}:{});
  const expected={referral_source:'chatgpt',referral_method:method,referral_landing_path:indexPath,page_language:lang};
  expect(await page.evaluate(()=>events.find(e=>e.name==='Page Viewed').props)).toMatchObject(expected);
  await page.locator('#next').click();
  await page.locator('.register-button').click();
  const event=await page.evaluate(()=>events.find(e=>e.name==='Registration Clicked'));
  expect(event.props).toMatchObject(expected);
  const stored=await page.evaluate(key=>sessionStorage.getItem(key),key);
  expect(stored).not.toContain('secret');expect(stored).not.toContain('chatgpt.com/c/');
  await page.locator('[data-analytics-choice="reject"]').evaluate(e=>e.click());
  expect(await page.evaluate(key=>sessionStorage.getItem(key),key)).toBeNull();
 });
 for(const privacy of ['rejected','gpc','dnt'])test(`${lang}: ${privacy} prevents referral tracking and storage`,async({page})=>{
  await setup(page,lang,privacy);await page.goto(host+indexPath+'?utm_source=chatgpt.com');
  await page.locator('.register-button').click();
  expect(await page.evaluate(()=>events)).toEqual([]);
  expect(await page.evaluate(key=>sessionStorage.getItem(key),key)).toBeNull();
 });
 test(`${lang}: spoofed domains do not count as ChatGPT`,async({page})=>{
  await setup(page,lang);await page.goto(host+indexPath,{referer:'https://chatgpt.com.fake.example/'});
  expect(await page.evaluate(()=>events[0].props.referral_source)).toBeUndefined();
 });
 test(`${lang}: attribution expires after inactivity`,async({page})=>{
  await setup(page,lang);await page.clock.install({time:new Date('2026-11-24T12:00:00Z')});
  await page.goto(host+indexPath+'?utm_source=chatgpt.com');
  await page.clock.setSystemTime(new Date('2026-11-24T12:31:00Z'));
  await page.locator('.register-button').click();
  expect(await page.evaluate(()=>events.find(e=>e.name==='Registration Clicked').props.referral_source)).toBeUndefined();
  await page.locator('#next').click();
  expect(await page.evaluate(()=>events[0].props.referral_source)).toBeUndefined();
 });
 test(`${lang}: a new external campaign clears attribution`,async({page})=>{
  await setup(page,lang);await page.goto(host+indexPath+'?utm_source=chatgpt.com');
  await page.goto(host+campsPath+'?utm_source=newsletter');
  expect(await page.evaluate(()=>events[0].props.referral_source)).toBeUndefined();
  expect(await page.evaluate(key=>sessionStorage.getItem(key),key)).toBeNull();
 });
}
