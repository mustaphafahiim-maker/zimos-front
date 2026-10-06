"use client";

import { useEffect, useRef, useState } from "react";
import type { ShopperAddress, ShopperAddressInput, StorefrontPlace } from "@store-builder/api-client";
import type { Locale } from "./i18n";
import { provinceFor } from "./orderForm";
import { findPlace, placesFor } from "./places";
import type { PlaceAddress, StorePlacesState } from "./useStorePlaces";

/**
 * A saved address (frontend-handoff 185) as the account and the checkout
 * read and write it. The province travels as the order carries it — the
 * platform's "<ar> (<en>)" for a known governorate, else the region's name —
 * the city and area as names, and `placeId` as the deepest place picked
 * from the store's own list (lib/useStorePlaces).
 */

/** "القاهرة (Cairo)" → the shopper's half; any other spelling as it is. */
export function provinceLabel(province: string | null | undefined, locale: Locale): string {
  const text = (province ?? "").trim();
  const match = /^(.*?)\s*\((.*)\)$/.exec(text);
  if (!match) return text;
  return locale === "ar" ? match[1] : match[2] || match[1];
}

/** One line: street, area, city, region. */
export function addressSummary(address: Partial<ShopperAddress>, locale: Locale): string {
  const parts = [address.addressLine, address.area, address.city, provinceLabel(address.province, locale)]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return parts.join(locale === "ar" ? "، " : ", ");
}

/** The platform's governorate code for a stored province ("الجيزة (Giza)", "Giza", "giza"); "" when none matches. */
export function governorateCodeOf(province: string | null | undefined, country: string): string {
  const text = (province ?? "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  const match = placesFor(country).find(
    (p) => p.code.toLowerCase() === lower || text === provinceFor(p.code) || text === p.ar || lower === p.en.toLowerCase()
  );
  return match ? match.code : "";
}

/** Region → city → area ids down to `placeId` in the store's list; null when it is not there (any more). */
export function placePath(
  regions: readonly StorefrontPlace[],
  placeId: string | null | undefined
): { regionId: string; cityId: string; areaId: string } | null {
  if (!placeId) return null;
  for (const region of regions) {
    if (region.id === placeId) return { regionId: region.id, cityId: "", areaId: "" };
    for (const city of region.children ?? []) {
      if (city.id === placeId) return { regionId: region.id as string, cityId: city.id, areaId: "" };
      for (const area of city.children ?? []) {
        if (area.id === placeId) return { regionId: region.id as string, cityId: city.id as string, areaId: area.id };
      }
    }
  }
  return null;
}

/**
 * Picks a saved place in the region → city → area pickers. Each picker
 * opens on the one before it, so the picks go one render at a time; a
 * request made while the store's list is still loading waits for it. Gives
 * up quietly when the place is gone from the list (the shopper picks again).
 */
export function usePlaceSteps(places: StorePlacesState): (placeId: string | null | undefined) => void {
  // The place still to reach; setting it asks for a render (`nudge`), and each render takes one step.
  const target = useRef<string | null>(null);
  const steps = useRef(0);
  const [, nudge] = useState(0);

  useEffect(() => {
    const placeId = target.current;
    if (!placeId || places.loading) return;
    const path = places.active ? placePath(places.regions, placeId) : null;
    if (!path || steps.current > 6) {
      target.current = null;
      return;
    }
    steps.current += 1;
    if (places.regionId !== path.regionId) return places.pickRegion(path.regionId);
    if (path.cityId && places.cityId !== path.cityId) return places.pickCity(path.cityId);
    if (path.areaId && places.areaId !== path.areaId) return places.pickArea(path.areaId);
    target.current = null;
  });

  return (placeId) => {
    steps.current = 0;
    target.current = placeId || null;
    nudge((n) => n + 1);
  };
}

/** What the account saves from a filled address form. */
export function addressInput(opts: {
  country: string;
  governorate: string;
  city: string;
  addressLine: string;
  postalCode?: string;
  place: PlaceAddress | null;
  label?: string;
  fullName?: string;
  phone?: string;
  isDefault?: boolean;
}): ShopperAddressInput {
  const country = (opts.country || "EG").toUpperCase();
  const place = opts.place;
  const province = place
    ? place.province
    : findPlace(opts.governorate)
      ? provinceFor(opts.governorate)
      : opts.governorate.trim() || null;
  const clean = (v?: string) => (v ?? "").trim() || null;
  return {
    country,
    province: province ?? null,
    city: (place?.city ?? opts.city).trim(),
    area: place?.area ?? null,
    placeId: place?.placeId ?? null,
    addressLine: opts.addressLine.trim(),
    postalCode: clean(opts.postalCode),
    label: clean(opts.label),
    fullName: clean(opts.fullName),
    phone: clean(opts.phone),
    ...(opts.isDefault !== undefined ? { isDefault: opts.isDefault } : {}),
  };
}
