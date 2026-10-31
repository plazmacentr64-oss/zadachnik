// Офлайн-кэш: только статические файлы самого сайта. Данные Supabase никогда не кэшируются.
const CACHE='zadachnik-v40';
const ASSETS=['./','./index.html','./styles.css','./app.js','./wood-wheels.js','./rounded-selects.js','./document-gen.js','./manifest.webmanifest','./favicon.ico','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./favicon-32.png','./favicon-48.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('message',e=>{if(e.data==='clear')caches.keys().then(ks=>ks.forEach(k=>caches.delete(k)))});
self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return; // Supabase, CDN — мимо кэша
  e.respondWith(fetch(req).then(res=>{
    if(res.ok&&res.type==='basic'){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}
    return res;
  }).catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||(req.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
