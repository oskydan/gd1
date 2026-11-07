// Demand-only cache: no pages, forms, analytics traffic, or movies are stored.
const ROOT = new URL(self.registration.scope);
const CACHE = 'gd1-assets-v1:' + ROOT.pathname;
const MAX_ENTRIES = 64;
const MAX_BYTES = 512 * 1024;
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
let writes = Promise.resolve();
const fresh = response => {
  const date = Date.parse(response.headers.get('date') || '');
  return Number.isFinite(date) && Date.now() - date < MAX_AGE;
};
const versioned = url => {
  if (url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return false;
  const name = url.pathname.slice(ROOT.pathname.length);
  const asset = /^assets\/.+\.(?:woff2?|ttf|otf|png|jpe?g|webp|avif|svg|gif|ico)$/.test(name)
    || /^(?:styles|fonts-cyrillic)\.css$/.test(name)
    || /^(?:script|gallery|analytics|camps-data|camps-data-uk|cache)\.js$/.test(name);
  return asset && url.searchParams.size === 1 && /^[a-f0-9]{16}$/.test(url.searchParams.get('v') || '');
};
async function store(request,response) {
  if (!response.ok || response.status !== 200 || !fresh(response)) return;
  if (Number(response.headers.get('content-length')) > MAX_BYTES) return;
  const copy = response.clone();
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return;
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  // An old CDN response under a new URL must never become a persistent cache hit.
  if (!hash.startsWith(new URL(request.url).searchParams.get('v'))) return;
  const cache = await caches.open(CACHE);
  await cache.put(request,copy);
  const keys = await cache.keys();
  for (const key of keys.slice(0,Math.max(0,keys.length-MAX_ENTRIES))) await cache.delete(key);
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  try {
    for (const name of await caches.keys()) {
      if (name.startsWith('gd1-assets-') && name.endsWith(':'+ROOT.pathname) && name !== CACHE) await caches.delete(name);
    }
  } catch {}

  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.headers.has('range') || url.origin !== ROOT.origin) return;
  if (request.mode === 'navigate') {
    // Always revalidate HTML; registration status must not be frozen in an offline page.
    event.respondWith(fetch(request,{cache:'no-cache'}));return;
  }
  if (!versioned(url)) return;
  event.respondWith((async()=>{
    try {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request);
      if (hit && fresh(hit)) return hit;
      if (hit) await cache.delete(request);
    } catch {} // Private-mode/quota failures fall back to ordinary network loading.
    const response = await fetch(request,{cache:'no-cache'});
    const copy = response.clone();
    writes = writes.catch(()=>{}).then(()=>store(request,copy)).catch(()=>{});
    event.waitUntil(writes);
    return response;
  })());
});
