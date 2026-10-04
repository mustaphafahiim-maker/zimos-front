/**
 * Push notifications on the person's devices (backend:
 * notifications/push/pushService.js), mounted at /me/push.
 *
 *   GET    /config          { available, provider, publicKey } — publicKey is
 *                           the VAPID key to subscribe the browser with; null
 *                           on a server whose provider is the sandbox
 *   GET    /devices         the person's devices
 *   POST   /devices         { platform, token } — token = the browser's push
 *                           subscription JSON (web)
 *   DELETE /devices/:id
 */
import type { ApiClient } from "../client";

export interface PushConfig {
  available: boolean;
  provider: string | null;
  publicKey: string | null;
}

export interface PushDevice {
  id: string;
  platform: "web" | "ios" | "android";
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
}

export async function pushConfig(client: ApiClient): Promise<PushConfig> {
  const { push } = await client.request<{ push: PushConfig }>(`/me/push/config`);
  return push;
}

export async function pushDevices(client: ApiClient): Promise<PushDevice[]> {
  const { devices } = await client.request<{ devices: PushDevice[] }>(`/me/push/devices`);
  return devices;
}

export async function pushRegister(client: ApiClient, payload: { platform: PushDevice["platform"]; token: string }): Promise<PushDevice> {
  const { device } = await client.request<{ device: PushDevice }>(`/me/push/devices`, { method: "POST", body: payload });
  return device;
}

export async function pushRemove(client: ApiClient, deviceId: string): Promise<void> {
  await client.request(`/me/push/devices/${deviceId}`, { method: "DELETE" });
}
