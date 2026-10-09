"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/CartProvider";
import { cartTokenSent, rememberStoreId } from "@/lib/shopperCart";
import { readToken, useShopperToken } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";

/**
 * Keeps the cart priced for whoever is signed in (handoff 205). The cart's
 * own calls carry the shopper's token (lib/shopperCart.ts); this tells them
 * which store's token that is, and reads the cart again when the shopper
 * signs in or out — or when the cart was first read before this store was
 * known. Renders nothing.
 */
export function ShopperCartPrices() {
  const { store } = useStore();
  const { refreshCart } = useCart();
  const routeRef = store?.workspaceId ?? "";
  const storeId = store?.id ?? "";
  const token = useShopperToken(storeId);

  useEffect(() => {
    if (!routeRef || !storeId) return;
    rememberStoreId(routeRef, storeId);
    const sent = cartTokenSent(routeRef);
    // Nothing read yet: the cart's first read is on its way and will carry the token by itself.
    // Compared with the token as it is stored: the hook's own value is still empty while the page hydrates.
    if (sent === undefined || sent === readToken(storeId)) return;
    void refreshCart().catch(() => {
      /* the cart keeps the prices it has */
    });
  }, [routeRef, storeId, token, refreshCart]);

  return null;
}
