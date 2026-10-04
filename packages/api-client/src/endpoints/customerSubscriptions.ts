/**
 * Customer subscriptions and installments (backend: src/modules/subscriptions).
 * Not the store's own ZIMOS plan — that is billing.
 *
 * Staff routes: /workspaces/:workspaceId/subscriptions (orders.view /
 * orders.manage; product plans need products.view / products.manage). The
 * customer's portal is public at /store/:workspaceId/subscriptions/:token.
 *
 * Notable codes: SUBSCRIPTION_ENDED (409), SUBSCRIPTION_NO_CARD (409),
 * SUBSCRIPTION_NOT_CANCELLABLE (409). The store's checkout answers
 * PLAN_NEEDS_SAVED_CARD (422) for a product on a plan paid any other way than a
 * card that can be saved (also on a payment retry and a switch to cash on delivery).
 */
import type { ApiClient } from "../client";

export type BillingInterval = "week" | "month" | "year";

/** How a product is paid for. The variant's price is what each payment charges. */
export type ProductBillingPlan =
  /** trialDays: days free before the first charge (the first order charges nothing for it). */
  | { mode: "subscription"; interval: BillingInterval; intervalCount?: number; trialDays?: number }
  | { mode: "installments"; interval: BillingInterval; intervalCount?: number; payments: number };

/** A public product's plan (GET /store/:id/products…: `billingPlan`, null when sold once). */
export function billingPlanOf(product: object): ProductBillingPlan | null {
  const plan = (product as { billingPlan?: ProductBillingPlan | null }).billingPlan;
  return plan && plan.mode ? plan : null;
}

export interface ProductPlanRow {
  id: string;
  name: string;
  status: string;
  productType: string;
  /** null = sold once. */
  billingPlan: ProductBillingPlan | null;
}

export type CustomerSubscriptionStatus = "trialing" | "active" | "past_due" | "paused" | "cancelled" | "completed";

export interface CustomerSubscription {
  id: string;
  customerId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  productId: string | null;
  productName: string;
  quantity: number;
  /** The order that started it. */
  orderId: string;
  lastOrderId: string | null;
  kind: "subscription" | "installments";
  status: CustomerSubscriptionStatus;
  interval: BillingInterval;
  intervalCount: number;
  /** Charged each period, minor units. */
  amount: string;
  currency: string;
  hasCard: boolean;
  currentPeriodEnd: string;
  /** When the next charge is tried; null when nothing is scheduled. */
  nextRenewalAt: string | null;
  paymentsMade: number;
  installmentsTotal: number | null;
  installmentsRemaining: number | null;
  failedAttempts: number;
  lastFailureReason: string | null;
  cancelledAt: string | null;
  /** The customer's portal is /subscriptions/<token> on the storefront. */
  portalToken: string;
  createdAt: string;
}

export interface SubscriptionsOverview {
  currency: string;
  total: number;
  /** On a free trial (not charged yet). */
  trialing: number;
  active: number;
  pastDue: number;
  paused: number;
  cancelled: number;
  completed: number;
  newThisMonth: number;
  /** What the active ones charge per period, added up. */
  activeAmount: string;
  /** Paid on first orders and renewals. */
  revenue: string;
  topProducts: { productName: string; subscriptions: number }[];
}

/** The customer's view in the portal. */
export interface SubscriptionPortal {
  productName: string;
  kind: "subscription" | "installments";
  status: CustomerSubscriptionStatus;
  interval: BillingInterval;
  intervalCount: number;
  amount: string;
  currency: string;
  nextRenewalAt: string | null;
  currentPeriodEnd: string;
  paymentsMade: number;
  installmentsTotal: number | null;
  installmentsRemaining: number | null;
  canCancel: boolean;
  /** The card renewals are charged to; null when there is none. */
  card?: { brand: string | null; last4: string | null; expiresAt: string | null } | null;
  /** The customer may replace the card on the payment provider's page. */
  canUpdateCard?: boolean;
}

const subscriptionsBase = (workspaceId: string) => `/workspaces/${workspaceId}/subscriptions`;

export async function customerSubscriptionsList(
  client: ApiClient,
  workspaceId: string,
  params: { status?: CustomerSubscriptionStatus; kind?: "subscription" | "installments"; limit?: number } = {}
): Promise<CustomerSubscription[]> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value));
  const query = search.toString();
  const { subscriptions } = await client.request<{ subscriptions: CustomerSubscription[] }>(`${subscriptionsBase(workspaceId)}${query ? `?${query}` : ""}`);
  return subscriptions;
}

export async function customerSubscriptionsOverview(client: ApiClient, workspaceId: string): Promise<SubscriptionsOverview> {
  return client.request<SubscriptionsOverview>(`${subscriptionsBase(workspaceId)}/overview`);
}

export async function customerSubscriptionsChangeStatus(
  client: ApiClient,
  workspaceId: string,
  subscriptionId: string,
  action: "pause" | "resume" | "cancel"
): Promise<CustomerSubscription> {
  const { subscription } = await client.request<{ subscription: CustomerSubscription }>(`${subscriptionsBase(workspaceId)}/${subscriptionId}/status`, {
    method: "POST",
    body: { action },
  });
  return subscription;
}

export async function productPlansList(client: ApiClient, workspaceId: string): Promise<ProductPlanRow[]> {
  const { products } = await client.request<{ products: ProductPlanRow[] }>(`${subscriptionsBase(workspaceId)}/plans`);
  return products;
}

/** `plan` null puts the product back to "sold once". */
export async function productPlanSet(client: ApiClient, workspaceId: string, productId: string, plan: ProductBillingPlan | null): Promise<void> {
  await client.request<unknown>(`${subscriptionsBase(workspaceId)}/plans/${productId}`, { method: "PUT", body: { plan } });
}

export async function subscriptionPortalGet(client: ApiClient, workspaceRef: string, token: string): Promise<SubscriptionPortal> {
  const { subscription } = await client.request<{ subscription: SubscriptionPortal }>(`/store/${workspaceRef}/subscriptions/${token}`, { auth: false });
  return subscription;
}

/**
 * Starts a card update from the portal: send the customer to `redirectUrl`.
 * `returnUrl` is the portal page; the provider sends them back to it with
 * its answer in the query string, for subscriptionPortalCardReturn.
 * Codes: SUBSCRIPTION_ENDED (409), CARD_SETUP_NOT_SUPPORTED (422).
 */
export async function subscriptionPortalCardStart(client: ApiClient, workspaceRef: string, token: string, returnUrl: string): Promise<{ redirectUrl: string }> {
  return client.request<{ redirectUrl: string }>(`/store/${workspaceRef}/subscriptions/${token}/card`, { method: "POST", body: { returnUrl }, auth: false });
}

/**
 * Back from the provider's page. A subscription waiting on a failed renewal
 * is charged on the new card at once (`renewal`: "renewed", "past_due", …).
 * Codes: CARD_NOT_SAVED (422), CARD_SETUP_NOT_STARTED (409).
 */
export async function subscriptionPortalCardReturn(
  client: ApiClient,
  workspaceRef: string,
  token: string,
  query: Record<string, string>
): Promise<{ subscription: SubscriptionPortal; renewal: string | null }> {
  return client.request<{ subscription: SubscriptionPortal; renewal: string | null }>(`/store/${workspaceRef}/subscriptions/${token}/card/return`, {
    method: "POST",
    body: { query },
    auth: false,
  });
}

export async function subscriptionPortalCancel(client: ApiClient, workspaceRef: string, token: string): Promise<SubscriptionPortal> {
  const { subscription } = await client.request<{ subscription: SubscriptionPortal }>(`/store/${workspaceRef}/subscriptions/${token}/cancel`, {
    method: "POST",
    body: {},
    auth: false,
  });
  return subscription;
}
