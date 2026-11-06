// Dahem Manufacturing — service worker (update-safe policy)
//  • Navigations / HTML: network-first — a new deploy is visible immediately,
//    the cached shell is only an offline fallback.
//  • Hashed build assets (/assets/*): cache-first (immutable by content hash).
//  • version.json + sw.js: never cached (always network via the fetch bypass).
//  • Other same-origin GETs: network-first with cache fallback.
// Cache name carries the build id stamped at build time (mw4xa8eix72), so an
// updated worker purges every older cache on activate. skipWaiting +
// clients.claim make activation immediate; the in-app banner handles the UX.
const BUILD = "mw4xa8eix72";
const CACHE = "dahem-mfg-" + BUILD;

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.indexOf("dahem-mfg-") === 0 && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/version.json") || url.pathname.endsWith("/sw.js")) return; // always network

  if (url.pathname.indexOf("/assets/") !== -1) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  const isNav = req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") !== -1;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(isNav ? "./index.html" : req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req) || (isNav ? await cache.match("./index.html") : undefined);
      if (hit) return hit;
      throw err;
    }
  })());
});
