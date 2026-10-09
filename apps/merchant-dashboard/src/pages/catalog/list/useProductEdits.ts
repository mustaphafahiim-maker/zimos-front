import { useMemo } from "react";
import { catalogBulkUpdateVariants, type Product, type Variant } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { apiClient } from "@/lib/apiClient";
import { majorToMinor } from "@/lib/format";
import { canManageProducts } from "@/lib/productAccess";
import { useWorkspaceId } from "@/lib/useWorkspaceId";

/** The saves behind a price or a stock count changed from the list. Each resolves once the server has it and rejects when it does not. */
export interface ProductEdits {
  /**
   * This role may change products (lib/productAccess.ts — the gate the sheet
   * update and the other product tools use). A role known to lack
   * products.manage reads the figures as plain text.
   */
  canEdit: boolean;
  /** `next` is the amount as typed: "250", "149.5". */
  price: (product: Product, variant: Variant, next: string) => Promise<void>;
  /** The count on hand, a whole number. */
  stock: (product: Product, variant: Variant, next: string) => Promise<void>;
}

type PatchProduct = (productId: string, change: (product: Product) => Product) => void;

function withVariant(product: Product, variantId: string, change: (variant: Variant) => Variant): Product {
  return { ...product, variants: (product.variants ?? []).map((variant) => (variant.id === variantId ? change(variant) : variant)) };
}

/**
 * One figure, one request — through the calls the product page makes:
 *
 *  - price: `apiClient.updateVariant` (PATCH /catalog/variants/:id) with
 *    `{ priceAmount }` in minor units, parsed the way the variant form parses it;
 *  - stock: `catalogBulkUpdateVariants` (PATCH …/variants/bulk) with one row
 *    `{ id, stockOnHand }` — stock is not part of the single-variant payload.
 *
 * After a save the row is written in place (`patch`: the rows on screen and the
 * kept pages), so the list is not read again and «تراجع» is the same save with
 * the old value.
 */
export function useProductEdits(patch: PatchProduct): ProductEdits {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const canEdit = canManageProducts(currentWorkspace?.role);

  return useMemo<ProductEdits>(
    () => ({
      canEdit,
      async price(product, variant, next) {
        const saved = await apiClient.updateVariant(workspaceId, variant.id, { priceAmount: majorToMinor(next) });
        patch(product.id, (current) => withVariant(current, variant.id, (was) => ({ ...was, priceAmount: saved.priceAmount, version: saved.version })));
      },
      async stock(product, variant, next) {
        const count = Number(next);
        await catalogBulkUpdateVariants(apiClient, workspaceId, product.id, [{ id: variant.id, stockOnHand: count }]);
        patch(product.id, (current) => withVariant(current, variant.id, (was) => ({ ...was, stockOnHand: count })));
      },
    }),
    [workspaceId, canEdit, patch]
  );
}
