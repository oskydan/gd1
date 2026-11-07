import {test,expect} from 'playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
async function accessible(page,testInfo,state){
  await page.evaluate(()=>document.fonts.ready);
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  await testInfo.attach(`accessibility-${state}`,{body:JSON.stringify({url:page.url(),violations:result.violations,incomplete:result.incomplete},null,2),contentType:'application/json'});
  expect(result.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,url:v.helpUrl,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
}
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    return ['127.0.0.1','localhost'].includes(url.hostname)||url.protocol==='data:'||url.protocol==='blob:'?route.continue():route.abort();
  });
});
for(const filename of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){
  test(`WCAG AA: ${filename}`,async({page},testInfo)=>{
    await page.goto('/'+filename);await accessible(page,testInfo,'page');
  });
}
for(const suffix of ['','-uk']){
  test(`navigation and language options ${suffix||'en'}`,async({page,isMobile},testInfo)=>{
    await page.goto('/index'+suffix+'.html');
    await page.locator(isMobile?'.menu-toggle':'.language-toggle').click();
    await accessible(page,testInfo,'navigation-open');
  });
  test(`gallery states ${suffix||'en'}`,async({page},testInfo)=>{
    await page.goto('/gallery'+suffix+'.html');
    await page.locator('.gallery-photo-open').first().click();
    await accessible(page,testInfo,'photo-dialog');
    await page.keyboard.press('Escape');
    await page.getByRole('tab').last().click();
    await accessible(page,testInfo,'video-tab');
  });
}
