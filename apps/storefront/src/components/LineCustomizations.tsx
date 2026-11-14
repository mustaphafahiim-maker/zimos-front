"use client";

import type { Customization } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";

/**
 * A cart line's answers to its product's custom fields, under the product
 * name: "Name to engrave: Sara", or that a photo is attached (the shopper saw
 * it when they picked it; the stored copy is never sent back to the browser).
 */
export function LineCustomizations({ customizations }: { customizations: Customization[] | null | undefined }) {
  const { t, locale } = useStore();
  if (!customizations || customizations.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
      {customizations.map((c) => {
        const label = locale === "ar" ? c.label.ar || c.label.en : c.label.en || c.label.ar;
        return (
          <li key={c.fieldId} className="line-clamp-2 break-words">
            <span className="font-medium text-ink">{label}:</span>{" "}
            {c.type === "image" ? t.custom.photoAttached : <span dir="auto">{c.value}</span>}
          </li>
        );
      })}
    </ul>
  );
}
