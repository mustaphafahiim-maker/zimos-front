/**
 * The shopper's browser push subscription (handoff 392): made through the
 * store's service worker with the server's VAPID public key; the whole
 * PushSubscription JSON is the token the API takes. Only ever called from a
 * tap — it is what asks for the notification permission.
 */

/** A base64url VAPID key as the bytes `pushManager.subscribe` takes. */
function vapidKeyBytes(base64Url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = window.atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function sameKey(subscription: PushSubscription, publicKey: string): boolean {
  const used = subscription.options?.applicationServerKey;
  if (!used) return true;
  const a = new Uint8Array(used);
  const b = vapidKeyBytes(publicKey);
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

export type BrowserPushResult = { ok: true; token: string } | { ok: false; reason: "unsupported" | "denied" };

export function browserCanPush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Asks for the permission and answers this browser's subscription as the
 * token to send. A subscription made with a key the store's server no longer
 * uses is dropped and made again. `scope` is the store's own path, so the
 * worker is the one the store's app already registers.
 */
export async function browserPushToken(publicKey: string, scope: string): Promise<BrowserPushResult> {
  if (!browserCanPush()) return { ok: false, reason: "unsupported" };
  if ((await Notification.requestPermission()) !== "granted") return { ok: false, reason: "denied" };
  const registration = await navigator.serviceWorker.register("/store-sw.js", { scope });
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription, publicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(publicKey) as BufferSource });
  return { ok: true, token: JSON.stringify(subscription) };
}
