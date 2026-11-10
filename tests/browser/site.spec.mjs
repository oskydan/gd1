import {test,expect} from 'playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const source=JSON.parse(fs.readFileSync(path.join(root,'data/camps.json'),'utf8'));
const detailCamps=source.camps.filter(c=>c.page).sort((a,b)=>a.startsOn.localeCompare(b.startsOn));
const clockDate=new Date(Date.parse((detailCamps[0]||source.camps[0]).startsOn+'T12:00:00Z')-86400000);
const upcoming=source.camps.filter(c=>c.endsOn>=clockDate.toISOString().slice(0,10)).sort((a,b)=>a.startsOn.localeCompare(b.startsOn));
const camps=detailCamps.filter(c=>c.status==='open');
const failures=new WeakMap();
const expected404=new WeakMap();

test.beforeEach(async({page,context})=>{
  const errors=[];failures.set(page,errors);expected404.set(page,new Set());
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',res=>{if(res.url().startsWith('http://127.0.0.1:4173')&&res.status()>=400){
    if(res.status()===404&&expected404.get(page).has(new URL(res.url()).pathname))return;
    errors.push(`${res.status()} ${res.url()}`);
  }});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    // WebKit routes its local media Blob URLs through interception too.
    if(url.protocol==='data:' || (url.protocol==='blob:'&&url.origin==='http://127.0.0.1:4173'))return route.continue();
    if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
    if(url.hostname==='forms.gle')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Registration test</title><p>Test form destination</p>'});
    errors.push('Unexpected external request: '+url.hostname);return route.abort();
  });
  await page.clock.install({time:clockDate});
});
test.afterEach(async({page})=>{expect(failures.get(page),'No JavaScript errors, broken resources or external tracking requests').toEqual([])});

async function layout(page){
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow').toBe(true);
  expect(await page.locator('img:not([loading="lazy"])').evaluateAll(images=>images.filter(i=>i.getAttribute('src')).every(i=>i.complete&&i.naturalWidth>0)),'Visible non-lazy images load').toBe(true);
}

for(const filename of fs.readdirSync(root).filter(n=>n.endsWith('.html'))){
  test(`page loads and fits: ${filename}`,async({page})=>{
    const response=await page.goto('/'+filename);expect(response.status()).toBe(200);await layout(page);
    await expect(page.locator('html')).toHaveAttribute('lang',filename.endsWith('-uk.html')?'uk':'en');
  });
}

for(const language of ['en','uk']){
  const suffix=language==='uk'?'-uk':'';
  test(`${language}: header navigation and language selection`,async({page,isMobile})=>{
    await page.goto(`/gallery${suffix}.html#videos`);
    const nav=page.locator('.main-nav');
    if(isMobile){await page.locator('.menu-toggle').click();await expect(nav).toBeVisible()}
    else await page.locator('.language-toggle').click();
    await expect(nav.locator('.language-option.is-current')).toHaveText(language==='uk'?'Українська':'English');
    if(isMobile){
      const home=await nav.locator('a').first().boundingBox();const languages=await nav.locator('.language-menu').boundingBox();
      expect(languages.x).toBeGreaterThan(home.x+20);
    }
    await nav.locator(`.language-option[hreflang="${language==='uk'?'en':'uk'}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/gallery${language==='uk'?'':'-uk'}\\.html#videos$`));
    await expect(page.locator('#videos-panel')).toBeVisible();
    if(isMobile)await page.locator('.menu-toggle').click();
    await page.locator('.main-nav>a').filter({hasText:language==='uk'?'Camps':'Кемпи'}).click();
    await expect(page).toHaveURL(new RegExp(`/camps${language==='uk'?'':'-uk'}\\.html$`));
  });

  test(`${language}: camps sort chronologically and registration opens a new tab`,async({page,context})=>{
    for(const filename of [`index${suffix}.html`,`camps${suffix}.html`]){
      await page.goto('/'+filename);
      const cards=page.locator(filename.startsWith('index')?'#home-camp-list article':'#upcoming-camps article');
      const ids=await cards.evaluateAll(nodes=>nodes.map(n=>n.dataset.campId));
      const shown=upcoming.slice(0,filename.startsWith('index')?3:undefined);
      expect(ids).toEqual(shown.map(c=>c.id));
      for(const camp of shown){
        const button=page.locator(`[data-camp-id="${camp.id}"] .register-button`);
        const card=page.locator(`[data-camp-id="${camp.id}"]`);
        await expect(card.locator('.camp-card-date')).toContainText(String((Date.parse(camp.endsOn)-Date.parse(camp.startsOn))/86400000+1));
        const fee=camp.detail?.prices.find(p=>p.id==='campFee');
        if(fee){
          await expect(card.locator('.camp-card-price strong')).toContainText(String(fee.amount));
          await expect(card.locator('.camp-card-facts')).toContainText(camp.copy[language].venue);
          await expect(card.locator('.camp-details-button')).toHaveAttribute('href',camp.page.replace('.html',suffix+'.html'));
        }

        if(camp.status!=='open'){
          await expect(button).toHaveAttribute('aria-disabled','true');
          expect(await button.getAttribute('href')).toBeNull();continue;
        }
        await expect(button).toHaveAttribute('href',camp.registrationUrl);await expect(button).toHaveAttribute('target','_blank');
        const pending=context.waitForEvent('page');await button.click();const popup=await pending;
        await popup.waitForLoadState('domcontentloaded');expect(popup.url()).toBe(camp.registrationUrl);await popup.close();
      }
    }
  });

  test(`${language}: overview details button opens the camp page`,async({page})=>{
    const camp=upcoming.find(c=>c.page&&c.status==='open');
    if(!camp)return;
    for(const filename of [`index${suffix}.html`,`camps${suffix}.html`]){
      await page.goto('/'+filename);
      await page.locator(`[data-camp-id="${camp.id}"] .camp-details-button`).click();
      await expect(page).toHaveURL(new RegExp('/'+camp.page.replace('.html',suffix+'\\.html')+'$'));
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('a.camp-detail-cta')).toHaveCount(2);
    }
  });

  test(`${language}: photo viewer navigation, focus and scroll restoration`,async({page})=>{
    await page.goto(`/gallery${suffix}.html`);
    const buttons=page.locator('.gallery-photo-open');const count=await buttons.count();
    const first=buttons.first();await first.scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);
    await first.click();const viewer=page.locator('#gallery-lightbox');await expect(viewer).toBeVisible();
    await expect(viewer.locator('.gallery-lightbox-count')).toHaveText(`1 / ${count}`);
    await expect.poll(()=>viewer.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
    await viewer.locator('.gallery-lightbox-prev').click();await expect(viewer.locator('.gallery-lightbox-count')).toHaveText(`${count} / ${count}`);
    await viewer.locator('.gallery-lightbox-next').click();await page.keyboard.press('ArrowRight');
    await expect(viewer.locator('.gallery-lightbox-count')).toHaveText(`2 / ${count}`);
    await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.querySelector('#gallery-lightbox').contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');await expect(viewer).not.toBeVisible();await expect(first).toBeFocused();
    expect(Math.abs(await page.evaluate(()=>scrollY)-scroll)).toBeLessThanOrEqual(2);
  });

  test(`${language}: gallery downloads a film only after Play and plays it`,async({page})=>{
    const requests=[];page.on('request',request=>{if(/\.mp4(?:\?|$)/.test(request.url()))requests.push(request.url())});
    await page.goto(`/gallery${suffix}.html`);
    expect(await page.locator('.gallery-video-item video').evaluateAll(videos=>videos.every(v=>!v.poster&&Boolean(v.dataset.poster))),'Photo tab defers all video covers').toBe(true);
    await page.locator('#videos-tab').click();await expect(page.locator('#videos-panel')).toBeVisible();
    expect(requests).toHaveLength(0);
    const video=page.locator('.gallery-video-item video').first();
    await expect.poll(()=>video.evaluate(v=>Boolean(v.poster))).toBe(true);
    await page.locator('.gallery-video-play').first().click();
    await expect.poll(()=>video.evaluate(v=>v.readyState>=2&&!v.paused),{timeout:15000}).toBe(true);
    const chosen=await video.evaluate(v=>v.currentSrc);expect(requests.length).toBeGreaterThan(0);expect(requests.every(url=>url===chosen)).toBe(true);
  });

  for(const camp of camps){
    test(`${language}: detail page and registration for ${camp.id}`,async({page})=>{
      await page.goto('/'+camp.page.replace('.html',suffix+'.html'));await layout(page);
      await expect(page.locator('.camp-detail-cta')).toHaveCount(2);
      for(const button of await page.locator('.camp-detail-cta').all()){
        await expect(button).toHaveAttribute('href',camp.registrationUrl);await expect(button).toHaveAttribute('target','_blank');
      }
    });
  }
}

test('archive loads 12 camps per click and hides Load more after the final batch',async({page})=>{
  const runtimeText=fs.readFileSync(path.join(root,'camps-data.js'),'utf8');
  const runtime=JSON.parse(runtimeText.slice(runtimeText.indexOf('=')+1).trim().replace(/;$/,''));
  const historic=Array.from({length:25},(_,index)=>({...runtime[0],id:`browser-test-past-${index}`,page:'',startsOn:'2025-01-01',endsOn:'2025-01-02'}));
  await page.route('**/camps-data.js?*',route=>route.fulfill({contentType:'text/javascript',body:'window.GD1_CAMPS='+JSON.stringify(historic)+';'}));
  await page.goto('/camps.html');
  const cards=page.locator('#past-camps article'),more=page.locator('#past-camps-load-more');
  await expect(cards).toHaveCount(12);await expect(more).toBeVisible();
  await more.click();await expect(cards).toHaveCount(24);
  await more.click();await expect(cards).toHaveCount(25);await expect(more).toBeHidden();
  await expect(page.locator('#past-camps a')).toHaveCount(0);
});

test('small mobile viewport does not overflow when the menu opens',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await page.goto('/index-uk.html');await page.locator('.menu-toggle').click();
  await expect(page.locator('.main-nav')).toBeVisible();await layout(page);
});

for(const missing of ['/missing-gd1-page.html','/old/wordpress/post/']){
  test('404 recovery at '+missing,async({page})=>{
    expected404.get(page).add(missing);
    const response=await page.goto(missing);expect(response.status()).toBe(404);
    await expect(page).toHaveURL('http://127.0.0.1:4173'+missing);
    await expect(page.locator('body')).toHaveClass('not-found-page');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
    await layout(page);
    await page.locator('.not-found-actions a[href="camps.html"]').click();
    await expect(page).toHaveURL('http://127.0.0.1:4173/camps.html');
    await expect(page.locator('#upcoming-camps')).toBeVisible();
  });
}

test('404 language selection and Ukrainian home recovery',async({page,isMobile})=>{
  expected404.get(page).add('/missing/language-test/');
  await page.goto('/missing/language-test/');
  await page.locator(isMobile?'.menu-toggle':'.language-toggle').click();
  await page.locator('.language-option[hreflang="uk"]').click();
  await expect(page).toHaveURL('http://127.0.0.1:4173/404-uk.html');
  await expect(page.locator('html')).toHaveAttribute('lang','uk');
  await page.locator('.not-found-actions a[href="index-uk.html"]').click();
  await expect(page).toHaveURL('http://127.0.0.1:4173/index-uk.html');
});

for(const name of ['404.html','404-uk.html']){
  test('404 fits a narrow phone: '+name,async({page})=>{
    await page.setViewportSize({width:320,height:740});
    await page.goto('/'+name);await layout(page);
    await expect(page.locator('.not-found-actions a').first()).toBeVisible();
  });
}
