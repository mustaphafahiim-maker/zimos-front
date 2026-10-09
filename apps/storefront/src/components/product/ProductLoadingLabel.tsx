"use client";

import { useStore } from "@/lib/StoreContext";
import { productPageText } from "./productPageText";

/** «بنحمّل المنتج…» for a screen reader, in the store's language, while the page's skeleton shows. */
export function ProductLoadingLabel() {
  const { locale } = useStore();
  return (
    <p role="status" className="sr-only">
      {productPageText(locale).loading}
    </p>
  );
}
