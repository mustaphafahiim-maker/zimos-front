import { ApiClient } from "@store-builder/api-client";
import { draftRefusal, holdForGoLive } from "@/lib/goLive";
import { getLocale } from "@/i18n/LocaleContext";

/** Base URL every API call is built on. Exported so non-ApiClient flows (e.g.
 * the Google OAuth redirect) can hit the same backend. */
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

/**
 * Headers on every call. Accept-Language follows the dashboard's language at
 * the moment of the request (a getter, read on each call), so server messages
 * for codes the dashboard does not map come back in Arabic too.
 */
const defaultHeaders: Record<string, string> = {
  get "Accept-Language"() {
    return getLocale() === "ar" ? "ar-EG,ar;q=0.9,en;q=0.5" : "en";
  },
};

export const apiClient = new ApiClient({
  baseUrl: apiBaseUrl,
  defaultHeaders,
  onSessionExpired: () => {
    // Full reload so every in-flight auth state resets cleanly. The login page
    // says why (?expired=1) and brings the merchant back to this page (?next=).
    if (window.location.pathname !== "/login") {
      const next = window.location.pathname + window.location.search;
      window.location.href = `/login?expired=1&next=${encodeURIComponent(next)}`;
    }
  },
});

// A draft store's refusal (403 SUBSCRIPTION_REQUIRED, details.draft) opens the
// subscribe dialog and waits on it: going live there sends the request again
// (lib/goLive). Every typed method goes through `request`, so this covers all.
const send = apiClient.request.bind(apiClient);
apiClient.request = async function request<T>(path: string, opts?: Parameters<typeof send>[1]): Promise<T> {
  try {
    return await send<T>(path, opts);
  } catch (err) {
    const refusal = draftRefusal(err);
    if (!refusal) throw err;
    return holdForGoLive(err, refusal, () => send<T>(path, opts));
  }
};
