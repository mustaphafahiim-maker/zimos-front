"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useStoreBasePath } from "@/components/StoreRoute";
import { storeHref } from "@/lib/storeHref";

/**
 * Moves the listing to a new URL (lib/catalogQuery.ts builds it) without
 * jumping to the top, and says while the new page is on its way — the
 * listing dims and announces it meanwhile.
 */
export function useCatalogNavigate() {
  const router = useRouter();
  const basePath = useStoreBasePath();
  const [pending, startTransition] = useTransition();
  const go = (href: string) =>
    startTransition(() => {
      router.push(storeHref(basePath, href), { scroll: false });
    });
  return { go, pending };
}
