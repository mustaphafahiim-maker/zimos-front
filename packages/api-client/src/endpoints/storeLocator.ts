/**
 * Store locator (backend: frontend-handoff item 233, src/modules/storeLocator).
 *
 * The store's branches are its stock locations (Inventory → Locations,
 * endpoints/stockLocations.ts): their name and address come from there. This
 * setting says which of them the public sees and adds what a shopper needs —
 * a phone, a WhatsApp number, opening hours, a note and the map pin.
 *
 * Dashboard (permission website.edit), /workspaces/:ws/store-locator:
 *   GET → StoreLocatorSettings
 *   PUT StoreLocatorSettings → the same. The whole setting is replaced; the
 *       keys of `branches` must be stock locations of this store (422 on
 *       `branches`), `lat` and `lng` go together (422), texts ≤ 300, phone and
 *       WhatsApp ≤ 40.
 *
 * Storefront (public): GET /store/:ws/branches?lat=&lng= → StorefrontBranches,
 *   404 while the locator is off. Only active locations marked visible. With
 *   the shopper's coordinates (both or neither, else 422) the list is nearest
 *   first, each with `distanceKm` (straight line), and `nearest` is set.
 */
import { ApiError, type ApiClient } from "../client";

/** A text in the store's two languages; either may be missing or empty. */
export interface StoreLocatorTexts {
  ar?: string;
  en?: string;
}

export interface StoreLocatorBranchSettings {
  /** Shown on the storefront's branches page. */
  visible: boolean;
  phone?: string | null;
  whatsapp?: string | null;
  hours?: StoreLocatorTexts | null;
  note?: StoreLocatorTexts | null;
  /** −90…90; sent together with `lng` or not at all. */
  lat?: number | null;
  /** −180…180. */
  lng?: number | null;
}

export interface StoreLocatorSettings {
  enabled: boolean;
  /** Keyed by stock location id. */
  branches: Record<string, StoreLocatorBranchSettings>;
}

export const STORE_LOCATOR_TEXT_MAX = 300;
export const STORE_LOCATOR_PHONE_MAX = 40;

export function storeLocatorGet(client: ApiClient, workspaceId: string): Promise<StoreLocatorSettings> {
  return client.request<StoreLocatorSettings>(`/workspaces/${workspaceId}/store-locator`);
}

export function storeLocatorSave(client: ApiClient, workspaceId: string, body: StoreLocatorSettings): Promise<StoreLocatorSettings> {
  return client.request<StoreLocatorSettings>(`/workspaces/${workspaceId}/store-locator`, { method: "PUT", body });
}

// ----------------------------------------------------------- storefront --

export interface StorefrontBranch {
  /** The stock location's id. */
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  hours: StoreLocatorTexts | null;
  note: StoreLocatorTexts | null;
  lat: number | null;
  lng: number | null;
  /** The branch takes click-and-collect orders (handoff 225). */
  pickup: boolean;
  /** Google Maps directions to the pin, or to the address when there is no pin; null with neither. */
  directionsUrl: string | null;
  /** Straight-line distance from the shopper, one decimal; null without the shopper's coordinates or without a pin. */
  distanceKm: number | null;
}

export interface StorefrontBranches {
  branches: StorefrontBranch[];
  /** The closest branch with a pin, when the shopper's coordinates were sent. */
  nearest: StorefrontBranch | null;
}

/**
 * The store's public branches, or null while the locator is off (404). With
 * `near` the list comes back nearest first. Any other failure (a locked
 * store, the network) is thrown.
 */
export async function storefrontBranches(
  client: ApiClient,
  workspaceRef: string,
  near?: { lat: number; lng: number } | null
): Promise<StorefrontBranches | null> {
  const query = near ? `?lat=${encodeURIComponent(near.lat)}&lng=${encodeURIComponent(near.lng)}` : "";
  try {
    return await client.request<StorefrontBranches>(`/store/${workspaceRef}/branches${query}`, { auth: false });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * `storeLocator.enabled` on the store's metadata, read defensively. GET
 * /store/:ws does not send it today: the storefront's layout asks
 * `storefrontBranches` once and lays the answer over the store it hands to
 * the footer; an API that starts sending it is read here with no change.
 */
export function storefrontHasBranches(store: unknown): boolean {
  return (store as { storeLocator?: { enabled?: unknown } } | null)?.storeLocator?.enabled === true;
}
