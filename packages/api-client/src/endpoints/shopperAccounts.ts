/**
 * Shopper accounts (backend shopperAccounts/): a
 * shopper signs in to one store with a 6-digit code sent by SMS or email,
 * then sees their orders, keeps up to 10 addresses and orders again. No
 * password exists.
 *
 * Dashboard (permission website.edit):
 *   GET /workspaces/:ws/shopper-accounts → { enabled, channels }
 *   PUT /workspaces/:ws/shopper-accounts { enabled, channels? } → same
 *
 * Storefront, all under /store/:ws/account, signed-in calls carry the token
 * in X-Shopper-Token:
 *   GET  /config                       → { enabled, channels } (public)
 *   POST /code   { phone | email, locale? }  → ShopperCodeSent
 *   POST /verify { phone | email, code }     → ShopperSession
 *   GET/PATCH /me, POST /sign-out-everywhere
 *   GET  /orders?before=<ISO>          → { orders, nextBefore } (20 a page)
 *   GET  /orders/:id, POST /orders/:id/reorder
 *   GET/POST /addresses, PATCH/DELETE /addresses/:id → { addresses }
 *
 * Codes: SHOPPER_ACCOUNTS_OFF (404, the store has no accounts),
 * SHOPPER_NOT_SIGNED_IN (401, drop the token), TOO_MANY_CODES (429,
 * details.retryAfterSeconds), INVALID_PHONE (422), SHOPPER_CHANNEL_OFF (422),
 * INVALID_CODE (422, details.attemptsLeft), CODE_EXPIRED (422),
 * TOO_MANY_ATTEMPTS (429), TOO_MANY_ADDRESSES (422).
 */
import type { ApiClient } from "../client";
import { shopperTokenHeaders } from "../shopperToken";
import type { TrackResult } from "../types";
import type { OrderTrackingExtras } from "./orderTracking";

export type ShopperChannel = "sms" | "email";

export interface ShopperAccountsSettings {
  enabled: boolean;
  /** At least one, no repeats. */
  channels: ShopperChannel[];
}

// ---------------------------------------------------------------- staff --

export function shopperAccountsGet(client: ApiClient, workspaceId: string): Promise<ShopperAccountsSettings> {
  return client.request<ShopperAccountsSettings>(`/workspaces/${workspaceId}/shopper-accounts`);
}

export function shopperAccountsSave(
  client: ApiClient,
  workspaceId: string,
  body: ShopperAccountsSettings
): Promise<ShopperAccountsSettings> {
  return client.request<ShopperAccountsSettings>(`/workspaces/${workspaceId}/shopper-accounts`, { method: "PUT", body });
}

// -------------------------------------------------------------- shopper --

export interface ShopperProfile {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  /** Only a verified email signs in by email. */
  emailVerified?: boolean;
  marketingConsent: boolean;
  ordersCount: number;
}

export interface ShopperAddress {
  id: string;
  label?: string | null;
  fullName?: string | null;
  phone?: string | null;
  /** ISO 3166 alpha-2. */
  country: string;
  province?: string | null;
  city: string;
  area?: string | null;
  addressLine: string;
  postalCode?: string | null;
  /** One of the store's delivery areas, when it prices by zones. */
  deliveryZoneId?: string | null;
  isDefault: boolean;
}

export type ShopperAddressInput = Omit<ShopperAddress, "id" | "isDefault"> & { isDefault?: boolean };

export interface ShopperMe {
  customer: ShopperProfile;
  addresses: ShopperAddress[];
}

export interface ShopperCodeSent {
  sent: true;
  channel: ShopperChannel;
  /** Masked: "01******003", "a***@mail.com". */
  target: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface ShopperSession extends ShopperMe {
  token: string;
  expiresInSeconds: number;
}

/** 0 placed · 1 confirmed · 2 shipped · 3 delivered — as the tracking page. */
export interface ShopperOrderRow {
  id: string;
  orderNumber: string;
  createdAt: string;
  stage: 0 | 1 | 2 | 3;
  /** Integer minor units as a string. */
  totalAmount: string;
  currency: string;
  itemsCount: number;
  firstItemName: string | null;
}

export interface ShopperOrderPage {
  orders: ShopperOrderRow[];
  /** Pass as `before` for the next page; null at the end. */
  nextBefore: string | null;
}

/** Everything the tracking page shows, plus the order's own id, date, payment and address. */
export type ShopperOrder = TrackResult &
  OrderTrackingExtras & {
    id: string;
    createdAt: string;
    paymentMethod: string | null;
    shippingAddress: Partial<ShopperAddress> | null;
  };

export type ShopperReorderReason = "low_stock" | "out_of_stock" | "unavailable";

export interface ShopperReorderLine {
  variantId: string | null;
  productId: string | null;
  name: string;
  /** Lowered to what is left on `low_stock`. */
  quantity: number;
  unitPrice: string | null;
  available: boolean;
  reason: ShopperReorderReason | null;
}

const base = (workspaceRef: string) => `/store/${workspaceRef}/account`;
const signed = (token: string) => ({ auth: false, headers: shopperTokenHeaders(token) }) as const;

export function shopperAccountConfig(client: ApiClient, workspaceRef: string): Promise<ShopperAccountsSettings> {
  return client.request<ShopperAccountsSettings>(`${base(workspaceRef)}/config`, { auth: false });
}

export function shopperRequestCode(
  client: ApiClient,
  workspaceRef: string,
  body: ({ phone: string } | { email: string }) & { locale?: "ar" | "en" | "fr" }
): Promise<ShopperCodeSent> {
  return client.request<ShopperCodeSent>(`${base(workspaceRef)}/code`, { method: "POST", body, auth: false });
}

export function shopperVerifyCode(
  client: ApiClient,
  workspaceRef: string,
  body: ({ phone: string } | { email: string }) & { code: string }
): Promise<ShopperSession> {
  return client.request<ShopperSession>(`${base(workspaceRef)}/verify`, { method: "POST", body, auth: false });
}

export function shopperMe(client: ApiClient, workspaceRef: string, token: string): Promise<ShopperMe> {
  return client.request<ShopperMe>(`${base(workspaceRef)}/me`, signed(token));
}

export function shopperUpdateMe(
  client: ApiClient,
  workspaceRef: string,
  token: string,
  body: { fullName?: string | null; email?: string | null; marketingConsent?: boolean }
): Promise<ShopperMe> {
  return client.request<ShopperMe>(`${base(workspaceRef)}/me`, { ...signed(token), method: "PATCH", body });
}

export function shopperSignOutEverywhere(client: ApiClient, workspaceRef: string, token: string): Promise<{ signedOut: boolean }> {
  return client.request<{ signedOut: boolean }>(`${base(workspaceRef)}/sign-out-everywhere`, { ...signed(token), method: "POST" });
}

export function shopperOrders(client: ApiClient, workspaceRef: string, token: string, before?: string | null): Promise<ShopperOrderPage> {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  return client.request<ShopperOrderPage>(`${base(workspaceRef)}/orders${query}`, signed(token));
}

export async function shopperOrder(client: ApiClient, workspaceRef: string, token: string, orderId: string): Promise<ShopperOrder> {
  const { order } = await client.request<{ order: ShopperOrder }>(`${base(workspaceRef)}/orders/${encodeURIComponent(orderId)}`, signed(token));
  return order;
}

export async function shopperReorder(client: ApiClient, workspaceRef: string, token: string, orderId: string): Promise<ShopperReorderLine[]> {
  const { lines } = await client.request<{ lines: ShopperReorderLine[] }>(
    `${base(workspaceRef)}/orders/${encodeURIComponent(orderId)}/reorder`,
    { ...signed(token), method: "POST" }
  );
  return lines;
}

export async function shopperAddresses(client: ApiClient, workspaceRef: string, token: string): Promise<ShopperAddress[]> {
  const { addresses } = await client.request<{ addresses: ShopperAddress[] }>(`${base(workspaceRef)}/addresses`, signed(token));
  return addresses;
}

export async function shopperAddAddress(
  client: ApiClient,
  workspaceRef: string,
  token: string,
  body: ShopperAddressInput
): Promise<ShopperAddress[]> {
  const { addresses } = await client.request<{ addresses: ShopperAddress[] }>(`${base(workspaceRef)}/addresses`, {
    ...signed(token),
    method: "POST",
    body,
  });
  return addresses;
}

export async function shopperUpdateAddress(
  client: ApiClient,
  workspaceRef: string,
  token: string,
  addressId: string,
  body: Partial<ShopperAddressInput>
): Promise<ShopperAddress[]> {
  const { addresses } = await client.request<{ addresses: ShopperAddress[] }>(
    `${base(workspaceRef)}/addresses/${encodeURIComponent(addressId)}`,
    { ...signed(token), method: "PATCH", body }
  );
  return addresses;
}

export async function shopperDeleteAddress(client: ApiClient, workspaceRef: string, token: string, addressId: string): Promise<ShopperAddress[]> {
  const { addresses } = await client.request<{ addresses: ShopperAddress[] }>(
    `${base(workspaceRef)}/addresses/${encodeURIComponent(addressId)}`,
    { ...signed(token), method: "DELETE" }
  );
  return addresses;
}

/** A store keeps at most this many addresses per shopper (422 TOO_MANY_ADDRESSES past it). */
export const SHOPPER_MAX_ADDRESSES = 10;
