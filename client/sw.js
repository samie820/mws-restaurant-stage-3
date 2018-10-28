self.addEventListener("install", e => {
  console.log('service worker installing')
  e.waitUntil(
    caches.open("restaurant-review-v2").then(cache => {
      return cache.addAll([
        "/",
        "https://unpkg.com/leaflet@1.3.1/dist/leaflet.js",
        "https://unpkg.com/leaflet@1.3.1/dist/leaflet.css",
        "/index.html",
        "/manifest.json",
        "/restaurant.html",
        "/js/restaurant_info.js",
        "/js/dbhelper.js",
        "/js/main.js",
        "/sw.js",
        "/css/styles.css",
        "/img/1.jpg",
        "/img/2.jpg",
        "/img/3.jpg",
        "/img/4.jpg",
        "/img/5.jpg",
        "/img/6.jpg",
        "/img/7.jpg",
        "/img/8.jpg",
        "/img/9.jpg",
        "/img/10.jpg",
        "/icons/food_256.png",
        "/icons/food_512.png",
      ]);
    })
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request, {
      ignoreSearch: true,
    }).then(response => {
      return (
        response ||
        fetch(event.request).then(response => {
          return caches.open("restaurant-review-v2").then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
      );
    })
  );
});

self.addEventListener("activate", event => {
  const cacheWhitelist = ["restaurant-review-v2"];

  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(
        keyList.map(key => {
          if (cacheWhitelist.indexOf(key) === -1) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});
