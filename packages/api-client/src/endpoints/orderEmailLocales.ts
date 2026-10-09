/**
 * Order emails per language (backend: frontend-handoff item 383,
 * notifications/orderEmailLocales.js). Orders remember the language the
 * shopper used the store in, and the customer's emails go out in it.
 *
 * The same routes as endpoints/orderEmailDesign.ts with `?locale=<ar|en|fr…>`,
 * which combines with `?funnelId=` / `?websiteId=`:
 *   GET    /order-emails?locale=en          → OrderEmailLocaleList
 *   PUT    /order-emails/:key?locale=en     saves that language's version; a field left
 *                                           empty uses the built-in text in that language
 *                                           (else the default version's). `isEnabled` here
 *                                           switches the whole email: one switch per email.
 *   DELETE /order-emails/:key?locale=en     removes that language's version (404 when none).
 *   POST   /order-emails/:key/preview|test?locale=en
 * Without `locale` (or with the store's own language) it is the default version.
 * A language the store does not offer → 422 VALIDATION_ERROR on `locale`.
 */
import type { ApiClient } from "../client";
import type { OrderEmailKey, OrderEmailPreview } from "./orderEmails";
import type { EmailBlock, OrderEmailDesignDraft, OrderEmailDesignList, OrderEmailDesignTemplate, OrderEmailScope } from "./orderEmailDesign";

/**
 * default  = the default version (the store's own language);
 * language = this language has its own version;
 * fallback = none yet: what is shown is what goes out today.
 */
export type OrderEmailVersion = "default" | "language" | "fallback";

export type OrderEmailLocaleTemplate = OrderEmailDesignTemplate & {
  /** The language shown. */
  locale?: string;
  version?: OrderEmailVersion;
  /** The language the shown text is written in ("ar" when an English tab falls back to an Arabic default). */
  textLocale?: string;
};

export interface OrderEmailLocaleList extends OrderEmailDesignList {
  templates: OrderEmailLocaleTemplate[];
  locale?: string;
  defaultLocale?: string;
  /** The store's languages, for the tabs. */
  languages?: string[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/order-emails`;

function query(scope?: OrderEmailScope, locale?: string | null): string {
  const params = new URLSearchParams();
  if (scope?.funnelId) params.set("funnelId", scope.funnelId);
  else if (scope?.websiteId) params.set("websiteId", scope.websiteId);
  if (locale) params.set("locale", locale);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function orderEmailLocaleList(client: ApiClient, workspaceId: string, scope?: OrderEmailScope, locale?: string | null): Promise<OrderEmailLocaleList> {
  return client.request<OrderEmailLocaleList>(`${base(workspaceId)}${query(scope, locale)}`);
}

export async function orderEmailLocaleSave(
  client: ApiClient,
  workspaceId: string,
  key: OrderEmailKey,
  patch: { isEnabled?: boolean; subject?: string | null; body?: string | null; blocks?: EmailBlock[] | null },
  scope?: OrderEmailScope,
  locale?: string | null
): Promise<OrderEmailLocaleTemplate> {
  const { template } = await client.request<{ template: OrderEmailLocaleTemplate }>(`${base(workspaceId)}/${key}${query(scope, locale)}`, { method: "PUT", body: patch });
  return template;
}

/** Removes a language's version: customers shopping in it get the default version again. Answers the template as it now goes out. */
export async function orderEmailLocaleRemove(client: ApiClient, workspaceId: string, key: OrderEmailKey, locale: string, scope?: OrderEmailScope): Promise<OrderEmailLocaleTemplate> {
  const { template } = await client.request<{ template: OrderEmailLocaleTemplate }>(`${base(workspaceId)}/${key}${query(scope, locale)}`, { method: "DELETE" });
  return template;
}

export function orderEmailLocalePreview(
  client: ApiClient,
  workspaceId: string,
  key: OrderEmailKey,
  draft: OrderEmailDesignDraft = {},
  scope?: OrderEmailScope,
  locale?: string | null
): Promise<OrderEmailPreview> {
  return client.request<OrderEmailPreview>(`${base(workspaceId)}/${key}/preview${query(scope, locale)}`, { method: "POST", body: draft });
}

export function orderEmailLocaleSendTest(
  client: ApiClient,
  workspaceId: string,
  key: OrderEmailKey,
  draft: OrderEmailDesignDraft & { to?: string } = {},
  scope?: OrderEmailScope,
  locale?: string | null
): Promise<{ ok: boolean; error: string | null; to: string }> {
  return client.request(`${base(workspaceId)}/${key}/test${query(scope, locale)}`, { method: "POST", body: draft });
}
