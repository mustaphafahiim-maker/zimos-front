import { ApiClient } from "@store-builder/api-client";
import { draftRefusal, holdForGoLive } from "@/lib/goLive";

/** Base URL every API call is built on. Exported so non-ApiClient flows (e.g.
 * the Google OAuth redirect) can hit the same backend. */
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

export const apiClient = new ApiClient({
  baseUrl: apiBaseUrl,
  onSessionExpired: () => {
    // Full reload so every in-flight auth state resets cleanly.
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
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
