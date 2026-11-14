"use client";

import { useEffect, useId, useState } from "react";
import type { StorefrontProduct, StorefrontVariant } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { variantLabel } from "@/lib/product";
import { input, label as labelClass } from "../ui";
import { pickText } from "@/lib/i18n";

const TEXT = {
  ar: { choose: "اختار النوع", soldOut: "نفذ" },
  en: { choose: "Choose an option", soldOut: "sold out" },
} as const;

/**
 * The option the shopper takes a one-click offer in (SPEC §9.5: "product +
 * variant (chosen by the customer)") — the funnel's upsell / downsell and the
 * store's thank-you offer. Shown only for an offer of one line whose product
 * has more than one variant; the server takes the choice for such an offer
 * only (offers/offerVariantChoice.js). Starts on the offer's own variant.
 */
export function OfferVariantPicker({
  product,
  value,
  onChange,
  disabled,
}: {
  product: StorefrontProduct | null | undefined;
  value: string;
  onChange: (variantId: string) => void;
  disabled?: boolean;
}) {
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  const id = useId();
  const variants = (product?.variants ?? []).filter((v) => variantLabel(v));
  if (variants.length < 2) return null;
  return (
    <div className="mx-auto mt-4 max-w-xs text-start">
      <label htmlFor={id} className={labelClass}>
        {text.choose}
      </label>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${input} cursor-pointer`}>
        {variants.map((v: StorefrontVariant) => (
          <option key={v.id} value={v.id} disabled={!v.inStock}>
            {variantLabel(v)}
            {!v.inStock ? ` — ${text.soldOut}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A product by its slug or id, for the thank-you offer's picker; null until it answers or when it fails. */
export function useOfferProduct(workspaceId: string, idOrSlug: string | null | undefined): StorefrontProduct | null {
  const [product, setProduct] = useState<{ key: string; product: StorefrontProduct } | null>(null);
  useEffect(() => {
    if (!idOrSlug) return;
    let cancelled = false;
    createStorefrontApiClient()
      .getStorefrontProduct(workspaceId, idOrSlug)
      .then((p) => {
        if (!cancelled) setProduct({ key: idOrSlug, product: p as StorefrontProduct });
      })
      .catch(() => {
        /* no picker: the offer's own variant */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, idOrSlug]);
  return product && product.key === idOrSlug ? product.product : null;
}
