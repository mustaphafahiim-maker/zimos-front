import { ApiError, pushConfig, pushRegister, pushRemove } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";

/**
 * Real web push for the dashboard (handoff 392): the browser subscribes
 * through the service worker with the server's VAPID public key, and the
 * whole PushSubscription JSON is what the server keeps as the device's token.
 *
 * When the owner rotates the keys, a subscription made with the old key stops
 * receiving: it is dropped and made again with the new key, and the device is
 * registered again (`syncPushKey`, run once per load of the signed-in shell).
 * Nothing here ever asks for the notification permission — that only happens
 * on a tap (pages/settings/PushDeviceToggle.tsx).
 */

/** Where this browser remembers the id of its push device. */
export const PUSH_DEVICE_KEY = "zimos_push_device";

export function storedPushDevice(): string | null {
  try {
    return window.localStorage.getItem(PUSH_DEVICE_KEY);
  } catch {
    return null;
  }
}

export function rememberPushDevice(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(PUSH_DEVICE_KEY, id);
    else window.localStorage.removeItem(PUSH_DEVICE_KEY);
  } catch {
    // Remembered for this page only.
  }
}

/** A base64url VAPID key as the bytes `pushManager.subscribe` takes. */
export function vapidKeyBytes(base64Url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = window.atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Whether a subscription was made with this key. A browser that does not say which key it used counts as a match. */
export function subscribedWithKey(subscription: PushSubscription, publicKey: string): boolean {
  const used = subscription.options?.applicationServerKey;
  if (!used) return true;
  const a = new Uint8Array(used);
  const b = vapidKeyBytes(publicKey);
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

/**
 * This browser's push subscription for `publicKey`: the one it has when that
 * was made with the same key, else a new one (after dropping one made with
 * another key — a browser refuses a second key while the first is live).
 */
export async function subscribeBrowser(registration: ServiceWorkerRegistration, publicKey: string): Promise<PushSubscription> {
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    if (subscribedWithKey(existing, publicKey)) return existing;
    await existing.unsubscribe();
  }
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(publicKey) as BufferSource });
}

/** 422 INVALID_PUSH_SUBSCRIPTION: what the browser handed over is not a push subscription the server can use. */
export function isInvalidPushSubscription(err: unknown): boolean {
  return err instanceof ApiError && err.code === "INVALID_PUSH_SUBSCRIPTION";
}

/**
 * After the server's keys were rotated: a device this browser turned on keeps
 * working. Runs quietly — no permission prompt, no message; a failure leaves
 * things as they were and the next load tries again. Answers the new device
 * id when the subscription was renewed, else null.
 */
export async function syncPushKey(): Promise<string | null> {
  const deviceId = storedPushDevice();
  if (!deviceId) return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  try {
    const config = await pushConfig(apiClient);
    if (!config.available || config.provider !== "webpush" || !config.publicKey) return null;
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    // Nothing to renew: no subscription (turned on against a sandbox server), or one made with the current key.
    if (!existing || subscribedWithKey(existing, config.publicKey)) return null;
    const subscription = await subscribeBrowser(registration, config.publicKey);
    const device = await pushRegister(apiClient, { platform: "web", token: JSON.stringify(subscription) });
    if (device.id !== deviceId) await pushRemove(apiClient, deviceId).catch(() => undefined);
    rememberPushDevice(device.id);
    return device.id;
  } catch {
    return null;
  }
}
