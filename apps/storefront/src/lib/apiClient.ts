import { ApiClient, createMemoryTokenStorage } from "@store-builder/api-client";
import { readStorePreviewCookie } from "./storePreview";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

/**
 * The storefront only ever talks to the public `/store/:workspaceId/...`
 * API, which needs no auth — so a fresh in-memory token storage per
 * session is enough. Nothing here ever calls the merchant-auth endpoints.
 *
 * For client components. Server components use
 * createServerStorefrontApiClient (./serverApiClient), which also tells the
 * API which shopper each call is for.
 */
export function createStorefrontApiClient() {
  // Staff previewing a store the public can't see yet (lib/storePreview).
  const preview = readStorePreviewCookie();
  return new ApiClient({
    baseUrl,
    tokenStorage: createMemoryTokenStorage(),
    ...(preview ? { defaultHeaders: { "X-Store-Preview": preview } } : {}),
  });
}
