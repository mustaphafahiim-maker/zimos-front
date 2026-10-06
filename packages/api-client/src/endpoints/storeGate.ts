/**
 * Store gates (backend modules/storeGate, frontend-handoff 197): a store kept
 * behind a password while it is prepared, a "coming soon" page that collects
 * emails, and an age question before entering.
 *
 * Dashboard (permission website.publish — it decides who can see the store):
 *   GET /workspaces/:ws/store-gate → StoreGateSettings (the password is never sent back)
 *   PUT /workspaces/:ws/store-gate StoreGateUpdate → StoreGateSettings
 *     password 4–100, required the first time the mode is "password"; a new
 *     one signs every visitor out. message ≤ 500, ageCheck.message ≤ 300,
 *     ageCheck.minAge 13–25.
 *   GET /workspaces/:ws/store-gate/signups → { signups, total } (newest first, ≤ 5000)
 *
 * Storefront, no sign-in:
 *   GET /store/:ws → store.gate (StoreGatePublic). While mode ≠ off every store
 *     route but the open ones answers 423 STORE_LOCKED (details.gate). Open:
 *     the store itself, the gate, order tracking and payment returns,
 *     downloads, courses, subscriptions, the affiliate portal, events, fonts,
 *     visitor context — and funnels unless lockFunnels. Staff previews
 *     (X-Store-Preview) pass.
 *   POST /store/:ws/gate/unlock { password } → { token, expiresInSeconds } (30 days);
 *     the token goes in X-Store-Gate on every store call. 422 WRONG_PASSWORD.
 *   POST /store/:ws/gate/signup { email, locale? } → 201 { signedUp: true }
 *     (both modes; the same email twice is fine; 409 STORE_OPEN when open).
 *   Both are rate limited (429).
 */
import { ApiError, type ApiClient } from "../client";

export type StoreGateMode = "off" | "password" | "coming_soon";

export type StoreGateAgeCheck = { enabled: false } | { enabled: true; minAge: number; message: string | null };

export interface StoreGateSettings {
  mode: StoreGateMode;
  /** A password is saved (it is never sent back). */
  hasPassword: boolean;
  message: string | null;
  /** ISO; the coming-soon page counts down to it. The store does not open by itself. */
  opensAt: string | null;
  lockFunnels: boolean;
  ageCheck: StoreGateAgeCheck;
}

export interface StoreGateUpdate {
  mode: StoreGateMode;
  /** Only when setting or changing it; leave out to keep the saved one. */
  password?: string;
  message?: string | null;
  opensAt?: string | null;
  lockFunnels?: boolean;
  ageCheck?: { enabled: boolean; minAge?: number; message?: string | null };
}

export interface StoreGateSignup {
  email: string;
  locale: "ar" | "en" | "fr" | null;
  createdAt: string;
  notifiedAt: string | null;
}

export function storeGateGet(client: ApiClient, workspaceId: string): Promise<StoreGateSettings> {
  return client.request<StoreGateSettings>(`/workspaces/${workspaceId}/store-gate`);
}

export function storeGateSave(client: ApiClient, workspaceId: string, body: StoreGateUpdate): Promise<StoreGateSettings> {
  return client.request<StoreGateSettings>(`/workspaces/${workspaceId}/store-gate`, { method: "PUT", body });
}

export function storeGateSignups(client: ApiClient, workspaceId: string): Promise<{ signups: StoreGateSignup[]; total: number }> {
  return client.request<{ signups: StoreGateSignup[]; total: number }>(`/workspaces/${workspaceId}/store-gate/signups`);
}

// -------------------------------------------------------------- shopper --

export interface StoreGatePublic {
  mode: StoreGateMode;
  message: string | null;
  opensAt: string | null;
  ageCheck: StoreGateAgeCheck;
}

const OFF: StoreGatePublic = { mode: "off", message: null, opensAt: null, ageCheck: { enabled: false } };

/** `store.gate` from GET /store/:ws, read defensively: an older API without it is an open store. */
export function storefrontGateOf(store: unknown): StoreGatePublic {
  const raw = (store as { gate?: Partial<StoreGatePublic> } | null)?.gate;
  if (!raw || typeof raw !== "object") return OFF;
  const mode: StoreGateMode = raw.mode === "password" || raw.mode === "coming_soon" ? raw.mode : "off";
  const age = raw.ageCheck as { enabled?: unknown; minAge?: unknown; message?: unknown } | undefined;
  const minAge = typeof age?.minAge === "number" && age.minAge >= 13 && age.minAge <= 25 ? age.minAge : 18;
  return {
    mode,
    message: typeof raw.message === "string" && raw.message.trim() ? raw.message : null,
    opensAt: typeof raw.opensAt === "string" && !Number.isNaN(Date.parse(raw.opensAt)) ? raw.opensAt : null,
    ageCheck:
      age?.enabled === true
        ? { enabled: true, minAge, message: typeof age.message === "string" && age.message.trim() ? age.message : null }
        : { enabled: false },
  };
}

/** The API's answer for a locked store's own routes. */
export function isStoreLocked(err: unknown): boolean {
  return err instanceof ApiError && err.status === 423 && err.code === "STORE_LOCKED";
}

export function storefrontGateUnlock(
  client: ApiClient,
  workspaceRef: string,
  password: string
): Promise<{ token: string; expiresInSeconds: number }> {
  return client.request<{ token: string; expiresInSeconds: number }>(`/store/${workspaceRef}/gate/unlock`, {
    method: "POST",
    body: { password },
    auth: false,
  });
}

export function storefrontGateSignup(
  client: ApiClient,
  workspaceRef: string,
  body: { email: string; locale?: "ar" | "en" | "fr" }
): Promise<{ signedUp: true }> {
  return client.request<{ signedUp: true }>(`/store/${workspaceRef}/gate/signup`, { method: "POST", body, auth: false });
}
