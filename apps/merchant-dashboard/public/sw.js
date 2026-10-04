/*
 * The dashboard's service worker (SPEC §20.1, first step: an installable PWA).
 *
 * It caches nothing on purpose. The dashboard shows live orders and money; a
 * cached page or API answer would be a wrong page. Its only jobs are to make
 * the app installable and to say so plainly when the phone is offline,
 * instead of the browser's own error page.
 */

const OFFLINE_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Zimos</title>
    <style>
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
             font-family: system-ui, sans-serif; background: #f5f4ef; color: #16211f; text-align: center; padding: 24px; }
      h1 { font-size: 20px; margin: 0 0 8px; }
      p { margin: 0 0 20px; color: #3c4a46; font-size: 15px; }
      button { border: 0; border-radius: 12px; padding: 12px 24px; font-size: 15px; font-weight: 600;
               background: #2563eb; color: #fff; cursor: pointer; }
      @media (prefers-color-scheme: dark) { body { background: #0b1220; color: #e7ecf5; } p { color: #a9b4c9; } }
    </style>
  </head>
  <body>
    <main>
      <h1>لا يوجد اتصال بالإنترنت</h1>
      <p>You are offline. Your orders will load again as soon as you are back online.</p>
      <button onclick="location.reload()">حاول مرة أخرى · Try again</button>
    </main>
  </body>
</html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  // Only page navigations; every asset and API call goes straight to the network.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } })
    )
  );
});

/*
 * Push notifications (SPEC §20 PWA web push; backend notifications/push).
 * The server sends { title, body, link }; a tap opens the link in the
 * dashboard (an open window is reused).
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "Zimos" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Zimos", {
      body: data.body || undefined,
      icon: "/icon.png",
      badge: "/icon.png",
      data: { link: data.link || "/" },
      tag: data.type || undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.link) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.navigate(target).then((w) => (w || open).focus());
      return self.clients.openWindow(target);
    })
  );
});
