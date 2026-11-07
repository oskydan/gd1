import {test,expect} from 'playwright/test';
import {createHash} from 'node:crypto';
const hash=body=>createHash('sha256').update(body).digest('hex').slice(0,16);
async function keys(page){return page.evaluate(async()=>{const names=await caches.keys();return (await Promise.all(names.map(async n=>(await (await caches.open(n)).keys()).map(r=>r.url)))).flat();});}
async function settle(page){await expect.poll(async()=>(await keys(page)).length).toBeGreaterThanOrEqual(5);}
async function open(page,scope){
 await page.goto(scope);await page.evaluate(()=>navigator.serviceWorker.ready);
 await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 await page.reload();await settle(page);
}
test.beforeEach(async({request})=>{await request.get('/__test/reset');});
for(const scope of ['/','/gd1/']){
 test(`reuse cached assets and receive updated deployment: ${scope}`,async({page,request})=>{
  await open(page,scope);
  const before=await (await request.get('/__test/counts')).json();
  await page.reload();await expect(page.locator('h1')).toHaveText('Deployment 0');
  const after=await (await request.get('/__test/counts')).json();
  for(const name of ['styles.css','script.js','assets/picture.png','assets/font.woff2'])expect(after[scope+name],name+' stays cached').toBe(before[scope+name]);
  expect(after[scope]).toBeGreaterThan(before[scope]);
  await request.get('/__test/change');await page.reload();
  await expect(page.locator('h1')).toHaveText('Deployment 1');
  await expect.poll(()=>page.evaluate(()=>window.deployment)).toBe(1);
  await expect(page.locator('body')).toHaveCSS('color','rgb(60, 70, 80)');
  const updated=await (await request.get('/__test/counts')).json();
  expect(updated[scope+'assets/font.woff2']).toBe(after[scope+'assets/font.woff2']);
  expect(updated[scope+'styles.css']).toBeGreaterThan(after[scope+'styles.css']);
 });
}
test('forms, tracking, video, ranges, errors and unversioned files are not cached',async({page})=>{
 await open(page,'/');
 await page.evaluate(async()=>{
  for(const path of ['form','track','movie.mp4','assets/missing.png?v=aaaaaaaaaaaaaaaa','assets/picture.png'])await fetch('/'+path);
  const image=document.querySelector('img').src;await fetch(image,{headers:{Range:'bytes=0-9'}});
 });
 const cached=await keys(page);expect(cached.every(u=>!/(?:form|track|movie|missing)/.test(u))).toBe(true);
 expect(cached.every(u=>new URL(u).searchParams.has('v'))).toBe(true);
 const response=await page.evaluate(async()=>{const r=await fetch(document.querySelector('img').src,{headers:{Range:'bytes=0-9'}});return {status:r.status,length:(await r.arrayBuffer()).byteLength};});
 expect(response).toEqual({status:206,length:10});
});
test('wrong content hashes and oversized assets are not stored',async({page})=>{
 await open(page,'/');
 const largeHash=hash(Buffer.alloc(513*1024,3));
 await page.evaluate(async largeHash=>{await fetch('/assets/picture.png?v=0000000000000000');await fetch('/assets/large.png?v='+largeHash);},largeHash);
 await page.waitForTimeout(300);
 expect((await keys(page)).some(u=>u.includes('0000000000000000')||u.includes('large.png'))).toBe(false);
});
test('old cache entries expire and storage stays bounded',async({page,request})=>{
 await open(page,'/');
 await page.evaluate(async()=>{
  const name=(await caches.keys()).find(n=>n.startsWith('gd1-assets-'));const cache=await caches.open(name);
  const url=document.querySelector('img').src;const response=await cache.match(url);const headers=new Headers(response.headers);headers.set('date','Sun, 01 Jan 2023 00:00:00 GMT');await cache.put(url,new Response(await response.arrayBuffer(),{headers}));
 });
 const before=await (await request.get('/__test/counts')).json();
 await page.evaluate(()=>fetch(document.querySelector('img').src));
 const after=await (await request.get('/__test/counts')).json();expect(after['/assets/picture.png']).toBe(before['/assets/picture.png']+1);
 for(let i=0;i<68;i++){
  const name='assets/item-'+i+'.png';await page.evaluate(url=>fetch(url),'/'+name+'?v='+hash(name));
 }
 await expect.poll(async()=>(await keys(page)).some(u=>u.includes('item-67.png'))).toBe(true);
 expect((await keys(page)).length).toBeLessThanOrEqual(64);
});
test('offline navigation does not show stale registration pages',async({page,context})=>{
 await open(page,'/');await context.setOffline(true);
 await expect(page.goto('/index.html')).rejects.toThrow();
});

test('packaged pages cache compressed styles and both language fonts',async({page,context})=>{
 await context.addInitScript(()=>{window.GD1_CACHE_TEST=true;});
 await page.goto('http://127.0.0.1:4173/index.html');
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 await page.reload();
 const stylesheet=await page.locator('link[rel="stylesheet"]').first().getAttribute('href');
 await expect.poll(async()=>(await keys(page)).some(u=>u.endsWith(stylesheet))).toBe(true);
 await page.goto('http://127.0.0.1:4173/index-uk.html');
 await expect.poll(async()=>(await keys(page)).some(u=>u.includes('inter-cyrillic.woff2?v='))).toBe(true);
 await expect.poll(async()=>(await keys(page)).some(u=>u.includes('fonts-cyrillic.css?v='))).toBe(true);
 expect((await keys(page)).every(u=>!u.endsWith('.html')&&!u.includes('.mp4')&&!u.includes('mixpanel'))).toBe(true);
});

test('storage restrictions fall back to normal loading',async({page,request})=>{
 await request.get('/__test/block-storage');await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready);
 await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 await page.reload();await expect(page.locator('h1')).toHaveText('Deployment 0');
 await expect(page.locator('body')).toHaveCSS('color','rgb(10, 20, 30)');
 expect(await keys(page)).toHaveLength(0);
});
