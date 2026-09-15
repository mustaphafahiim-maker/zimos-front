"use client";

import { useEffect, useRef } from "react";
import { createStorefrontApiClient } from "./apiClient";
import { isEgyptianMobile } from "./egypt";

/**
 * Records the checkout in progress (POST /store/:id/checkout-sessions) once the
 * shopper has typed a valid mobile number, so the merchant can follow up if
 * they leave without ordering. Prices are computed by the backend; placing the
 * order closes the session automatically.
 */
export function useCheckoutSession(
  workspaceId: string,
  input: {
    fullName: string;
    phone: string;
    email?: string;
    items: Array<{ variantId: string; offerId?: string; quantity: number }>;
    funnelId?: string;
  }
) {
  const sessionId = useRef<string | null>(null);
  const lastSent = useRef("");
  const { fullName, phone, email, items, funnelId } = input;
  const itemsKey = JSON.stringify(items);

  useEffect(() => {
    if (!workspaceId || !isEgyptianMobile(phone) || items.length === 0) return;
    const body = {
      ...(sessionId.current ? { sessionId: sessionId.current } : {}),
      contact: { fullName: fullName.trim() || null, phone, email: email?.trim() || null },
      items,
      ...(funnelId ? { funnelId } : {}),
    };
    const key = JSON.stringify({ ...body, sessionId: undefined });
    if (key === lastSent.current) return;

    const timer = window.setTimeout(() => {
      lastSent.current = key;
      createStorefrontApiClient()
        .request<{ session: { id: string } }>(`/store/${workspaceId}/checkout-sessions`, { method: "POST", body })
        .then((res) => {
          sessionId.current = res.session.id;
        })
        .catch(() => {
          lastSent.current = "";
        });
    }, 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, fullName, phone, email, itemsKey, funnelId]);

  return sessionId;
}
