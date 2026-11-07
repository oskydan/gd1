// Static assets only. Local/file previews retain their ordinary browser behavior.
(() => {
  if (!('serviceWorker' in navigator) || !['https:','http:'].includes(location.protocol)) return;
  const local = ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  if (local && window.GD1_CACHE_TEST !== true) return;
  if (!local && location.protocol !== 'https:') return;
  const root = new URL('.', document.currentScript.src);
  const register = () => navigator.serviceWorker.register(new URL('sw.js', root), {
    scope: root.href, updateViaCache: 'none'
  }).catch(() => {}); // Storage restrictions must never prevent normal site use.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, {once:true});
})();
