import type { ShopperBusiness } from "@store-builder/api-client";
import type { Locale } from "@/lib/i18n";
import { relayedPut } from "@/lib/relayedPut";
import type { ShopperApi } from "@/lib/shopperSession";

/**
 * The one place the shopper's company details are saved from (handoff 228:
 * PUT /store/:ws/account/business with the shopper's token).
 *
 * The API's storefront CORS policy allows GET, POST, PATCH and DELETE but not
 * PUT (backend core/middleware/cors.js), so a browser on the store's own
 * address cannot send this request straight to the API: its preflight is
 * refused. It goes through the store's own same-origin relay instead
 * (lib/relayedPut.ts → app/store/[workspaceId]/api-put), which answers and
 * throws exactly as the API does. Once the API allows PUT, the call below can
 * go back to `shopperBusinessSave(client, storeId, token, body)`.
 *
 * `api.call` supplies the current token, and drops it on a 401 so the account
 * falls back to the sign-in.
 */
export function saveCompanyDetails(
  api: ShopperApi,
  store: { basePath: string; locale: Locale },
  body: { companyName: string; taxId: string }
): Promise<ShopperBusiness> {
  return api.call((_client, _storeId, token) =>
    relayedPut<ShopperBusiness>({
      basePath: store.basePath,
      path: "account/business",
      body,
      headers: { "X-Shopper-Token": token },
      locale: store.locale,
    })
  );
}
