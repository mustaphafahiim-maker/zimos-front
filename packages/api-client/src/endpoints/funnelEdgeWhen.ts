/**
 * Order conditions on a funnel path (backend: frontend-handoff item 376).
 *
 * An edge's `condition` takes an optional `when` next to `type`:
 *   { type: "completed_checkout", when: { productIds: ["…"], maxTotal: 50000, paymentMethods: ["card"] } }
 * At least one key; every key given must hold. productIds / variantIds: up to 50 each, the order
 * holds any of them (either list). minTotal (≥) and maxTotal (<) are whole minor units of the
 * funnel's currency, maxTotal above minTotal. The server checks them against the order the
 * visitor placed in this funnel; before any order exists a `when` never matches.
 * 422 VALIDATION_ERROR on field `condition`; publish and GET /issues name the path
 * (`edges[i].condition` / `edges.<edgeId>.condition`).
 */
export type FunnelEdgePaymentMethod = "cod" | "card" | "wallet" | "valu" | "kiosk" | "paypal" | "bank_transfer" | "on_account";

export const FUNNEL_EDGE_PAYMENT_METHODS: readonly FunnelEdgePaymentMethod[] = [
  "cod",
  "card",
  "wallet",
  "valu",
  "kiosk",
  "paypal",
  "bank_transfer",
  "on_account",
];

/** Most ids one list of a `when` may name. */
export const FUNNEL_EDGE_WHEN_MAX_IDS = 50;

export interface FunnelEdgeWhen {
  productIds?: string[];
  variantIds?: string[];
  minTotal?: number;
  maxTotal?: number;
  paymentMethods?: FunnelEdgePaymentMethod[];
}

const ids = (value: unknown): string[] | undefined => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : undefined);
const amount = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

/** The `when` of an edge's condition as the server sent it; null when it has none. */
export function funnelEdgeWhenOf(condition: unknown): FunnelEdgeWhen | null {
  const raw = (condition as { when?: unknown } | null)?.when;
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const when: FunnelEdgeWhen = {};
  // An imported funnel's lists come over empty: kept, so the path still shows the condition to fill.
  const productIds = ids(source.productIds);
  if (productIds) when.productIds = productIds;
  const variantIds = ids(source.variantIds);
  if (variantIds) when.variantIds = variantIds;
  const minTotal = amount(source.minTotal);
  if (minTotal !== undefined) when.minTotal = minTotal;
  const maxTotal = amount(source.maxTotal);
  if (maxTotal !== undefined) when.maxTotal = maxTotal;
  const methods = ids(source.paymentMethods) as FunnelEdgePaymentMethod[] | undefined;
  if (methods) when.paymentMethods = methods;
  return Object.keys(when).length > 0 ? when : null;
}

/** True when the two say the same thing (key order aside). */
export function funnelEdgeWhenEqual(a: FunnelEdgeWhen | null | undefined, b: FunnelEdgeWhen | null | undefined): boolean {
  const norm = (w: FunnelEdgeWhen | null | undefined) =>
    w && Object.keys(w).length > 0
      ? JSON.stringify([w.productIds ?? null, w.variantIds ?? null, w.minTotal ?? null, w.maxTotal ?? null, w.paymentMethods ?? null])
      : "null";
  return norm(a) === norm(b);
}

/** `{ when }` to spread into a condition payload; nothing when there is none. */
export function funnelEdgeWhenPayload(when: FunnelEdgeWhen | null | undefined): { when?: FunnelEdgeWhen } {
  return when && Object.keys(when).length > 0 ? { when } : {};
}
