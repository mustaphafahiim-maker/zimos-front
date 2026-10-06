import type { ApiClient } from "../client";
import type { StorefrontPaymentMethod } from "../types";

/**
 * The payment methods a checkout offers, narrowed to a funnel's own list when
 * `funnelId` is given (payment rules → methods per funnel), each with its fee
 * or discount. Same answer as getStorefrontPaymentMethods otherwise.
 *
 * `currency`: what the checkout sells in, when the page knows (a cart's). A
 * gateway that cannot take it is left out, and each fee is the one for that
 * currency. Without it the server uses the funnel's currency, else the store's.
 */
export async function storefrontPaymentMethodsFor(
  client: ApiClient,
  workspaceId: string,
  opts: { funnelId?: string; currency?: string; previewToken?: string } = {}
): Promise<{ methods: StorefrontPaymentMethod[]; preview: boolean; currency?: string }> {
  const params = new URLSearchParams();
  if (opts.funnelId) params.set("funnelId", opts.funnelId);
  if (opts.currency) params.set("currency", opts.currency);
  const qs = params.toString();
  const query = qs ? `?${qs}` : "";
  return client.request<{ methods: StorefrontPaymentMethod[]; preview: boolean; currency?: string }>(`/store/${workspaceId}/payment-methods${query}`, {
    auth: false,
    headers: opts.previewToken ? { "X-Store-Preview": opts.previewToken } : {},
  });
}
