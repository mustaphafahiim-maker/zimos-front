import { useEffect, useMemo, useRef } from "react";
import { catalogBulkUpdateVariants, isApiErrorCode, type CatalogEntityStatus, type Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { majorToMinor } from "@/lib/format";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useT } from "@/i18n/LocaleContext";
import { VARIANT_STRINGS } from "./variantStrings";

/** The saves behind the cells of the variants grid. Each one resolves once the server has it, and rejects when it does not. */
export interface VariantEdits {
  /** `next` is the amount as typed: "250", "149.5". */
  price: (variant: Variant, next: string) => Promise<void>;
  /** Empty clears the price before discount. */
  compareAt: (variant: Variant, next: string) => Promise<void>;
  /** Empty clears the SKU. */
  sku: (variant: Variant, next: string) => Promise<void>;
  /** The count on hand, a whole number. */
  stock: (variant: Variant, next: string) => Promise<void>;
  status: (variant: Variant, next: CatalogEntityStatus) => Promise<void>;
}

/**
 * One cell, one request — through the calls the page already made:
 *
 *  - price, price before discount, SKU and status: `apiClient.updateVariant`
 *    (PATCH /catalog/variants/:id) with that one field, as the variant form
 *    sends it;
 *  - stock: `catalogBulkUpdateVariants` (PATCH …/variants/bulk) with one row
 *    `{ id, stockOnHand }`, exactly what the "edit all in a table" sheet sends
 *    for a changed stock cell — stock is not part of the single-variant payload.
 *
 * After each save the page reloads the product quietly (`onChanged`), so the
 * row shows what the server now holds.
 */
export function useVariantEdits(productId: string, onChanged: () => void): VariantEdits {
  const t = useT(VARIANT_STRINGS);
  const workspaceId = useWorkspaceId();

  // «تراجع» runs seconds later: it reloads through the page's latest callback and speaks the current language.
  const latest = useRef({ onChanged, t });
  useEffect(() => {
    latest.current = { onChanged, t };
  });

  return useMemo<VariantEdits>(
    () => ({
      async price(variant, next) {
        await apiClient.updateVariant(workspaceId, variant.id, { priceAmount: majorToMinor(next) });
        latest.current.onChanged();
      },
      async compareAt(variant, next) {
        await apiClient.updateVariant(workspaceId, variant.id, { compareAtAmount: next === "" ? null : majorToMinor(next) });
        latest.current.onChanged();
      },
      async sku(variant, next) {
        try {
          await apiClient.updateVariant(workspaceId, variant.id, { sku: next === "" ? null : next });
        } catch (err) {
          if (isApiErrorCode(err, "DUPLICATE_RESOURCE")) throw new Error(latest.current.t.skuTaken);
          throw err;
        }
        latest.current.onChanged();
      },
      async stock(variant, next) {
        await catalogBulkUpdateVariants(apiClient, workspaceId, productId, [{ id: variant.id, stockOnHand: Number(next) }]);
        latest.current.onChanged();
      },
      async status(variant, next) {
        await apiClient.updateVariant(workspaceId, variant.id, { status: next });
        latest.current.onChanged();
      },
    }),
    [workspaceId, productId]
  );
}
