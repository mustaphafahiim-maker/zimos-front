// The shop's service worker (SPEC §20.2): it is what lets a shopper add the
// store to the home screen as an app. It keeps nothing in a cache — prices and
// stock must never be shown stale — and, offline, a page opened from the app
// gets a short notice instead of the browser's error page.
const OFFLINE_PAGE =
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title></head>' +
  '<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;text-align:center;padding:1rem">' +
  '<div><p dir="rtl">أنت غير متصل بالإنترنت. حاول مرة أخرى بعد عودة الاتصال.</p><p>You are offline. Try again once you are connected.</p></div></body></html>';

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => new Response(OFFLINE_PAGE, { headers: { "content-type": "text/html; charset=utf-8" } }))
  );
});
