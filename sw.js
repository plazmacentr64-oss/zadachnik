const CACHE='zadachnik-v33';
const ASSETS=['/styles.css?v=31','/app.js?v=31','/wood-wheels.js?v=31','/rounded-selects.js?v=31','/document-gen.js?v=1','/favicon.ico','/','/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/favicon-32.png','/favicon-48.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match(event.request).then(r=>r||caches.match('/index.html'))));
});
