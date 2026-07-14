// Waypoint — service worker for basic offline support.
//
// Strategy:
// 1. On install, precache the app shell (the files that make the app itself
//    load: HTML, manifest, icons).
// 2. On every fetch, serve from cache immediately if available, then update
//    the cache in the background from the network ("stale-while-revalidate").
//    This means anything the app has successfully loaded once — including
//    the CDN-hosted React/Babel/Leaflet scripts and any map tiles you've
//    already viewed — becomes available offline on the next visit.
//
// Limitations (by design, not a bug):
// - The very first visit still needs an internet connection, to pull down
//   the app shell and libraries for the first time.
// - Map tiles for areas you haven't scrolled to yet won't be cached, so the
//   map may show blank/gray tiles for unexplored areas while offline.
// - Bumping CACHE_VERSION below forces everyone to re-fetch everything on
//   their next online visit — do this if you ever need to invalidate a bad
//   cached response.

const CACHE_VERSION = "waypoint-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => {
        // Don't block install if one shell file fails (e.g. offline first install)
        console.warn("Service worker precache issue:", err);
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle simple GET requests — let everything else (POST, etc.) pass through untouched.
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          // Only cache successful, basic/CORS-ok responses.
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
