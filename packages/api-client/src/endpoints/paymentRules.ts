/**
 * Payment rules (backend: src/modules/payments/paymentRulesService.js):
 * a fee or a discount per payment method, the payment methods a funnel
 * offers, and a fresh payment link for an unpaid online order.
 *
 * Mounted at /workspaces/:workspaceId/payment-rules. The rules need
 * workspace.manage; the payment link needs orders.manage. All exported names
 * in this file are prefixed with `paymentRules` / `PaymentRule`.
 *
 * The storefront receives each method's rule on the method itself
 * (`adjustment`, see PaymentRuleOnMethod) and never computes the amount: the
 * server prices it into the order (`order.paymentAdjustmentAmount`, signed,
 * with `order.paymentAdjustmentLabel`).
 */
import type { ApiClient } from "../client";

export type PaymentRuleMethod = "cod" | "card" | "wallet" | "bank_transfer";

export interface PaymentRuleAdjustment {
  method: PaymentRuleMethod;
  type: "fee" | "discount";
  valueType: "fixed" | "percent";
  /** Minor units when `fixed`; basis points (500 = 5%) when `percent`. */
  value: number;
  /** The line's name on the order, e.g. "Cash on delivery fee". */
  label: string | null;
  enabled: boolean;
}

export interface PaymentRules {
  adjustments: PaymentRuleAdjustment[];
  /** funnel id → the payment method ids its checkout offers; a missing funnel offers all. */
  methodsByFunnel: Record<string, string[]>;
  methods: PaymentRuleMethod[];
}

/** What a storefront payment method carries when its method has a rule. */
export interface PaymentRuleOnMethod {
  type: "fee" | "discount";
  valueType: "fixed" | "percent";
  value: number;
  label: string | null;
}

export interface PaymentRuleLink {
  /** Path on the store, with the token: join it to the store's address. */
  path: string;
  expiresAt: string;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/payment-rules`;

export async function paymentRulesGet(client: ApiClient, workspaceId: string): Promise<PaymentRules> {
  const { rules } = await client.request<{ rules: PaymentRules }>(base(workspaceId));
  return rules;
}

/** Each key replaces its whole list/map; omit a key to leave it as it is. */
export async function paymentRulesSave(
  client: ApiClient,
  workspaceId: string,
  payload: { adjustments?: PaymentRuleAdjustment[]; methodsByFunnel?: Record<string, string[]> }
): Promise<PaymentRules> {
  const { rules } = await client.request<{ rules: PaymentRules }>(base(workspaceId), { method: "PUT", body: payload });
  return rules;
}

/**
 * A new "pay now" link for an order paid by card or wallet that is still
 * unpaid. Any earlier link for the order stops working. Codes:
 * NOT_AN_ONLINE_ORDER (422), ORDER_ALREADY_PAID (409), ORDER_CANCELLED (409).
 */
export async function paymentRulesCreateLink(client: ApiClient, workspaceId: string, orderId: string): Promise<PaymentRuleLink> {
  const { link } = await client.request<{ link: PaymentRuleLink }>(`${base(workspaceId)}/orders/${orderId}/payment-link`, {
    method: "POST",
  });
  return link;
}
