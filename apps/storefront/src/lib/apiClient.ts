import { ApiClient, createMemoryTokenStorage } from "@store-builder/api-client";
import { LOCALE_COOKIE, parseLocale, type Locale } from "./i18n";
import { readStorePreviewCookie } from "./storePreview";
import { readStoreGateCookie } from "./storeGate";

/** The shopper's chosen language from its cookie, for the API's X-Store-Locale. */
function chosenLocale(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
  return parseLocale(match ? decodeURIComponent(match.slice(LOCALE_COOKIE.length + 1)) : null);
}

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

/**
 * The storefront only ever talks to the public `/store/:workspaceId/...`
 * API, which needs no auth — so a fresh in-memory token storage per
 * session is enough. Nothing here ever calls the merchant-auth endpoints.
 *
 * For client components. Server components use
 * createServerStorefrontApiClient (./serverApiClient), which also tells the
 * API which shopper each call is for.
 *
 * `locale`: the page's language, for a client whose errors the shopper reads
 * (the checkout): the API then words them in it even when the shopper never
 * touched the language switch (the store's default language, no cookie).
 */
export function createStorefrontApiClient(opts: { locale?: Locale | null } = {}) {
  // Staff previewing a store the public can't see yet (lib/storePreview).
  const preview = readStorePreviewCookie();
  const locale = opts.locale ?? chosenLocale();
  // A password-locked store this visitor unlocked (lib/storeGate, handoff 197).
  const gate = readStoreGateCookie();
  const defaultHeaders: Record<string, string> = {
    ...(preview ? { "X-Store-Preview": preview } : {}),
    ...(locale ? { "X-Store-Locale": locale } : {}),
    ...(gate ? { "X-Store-Gate": gate } : {}),
  };
  return new ApiClient({
    baseUrl,
    tokenStorage: createMemoryTokenStorage(),
    ...(Object.keys(defaultHeaders).length > 0 ? { defaultHeaders } : {}),
  });
}
