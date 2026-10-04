/**
 * Currencies (backend: src/modules/currencies): the store's display
 * currencies and the exchange rates behind them.
 *
 * Staff side at /workspaces/:workspaceId/currencies — any member reads,
 * workspace.manage writes. Shopper side at /store/:workspaceId/currencies.
 * All exported names in this file are prefixed with `currencies` / `Currency`.
 *
 * A rate is "units of the other currency per 1 unit of the store's base
 * currency". Converted prices are for display only: orders are always created
 * and collected in the store's own currency. With the sandbox rates provider
 * the numbers are placeholders, not market rates.
 */
import type { ApiClient } from "../client";

export interface CurrencySettings {
  /** Extra currencies shoppers can view prices in. */
  display: string[];
  /** Show each visitor their own currency when it is one of `display`. */
  autoConvert: boolean;
  /** Offer every currency that has a rate, not just `display`. */
  useAll: boolean;
  symbolPosition: "auto" | "before" | "after";
  decimals: "auto" | "always" | "never";
}

export interface CurrencyDashboard {
  baseCurrency: string;
  /** True once the store has an order: the account currency can no longer change. */
  baseCurrencyLocked: boolean;
  settings: CurrencySettings;
  /** quote → units per 1 base, for the display currencies. */
  rates: Record<string, number>;
  ratesFetchedAt: string | null;
  availableCurrencies: string[];
  /** "sandbox" until a real rates provider is configured. */
  provider: string;
}

export interface CurrencyStorefront {
  baseCurrency: string;
  displayCurrencies: string[];
  rates: Record<string, number>;
  autoConvert: boolean;
  symbolPosition: CurrencySettings["symbolPosition"];
  decimals: CurrencySettings["decimals"];
  ratesFetchedAt: string | null;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/currencies`;

export async function currenciesGet(client: ApiClient, workspaceId: string): Promise<CurrencyDashboard> {
  const { currencies } = await client.request<{ currencies: CurrencyDashboard }>(base(workspaceId));
  return currencies;
}

export async function currenciesSave(
  client: ApiClient,
  workspaceId: string,
  payload: Partial<CurrencySettings>
): Promise<CurrencyDashboard> {
  const { currencies } = await client.request<{ currencies: CurrencyDashboard }>(base(workspaceId), { method: "PUT", body: payload });
  return currencies;
}

export async function currenciesRefreshRates(client: ApiClient, workspaceId: string): Promise<CurrencyDashboard> {
  const { currencies } = await client.request<{ currencies: CurrencyDashboard }>(`${base(workspaceId)}/refresh`, { method: "POST" });
  return currencies;
}

export async function currenciesGetForStore(client: ApiClient, workspaceId: string): Promise<CurrencyStorefront> {
  const { currencies } = await client.request<{ currencies: CurrencyStorefront }>(`/store/${workspaceId}/currencies`, { auth: false });
  return currencies;
}

/**
 * The store's own currency, until its first order (currencies/baseCurrency.js).
 * Every variant and offer moves to it with the same amounts; 409
 * BASE_CURRENCY_LOCKED once the store has an order.
 */
export async function currenciesSetBase(client: ApiClient, workspaceId: string, currency: string): Promise<CurrencyDashboard> {
  const { currencies } = await client.request<{ currencies: CurrencyDashboard }>(`${base(workspaceId)}/base`, { method: "PUT", body: { currency } });
  return currencies;
}
