/**
 * The store's display currencies (backend: currencies/fxService.getForStorefront,
 * GET /store/:ws/currencies, public). For showing approximate prices only:
 * orders are always charged in the price's own currency.
 */
import type { ApiClient } from "../client";

export interface StorefrontCurrencies {
  baseCurrency: string;
  /** The other currencies a shopper may view prices in. */
  displayCurrencies: string[];
  /** Units of each display currency per one unit of the base currency. */
  rates: Record<string, number>;
  /** Pick the visitor's own currency on their first visit, when it is on the list. */
  autoConvert: boolean;
  symbolPosition?: string;
  decimals?: string;
  ratesFetchedAt: string | null;
}

export async function storefrontCurrencies(client: ApiClient, workspaceRef: string): Promise<StorefrontCurrencies> {
  const { currencies } = await client.request<{ currencies: StorefrontCurrencies }>(`/store/${encodeURIComponent(workspaceRef)}/currencies`);
  return currencies;
}
