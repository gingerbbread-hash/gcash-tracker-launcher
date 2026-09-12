const CACHE_NAME='gcash-tracker-pwa-v3';

const APP_SHELL=[
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

const OFFLINE_IMAGE_ASSETS=[
  'https://www.maya.ph/hubfs/Maya/Change%20in%20Management/maya%20consumer%20logo.svg',
  'https://www.bsp.gov.ph/Coins%20and%20Notes/Polymer/1000banknote.png',
  'https://www.bsp.gov.ph/Coins%20and%20Notes/Polymer/500banknote.png',
  'https://upload.wikimedia.org/wikipedia/commons/3/32/NDS_obverse_200_Philippine_peso_bill.jpg',
  'https://www.bsp.gov.ph/Coins%20and%20Notes/Polymer/100banknote.png',
  'https://www.bsp.gov.ph/Coins%20and%20Notes/Polymer/50banknote.png',
  'https://upload.wikimedia.org/wikipedia/commons/c/cd/NDS_obverse_20_Philippine_peso_bill.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/1/15/Font_20_peso_Coin_Philippines.png',
  'https://upload.wikimedia.org/wikipedia/commons/8/8b/NGC_PHP_10_piso.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/9/96/PhilippinesNewGen5PesoObverse.png',
  'https://upload.wikimedia.org/wikipedia/commons/4/43/1_philippinischer_Peso_2018.jpg'
];

async function cacheRemoteImage(cache,url){
  try{
    const res=await fetch(url,{
      mode:'no-cors',
      cache:'reload'
    });

    if(res){
      await cache.put(url,res);
    }
  }catch(e){
    // Do not fail service-worker installation
    // if one remote image is unavailable.
  }
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);

    await cache.addAll(APP_SHELL);

    await Promise.allSettled(
      OFFLINE_IMAGE_ASSETS.map(
        url=>cacheRemoteImage(cache,url)
      )
    );

    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();

    await Promise.all(
      keys
        .filter(k=>k!==CACHE_NAME)
        .map(k=>caches.delete(k))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;

  if(req.method!=='GET'){
    return;
  }

  const url=new URL(req.url);

  // Never cache Apps Script/API responses.
  if(
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('googleusercontent.com')
  ){
    return;
  }

  // Always prefer newest app HTML while online.
  if(
    req.mode==='navigate' ||
    url.pathname.endsWith('/index.html')
  ){
    event.respondWith(
      fetch(req,{
        cache:'no-store'
      })
        .then(res=>{
          const copy=res.clone();

          caches
            .open(CACHE_NAME)
            .then(c=>c.put('./index.html',copy));

          return res;
        })
        .catch(
          ()=>caches.match('./index.html')
        )
    );

    return;
  }

  // Images:
  // use cached copy first.
  // When online, save images for offline use.
  if(
    req.destination==='image' ||
    OFFLINE_IMAGE_ASSETS.includes(req.url)
  ){
    event.respondWith(
      caches.match(req)
        .then(cached=>{
          if(cached){
            return cached;
          }

          return fetch(req)
            .then(res=>{
              const copy=res.clone();

              caches
                .open(CACHE_NAME)
                .then(c=>c.put(req,copy))
                .catch(()=>{});

              return res;
            });
        })
    );

    return;
  }

  // Other static app assets.
  event.respondWith(
    caches.match(req)
      .then(cached=>{
        if(cached){
          return cached;
        }

        return fetch(req)
          .then(res=>{
            if(
              res &&
              res.status===200
            ){
              const copy=res.clone();

              caches
                .open(CACHE_NAME)
                .then(c=>c.put(req,copy))
                .catch(()=>{});
            }

            return res;
          });
      })
  );
});
