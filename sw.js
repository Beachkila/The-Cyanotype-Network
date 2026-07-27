// THE CYANOTYPE NETWORK · sw.js — PWA shell (stage 7)
// Network-first for the app shell so deploys are never stale; cache fallback
// keeps the shell openable offline. API/storage/CDN requests pass through.
const VERSION = "tcn-v1";
const SHELL = [
  "./", "index.html", "style.css", "manifest.json",
  "js/config.js", "js/db.js", "js/auth.js", "js/upload.js",
  "js/forecast.js", "js/feed.js", "js/collected.js",
  "js/myprints.js", "js/router.js",
  "assets/icon-192.png", "assets/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then(hit => hit || caches.match("index.html")))
  );
});
