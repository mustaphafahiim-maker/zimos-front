"use client";

import { useEffect } from "react";
import { declarePageType, type StorePageType } from "@/lib/storePageType";

/**
 * Declares the page on screen as a kind of store page its address does not
 * tell (a funnel's thank-you step), for the store scripts limited to that kind
 * (components/StoreScripts.tsx). Renders nothing.
 */
export function StorePageMark({ type }: { type: StorePageType }) {
  useEffect(() => declarePageType(type), [type]);
  return null;
}
