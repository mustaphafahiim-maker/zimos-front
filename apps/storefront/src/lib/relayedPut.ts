import { ApiClient, createMemoryTokenStorage } from "@store-builder/api-client";
import type { Locale } from "./i18n";
import { readStoreGateCookie } from "./storeGate";
import { readStorePreviewCookie } from "./storePreview";

/**
 * A PUT to the storefront API from the browser, sent through the store's own
 * server.
 *
 * The API's CORS policy for /api/v1/store does not allow PUT, so the browser
 * refuses to send one to the API itself. This sends it to the store's own
 * origin instead, where app/store/[workspaceId]/api-put/[...path]/route.ts
 * forwards it to PUT /store/:workspaceId/<path> and hands the API's answer
 * back unchanged:
 *
 *   const basePath = useStoreBasePath();
 *   const saved = await relayedPut<Saved>({
 *     basePath,
 *     path: "account/business",
 *     body,
 *     headers: { "X-Shopper-Token": token },
 *     locale,
 *   });
 *
 * `path` is what follows /store/:workspaceId/ in the API's address, and must
 * be one of the shapes the relay lists (ALLOWED in that route file — add
 * yours there). The answer is the API's own, and so is a refusal: it is
 * thrown as an ApiError with the API's status, code and details, exactly as
 * `client.request` would throw it.
 *
 * Browser only. Once the API allows PUT from the storefront, a caller can
 * go back to the API client and drop this.
 */
export function relayedPut<T>({
  basePath,
  path,
  body,
  headers,
  locale,
}: {
  /** The store's link prefix (useStoreBasePath): empty on the store's own domain. */
  basePath: string;
  path: string;
  body?: unknown;
  /** The call's own headers the API reads: X-Shopper-Token, X-Payment-Token. */
  headers?: Record<string, string>;
  /** The page's language, so the API words its errors in it. */
  locale?: Locale | null;
}): Promise<T> {
  // What every store call of this browser carries (lib/apiClient): a staff preview, a password unlock.
  const preview = readStorePreviewCookie();
  const gate = readStoreGateCookie();
  const client = new ApiClient({
    baseUrl: `${window.location.origin}${basePath}/api-put`,
    tokenStorage: createMemoryTokenStorage(),
    defaultHeaders: {
      ...(preview ? { "X-Store-Preview": preview } : {}),
      ...(locale ? { "X-Store-Locale": locale } : {}),
      ...(gate ? { "X-Store-Gate": gate } : {}),
    },
  });
  return client.request<T>(`/${path.replace(/^\/+/, "")}`, { method: "PUT", auth: false, body, headers });
}
