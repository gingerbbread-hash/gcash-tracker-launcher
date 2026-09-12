const CACHE_NAME='gcash-tracker-pwa-v2';
const APP_SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;

  const url=new URL(req.url);

  // Never cache Apps Script/API responses.
  if(url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')){
    return;
  }

  // Always prefer the newest app HTML when online.
  if(req.mode==='navigate' || url.pathname.endsWith('/index.html')){
    event.respondWith(
      fetch(req,{cache:'no-store'}).then(res=>{
        const copy=res.clone();
        caches.open(CACHE_NAME).then(c=>c.put('./index.html',copy));
        return res;
      }).catch(()=>caches.match('./index.html'))
    );
    return;
  }

  // Static app assets can use cache-first.
  event.respondWith(
    caches.match(req).then(cached=>{
      if(cached) return cached;
      return fetch(req).then(res=>{
        if(res && res.status===200 && (res.type==='basic' || res.type==='cors')){
          const copy=res.clone();
          caches.open(CACHE_NAME).then(c=>c.put(req,copy));
        }
        return res;
      });
    })
  );
});
