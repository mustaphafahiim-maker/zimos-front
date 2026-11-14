/**
 * Services marketplace (backend: src/modules/serviceListings).
 *
 * Merchants read the active listings at /service-listings (any signed-in
 * user). Platform admins manage them at /admin/service-listings
 * (service_listings.view / service_listings.manage).
 *
 * Notable codes: VALIDATION_ERROR (422 — a listing needs at least one
 * contact; a price needs its currency), INVALID_PHONE (422).
 */
import type { ApiClient } from "../client";

export const SERVICE_CATEGORIES = [
  "page_management",
  "landing_pages",
  "ugc",
  "video",
  "marketing",
  "programming",
  "consulting",
  "store_setup",
  "design",
  "accounting",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export interface ServiceListing {
  id: string;
  category: ServiceCategory;
  title: string;
  titleAr: string | null;
  description: string;
  descriptionAr: string | null;
  providerName: string;
  providerLogoUrl: string | null;
  /** The provider's own price in minor units; null = ask for a quote. */
  priceAmount: string | null;
  priceCurrency: string | null;
  /** e.g. "per month", "per page". */
  priceUnit: string | null;
  /** Digits with country code. */
  contactWhatsapp: string | null;
  contactUrl: string | null;
  contactEmail: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
}

export interface ServiceListingPayload {
  category: ServiceCategory;
  title: string;
  titleAr?: string | null;
  description: string;
  descriptionAr?: string | null;
  providerName: string;
  providerLogoUrl?: string | null;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  priceUnit?: string | null;
  contactWhatsapp?: string | null;
  contactUrl?: string | null;
  contactEmail?: string | null;
  isActive?: boolean;
  position?: number;
}

/** The active listings, for merchants. */
export async function serviceListingsList(client: ApiClient, category?: ServiceCategory): Promise<ServiceListing[]> {
  const { listings } = await client.request<{ listings: ServiceListing[] }>(`/service-listings${category ? `?category=${category}` : ""}`);
  return listings;
}

export async function adminServiceListingsList(client: ApiClient): Promise<ServiceListing[]> {
  const { listings } = await client.request<{ listings: ServiceListing[] }>("/admin/service-listings");
  return listings;
}

export async function adminServiceListingsCreate(client: ApiClient, payload: ServiceListingPayload): Promise<ServiceListing> {
  const { listing } = await client.request<{ listing: ServiceListing }>("/admin/service-listings", { method: "POST", body: payload });
  return listing;
}

export async function adminServiceListingsUpdate(client: ApiClient, listingId: string, payload: Partial<ServiceListingPayload>): Promise<ServiceListing> {
  const { listing } = await client.request<{ listing: ServiceListing }>(`/admin/service-listings/${listingId}`, { method: "PATCH", body: payload });
  return listing;
}

export async function adminServiceListingsDelete(client: ApiClient, listingId: string): Promise<void> {
  await client.request<unknown>(`/admin/service-listings/${listingId}`, { method: "DELETE" });
}
