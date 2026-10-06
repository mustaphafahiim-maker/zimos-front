/**
 * Address suggestions at checkout (backend: frontend-handoff item 184,
 * places/autocomplete). The shopper types in one field; a pick fills the
 * address. The suggestions come from the store's provider: its own places
 * list (`builtin`, the default, no key) or Google Maps with the store's own
 * key. A pick is matched back to the store's places list, so its names are
 * the list's names and `placeId` prices the shipping.
 *
 * Storefront (public, no auth):
 *   GET /store/:ws/address/config                             → AddressLookupConfig (cached 60 s)
 *   GET /store/:ws/address/suggest?q=&country=&lang=&session= → { enabled, suggestions } (≤ 8)
 *   GET /store/:ws/address/details?id=&session=               → { address }   404 ADDRESS_NOT_FOUND
 *
 * Dashboard (shipping.manage):
 *   GET /workspaces/:ws/address-autocomplete                  → AddressLookupSettings
 *   PUT /workspaces/:ws/address-autocomplete { provider, apiKey? } → AddressLookupSettings
 *     422 ADDRESS_LOOKUP_KEY_REQUIRED (Google without a key), 422 ADDRESS_LOOKUP_INVALID_KEY
 *     (Google refused the key), 502 ADDRESS_LOOKUP_UNAVAILABLE (Google could not be reached).
 *     The key is never returned: `hasKey` only.
 */
import type { ApiClient } from "../client";

// ----------------------------------------------------------- storefront --

export interface AddressLookupConfig {
  enabled: boolean;
  provider: "builtin" | "google" | null;
  /** "google": show "Powered by Google" under the suggestions. */
  attribution: "google" | null;
}

export type AddressSuggestionLevel = "region" | "city" | "area" | "address";

export interface AddressSuggestion {
  /** Opaque: "p:<store place>", "g:<platform place>" or "google:<place>"; handed back to details. */
  id: string;
  /** The place itself (shown bold). */
  text: string;
  /** Where it is ("مدينة نصر، القاهرة"); null when nothing is above it. */
  secondaryText: string | null;
  level: AddressSuggestionLevel;
}

export interface AddressSuggestions {
  /** false: the store turned suggestions off (the list is then empty). */
  enabled: boolean;
  suggestions: AddressSuggestion[];
}

/** A picked address. Every part may be null; the names are the store list's names where they match. */
export interface AddressLookupAddress {
  country: string | null;
  province: string | null;
  city: string | null;
  area: string | null;
  /** The street (Google only; the store's list has none). */
  addressLine: string | null;
  postalCode: string | null;
  /** The deepest store place it matched: the checkout's `placeId`, which prices the shipping. */
  placeId: string | null;
  location: { lat: number; lng: number } | null;
}

const storeBase = (workspaceId: string) => `/store/${encodeURIComponent(workspaceId)}/address`;

export function storefrontAddressConfig(client: ApiClient, workspaceId: string): Promise<AddressLookupConfig> {
  return client.request<AddressLookupConfig>(`${storeBase(workspaceId)}/config`, { auth: false });
}

export function storefrontAddressSuggest(
  client: ApiClient,
  workspaceId: string,
  params: { q: string; country?: string; lang?: string; session?: string },
  opts: { signal?: AbortSignal } = {}
): Promise<AddressSuggestions> {
  const query = new URLSearchParams({ q: params.q });
  if (params.country) query.set("country", params.country);
  if (params.lang) query.set("lang", params.lang);
  if (params.session) query.set("session", params.session);
  return client.request<AddressSuggestions>(`${storeBase(workspaceId)}/suggest?${query}`, { auth: false, signal: opts.signal });
}

export async function storefrontAddressDetails(
  client: ApiClient,
  workspaceId: string,
  params: { id: string; country?: string; lang?: string; session?: string }
): Promise<AddressLookupAddress> {
  const query = new URLSearchParams({ id: params.id });
  if (params.country) query.set("country", params.country);
  if (params.lang) query.set("lang", params.lang);
  if (params.session) query.set("session", params.session);
  const { address } = await client.request<{ address: AddressLookupAddress }>(`${storeBase(workspaceId)}/details?${query}`, { auth: false });
  return address;
}

// ------------------------------------------------------------ dashboard --

export type AddressLookupProviderCode = "builtin" | "google";

export interface AddressLookupProvider {
  code: AddressLookupProviderCode;
  name: { en: string; ar: string };
  needsKey: boolean;
}

export interface AddressLookupSettings {
  provider: "off" | AddressLookupProviderCode;
  providers: AddressLookupProvider[];
  /** A Google key is saved (it is never sent back). */
  hasKey: boolean;
  /** Set when Google later refused the saved key; shoppers get the places list meanwhile. */
  lastError: string | null;
}

export interface AddressLookupUpdate {
  provider: "off" | AddressLookupProviderCode;
  /** 20–200 characters; left out to keep the saved key. */
  apiKey?: string;
}

const staffBase = (workspaceId: string) => `/workspaces/${workspaceId}/address-autocomplete`;

export function addressLookupSettings(client: ApiClient, workspaceId: string): Promise<AddressLookupSettings> {
  return client.request<AddressLookupSettings>(staffBase(workspaceId));
}

export function addressLookupUpdate(client: ApiClient, workspaceId: string, body: AddressLookupUpdate): Promise<AddressLookupSettings> {
  return client.request<AddressLookupSettings>(staffBase(workspaceId), { method: "PUT", body });
}
