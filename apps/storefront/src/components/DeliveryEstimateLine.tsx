"use client";

import { useEffect, useState } from "react";
import { storefrontDeliveryEstimate, type DeliveryEstimate, type DeliveryEstimateQuery } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { deliveryGetText } from "@/lib/buyInfo";
import { provinceFor } from "@/lib/orderForm";
import { useShipTo } from "@/lib/shipTo";
import { useStoreCountry } from "@/lib/storeCountry";
import type { PlaceAddress } from "@/lib/useStorePlaces";
import { TruckIcon } from "./Icons";

/**
 * «هيوصلك من … لـ …» (handoff 199): the window the API worked out for an
 * address — from the shipping quote in the cart and at checkout, or asked for
 * on the product page. Nothing when the store shows none.
 */
export function DeliveryEstimateLine({ estimate, className = "" }: { estimate: DeliveryEstimate | null | undefined; className?: string }) {
  const { t, intlLocale } = useStore();
  const text = estimate ? deliveryGetText(estimate, t.buyInfo, intlLocale) : "";
  if (!text) return null;
  return (
    <p className={`flex items-center gap-1.5 text-sm font-medium text-ink ${className}`} aria-live="polite">
      <TruckIcon size={16} className="shrink-0 text-primary" />
      {text}
    </p>
  );
}

/** Where the product page asks about: the picked place, else the form's governorate, else the one this device saved. */
export interface DeliveryTarget {
  /** The quick order form's governorate code ("" until chosen). */
  governorate: string;
  /** The place picked from the store's own list, when there is one. */
  place: PlaceAddress | null;
}

// One answer per store and address for the page's life (the API caches it 5 minutes too).
const cache = new Map<string, Promise<DeliveryEstimate | null>>();

/**
 * The product page's window: GET /store/:ws/delivery-estimate for the
 * visitor's place — the one picked in the quick order form, else the
 * governorate saved from the cart (lib/shipTo), else the store's usual time.
 * `target: null` asks nothing (a sold-out or pre-order variant).
 */
export function useDeliveryEstimate(target: DeliveryTarget | null): DeliveryEstimate | null {
  const { store } = useStore();
  const workspaceId = store?.workspaceId ?? "";
  const [savedCode] = useShipTo(workspaceId);
  const country = useStoreCountry();
  const code = target?.governorate || savedCode;
  const query: DeliveryEstimateQuery | null = !target
    ? null
    : target.place
      ? { country, province: target.place.province, city: target.place.city, area: target.place.area, placeId: target.place.placeId }
      : { country, province: code ? provinceFor(code) : null };
  const key = query && workspaceId ? JSON.stringify([workspaceId, query]) : "";
  const [answer, setAnswer] = useState<{ key: string; estimate: DeliveryEstimate | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let request = cache.get(key);
    if (!request) {
      request = storefrontDeliveryEstimate(createStorefrontApiClient(), workspaceId, JSON.parse(key)[1] as DeliveryEstimateQuery);
      cache.set(key, request);
      // A failure says nothing about the next visit: asked again then.
      request.catch(() => cache.delete(key));
    }
    request
      .then((estimate) => !cancelled && setAnswer({ key, estimate }))
      // The page simply says nothing about delivery.
      .catch(() => !cancelled && setAnswer({ key, estimate: null }));
    return () => {
      cancelled = true;
    };
  }, [key, workspaceId]);

  return answer && answer.key === key ? answer.estimate : null;
}
