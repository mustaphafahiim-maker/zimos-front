/**
 * A dropshipping supplier's own rules on the store's orders (backend: frontend-handoff item 263,
 * src/modules/dropship/supplierRules.js): its shipping rates and its minimum order.
 *
 * Dashboard — PATCH /workspaces/:ws/dropship/providers/:code/settings (apps.manage) also takes
 * `useSupplierShipping` and `enforceMinimum`; GET /dropship/providers returns both with the
 * supplier's other settings.
 *   422 DROPSHIP_NOT_SUPPORTED — the supplier gives no shipping prices / has no minimum. The
 *   list does not say which suppliers can: the refusal is how the screen learns it.
 *   409 DROPSHIP_NOT_CONNECTED — connect the supplier first.
 *
 *   useSupplierShipping: an order whose every product is that supplier's is charged the
 *     supplier's shipping price (the store's free-shipping rules still win; a mixed order keeps
 *     the store's rates). The quote's `rule` is then "supplier_rate".
 *   enforceMinimum: a shopper's order below the supplier's minimum is refused at checkout with
 *     422 BELOW_SUPPLIER_MINIMUM (details = SupplierMinimumGap). Orders typed in by the team
 *     are not refused.
 *
 * Storefront — POST /store/:ws/shipping-quote answers `supplierMinimum`: the same object while
 * the cart is below a supplier's minimum, else null.
 *
 * Amounts are integer minor units, sent as strings.
 */
import { ApiError, type ApiClient } from "../client";
import { apiErrorDetails } from "../errors";
import type { ShippingQuote } from "../types";
import type { DropshipProviderDto } from "./apps";

export interface DropshipSupplierRules {
  useSupplierShipping: boolean;
  enforceMinimum: boolean;
}

export type DropshipSupplierRule = keyof DropshipSupplierRules;

/** The two switches as the supplier list gave them (off for an older server that sends neither). */
export function dropshipRulesOf(provider: DropshipProviderDto): DropshipSupplierRules {
  const p = provider as DropshipProviderDto & Partial<DropshipSupplierRules>;
  return { useSupplierShipping: p.useSupplierShipping === true, enforceMinimum: p.enforceMinimum === true };
}

/** Needs apps.manage (403 otherwise). One switch per call, so a refusal names the switch it is about. */
export async function dropshipSaveRules(
  client: ApiClient,
  workspaceId: string,
  code: string,
  changes: Partial<DropshipSupplierRules>
): Promise<DropshipSupplierRules> {
  const saved = await client.request<Partial<DropshipSupplierRules>>(
    `/workspaces/${workspaceId}/dropship/providers/${encodeURIComponent(code)}/settings`,
    { method: "PATCH", body: changes }
  );
  return { useSupplierShipping: saved.useSupplierShipping === true, enforceMinimum: saved.enforceMinimum === true };
}

/** The supplier cannot do what the switch asks (it gives no shipping prices, or has no minimum). */
export function isDropshipNotSupported(err: unknown): boolean {
  return err instanceof ApiError && err.code === "DROPSHIP_NOT_SUPPORTED";
}

// -------------------------------------------------------------- storefront --

/** How far the cart's lines from one supplier are from that supplier's minimum order. */
export interface SupplierMinimumGap {
  /** The supplier's code. */
  supplier?: string;
  supplierName: string;
  minimumAmount: string;
  /** What the supplier's own lines come to now. */
  linesAmount: string;
  missingAmount: string;
}

function asGap(value: unknown): SupplierMinimumGap | null {
  if (!value || typeof value !== "object") return null;
  const gap = value as Partial<SupplierMinimumGap>;
  if (gap.missingAmount === undefined || gap.missingAmount === null) return null;
  // Nothing missing is no gap at all.
  if (!(Number(gap.missingAmount) > 0)) return null;
  return {
    supplier: typeof gap.supplier === "string" ? gap.supplier : undefined,
    supplierName: typeof gap.supplierName === "string" ? gap.supplierName : "",
    minimumAmount: String(gap.minimumAmount ?? ""),
    linesAmount: String(gap.linesAmount ?? ""),
    missingAmount: String(gap.missingAmount),
  };
}

/** The quote's `supplierMinimum`: the minimum this cart does not reach yet, or null. */
export function supplierMinimumOf(quote: ShippingQuote | null | undefined): SupplierMinimumGap | null {
  return asGap((quote as (ShippingQuote & { supplierMinimum?: unknown }) | null | undefined)?.supplierMinimum);
}

/** The same gap from a checkout refused with 422 BELOW_SUPPLIER_MINIMUM; null for any other error. */
export function belowSupplierMinimum(err: unknown): SupplierMinimumGap | null {
  if (!(err instanceof ApiError) || err.code !== "BELOW_SUPPLIER_MINIMUM") return null;
  return asGap(apiErrorDetails<unknown>(err));
}
