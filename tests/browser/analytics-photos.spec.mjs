import {test,expect} from 'playwright/test';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
for(const lang of ['en','uk'])for(const choice of ['allowed','rejected','gpc']){
 test(`${lang}: photo clicks respect ${choice} consent`,async({page})=>{
  await page.clock.install({time:new Date('2026-12-22T12:00:00Z')});
  await page.route('https://gd1-analytics.example/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="${lang}"><body data-camp-id="prague-december-2026"><main><section class="camp-detail-hero"><a class="button camp-photos-button" href="https://gd1school.pixieset.com/2026-12-prague/?private=excluded#photo"><svg width="24" height="24"><rect width="24" height="24"/></svg>Photos</a></section><span class="camp-photos-button" aria-disabled="true">Unavailable</span></main><aside class="mobile-camp-bar"><a class="camp-photos-button" href="https://gd1school.pixieset.com/2026-12-prague/">Photos</a></aside></body></html>`}));
  await page.goto(`https://gd1-analytics.example/prague-czech-republic-dec-2026${lang==='uk'?'-uk':''}.html`);
  await page.evaluate(({lang,choice})=>{
   localStorage.setItem('gd1_analytics_consent_v2',JSON.stringify({allowed:choice!=='rejected',savedAt:Date.now()}));
   Object.defineProperty(navigator,'globalPrivacyControl',{value:choice==='gpc'});
   Object.defineProperty(navigator,'doNotTrack',{value:null});
   window.events=[];window.mixpanel={init(token,options){options.loaded({track:(name,props)=>window.events.push({name,props}),opt_in_tracking(){},opt_out_tracking(){},start_session_recording(){}})}};
   window.GD1_CAMPS=[{id:'prague-december-2026',title:lang==='uk'?'Прага, Чехія':'Prague, Czech Republic',period:'21–26 December 2026',startsOn:'2026-12-21',endsOn:'2026-12-26',timeZone:'Europe/Prague'}];
   // Keep test clicks on this page while running the real delegated listener.
   document.addEventListener('click',e=>e.preventDefault());
  },{lang,choice});
  await page.addScriptTag({path:path.join(root,'analytics.js')});
  await page.locator('.camp-detail-hero svg rect').click();
  await page.locator('.mobile-camp-bar a').click();
  await page.locator('span[aria-disabled="true"]').click();
  const events=await page.evaluate(()=>window.events.filter(e=>e.name==='Camp Photos Clicked'));
  if(choice!=='allowed'){expect(events).toHaveLength(0);return;}
  expect(events).toHaveLength(2);
  expect(events.map(e=>e.props.photo_location)).toEqual(['hero','mobile_sticky']);
  for(const {props} of events){
   expect(props).toMatchObject({camp_id:'prague-december-2026',page_language:lang,photo_provider:'Pixieset',camp_status:'in_progress',destination_host:'gd1school.pixieset.com',destination_path:'/2026-12-prague/'});
   expect(JSON.stringify(props)).not.toContain('private=');
  }
  await page.clock.setSystemTime(new Date('2027-01-01T12:00:00Z'));
  await page.locator('.mobile-camp-bar a').click();
  expect(await page.evaluate(()=>window.events.filter(e=>e.name==='Camp Photos Clicked').at(-1).props.camp_status)).toBe('completed');
 });
}
