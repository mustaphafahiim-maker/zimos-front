"use client";

import { useEffect } from "react";
import { storefrontRedirectLookup, type StorefrontRedirect } from "@store-builder/api-client";
import { createStorefrontApiClient } from "./apiClient";
import { useStore } from "./StoreContext";
import { redirectTarget } from "./urlRedirects";

// One question per address for the page's life (React's development double-run would ask twice, and count twice).
const asked = new Map<string, Promise<StorefrontRedirect | null>>();

/**
 * The store's not-found page asking whether its address was moved
 * (frontend-handoff 232). The pages a store's old links usually point at —
 * a page, a product, a collection, a blog post — ask on the server and answer
 * with a real redirect (lib/urlRedirectsServer); this covers every other
 * address that ends on the not-found page. A hit replaces the address, so
 * "back" does not return to a page that is not there.
 *
 * The address is read from the browser (the boundary gets no route params):
 * on the shared host it still carries `/store/<workspaceId>`, on the store's
 * own domain it is store-relative already and the store comes from context.
 */
export function useRedirectLookup(): void {
  const { store } = useStore();
  const contextRef = store?.id ?? null;

  useEffect(() => {
    const { pathname, search } = window.location;
    const prefix = pathname.match(/^\/store\/([^/]+)/);
    const storeRef = prefix?.[1] ?? contextRef;
    if (!storeRef) return;
    const basePath = prefix?.[0] ?? "";
    const current = `${pathname.slice(basePath.length) || "/"}${search}`;
    const key = `${storeRef} ${current}`;
    let cancelled = false;
    let question = asked.get(key);
    if (!question) {
      // A locked store or a network failure is "not moved": the page stays as it is.
      question = storefrontRedirectLookup(createStorefrontApiClient(), storeRef, current).catch(() => null);
      asked.set(key, question);
    }
    void question.then((found) => {
      if (cancelled || !found) return;
      const target = redirectTarget(found, basePath, current, new URLSearchParams(search));
      if (target) window.location.replace(target);
    });
    return () => {
      cancelled = true;
    };
  }, [contextRef]);
}
