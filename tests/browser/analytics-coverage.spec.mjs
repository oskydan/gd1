import {test,expect} from 'playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const pages=fs.readdirSync(root).filter(f=>f.endsWith('.html')&&!fs.readFileSync(path.join(root,f),'utf8').includes('<meta name="robots" content="noindex, nofollow">'));
for(const filename of pages)test(`Mixpanel page coverage: ${filename}`,async({page})=>{
 const html=fs.readFileSync(path.join(root,filename),'utf8');
 const context=JSON.parse(html.match(/<script type="application\/json" id="gd1-page-context">(.*?)<\/script>/s)[1]);
 expect(context.page_type).not.toBe('page');
 await page.addInitScript(()=>{
  localStorage.setItem('gd1_analytics_consent_v2',JSON.stringify({allowed:true,savedAt:Date.now()}));
  Object.defineProperty(navigator,'globalPrivacyControl',{value:false});
  Object.defineProperty(navigator,'doNotTrack',{value:null});
  window.analyticsEvents=[];
  window.mixpanel={init(token,options){options.loaded({track:(name,props)=>window.analyticsEvents.push({name,props}),opt_in_tracking(){},opt_out_tracking(){},start_session_recording(){}})}};
 });
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='gd1-coverage.example')return route.abort();
  const file=path.join(root,decodeURIComponent(url.pathname));
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
  await route.fulfill({path:file});
 });
 await page.goto(`https://gd1-coverage.example/${filename}`,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.analyticsEvents.filter(e=>e.name==='Page Viewed').length)).toBe(1);
 const event=await page.evaluate(()=>window.analyticsEvents.find(e=>e.name==='Page Viewed'));
 const expected={...context};if(expected.camp_id){expected.page_camp_id=expected.camp_id;delete expected.camp_id;}
 expect(event.props).toMatchObject({...expected,page_language:filename.endsWith('-uk.html')?'uk':'en'});
 // Metadata remains stable if a browser translates the visible page title.
 await page.evaluate(()=>document.title='Browser translated title');
 expect(event.props.page_title).toBe(context.page_title);
});
