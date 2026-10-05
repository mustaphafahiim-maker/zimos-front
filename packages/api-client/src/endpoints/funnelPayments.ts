import type { ApiClient } from "../client";
import type { StorefrontPaymentMethod } from "../types";

/**
 * The payment methods a checkout offers, narrowed to a funnel's own list when
 * `funnelId` is given (payment rules → methods per funnel), each with its fee
 * or discount. Same answer as getStorefrontPaymentMethods otherwise.
 */
export async function storefrontPaymentMethodsFor(
  client: ApiClient,
  workspaceId: string,
  opts: { funnelId?: string; previewToken?: string } = {}
): Promise<{ methods: StorefrontPaymentMethod[]; preview: boolean }> {
  const query = opts.funnelId ? `?funnelId=${encodeURIComponent(opts.funnelId)}` : "";
  return client.request<{ methods: StorefrontPaymentMethod[]; preview: boolean }>(`/store/${workspaceId}/payment-methods${query}`, {
    auth: false,
    headers: opts.previewToken ? { "X-Store-Preview": opts.previewToken } : {},
  });
}
