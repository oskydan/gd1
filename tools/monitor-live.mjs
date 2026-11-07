// Read-only checks of the published site. Never submit a registration form.
import { chromium, request } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
const origin='https://'+readFileSync(resolve(root,'CNAME'),'utf8').trim();
const data=JSON.parse(readFileSync(resolve(root,'data/camps.json'),'utf8'));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const camps=data.camps.filter(c=>c.status==='open'&&c.endsOn>=today);
const browser=await chromium.launch(process.env.GD1_TEST_CHROME_PATH?{executablePath:process.env.GD1_TEST_CHROME_PATH}:{});
const context=await browser.newContext();
const formRequests=await request.newContext();
// Live monitoring must not create analytics visits or replays.
await context.route(/mixpanel|mxpnl/i,route=>route.abort());
const results=[];
async function check(name,fn){
 let failure;
 for(let attempt=1;attempt<=3;attempt++){
  try{await fn();results.push({name,ok:true,attempt});console.log('PASS '+name);return;}
  catch(error){failure=String(error.message||error);if(attempt<3)await delay(5000);}
 }
 results.push({name,ok:false,error:failure});console.error('FAIL '+name+': '+failure);
}
try{
 for(const language of ['en','uk']){
  const suffix=language==='uk'?'-uk':'';
  const pages=['index','camps','coach','school','gallery','contact'].map(p=>p+suffix+'.html');
  pages.push(...camps.filter(c=>c.page).map(c=>c.page.replace('.html',suffix+'.html')));
  for(const file of pages)await check(file,async()=>{
   const page=await context.newPage();const errors=[];
   page.on('response',r=>{if(r.url().startsWith(origin+'/')&&r.status()>=400)errors.push(r.status()+' '+r.url());});
   page.on('requestfailed',r=>{if(r.url().startsWith(origin+'/'))errors.push(r.url()+' '+r.failure()?.errorText);});
   try{
    const response=await page.goto(origin+'/'+file,{waitUntil:'networkidle',timeout:45000});
    if(!response||response.status()!==200)throw Error('Page status '+response?.status());
    if(await page.locator('html').getAttribute('lang')!==language)throw Error('Wrong page language');
    if(!await page.locator('main').innerText({timeout:5000}))throw Error('Missing page content');
    if(await page.locator('body').evaluate(el=>el.classList.contains('not-found-page')))throw Error('404 content returned');
    const relevant=file.startsWith('index')||file.startsWith('camps')?camps:camps.filter(c=>file===c.page?.replace('.html',suffix+'.html'));
    for(const camp of relevant){
     const links=page.locator('a').filter({hasText:language==='uk'?/реєстр/i:/register/i});
     const targets=await links.evaluateAll(els=>els.map(el=>({href:el.href,target:el.target})));
     if(!targets.some(a=>a.href===camp.registrationUrl&&a.target==='_blank'))throw Error('Missing new-tab registration link for '+camp.id);
    }
    const broken=await page.locator('img').evaluateAll(images=>images.filter(i=>i.getAttribute('src')&&i.loading!=='lazy'&&(!i.complete||i.naturalWidth===0)).map(i=>i.src));
    if(broken.length)errors.push(...broken);
    if(errors.length)throw Error('Essential resource failures: '+errors.join('; '));
   }finally{await page.close();}
  });
 }
 for(const url of new Set(camps.map(c=>c.registrationUrl)))await check('Registration '+url,async()=>{
  const response=await formRequests.get(url,{timeout:30000,maxRedirects:10});
  if(response.status()!==200)throw Error('Form status '+response.status());
  const html=await response.text();
  if(!['forms.gle','docs.google.com'].includes(new URL(response.url()).hostname))throw Error('Unexpected destination '+response.url());
  if(/no longer accepting responses|form has been deleted|requested file does not exist/i.test(html))throw Error('Form is unavailable or closed');
  if(!html.includes('FB_PUBLIC_LOAD_DATA_')||!/<form[^>]+action="https:\/\/docs\.google\.com\/forms\/[^"]+\/formResponse"/i.test(html))throw Error('Expected public Google Form not found (possibly login required)');
 });
}finally{await formRequests.dispose();await context.close();await browser.close();}
const failed=results.filter(r=>!r.ok);
const report='# Published site monitoring\n\n'+results.map(r=>`- ${r.ok?'PASS':'FAIL'} ${r.name}${r.error?': '+r.error:''}`).join('\n')+'\n';
writeFileSync(resolve(root,'monitor-report.md'),report);
if(process.env.GITHUB_STEP_SUMMARY)writeFileSync(process.env.GITHUB_STEP_SUMMARY,report,{flag:'a'});
if(failed.length){console.error(`${failed.length} live checks failed`);process.exitCode=1;}
