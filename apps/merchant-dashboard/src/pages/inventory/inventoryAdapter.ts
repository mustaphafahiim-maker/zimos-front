import type { Product, Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { variantLabel } from "@/lib/format";

/* ------------------------------------------------------------------ DTOs --
 * Mirrors src/modules/inventory/inventoryController.js in the backend.
 * Mounted at /api/v1/workspaces/:workspaceId/inventory.
 */

/** GET /inventory/:variantId */
export interface StockLevelDto {
  variantId: string;
  stockOnHand: number;
  reservedStock: number;
  availableStock: number;
}

/** POST /inventory/:variantId/adjust and /restock */
export interface StockMutationDto {
  variantId: string;
  stockOnHand: number;
  reservedStock: number;
}

/** Joi: delta integer, != 0, required; reason string <= 300, required. */
export interface AdjustStockBody {
  delta: number;
  reason: string;
}

/** Joi: quantity integer >= 1, required; reason string <= 300, optional. */
export interface RestockBody {
  quantity: number;
  reason?: string;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/inventory`;

export function getStock(workspaceId: string, variantId: string) {
  return apiClient.request<StockLevelDto>(`${base(workspaceId)}/${variantId}`);
}

export function adjustStock(workspaceId: string, variantId: string, body: AdjustStockBody) {
  return apiClient.request<StockMutationDto>(`${base(workspaceId)}/${variantId}/adjust`, { method: "POST", body });
}

export function restockVariant(workspaceId: string, variantId: string, body: RestockBody) {
  return apiClient.request<StockMutationDto>(`${base(workspaceId)}/${variantId}/restock`, { method: "POST", body });
}

/* ------------------------------------------------------------- View rows -- */

export interface InventoryItem {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  sku: string | null;
  onHand: number;
  reserved: number;
  available: number;
  /** Minor units; null when the variant has no cost recorded. */
  costAmount: number | null;
  currency: string;
  lowStockThreshold: number;
}

export const DEFAULT_LOW_STOCK_THRESHOLD = 10;

/** Saves the variant's low-stock threshold on the server (null = default). */
export async function writeThreshold(workspaceId: string, variantId: string, value: number | null): Promise<void> {
  await apiClient.request(`/workspaces/${workspaceId}/catalog/variants/${variantId}`, { method: "PATCH", body: { lowStockThreshold: value } });
}

function toItem(product: Product, v: Variant): InventoryItem {
  const onHand = Number(v.stockOnHand) || 0;
  const reserved = Number(v.reservedStock) || 0;
  const cost = v.costAmount === null || v.costAmount === undefined || v.costAmount === "" ? null : Number(v.costAmount);
  return {
    variantId: v.id,
    productId: product.id,
    productName: product.name,
    variantLabel: variantLabel(v),
    sku: v.sku ?? null,
    onHand,
    reserved,
    available: onHand - reserved,
    costAmount: cost !== null && Number.isFinite(cost) ? cost : null,
    currency: v.currency || "EGP",
    lowStockThreshold: (v as { lowStockThreshold?: number | null }).lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
  };
}

/** Every variant of every active + draft product, following the catalog cursor. */
export async function listInventoryItems(workspaceId: string): Promise<InventoryItem[]> {
  const items: InventoryItem[] = [];
  for (const status of ["active", "draft"] as const) {
    let cursor: string | undefined;
    // Hard stop guards against a server that keeps returning the same cursor.
    for (let page = 0; page < 200; page++) {
      const res = await apiClient.listProducts(workspaceId, { status, limit: 100, cursor });
      for (const p of res.products) {
        for (const v of p.variants ?? []) {
          if ((v as { status?: string }).status === "archived") continue;
          items.push(toItem(p, v));
        }
      }
      if (!res.nextCursor || res.nextCursor === cursor) break;
      cursor = res.nextCursor;
    }
  }
  return items;
}

/** Merge a fresh GET /inventory/:variantId into an existing row. */
export function applyStockLevel(item: InventoryItem, level: StockLevelDto): InventoryItem {
  return {
    ...item,
    onHand: level.stockOnHand,
    reserved: level.reservedStock,
    available: level.availableStock ?? level.stockOnHand - level.reservedStock,
  };
}
