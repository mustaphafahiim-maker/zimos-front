"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { storefrontPlaces, type ApiClient, type StorefrontPlace, type StorefrontPlaceList } from "@store-builder/api-client";
import { formOf, provinceFor, type OrderFormField, type OrderFormFieldModes, type PlacePicks } from "./orderForm";
import { findPlace } from "./places";

/**
 * The store's own places at checkout (frontend-handoff 163/164): when the
 * store keeps its own list for the form's country (GET /store/:ws/places,
 * source "store"), the governorate and city fields become three dependent
 * pickers — region → city → area, the area only when the chosen city has
 * some. Without an own list (source "platform", still loading, or the call
 * failed) nothing changes: the platform's governorates and a typed city.
 *
 * The picks are kept here; the form's values follow them (onChange), so the
 * rest of the form — validation, the cart's "ship to", the progress steps —
 * reads them as before: `governorate` holds the region's platform code (or ""
 * for a region the platform does not know), `city` the city's name. What the
 * quote and the order carry is `address`: the names, and the deepest picked
 * place's id, which prices the shipping (the storefront never computes it).
 */

/** What the picked place puts on the shipping quote and on the order's shipping address. */
export interface PlaceAddress {
  /** The region: the platform's "<ar> (<en>)" for a known governorate (as orders always carried it), else its name. */
  province: string;
  city?: string;
  area?: string;
  /** The deepest picked place. */
  placeId: string;
  /** Nothing left to pick under it: an area, or a city / region without any (the address is complete). */
  final?: boolean;
}

export interface StorePlacesState extends PlacePicks {
  /** The list is being asked for (the platform's governorates show meanwhile). */
  loading: boolean;
  regions: readonly StorefrontPlace[];
  /** The picked region's cities; [] before a region is picked or when it has none (a typed city then). */
  cities: readonly StorefrontPlace[];
  /** The picked city's areas; [] when it has none (no area picker then). */
  areas: readonly StorefrontPlace[];
  areaId: string;
  pickRegion: (id: string) => void;
  pickCity: (id: string) => void;
  pickArea: (id: string) => void;
  /** null until a region is picked, and whenever the store's own list is not in use. */
  address: PlaceAddress | null;
  /** Asks for the list again (a place was hidden after this page loaded: SHIPPING_PLACE_UNAVAILABLE). */
  reload: () => void;
}

// One request per store and country for the page's life: the product page, the cart and the checkout share it.
const cache = new Map<string, Promise<StorefrontPlaceList>>();

function loadPlaces(client: ApiClient, workspaceId: string, country: string, fresh: boolean): Promise<StorefrontPlaceList> {
  const key = `${workspaceId}:${country}`;
  const known = fresh ? undefined : cache.get(key);
  if (known) return known;
  const request = storefrontPlaces(client, workspaceId, country, { fresh });
  cache.set(key, request);
  // A failure is asked again next time rather than remembered.
  request.catch(() => {
    if (cache.get(key) === request) cache.delete(key);
  });
  return request;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function useStorePlaces({
  client,
  workspaceId,
  country,
  fields,
  governorate,
  city,
  onChange,
}: {
  client: ApiClient;
  workspaceId: string;
  /** The form's country ("" = Egypt). */
  country: string;
  /** The purchase form: the pickers stand in for its governorate field, so they only appear when it is on. */
  fields: OrderFormFieldModes;
  /** The form's governorate code: a region with that code is picked for the shopper (the cart's "ship to", a recovery link). */
  governorate: string;
  /** The form's city text: a city of that name is picked with it. */
  city: string;
  /** The form's own change handler: the picks are written back to `governorate` and `city`. */
  onChange: (field: OrderFormField, value: string) => void;
}): StorePlacesState {
  const code = (country || "EG").toUpperCase();
  const [loaded, setLoaded] = useState<{ key: string; list: StorefrontPlaceList | null } | null>(null);
  const [nonce, setNonce] = useState(0);
  const listKey = `${workspaceId}:${code}`;

  useEffect(() => {
    let cancelled = false;
    loadPlaces(client, workspaceId, code, nonce > 0)
      .then((list) => {
        if (!cancelled) setLoaded({ key: listKey, list });
      })
      .catch(() => {
        // The platform's list stays: a shopper is never stuck on a failed call.
        if (!cancelled) setLoaded({ key: listKey, list: null });
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId, code, listKey, nonce]);

  const list = loaded?.key === listKey ? loaded.list : null;
  const regionShown = useMemo(() => formOf(fields).some((f) => f.key === "government"), [fields]);
  const regions = useMemo(() => (list?.source === "store" ? list.places.filter((p) => p.id) : []), [list]);
  const active = regionShown && regions.length > 0;

  const [picks, setPicks] = useState({ regionId: "", cityId: "", areaId: "" });

  // A region (and city) the form already names is picked for the shopper — once
  // per name, so clearing the picker is not undone.
  const [adopted, setAdopted] = useState("");
  const adoptKey = `${listKey}|${governorate}|${city}`;
  if (active && !picks.regionId && governorate && adopted !== adoptKey) {
    setAdopted(adoptKey);
    const region = regions.find((r) => r.code === governorate);
    if (region?.id) {
      const match = city ? (region.children ?? []).find((c) => c.id && (same(c.ar, city) || same(c.en, city))) : undefined;
      setPicks({ regionId: region.id, cityId: match?.id ?? "", areaId: "" });
    }
  }

  // Picks the list no longer has (reloaded, or another country) read as not picked.
  const region = active ? regions.find((r) => r.id === picks.regionId) : undefined;
  const cities = (region?.children ?? []).filter((c) => c.id);
  const cityPlace = cities.find((c) => c.id === picks.cityId);
  const areas = (cityPlace?.children ?? []).filter((a) => a.id);
  const areaPlace = areas.find((a) => a.id === picks.areaId);

  const pickRegion = useCallback(
    (id: string) => {
      const next = regions.find((r) => r.id === id);
      setPicks({ regionId: next?.id ?? "", cityId: "", areaId: "" });
      // The cart's "ship to" and the governorate rules read the platform code; a region it does not know clears it.
      onChange("governorate", next?.code && findPlace(next.code) ? next.code : "");
      onChange("city", "");
    },
    [regions, onChange]
  );

  const pickCity = useCallback(
    (id: string) => {
      const next = cities.find((c) => c.id === id);
      setPicks((prev) => ({ ...prev, cityId: next?.id ?? "", areaId: "" }));
      onChange("city", next ? next.ar : "");
      // A new pick answers a refused place (said at the governorate, components/checkout/StorePlaceFields).
      onChange("governorate", governorate);
    },
    [cities, onChange, governorate]
  );

  const pickArea = useCallback(
    (id: string) => {
      setPicks((prev) => ({ ...prev, areaId: id }));
      onChange("governorate", governorate);
    },
    [onChange, governorate]
  );

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const address = useMemo<PlaceAddress | null>(() => {
    if (!region?.id) return null;
    const deepest = areaPlace ?? cityPlace ?? region;
    const below = areaPlace ? [] : ((cityPlace ?? region).children ?? []).filter((p) => p.id);
    return {
      province: (region.code && findPlace(region.code) && provinceFor(region.code)) || region.ar,
      ...(cityPlace ? { city: cityPlace.ar } : {}),
      ...(areaPlace ? { area: areaPlace.ar } : {}),
      placeId: deepest.id as string,
      final: below.length === 0,
    };
  }, [region, cityPlace, areaPlace]);

  return {
    active,
    loading: regionShown && !list && loaded?.key !== listKey,
    regions,
    cities,
    areas,
    regionId: region?.id ?? "",
    cityId: cityPlace?.id ?? "",
    areaId: areaPlace?.id ?? "",
    hasCities: cities.length > 0,
    pickRegion,
    pickCity,
    pickArea,
    address,
    reload,
  };
}
